"""Contract, validation and SDK-boundary tests; never call the real OpenAI API."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import main
from openai import APITimeoutError
import httpx


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    return TestClient(main.app)


def request(text="Move tooth 11 buccally 1 mm", **kwargs):
    return {"text": text, "selected_tooth": "11", "selected_teeth": [], "available_teeth": ["11", "12"], **kwargs}


def fake_result(monkeypatch, command):
    monkeypatch.setattr(main, "interpret_with_openai", lambda payload: {"command": command, "reason": ""})


def test_health_does_not_require_api_key(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ai_enabled"] is False


def test_missing_key_is_actionable(client):
    response = client.post("/api/interpret", json=request())
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


@pytest.mark.parametrize("command", [
    {"type": "move", "tooth": "11", "direction": "buccal", "amount": 1},
    {"type": "rotate", "tooth": "11", "axis": "z", "amount": -5},
    {"type": "ghost", "visible": True},
    {"type": "stages", "count": 10},
    {"type": "undo"}, {"type": "redo"}, {"type": "play"},
])
def test_commands_match_frontend_union(client, monkeypatch, command):
    fake_result(monkeypatch, command)
    response = client.post("/api/interpret", json=request())
    assert response.status_code == 200
    assert response.json() == command


@pytest.mark.parametrize("command", [
    {"type": "move", "tooth": "11", "direction": "buccal", "amount": 11},
    {"type": "move", "tooth": "11", "direction": "buccal", "amount": "1"},
    {"type": "rotate", "tooth": "11", "axis": "q", "amount": 5},
    {"type": "rotate", "tooth": "11", "axis": "z", "amount": 181},
    {"type": "stages", "count": 1},
    {"type": "stages", "count": 51},
    {"type": "stages", "count": True},
    {"type": "ghost", "visible": "true"},
    {"type": "move_group", "teeth": [], "direction": "buccal", "amount": 1},
    {"type": "move_group", "teeth": ["11", "11"], "direction": "buccal", "amount": 1},
    {"type": "move_group", "teeth": ["11"], "direction": "buccal", "amount": float("inf")},
    {"type": "move_group", "teeth": ["11"], "direction": "buccal", "amount": True},
    {"type": "rotate_group", "teeth": ["11"], "axis": "z", "amount": -181},
    {"type": "orthodontic", "teeth": ["11"], "movement": "translate", "amount": 1},
    {"type": "orthodontic", "teeth": ["11"], "movement": "tip", "amount": 181},
    {"type": "reset", "teeth": ["99"]},
    {"type": "appliance", "visible": "true"},
    {"type": "undo", "extra": "not allowed"},
])
def test_invalid_provider_output_is_rejected(client, monkeypatch, command):
    fake_result(monkeypatch, command)
    assert client.post("/api/interpret", json=request()).status_code == 502


@pytest.mark.parametrize("text", [
    "Move 11 buccally 1 mm and rotate it 5 degrees",
    "Undo; redo",
    "Move tooth 11 1 mm, then move tooth 12 1 mm",
    "Undo\nredo",
])
def test_compound_command_does_not_call_provider(client, monkeypatch, text):
    provider = MagicMock()
    monkeypatch.setattr(main, "interpret_with_openai", provider)
    assert client.post("/api/interpret", json=request(text)).status_code == 422
    provider.assert_not_called()


@pytest.mark.parametrize("overrides", [
    {"selected_tooth": "21"},
    {"available_teeth": ["11", "11"]},
    {"available_teeth": ["99"]},
    {"selected_teeth": ["11", "11"]},
    {"selected_teeth": ["21"]},
    {"text": " "},
    {"text": "x" * 501},
    {"geometry": "private-mesh"},
])
def test_invalid_request_context_does_not_call_provider(client, monkeypatch, overrides):
    provider = MagicMock()
    monkeypatch.setattr(main, "interpret_with_openai", provider)
    response = client.post("/api/interpret", json=request(**overrides))
    assert response.status_code == 422
    assert "private-mesh" not in response.text
    provider.assert_not_called()


def test_unavailable_tooth_is_rejected(client, monkeypatch):
    fake_result(monkeypatch, {"type": "move", "tooth": "21", "direction": "buccal", "amount": 1})
    assert client.post("/api/interpret", json=request()).status_code == 422


def test_zero_move_is_rejected(client, monkeypatch):
    fake_result(monkeypatch, {"type": "move", "tooth": "11", "direction": "buccal", "amount": 0})
    assert client.post("/api/interpret", json=request()).status_code == 422


def test_model_ambiguity_does_not_create_command(client, monkeypatch):
    fake_result(monkeypatch, None)
    assert client.post("/api/interpret", json=request("Move it a little")).status_code == 422


@pytest.mark.parametrize("text,command", [
    ("Move tooth 11 buccally 1 mm", main.Move(type="move", tooth="11", direction="buccal", amount=1)),
    ("Rotate it 5 degrees", main.Rotate(type="rotate", tooth="11", axis="y", amount=5)),
])
def test_sdk_uses_server_key_strict_schema_and_no_response_storage(client, monkeypatch, text, command):
    monkeypatch.setenv("OPENAI_API_KEY", "test-server-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    sdk = MagicMock()
    sdk.responses.parse.return_value = SimpleNamespace(output_parsed=main.Interpretation(
        command=command, reason=""
    ))
    sdk.__enter__.return_value = sdk
    factory = MagicMock(return_value=sdk)
    monkeypatch.setattr(main, "OpenAI", factory)
    response = client.post("/api/interpret", json=request(text))
    assert response.status_code == 200
    assert response.json() == command.model_dump()
    factory.assert_called_once_with(api_key="test-server-key", timeout=20, max_retries=0)
    arguments = sdk.responses.parse.call_args.kwargs
    assert arguments["model"] == "test-model"
    assert arguments["store"] is False
    assert arguments["text_format"] is main.Interpretation
    assert json.loads(arguments["input"][1]["content"]) == {**request(text), "resolved_teeth": ["11"]}
    assert "If the axis is omitted use y" in arguments["input"][0]["content"]
    assert "test-server-key" not in response.text
    schema = main.Interpretation.model_json_schema()
    assert schema["type"] == "object"
    assert schema["additionalProperties"] is False
    assert all(definition.get("additionalProperties") is False for definition in schema["$defs"].values())


def test_provider_refusal_is_rejected(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-server-key")
    sdk = MagicMock()
    sdk.__enter__.return_value = sdk
    sdk.responses.parse.return_value = SimpleNamespace(output_parsed=None)
    monkeypatch.setattr(main, "OpenAI", MagicMock(return_value=sdk))
    assert client.post("/api/interpret", json=request()).status_code == 422


def test_provider_failure_does_not_echo_private_details(client, monkeypatch):
    def fail(_payload):
        raise APITimeoutError(request=httpx.Request("POST", "https://example.com/private-input"))

    monkeypatch.setattr(main, "interpret_with_openai", fail)
    response = client.post("/api/interpret", json=request())
    assert response.status_code == 502
    assert "private-input" not in response.text


def test_cors_accepts_only_default_local_origins(client):
    for origin, allowed in [("http://localhost:3000", True), ("http://127.0.0.1:3000", True), ("https://example.com", False)]:
        response = client.options("/api/interpret", headers={
            "Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"
        })
        assert (response.headers.get("access-control-allow-origin") == origin) is allowed


FULL_TEETH = [f"{quadrant}{position}" for quadrant in range(1, 5) for position in range(1, 9)]


@pytest.mark.parametrize("text,command", [
    ("intrude upper incisors 0.5 mm", {"type": "move_group", "teeth": ["11", "12", "21", "22"], "direction": "intrude", "amount": 0.5}),
    ("torque lower incisors -3 degrees", {"type": "orthodontic", "teeth": ["31", "32", "41", "42"], "movement": "torque", "amount": -3}),
    ("tip teeth 11,12 5 degrees", {"type": "orthodontic", "teeth": ["11", "12"], "movement": "tip", "amount": 5}),
    ("rotate teeth 11,12 5 degrees around x", {"type": "rotate_group", "teeth": ["11", "12"], "axis": "x", "amount": 5}),
    ("rotate teeth 11,12 5 degrees", {"type": "orthodontic", "teeth": ["11", "12"], "movement": "rotate", "amount": 5}),
    ("axially rotate 11 5 degrees", {"type": "orthodontic", "teeth": ["11"], "movement": "rotate", "amount": 5}),
    ("rotate 11 5 degrees around long axis", {"type": "orthodontic", "teeth": ["11"], "movement": "rotate", "amount": 5}),
    ("move teeth 11 and 12 buccal 1 mm", {"type": "move_group", "teeth": ["11", "12"], "direction": "buccal", "amount": 1}),
    ("reset teeth 11 12", {"type": "reset", "teeth": ["11", "12"]}),
    ("reset all teeth", {"type": "reset", "teeth": FULL_TEETH}),
    ("show braces", {"type": "appliance", "visible": True}),
    ("hide braces", {"type": "appliance", "visible": False}),
])
def test_expanded_commands_match_frontend_contract(client, monkeypatch, text, command):
    fake_result(monkeypatch, command)
    response = client.post("/api/interpret", json=request(text, available_teeth=FULL_TEETH))
    assert response.status_code == 200, response.text
    assert response.json() == command


@pytest.mark.parametrize("selector,expected", [
    ("all teeth", FULL_TEETH),
    ("upper teeth", [t for t in FULL_TEETH if t[0] in "12"]),
    ("lower teeth", [t for t in FULL_TEETH if t[0] in "34"]),
    ("incisors", [t for t in FULL_TEETH if t[1] in "12"]),
    ("canines", ["13", "23", "33", "43"]),
    ("premolars", [t for t in FULL_TEETH if t[1] in "45"]),
    ("molars", [t for t in FULL_TEETH if t[1] in "678"]),
    ("upper anterior", [t for t in FULL_TEETH if t[0] in "12" and t[1] in "123"]),
    ("lower posterior teeth", [t for t in FULL_TEETH if t[0] in "34" and t[1] in "45678"]),
    ("maxillary incisors", ["11", "12", "21", "22"]),
    ("mandibular canines", ["33", "43"]),
    ("upper arch", [t for t in FULL_TEETH if t[0] in "12"]),
])
def test_groups_resolve_only_available_fdi_teeth(client, monkeypatch, selector, expected):
    command = {"type": "move_group", "teeth": expected, "direction": "buccal", "amount": 0.5}
    fake_result(monkeypatch, command)
    response = client.post("/api/interpret", json=request(f"expand {selector} 0.5 mm", available_teeth=FULL_TEETH))
    assert response.status_code == 200, response.text


def test_selected_group_is_not_replaced_by_active_tooth(client, monkeypatch):
    command = {"type": "orthodontic", "teeth": ["12", "22"], "movement": "torque", "amount": -3}
    fake_result(monkeypatch, command)
    response = client.post("/api/interpret", json=request("torque selected teeth -3 degrees", available_teeth=FULL_TEETH, selected_teeth=["12", "22"]))
    assert response.status_code == 200
    assert response.json()["teeth"] == ["12", "22"]


def test_group_resolves_available_members_without_inventing_missing_teeth(client, monkeypatch):
    fake_result(monkeypatch, {"type": "move_group", "teeth": ["11"], "direction": "intrude", "amount": 0.5})
    response = client.post("/api/interpret", json=request("intrude upper incisors 0.5 mm", available_teeth=["11", "31"]))
    assert response.status_code == 200
    assert response.json()["teeth"] == ["11"]


@pytest.mark.parametrize("text,command", [
    ("move 11 buccal 1 mm", {"type": "move", "tooth": "12", "direction": "buccal", "amount": 1}),
    ("move teeth 11,12 buccal 1 mm", {"type": "move_group", "teeth": ["11"], "direction": "buccal", "amount": 1}),
    ("move 11 buccal 1 mm", {"type": "move_group", "teeth": ["11", "12"], "direction": "buccal", "amount": 1}),
    ("reset 11", {"type": "reset", "teeth": ["12"]}),
    ("intrude upper incisors 0.5 mm", {"type": "move_group", "teeth": ["11", "12", "31", "32"], "direction": "intrude", "amount": 0.5}),
    ("tip selected teeth 3 degrees", {"type": "orthodontic", "teeth": ["11"], "movement": "tip", "amount": 3}),
])
def test_available_but_wrong_provider_targets_are_rejected(client, monkeypatch, text, command):
    fake_result(monkeypatch, command)
    response = client.post("/api/interpret", json=request(text, available_teeth=FULL_TEETH, selected_teeth=["12", "22"]))
    assert response.status_code == 422
    assert "targets" in response.json()["detail"]


@pytest.mark.parametrize("text,overrides", [
    ("move teeth 11,21 buccal 1 mm", {}),
    ("move 99 buccal 1 mm", {}),
    ("move tooth 111 buccal 1 mm", {}),
    ("move teeth 11-18 buccal 1 mm", {"available_teeth": FULL_TEETH}),
    ("move teeth 11–18 buccal 1 mm", {"available_teeth": FULL_TEETH}),
    ("move teeth 11 through 18 buccal 1 mm", {"available_teeth": FULL_TEETH}),
    ("move teeth 11 or 12 buccal 1 mm", {}),
    ("move some teeth buccal 1 mm", {}),
    ("move all teeth except 11 buccal 1 mm", {}),
    ("intrude two upper incisors 0.5 mm", {"available_teeth": FULL_TEETH}),
    ("intrude lower incisors 0.5 mm", {}),
    ("tip selected teeth 3 degrees", {}),
    ("expand upper and lower teeth 1 mm", {}),
    ("move upper tooth 31 buccal 1 mm", {"available_teeth": FULL_TEETH}),
    ("move upper left teeth buccal 1 mm", {"available_teeth": FULL_TEETH}),
])
def test_missing_or_ambiguous_targets_reject_before_provider(client, monkeypatch, text, overrides):
    provider = MagicMock()
    monkeypatch.setattr(main, "interpret_with_openai", provider)
    response = client.post("/api/interpret", json=request(text, **overrides))
    assert response.status_code == 422
    provider.assert_not_called()


def test_selected_teeth_field_is_backward_compatible(client, monkeypatch):
    fake_result(monkeypatch, {"type": "rotate", "tooth": "11", "axis": "y", "amount": 5})
    payload = request("rotate it 5 degrees")
    del payload["selected_teeth"]
    assert client.post("/api/interpret", json=payload).status_code == 200


def test_amount_is_not_mistaken_for_a_target_id(client, monkeypatch):
    fake_result(monkeypatch, {"type": "rotate", "tooth": "11", "axis": "y", "amount": 12})
    response = client.post("/api/interpret", json=request("rotate it 12 degrees"))
    assert response.status_code == 200


def test_negative_angle_is_not_mistaken_for_a_tooth_range(client, monkeypatch):
    fake_result(monkeypatch, {"type": "rotate", "tooth": "11", "axis": "y", "amount": -12})
    response = client.post("/api/interpret", json=request("rotate 11 -12 degrees"))
    assert response.status_code == 200
