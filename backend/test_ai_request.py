"""Request lifetimes cancel and await work, without a provider or network."""
import asyncio

import pytest
from fastapi import HTTPException, Request

from ai_request import run_ai_request


async def consumed_request():
    messages = asyncio.Queue()
    messages.put_nowait({"type": "http.request", "body": b"{}", "more_body": False})
    listening, receive_cancelled = asyncio.Event(), asyncio.Event()

    async def receive():
        listening.set()
        try:
            return await messages.get()
        except asyncio.CancelledError:
            receive_cancelled.set()
            raise

    request = Request({"type": "http", "method": "POST", "path": "/"}, receive)
    assert await request.body() == b"{}"
    listening.clear()
    return request, messages, listening, receive_cancelled


@pytest.mark.parametrize("ending", ["caller", "disconnect", "timeout"])
def test_interruption_awaits_provider_cleanup_and_leaves_no_tasks(ending):
    async def scenario():
        existing = asyncio.all_tasks()
        request, messages, listening, receive_cancelled = await consumed_request()
        started, cleaning, release_cleanup = asyncio.Event(), asyncio.Event(), asyncio.Event()

        async def operation(deadline):
            assert deadline > asyncio.get_running_loop().time()
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                cleaning.set()
                await release_cleanup.wait()

        task = asyncio.create_task(run_ai_request(
            request, operation, timeout=.05 if ending == "timeout" else 10,
            timeout_detail="Request took too long.",
        ))
        await asyncio.wait_for(started.wait(), 2)
        await asyncio.wait_for(listening.wait(), 2)
        if ending == "caller":
            task.cancel()
        elif ending == "disconnect":
            messages.put_nowait({"type": "http.disconnect"})
        await asyncio.wait_for(cleaning.wait(), 2)
        assert not task.done(), "The route must await asynchronous provider cleanup."
        release_cleanup.set()
        if ending == "caller":
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(task, 2)
        else:
            with pytest.raises(HTTPException) as error:
                await asyncio.wait_for(task, 2)
            assert error.value.status_code == (499 if ending == "disconnect" else 502)
            assert error.value.detail == (
                "The teaching request was cancelled." if ending == "disconnect"
                else "Request took too long."
            )
        if ending != "disconnect":
            assert receive_cancelled.is_set()
        assert asyncio.all_tasks() == existing

    asyncio.run(scenario())


def test_success_uses_absolute_deadline_and_cleans_up_disconnect_watch():
    async def scenario():
        existing = asyncio.all_tasks()
        request, _, listening, receive_cancelled = await consumed_request()
        loop = asyncio.get_running_loop()
        before = loop.time()
        value = object()

        async def operation(deadline):
            assert before + 7 <= deadline <= loop.time() + 7
            await listening.wait()
            return value

        assert await run_ai_request(request, operation, timeout=7, timeout_detail="Late.") is value
        assert receive_cancelled.is_set()
        assert asyncio.all_tasks() == existing

    asyncio.run(scenario())


@pytest.mark.parametrize("error", [HTTPException(422, "Invalid plan."), ValueError("bad provider")])
def test_other_errors_are_preserved_and_disconnect_watch_is_cleaned(error):
    async def scenario():
        existing = asyncio.all_tasks()
        request, _, listening, receive_cancelled = await consumed_request()

        async def operation(_deadline):
            await listening.wait()
            raise error

        with pytest.raises(type(error)) as caught:
            await run_ai_request(request, operation, timeout=7, timeout_detail="Late.")
        assert caught.value is error
        assert receive_cancelled.is_set()
        assert asyncio.all_tasks() == existing

    asyncio.run(scenario())


@pytest.mark.parametrize("completion_first", [False, True])
def test_already_ready_disconnect_wins_over_simultaneous_success(completion_first):
    async def scenario():
        existing = asyncio.all_tasks()
        request, messages, listening, _ = await consumed_request()
        release, started = asyncio.Event(), asyncio.Event()

        async def operation(_deadline):
            started.set()
            await release.wait()
            return {"actions": ["must not publish"]}

        task = asyncio.create_task(run_ai_request(request, operation, timeout=7, timeout_detail="Late."))
        await asyncio.wait_for(started.wait(), 2)
        await asyncio.wait_for(listening.wait(), 2)
        if completion_first:
            release.set()
        messages.put_nowait({"type": "http.disconnect"})
        release.set()
        with pytest.raises(HTTPException) as error:
            await asyncio.wait_for(task, 2)
        assert error.value.status_code == 499
        assert asyncio.all_tasks() == existing

    asyncio.run(scenario())
