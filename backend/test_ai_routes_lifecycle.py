"""Real ASGI routes stop initial and repair SDK work when the request ends."""
import asyncio
import json
from types import SimpleNamespace

import pytest

import main
import scene_analysis
from ai_request import run_ai_request
from test_scene_analysis import explanation, scene_request
from test_teaching import dental, plan, request


class PendingSDK:
    """Async SDK context that records whether cancellation finishes cleanup."""

    def __init__(self, pending_call, initial=None):
        self.pending_call = pending_call
        self.initial = initial
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.options = []
        self.calls = 0
        self.entered = self.closed = self.cancelled = 0

    def client(self, **options):
        self.options.append(options)
        owner = self

        class Client:
            async def __aenter__(self):
                owner.entered += 1
                self.responses = SimpleNamespace(parse=owner.parse)
                return self

            async def __aexit__(self, *_args):
                # Real asynchronous cleanup must finish before a response escapes.
                await asyncio.sleep(0)
                owner.closed += 1

        return Client()

    async def parse(self, **_kwargs):
        self.calls += 1
        if self.calls != self.pending_call:
            return SimpleNamespace(output_parsed=self.initial)
        self.started.set()
        try:
            await self.release.wait()
        except asyncio.CancelledError:
            self.cancelled += 1
            raise
        return SimpleNamespace(output_parsed=self.initial)


def asgi_request(path, payload):
    messages, sent = asyncio.Queue(), []
    messages.put_nowait({"type": "http.request", "body": json.dumps(payload).encode(), "more_body": False})
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "POST", "scheme": "http", "path": path, "raw_path": path.encode(),
        "query_string": b"", "root_path": "", "headers": [(b"content-type", b"application/json")],
        "client": ("127.0.0.1", 1234), "server": ("test", 80),
    }

    async def send(message):
        sent.append(message)

    task = asyncio.create_task(main.app(scope, messages.get, send))
    return task, messages, sent


def response(sent):
    status = next(message["status"] for message in sent if message["type"] == "http.response.start")
    body = b"".join(message.get("body", b"") for message in sent if message["type"] == "http.response.body")
    return status, json.loads(body)


@pytest.mark.parametrize("endpoint", ["interpret", "analysis", "repair"])
@pytest.mark.parametrize("ending", ["caller", "disconnect", "timeout"])
def test_request_end_cancels_sdk_and_awaits_cleanup(monkeypatch, endpoint, ending):
    async def scenario():
        existing = asyncio.all_tasks()
        monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-sent")
        repair = endpoint == "repair"
        analysis = endpoint == "analysis"
        module = scene_analysis if analysis else main
        rejected = main.TeachingPlan.model_validate(plan(dental(tooth="12")))
        sdk = PendingSDK(2 if repair else 1, initial=rejected)
        monkeypatch.setattr(module, "AsyncOpenAI", sdk.client)
        budgets = []

        async def short_lifetime(http_request, operation, *, timeout, timeout_detail):
            budgets.append(timeout)

            async def eligible_operation(_deadline):
                # Preserve repair eligibility while shortening only this request's
                # lifetime. No global clock patch or real 20-second provider wait.
                return await operation(asyncio.get_running_loop().time() + timeout)

            return await run_ai_request(http_request, eligible_operation, timeout=.1, timeout_detail=timeout_detail)

        if ending == "timeout":
            monkeypatch.setattr(module, "run_ai_request", short_lifetime)
        task, messages, sent = asgi_request(
            "/api/analyze-teaching" if analysis else "/api/interpret-teaching",
            scene_request() if analysis else request("Move tooth 11 buccally 1 mm"),
        )
        await asyncio.wait_for(sdk.started.wait(), 2)
        if ending == "caller":
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(task, 2)
            assert not sent
        else:
            if ending == "disconnect":
                messages.put_nowait({"type": "http.disconnect"})
            await asyncio.wait_for(task, 2)
            status, body = response(sent)
            assert status == (499 if ending == "disconnect" else 502)
            assert set(body) == {"detail"}
            assert "test-key" not in str(body) and "actions" not in body
        assert sdk.calls == sdk.entered == sdk.closed == (2 if repair else 1)
        assert sdk.cancelled == 1
        assert all(options["max_retries"] == 0 for options in sdk.options)
        assert 0 < sdk.options[0]["timeout"] <= 20
        if repair:
            assert 0 < sdk.options[1]["timeout"] <= 10
        if ending == "timeout":
            assert budgets == [20 if analysis else 21]
        assert asyncio.all_tasks() == existing

    asyncio.run(scenario())


@pytest.mark.parametrize("endpoint", ["interpret", "analysis"])
def test_successful_provider_response_closes_sdk_and_leaves_no_tasks(monkeypatch, endpoint):
    async def scenario():
        existing = asyncio.all_tasks()
        monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-sent")
        analysis = endpoint == "analysis"
        module = scene_analysis if analysis else main
        value = explanation() if analysis else plan(dental())
        sdk = PendingSDK(1, initial=value)
        monkeypatch.setattr(module, "AsyncOpenAI", sdk.client)
        task, _, sent = asgi_request(
            "/api/analyze-teaching" if analysis else "/api/interpret-teaching",
            scene_request() if analysis else request("Move tooth 11 buccally 1 mm"),
        )
        await asyncio.wait_for(sdk.started.wait(), 2)
        sdk.release.set()
        await asyncio.wait_for(task, 2)
        status, body = response(sent)
        assert status == 200
        if analysis:
            assert {key: body[key] for key in value} == value
            assert "actions" not in body
        else:
            assert body == value
        assert sdk.entered == sdk.closed == sdk.calls == 1
        assert sdk.cancelled == 0
        assert asyncio.all_tasks() == existing

    asyncio.run(scenario())


@pytest.mark.parametrize("endpoint", ["interpret", "analysis"])
def test_disconnect_ready_with_sdk_completion_never_publishes_response(monkeypatch, endpoint):
    async def scenario():
        existing = asyncio.all_tasks()
        monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-sent")
        analysis = endpoint == "analysis"
        module = scene_analysis if analysis else main
        sdk = PendingSDK(1, initial=explanation() if analysis else plan(dental()))
        monkeypatch.setattr(module, "AsyncOpenAI", sdk.client)
        task, messages, sent = asgi_request(
            "/api/analyze-teaching" if analysis else "/api/interpret-teaching",
            scene_request() if analysis else request("Move tooth 11 buccally 1 mm"),
        )
        await asyncio.wait_for(sdk.started.wait(), 2)
        # Both are ready before control returns to the event loop. Completion
        # becoming ready first must not publish a now-abandoned action or answer.
        sdk.release.set()
        messages.put_nowait({"type": "http.disconnect"})
        await asyncio.wait_for(task, 2)
        assert response(sent) == (499, {"detail": "The teaching request was cancelled."})
        assert sdk.entered == sdk.closed == sdk.calls == 1
        assert asyncio.all_tasks() == existing

    asyncio.run(scenario())
