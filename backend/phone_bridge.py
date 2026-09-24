"""Token-protected, loopback-only bridge to the existing validated local API."""
import asyncio
from collections import deque
import hmac
import json
import os
from time import monotonic

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.requests import ClientDisconnect


MAX_BODY_BYTES = 64 * 1024
TEACHING_PATHS = {"/api/interpret-teaching", "/api/analyze-teaching"}
UPSTREAM = "http://127.0.0.1:8000"
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
_post_times: deque[float] = deque()
_active_upstream = 0


def error(status: int, detail: str) -> JSONResponse:
    return JSONResponse({"detail": detail}, status_code=status)


@app.middleware("http")
async def authenticate(request: Request, call_next):
    expected = os.environ.get("FORMA_PHONE_BRIDGE_TOKEN", "")
    supplied = request.headers.getlist("x-forma-bridge-token")
    if not expected:
        response = error(503, "Phone bridge is not configured.")
    elif len(supplied) != 1 or not hmac.compare_digest(supplied[0].encode(), expected.encode()):
        response = error(401, "Phone bridge authentication required.")
    elif request.scope.get("query_string"):
        response = error(400, "Query strings are not supported.")
    else:
        limited = False
        if request.method == "POST" and request.url.path in TEACHING_PATHS:
            now = monotonic()
            while _post_times and _post_times[0] <= now - 60:
                _post_times.popleft()
            limited = len(_post_times) >= 30
            if not limited:
                _post_times.append(now)
        if limited:
            response = error(429, "Phone teaching requests are limited to 30 per minute. Try again shortly.")
            response.headers["Retry-After"] = "60"
        else:
            response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


async def forward(method: str, path: str, body: bytes = b"") -> JSONResponse:
    global _active_upstream
    # Run one Uvicorn worker: these checks occur before any await, so they are
    # shared and atomic across requests on its event loop.
    if _active_upstream >= 2:
        return error(429, "Two phone requests are already running. Try again shortly.")
    _active_upstream += 1
    try:
        # Ignore proxy environment variables and redirects. The target is fixed.
        async with httpx.AsyncClient(timeout=23, trust_env=False, follow_redirects=False) as client:
            response = await asyncio.wait_for(client.request(
                method, UPSTREAM + path, content=body,
                headers={"Content-Type": "application/json"} if method == "POST" else {},
            ), timeout=23)
    except (httpx.HTTPError, asyncio.TimeoutError):
        return error(502, "The local AI backend is unavailable. Try again shortly.")
    finally:
        _active_upstream -= 1
    if response.status_code >= 500 or 300 <= response.status_code < 400:
        return error(503 if response.status_code == 503 else 502, "The local AI backend could not complete this request.")
    if len(response.content) > MAX_BODY_BYTES:
        return error(502, "The local AI backend returned an invalid response.")
    try:
        payload = response.json()
    except (ValueError, UnicodeError):
        return error(502, "The local AI backend returned an invalid response.")
    if not isinstance(payload, dict):
        return error(502, "The local AI backend returned an invalid response.")
    if response.status_code >= 400:
        # Only the fixed local app's bounded validation message can pass through.
        # Provider errors and arbitrary upstream bodies use our own messages.
        detail = payload.get("detail")
        if response.status_code == 422 and set(payload) == {"detail"} and isinstance(detail, str) and 0 < len(detail) <= 600:
            return error(422, detail)
        if response.status_code == 402:
            return error(402, "The AI provider needs available API credits.")
        if response.status_code == 429:
            return error(429, "The AI provider is rate limiting requests or has no available quota. Try local commands.")
        return error(response.status_code, "The local AI backend rejected this request.")
    return JSONResponse(payload)


@app.get("/health")
async def health():
    return await forward("GET", "/health")


@app.post("/api/interpret-teaching")
@app.post("/api/analyze-teaching")
async def interpret(request: Request):
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        return error(415, "Use application/json for teaching requests.")
    if request.headers.get("content-encoding", "identity").lower() != "identity":
        return error(415, "Compressed teaching requests are not supported.")
    data = bytearray()
    try:
        async for chunk in request.stream():
            if len(data) + len(chunk) > MAX_BODY_BYTES:
                return error(413, "Teaching request exceeds the 64 KiB limit.")
            data.extend(chunk)
    except ClientDisconnect:
        return error(400, "Teaching request was interrupted.")
    try:
        if not isinstance(json.loads(data), dict):
            return error(400, "Supply a JSON request object.")
    except (ValueError, UnicodeError):
        return error(400, "Supply a valid JSON request object.")
    # Both allowlisted routes retain the backend's complete validation.
    return await forward("POST", request.url.path, bytes(data))
