"""Disconnects pass through the real bridge authentication middleware; no network."""
import asyncio
import json

import pytest

import phone_bridge
from ai_request import run_ai_request


@pytest.mark.parametrize("path", sorted(phone_bridge.TEACHING_PATHS))
@pytest.mark.parametrize("ending", ["disconnect", "caller-cancel", "deadline"])
def test_bridge_cancels_upstream_and_awaits_client_close(monkeypatch, path, ending):
    monkeypatch.setenv("FORMA_PHONE_BRIDGE_TOKEN", "test-only")
    phone_bridge._post_times.clear()
    monkeypatch.setattr(phone_bridge, "_active_upstream", 0)

    async def scenario():
        entered, cancelled, closed = asyncio.Event(), asyncio.Event(), asyncio.Event()
        messages = asyncio.Queue()
        messages.put_nowait({"type": "http.request", "body": b"{}", "more_body": False})
        sent, budgets = [], []

        class Client:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                await asyncio.sleep(0)
                closed.set()

            async def request(self, method, url, **kwargs):
                assert method == "POST" and url == phone_bridge.UPSTREAM + path
                assert kwargs == {"content": b"{}", "headers": {"Content-Type": "application/json"}}
                entered.set()
                try:
                    await asyncio.Event().wait()
                except asyncio.CancelledError:
                    cancelled.set()
                    raise

        async def bounded(request, operation, **kwargs):
            budgets.append(kwargs["timeout"])
            if ending == "deadline":
                kwargs["timeout"] = 0.05
            return await run_ai_request(request, operation, **kwargs)

        async def send(message):
            sent.append(message)

        monkeypatch.setattr(phone_bridge.httpx, "AsyncClient", lambda **kwargs: Client())
        monkeypatch.setattr(phone_bridge, "run_ai_request", bounded)
        scope = {
            "type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
            "http_version": "1.1", "method": "POST", "scheme": "http", "path": path,
            "raw_path": path.encode(), "query_string": b"", "root_path": "",
            "headers": [(b"content-type", b"application/json"), (b"x-forma-bridge-token", b"test-only")],
            "client": ("127.0.0.1", 1234), "server": ("test", 80),
        }
        baseline = asyncio.all_tasks()
        task = asyncio.create_task(phone_bridge.app(scope, messages.get, send))
        await asyncio.wait_for(entered.wait(), 1)
        assert phone_bridge._active_upstream == 1
        if ending == "caller-cancel":
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(task, 1)
        else:
            if ending == "disconnect":
                messages.put_nowait({"type": "http.disconnect"})
            await asyncio.wait_for(task, 1)
            status = next(message["status"] for message in sent if message["type"] == "http.response.start")
            assert status == (499 if ending == "disconnect" else 502)
            body = b"".join(message.get("body", b"") for message in sent)
            assert set(json.loads(body)) == {"detail"}
            assert "test-only" not in body.decode()
        assert budgets == [23]
        assert cancelled.is_set() and closed.is_set()
        assert phone_bridge._active_upstream == 0
        assert not (asyncio.all_tasks() - baseline)

    asyncio.run(scenario())
