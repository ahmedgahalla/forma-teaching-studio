"""Tie asynchronous AI work to one consumed HTTP request and total deadline."""
import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

import anyio
from fastapi import HTTPException, Request


T = TypeVar("T")


async def _disconnected(request: Request) -> None:
    # Call only after the route has consumed its body. A single blocking receiver
    # also works through BaseHTTPMiddleware, unlike cancellation-based polling.
    while True:
        if (await request.receive())["type"] == "http.disconnect":
            return


async def run_ai_request(
    request: Request,
    operation: Callable[[float], Awaitable[T]],
    *,
    timeout: float,
    timeout_detail: str,
) -> T:
    deadline = asyncio.get_running_loop().time() + timeout
    disconnected = asyncio.create_task(_disconnected(request))
    work = asyncio.create_task(operation(deadline))
    try:
        async with asyncio.timeout_at(deadline):
            await asyncio.wait((work, disconnected), return_when=asyncio.FIRST_COMPLETED)
            # Let an already-ready disconnect receiver finish before publishing.
            await asyncio.sleep(0)
            if disconnected.done():
                disconnected.result()
                raise HTTPException(499, "The teaching request was cancelled.")
            return await work
    except TimeoutError:
        raise HTTPException(502, timeout_detail) from None
    finally:
        for task in (work, disconnected):
            if not task.done():
                task.cancel()
        # Middleware cancellation scopes must not interrupt client-close cleanup.
        with anyio.CancelScope(shield=True):
            await asyncio.gather(work, disconnected, return_exceptions=True)
