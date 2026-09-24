"""The phone bridge never weakens or reimplements the local interpreter contract."""
import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

import phone_bridge


TOKEN = "bridge-unit-test-only"
AUTH = {"X-Forma-Bridge-Token": TOKEN}


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("FORMA_PHONE_BRIDGE_TOKEN", TOKEN)
    phone_bridge._post_times.clear()
    monkeypatch.setattr(phone_bridge, "_active_upstream", 0)
    requests, options = [], []
    reply = {"status": 200, "json": {"status": "ok", "ai_enabled": True}}
    original = httpx.AsyncClient

    def handler(request):
        requests.append(request)
        if "exception" in reply:
            raise reply["exception"]
        return httpx.Response(reply["status"], json=reply["json"])

    def factory(**kwargs):
        options.append(kwargs)
        return original(**kwargs, transport=httpx.MockTransport(handler))

    monkeypatch.setattr(phone_bridge.httpx, "AsyncClient", factory)
    return TestClient(phone_bridge.app), requests, options, reply


@pytest.mark.parametrize("headers", [{}, {"X-Forma-Bridge-Token": "wrong"}, {"Authorization": f"Bearer {TOKEN}"}])
def test_authentication_precedes_proxy_and_does_not_echo_credentials(setup, headers):
    client, requests, _, _ = setup
    response = client.post("/api/interpret-teaching", headers=headers, json={"text": "show roots"})
    assert response.status_code == 401
    assert TOKEN not in response.text and "wrong" not in response.text
    assert response.headers["cache-control"] == "no-store"
    assert not requests


def test_missing_configuration_and_duplicate_credentials_fail_closed(setup, monkeypatch):
    client, requests, _, _ = setup
    response = client.get("/health", headers=[("X-Forma-Bridge-Token", TOKEN), ("X-Forma-Bridge-Token", TOKEN)])
    assert response.status_code == 401
    monkeypatch.delenv("FORMA_PHONE_BRIDGE_TOKEN")
    assert client.get("/health", headers=AUTH).status_code == 503
    assert not requests


@pytest.mark.parametrize("path", ["/docs", "/openapi.json", "/api/interpret", "/unknown"])
def test_unknown_routes_never_proxy(setup, path):
    client, requests, _, _ = setup
    assert client.get(path).status_code == 401
    assert client.get(path, headers=AUTH).status_code == 404
    assert not requests


def test_health_uses_only_fixed_loopback_target_and_no_incoming_headers(setup):
    client, requests, options, reply = setup
    response = client.get("/health", headers={**AUTH, "Cookie": "session=private", "Authorization": "Bearer private"})
    assert response.status_code == 200 and response.json() == reply["json"]
    assert str(requests[0].url) == "http://127.0.0.1:8000/health"
    assert requests[0].method == "GET"
    assert not {"cookie", "authorization", "x-forma-bridge-token"} & set(requests[0].headers)
    assert options == [{"timeout": 23, "trust_env": False, "follow_redirects": False}]


def test_post_preserves_body_for_full_backend_validation_without_forwarding_headers(setup):
    client, requests, _, reply = setup
    plan = {"actions": [], "summary": "", "clarification": "Choose an explicit movement amount."}
    reply["json"] = plan
    body = json.dumps({"text": "move them buccally", "context": {"selectedIds": ["11", "21"]}}).encode()
    response = client.post("/api/interpret-teaching", content=body, headers={**AUTH, "Content-Type": "application/json; charset=utf-8", "Cookie": "private", "X-Untrusted": "private"})
    assert response.status_code == 200 and response.json() == plan
    assert requests[0].content == body
    assert str(requests[0].url) == "http://127.0.0.1:8000/api/interpret-teaching"
    assert requests[0].headers["content-type"] == "application/json"
    assert not {"cookie", "x-untrusted", "x-forma-bridge-token"} & set(requests[0].headers)


def test_stream_limit_does_not_trust_content_length(setup):
    client, requests, _, _ = setup
    response = client.post("/api/interpret-teaching", content=iter([b" " * 32000, b" " * 34000]), headers={**AUTH, "Content-Type": "application/json", "Content-Length": "1"})
    assert response.status_code == 413 and not requests


@pytest.mark.parametrize("body,headers,status", [
    (b"{}", {}, 415),
    (b"{}", {"Content-Type": "application/json", "Content-Encoding": "gzip"}, 415),
    (b"not-json", {"Content-Type": "application/json"}, 400),
    (b"[]", {"Content-Type": "application/json"}, 400),
])
def test_invalid_bodies_are_not_forwarded(setup, body, headers, status):
    client, requests, _, _ = setup
    response = client.post("/api/interpret-teaching", content=body, headers={**AUTH, **headers})
    assert response.status_code == status and not requests


def test_preserves_only_bounded_local_validation_detail(setup):
    client, _, _, reply = setup
    reply.update(status=422, json={"detail": "The proposed movement amount does not match the explicit instruction."})
    response = client.post("/api/interpret-teaching", headers=AUTH, json={})
    assert response.status_code == 422 and response.json() == reply["json"]
    reply["json"] = {"detail": [{"input": "private request content"}]}
    response = client.post("/api/interpret-teaching", headers=AUTH, json={})
    assert response.status_code == 422 and "private request content" not in response.text


@pytest.mark.parametrize("status,expected", [(302, 502), (401, 401), (402, 402), (429, 429), (500, 502), (503, 503)])
def test_upstream_errors_and_redirects_do_not_leak_bodies(setup, status, expected):
    client, _, _, reply = setup
    reply.update(status=status, json={"detail": "private upstream credentials", "url": "https://private.invalid"})
    response = client.get("/health", headers=AUTH)
    assert response.status_code == expected
    assert "private" not in response.text


@pytest.mark.parametrize("exception", [httpx.ConnectError("private connection"), httpx.ReadTimeout("private timeout")])
def test_connection_failures_are_safe(setup, exception):
    client, _, _, reply = setup
    reply["exception"] = exception
    response = client.get("/health", headers=AUTH)
    assert response.status_code == 502 and "private" not in response.text
    assert phone_bridge._active_upstream == 0


def test_query_strings_are_rejected_after_authentication(setup):
    client, requests, _, _ = setup
    assert client.get("/health?target=private").status_code == 401
    response = client.get("/health?target=private", headers=AUTH)
    assert response.status_code == 400 and "private" not in response.text
    assert client.post("/api/interpret-teaching?anything=1", headers=AUTH, json={}).status_code == 400
    assert not requests and not phone_bridge._post_times


def test_rate_limit_is_shared_across_requests_and_expires(setup, monkeypatch):
    client, requests, _, _ = setup
    clock = [100.0]
    monkeypatch.setattr(phone_bridge, "monotonic", lambda: clock[0])
    for _ in range(30):
        assert client.post("/api/interpret-teaching", headers=AUTH, json={}).status_code == 200
    response = client.post("/api/interpret-teaching", headers=AUTH, json={})
    assert response.status_code == 429 and response.headers["retry-after"] == "60"
    assert len(requests) == 30
    assert client.get("/health", headers=AUTH).status_code == 200
    clock[0] = 160.0
    assert client.post("/api/interpret-teaching", headers=AUTH, json={}).status_code == 200
    assert len(phone_bridge._post_times) == 1


def test_unauthenticated_requests_do_not_consume_rate_limit(setup):
    client, requests, _, _ = setup
    for _ in range(31):
        assert client.post("/api/interpret-teaching", content=b"invalid").status_code == 401
    assert not requests and not phone_bridge._post_times


def test_upstream_concurrency_is_bounded_and_released_on_cancellation(setup, monkeypatch):
    async def scenario():
        entered = asyncio.Event()
        release = asyncio.Event()
        calls = 0

        class SlowClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def request(self, *args, **kwargs):
                nonlocal calls
                calls += 1
                if calls == 2:
                    entered.set()
                await release.wait()
                return httpx.Response(200, json={"ok": True})

        monkeypatch.setattr(phone_bridge.httpx, "AsyncClient", lambda **kwargs: SlowClient())
        first = asyncio.create_task(phone_bridge.forward("POST", "/api/interpret-teaching", b"{}"))
        second = asyncio.create_task(phone_bridge.forward("GET", "/health"))
        await asyncio.wait_for(entered.wait(), timeout=1)
        rejected = await phone_bridge.forward("POST", "/api/interpret-teaching", b"{}")
        assert rejected.status_code == 429 and calls == 2
        first.cancel()
        with pytest.raises(asyncio.CancelledError):
            await first
        assert phone_bridge._active_upstream == 1
        release.set()
        assert (await second).status_code == 200
        assert phone_bridge._active_upstream == 0

    asyncio.run(scenario())
