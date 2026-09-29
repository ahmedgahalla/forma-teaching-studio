"""Actionable provider errors stay sanitized for commands and explanations."""
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import APIConnectionError, APIStatusError, APITimeoutError

import main
import scene_analysis
from test_scene_analysis import scene_request
from test_teaching import request


PRIVATE_DETAIL = "private-provider-payload-and-credential"
PRIVATE_URL = "https://private.invalid/request-text"


def provider_failure(kind, code="private-provider-code"):
    upstream_request = httpx.Request("POST", PRIVATE_URL)
    if kind == "timeout":
        return APITimeoutError(request=upstream_request)
    if kind == "connection":
        return APIConnectionError(message=PRIVATE_DETAIL, request=upstream_request)
    status = int(kind)
    return APIStatusError(
        PRIVATE_DETAIL,
        response=httpx.Response(status, request=upstream_request),
        body={"code": code, "message": PRIVATE_DETAIL},
    )


@pytest.mark.parametrize("endpoint", ["command", "analysis"])
@pytest.mark.parametrize("kind,status,detail", [
    ("400", 502, "model or request settings"),
    ("403", 503, "access to the configured model"),
    ("404", 503, "model or API endpoint"),
    ("timeout", 502, "timed out"),
    ("connection", 502, "could not be reached"),
])
def test_provider_failure_explains_recovery_without_private_details(monkeypatch, endpoint, kind, status, detail):
    monkeypatch.setenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    analysis = endpoint == "analysis"
    function = "analyze_with_openai" if analysis else "interpret_teaching_with_openai"
    failure = AsyncMock(side_effect=provider_failure(kind))
    monkeypatch.setattr(scene_analysis if analysis else main, function, failure)
    result = TestClient(main.app).post(
        "/api/analyze-teaching" if analysis else "/api/interpret-teaching",
        json=scene_request() if analysis else request(),
    )
    assert result.status_code == status
    assert detail in result.json()["detail"]
    assert "OpenRouter" in result.json()["detail"]
    assert PRIVATE_DETAIL not in result.text and PRIVATE_URL not in result.text
    assert "private-provider-code" not in result.text
    assert "actions" not in result.json()
    failure.assert_awaited_once()


@pytest.mark.parametrize("endpoint", ["command", "analysis"])
@pytest.mark.parametrize("code", [
    "insufficient_quota", "billing_hard_limit_reached",
    "organization_spend_limit_exceeded", "project_spend_limit_exceeded",
    "organization_usage_limit_exceeded",
])
def test_billing_limits_are_not_described_as_temporary_rate_limits(monkeypatch, endpoint, code):
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    analysis = endpoint == "analysis"
    function = "analyze_with_openai" if analysis else "interpret_teaching_with_openai"
    monkeypatch.setattr(scene_analysis if analysis else main, function,
                        AsyncMock(side_effect=provider_failure("429", code)))
    result = TestClient(main.app).post(
        "/api/analyze-teaching" if analysis else "/api/interpret-teaching",
        json=scene_request() if analysis else request(),
    )
    assert result.status_code == 429
    detail = result.json()["detail"]
    assert "OpenAI" in detail and "API billing and usage limits" in detail
    assert "try again" not in detail.lower() and "wait briefly" not in detail.lower()
    assert "temporarily" not in detail and "actions" not in result.json()
    assert PRIVATE_DETAIL not in result.text and PRIVATE_URL not in result.text
