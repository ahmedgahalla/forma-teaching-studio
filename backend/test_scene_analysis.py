"""Read-only scene explanation contracts; provider calls are mocked."""
import copy
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from openai import APITimeoutError, RateLimitError

import main
import scene_analysis as analysis


def scene_request():
    return {
        "question": "What could I ask students about this setup?",
        "context": {
            "synthetic": True, "selectedIds": ["11", "21"], "visibleArch": "upper",
            "teeth": [
                {"id": "11", "translationMm": [0, 0.5, 0], "rotationDeg": [0, 0, 0], "locked": False},
                {"id": "21", "translationMm": [0, 0, 0], "rotationDeg": [0, 5, 0], "locked": True},
            ],
            "layers": {"roots": True, "gingiva": False, "bone": False},
            "appliances": {"bracketTeeth": ["11", "21"], "wires": [{
                "teeth": ["11", "21"], "material": "stainless-steel",
                "section": {"shape": "round", "diameterMm": 0.4064},
                "expansionMm": 0.5, "torqueDeg": 0,
            }], "tadCount": 0, "elasticCount": 0, "expanderCount": 0},
            "result": None, "lesson": None,
        },
    }


def explanation():
    return {"observations": "Teeth 11 and 21 are selected; roots are visible.",
            "explanation": "Ask students to compare the geometric edits before calculating a wire response.",
            "limitations": "No current calculated response was supplied. This is an educational scene.",
            "studentQuestion": "Which supplied change is a translation, and which is a rotation?"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ANALYSIS_MODEL", raising=False)
    monkeypatch.setenv("OPENAI_MODEL", "interpreter-test")
    app = FastAPI()
    app.add_exception_handler(RequestValidationError, main.invalid_request)
    app.include_router(analysis.make_analysis_router(main.provider_error))
    return TestClient(app)


def test_read_only_response_has_no_actions_and_preserves_input(client, monkeypatch):
    received = []
    monkeypatch.setattr(analysis, "analyze_with_openai", lambda payload: received.append(payload.model_dump()) or explanation())
    request = scene_request()
    original = copy.deepcopy(request)
    response = client.post("/api/analyze-teaching", json=request)
    assert response.status_code == 200
    assert response.json() == {**explanation(), "model": "interpreter-test"}
    assert request == original and received == [request]
    assert "actions" not in response.json()


def test_analysis_model_is_independent_and_metadata_is_not_provider_controlled(client, monkeypatch):
    monkeypatch.setenv("OPENAI_ANALYSIS_MODEL", "analysis-test")
    monkeypatch.setattr(analysis, "analyze_with_openai", lambda payload: explanation())
    assert client.post("/api/analyze-teaching", json=scene_request()).json()["model"] == "analysis-test"
    monkeypatch.setenv("OPENAI_ANALYSIS_MODEL", " ")
    assert analysis.analysis_model() == "interpreter-test"


@pytest.mark.parametrize("mutation", [
    lambda p: p.update(patientName="private"),
    lambda p: p["context"].update(meshVertices=[1, 2, 3]),
    lambda p: p["context"].update(selectedIds=["11", "11"]),
    lambda p: p["context"].update(selectedIds=["12"]),
    lambda p: p["context"].update(visibleArch="sideways"),
    lambda p: p["context"]["teeth"].append(copy.deepcopy(p["context"]["teeth"][0])),
    lambda p: p["context"]["teeth"][0].update(translationMm=[201, 0, 0]),
    lambda p: p["context"]["teeth"][0].update(translationMm=["1", 0, 0]),
    lambda p: p["context"]["teeth"][0].update(translationMm=[0, 0]),
    lambda p: p["context"]["teeth"][0].update(rotationDeg=[0, 3601, 0]),
    lambda p: p["context"]["teeth"][0].update(locked="false"),
    lambda p: p["context"]["appliances"].update(bracketTeeth=[]),
    lambda p: p["context"]["appliances"].update(tadCount=9),
    lambda p: p["context"]["appliances"].update(tadCount=True),
    lambda p: p["context"]["appliances"]["wires"][0].update(teeth=["11", "11"]),
    lambda p: p["context"]["appliances"]["wires"][0].update(expansionMm=3),
    lambda p: p["context"]["appliances"]["wires"][0].update(material="niti"),
    lambda p: p["context"]["appliances"]["wires"][0]["section"].update(diameterMm=50),
    lambda p: p.update(question=" "),
    lambda p: p.update(question="x" * 801),
])
def test_invalid_scene_never_calls_provider_or_echoes_input(client, monkeypatch, mutation):
    provider = MagicMock()
    monkeypatch.setattr(analysis, "analyze_with_openai", provider)
    payload = scene_request()
    mutation(payload)
    response = client.post("/api/analyze-teaching", json=payload)
    assert response.status_code == 422
    assert "private" not in response.text and "input" not in response.text
    provider.assert_not_called()


def test_one_wire_cannot_cross_arches(client, monkeypatch):
    provider = MagicMock()
    monkeypatch.setattr(analysis, "analyze_with_openai", provider)
    payload = scene_request()
    context = payload["context"]
    context["teeth"][1]["id"] = "31"
    context["selectedIds"] = ["11", "31"]
    context["appliances"]["bracketTeeth"] = ["11", "31"]
    context["appliances"]["wires"][0]["teeth"] = ["11", "31"]
    assert client.post("/api/analyze-teaching", json=payload).status_code == 422
    provider.assert_not_called()


def test_exact_supplied_result_and_lesson_are_forwarded_without_inference(client, monkeypatch):
    payload = scene_request()
    payload["context"]["result"] = {
        "maxDisplacementMm": 0.0116, "maxRotationDeg": 0.3,
        "assumptions": ["Initial elastic response."], "warnings": ["No remodeling calculated."],
    }
    payload["context"]["lesson"] = {"title": "Tipping and translation", "explanation": "Compare the two authored paths."}
    received = []
    monkeypatch.setattr(analysis, "analyze_with_openai", lambda p: received.append(p.model_dump()) or explanation())
    assert client.post("/api/analyze-teaching", json=payload).status_code == 200
    assert received == [payload]
    payload["context"]["synthetic"] = False
    assert client.post("/api/analyze-teaching", json=payload).status_code == 422
    assert len(received) == 1


@pytest.mark.parametrize("result", [
    {**explanation(), "actions": [{"kind": "select", "teeth": ["11"]}]},
    {**explanation(), "model": "provider-picked"},
    {**explanation(), "observations": " "},
    {**explanation(), "explanation": "x" * 1201},
    {"observations": "Missing required sections."},
])
def test_invalid_provider_response_is_rejected(client, monkeypatch, result):
    monkeypatch.setattr(analysis, "analyze_with_openai", lambda payload: result)
    response = client.post("/api/analyze-teaching", json=scene_request())
    assert response.status_code == 502
    assert "actions" not in response.json() and "provider-picked" not in response.text


def test_missing_key_is_actionable_and_does_not_change_scene(client):
    response = client.post("/api/analyze-teaching", json=scene_request())
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


@pytest.mark.parametrize("exception,status", [
    (APITimeoutError(request=httpx.Request("POST", "https://private.invalid")), 502),
    (RateLimitError("private credentials", response=httpx.Response(429, request=httpx.Request("POST", "https://private.invalid")), body={}), 429),
])
def test_provider_errors_use_existing_sanitizer(client, monkeypatch, exception, status):
    def fail(payload):
        raise exception
    monkeypatch.setattr(analysis, "analyze_with_openai", fail)
    response = client.post("/api/analyze-teaching", json=scene_request())
    assert response.status_code == status and "private" not in response.text


@pytest.mark.parametrize("model", ["openai/gpt-4.1-mini", "openai/gpt-6-luna"])
def test_sdk_uses_strict_read_only_schema_minimal_facts_and_no_storage(monkeypatch, model):
    monkeypatch.setenv("OPENAI_API_KEY", "test-only")
    monkeypatch.setenv("OPENAI_ANALYSIS_MODEL", model)
    sdk = MagicMock()
    sdk.responses.parse.return_value = SimpleNamespace(output_parsed=analysis.SceneExplanation(**explanation()))
    factory = MagicMock()
    factory.return_value.__enter__.return_value = sdk
    monkeypatch.setattr(analysis, "OpenAI", factory)
    payload = analysis.AnalysisRequest.model_validate(scene_request())
    assert analysis.analyze_with_openai(payload).model_dump() == explanation()
    call = sdk.responses.parse.call_args.kwargs
    assert call["model"] == model and call["store"] is False
    assert call["text_format"] is analysis.SceneExplanation and call["max_output_tokens"] == 1800
    assert "tools" not in call
    assert json.loads(call["input"][1]["content"]) == scene_request()
    assert "No current" not in call["input"][1]["content"]  # no invented result
    assert "cannot see an image" in call["input"][0]["content"]
    assert "READ ONLY" in call["input"][0]["content"]
    assert "not biological progression" in call["input"][0]["content"]
    assert "Do not calculate a hypothetical appliance outcome" in call["input"][0]["content"]
    if "gpt-6-luna" in model:
        assert call["reasoning"] == {"effort": "none"}
    else:
        assert "reasoning" not in call
    factory.assert_called_once_with(api_key="test-only", timeout=20, max_retries=0)


def test_empty_or_refused_provider_reply_fails_without_actions(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-only")
    sdk = MagicMock()
    sdk.responses.parse.return_value = SimpleNamespace(output_parsed=None)
    factory = MagicMock()
    factory.return_value.__enter__.return_value = sdk
    monkeypatch.setattr(analysis, "OpenAI", factory)
    response = client.post("/api/analyze-teaching", json=scene_request())
    assert response.status_code == 422 and "actions" not in response.json()
