"""Health, CORS and shared target-resolution coverage; never calls the real OpenAI API.

The legacy /api/interpret route was removed in Phase 2.1. resolve_targets and the
Command models it audits stay load-bearing for /api/interpret-teaching, so their
edge-case coverage is hosted here directly against the helpers.
"""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

import main


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    return TestClient(main.app)


def payload(text="Move tooth 11 buccally 1 mm", **kwargs):
    return {"text": text, "selected_tooth": "11", "selected_teeth": [], "available_teeth": ["11", "12"], **kwargs}


def resolve(text, **kwargs):
    return main.resolve_targets(main.InterpretRequest(**payload(text, **kwargs)))


def test_health_does_not_require_api_key(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ai_enabled"] is False


def test_legacy_interpret_route_is_gone(client):
    assert client.post("/api/interpret", json=payload()).status_code in (404, 405)


def test_cors_accepts_only_default_local_origins(client):
    for origin, allowed in [("http://localhost:3000", True), ("http://127.0.0.1:3000", True), ("https://example.com", False)]:
        response = client.options("/api/interpret-teaching", headers={
            "Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"
        })
        assert (response.headers.get("access-control-allow-origin") == origin) is allowed


@pytest.mark.parametrize("overrides", [
    {"selected_tooth": "21"},
    {"available_teeth": ["11", "11"]},
    {"selected_teeth": ["11", "11"]},
    {"selected_teeth": ["21"]},
    {"text": " "},
    {"text": "x" * 501},
    {"geometry": "private-mesh"},
])
def test_invalid_request_context_is_rejected_by_the_schema(overrides):
    with pytest.raises(ValidationError):
        main.InterpretRequest(**payload(**overrides))


def test_available_teeth_reject_unknown_fdi_ids():
    with pytest.raises(ValidationError):
        main.InterpretRequest(**payload(available_teeth=["99"]))


FULL_TEETH = [f"{quadrant}{position}" for quadrant in range(1, 5) for position in range(1, 9)]


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
def test_groups_resolve_only_available_fdi_teeth(selector, expected):
    assert sorted(resolve(f"expand {selector} 0.5 mm", available_teeth=FULL_TEETH)) == sorted(expected)


def test_selected_group_is_not_replaced_by_active_tooth():
    targets = resolve("torque selected teeth -3 degrees", available_teeth=FULL_TEETH, selected_teeth=["12", "22"])
    assert targets == ["12", "22"]


def test_group_resolves_available_members_without_inventing_missing_teeth():
    assert resolve("intrude upper incisors 0.5 mm", available_teeth=["11", "31"]) == ["11"]


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
def test_missing_or_ambiguous_targets_are_rejected(text, overrides):
    with pytest.raises(HTTPException) as error:
        resolve(text, **overrides)
    assert error.value.status_code == 422


def test_selected_teeth_field_is_backward_compatible():
    data = payload("rotate it 5 degrees")
    del data["selected_teeth"]
    assert main.resolve_targets(main.InterpretRequest(**data)) == ["11"]


def test_amount_is_not_mistaken_for_a_target_id():
    assert resolve("rotate it 12 degrees") == ["11"]


def test_negative_angle_is_not_mistaken_for_a_tooth_range():
    assert resolve("rotate 11 -12 degrees") == ["11"]
