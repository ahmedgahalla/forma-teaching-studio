"""Configured mechanics facts remain complete, bounded and read-only."""
import asyncio
import copy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

import scene_analysis as analysis
from test_scene_analysis import client, explanation, scene_request


def mechanics_request():
    payload = scene_request()
    payload["context"]["appliances"].update(
        fixedTeeth=["21"],
        tads=[{"id": "tad-1", "position": [12, -4, 8]}],
        elastics=[
            {"from": {"kind": "tooth", "tooth": "11", "local": [0, 0, 3]},
             "to": {"kind": "tad", "id": "tad-1"}, "law": {"kind": "constant", "forceN": 0.5}},
            {"from": {"kind": "tooth", "tooth": "21", "local": [0, 1, 3]},
             "to": {"kind": "tooth", "tooth": "11", "local": [0, 1, 3]},
             "law": {"kind": "spring", "stiffnessNPerMm": 2, "restLengthMm": 10}},
        ],
        expanders=[{"left": ["21"], "right": ["11"], "activationMm": 0.1,
                    "stiffnessNPerMm": 10, "palateStiffnessNPerMm": None}],
        tadCount=1, elasticCount=2, expanderCount=1,
    )
    return payload


def replace(payload, path, value):
    target = payload["context"]["appliances"]
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value


@pytest.mark.parametrize("preset,translation,rotation", [
    ("standard", 100, 1000), ("soft", 50, 500), ("firm", 200, 2000),
])
@pytest.mark.parametrize("palate", [None, 20])
def test_complete_rig_reaches_provider_without_changing_the_scene(
    client, monkeypatch, preset, translation, rotation, palate
):
    payload = mechanics_request()
    appliances = payload["context"]["appliances"]
    appliances["support"] = {"preset": preset, "translationNPerMm": translation, "rotationNmmPerRad": rotation}
    appliances["expanders"][0]["palateStiffnessNPerMm"] = palate
    original = copy.deepcopy(payload)
    received = []
    monkeypatch.setattr(analysis, "analyze_with_openai", AsyncMock(side_effect=lambda p, timeout: received.append(p.model_dump(by_alias=True)) or explanation()))
    response = client.post("/api/analyze-teaching", json=payload)
    assert response.status_code == 200
    assert received == [original] and payload == original
    assert response.json() == {**explanation(), "model": "interpreter-test"}
    assert payload["context"]["result"] is None
    assert "actions" not in response.json()


@pytest.mark.parametrize("path,value", [
    (("fixedTeeth",), ["11"]),
    (("support",), {"preset": "soft", "translationNPerMm": 50, "rotationNmmPerRad": 500}),
    (("tads", 0, "position"), [12, -4, 9]),
    (("elastics", 0, "from", "local"), [0, 2, 3]),
    (("elastics", 0, "law", "forceN"), 1),
    (("elastics", 1, "law", "stiffnessNPerMm"), 4),
    (("elastics", 1, "law", "restLengthMm"), 8),
    (("expanders", 0, "activationMm"), 0.2),
    (("expanders", 0, "stiffnessNPerMm"), 15),
    (("expanders", 0, "palateStiffnessNPerMm"), 20),
])
def test_otherwise_identical_rigs_send_distinct_configuration_facts(client, monkeypatch, path, value):
    first = mechanics_request()
    second = copy.deepcopy(first)
    replace(second, path, value)
    received = []
    monkeypatch.setattr(analysis, "analyze_with_openai", AsyncMock(side_effect=lambda p, timeout: received.append(p.model_dump(by_alias=True)) or explanation()))
    for payload in (first, second):
        assert client.post("/api/analyze-teaching", json=payload).status_code == 200
    assert received == [first, second] and received[0] != received[1]
    assert received[0]["context"]["teeth"] == received[1]["context"]["teeth"]
    assert received[0]["context"]["result"] is received[1]["context"]["result"] is None


def test_absent_experiment_is_explicit_and_does_not_invent_support(client, monkeypatch):
    payload = scene_request()
    payload["context"]["appliances"].update(support=None, bracketTeeth=[], wires=[])
    received = []
    monkeypatch.setattr(analysis, "analyze_with_openai", AsyncMock(side_effect=lambda p, timeout: received.append(p.model_dump(by_alias=True)) or explanation()))
    assert client.post("/api/analyze-teaching", json=payload).status_code == 200
    assert received == [payload]
    payload["context"]["result"] = {
        "maxDisplacementMm": 0, "maxRotationDeg": 0, "assumptions": [], "warnings": [],
    }
    assert client.post("/api/analyze-teaching", json=payload).status_code == 422
    assert len(received) == 1


@pytest.mark.parametrize("field", ["support", "fixedTeeth", "tads", "elastics", "expanders"])
def test_old_or_incomplete_configuration_is_rejected_instead_of_defaulted(client, monkeypatch, field):
    payload = mechanics_request()
    del payload["context"]["appliances"][field]
    provider = AsyncMock()
    monkeypatch.setattr(analysis, "analyze_with_openai", provider)
    assert client.post("/api/analyze-teaching", json=payload).status_code == 422
    provider.assert_not_called()


@pytest.mark.parametrize("path,value", [
    (("support",), None),
    (("support", "preset"), "custom"),
    (("support", "translationNPerMm"), 101),
    (("support", "rotationNmmPerRad"), 999),
    (("support", "translationNPerMm"), "100"),
    (("support", "rotationNmmPerRad"), True),
    (("support", "label"), "private support name"),
    (("fixedTeeth",), ["12"]),
    (("fixedTeeth",), ["21", "21"]),
    (("fixedTeeth",), ["private tooth"]),
    (("tadCount",), 0),
    (("elasticCount",), 1),
    (("expanderCount",), 0),
    (("tads", 0, "id"), "private-anchor"),
    (("tads", 0, "id"), "tad-9"),
    (("tads", 0, "position"), [201, 0, 0]),
    (("tads", 0, "position"), [0, -201, 0]),
    (("tads", 0, "position"), [0, 0]),
    (("tads", 0, "position"), [0, "0", 0]),
    (("tads", 0, "name"), "private anchor name"),
    (("elastics", 0, "id"), "private-elastic"),
    (("elastics", 0, "from", "tooth"), "12"),
    (("elastics", 0, "from", "local"), [31, 0, 0]),
    (("elastics", 0, "from", "local"), [0, -31, 0]),
    (("elastics", 0, "from", "position"), [0, 0, 0]),
    (("elastics", 0, "to", "id"), "tad-2"),
    (("elastics", 0, "to", "id"), "private-anchor"),
    (("elastics", 0, "to"), {"kind": "tooth", "tooth": "11", "local": [0, 0, 3]}),
    (("elastics", 0, "law", "kind"), "measured"),
    (("elastics", 0, "law", "forceN"), -0.01),
    (("elastics", 0, "law", "forceN"), 20.01),
    (("elastics", 0, "law", "forceN"), True),
    (("elastics", 0, "law", "forceN"), "0.5"),
    (("elastics", 0, "law", "stiffnessNPerMm"), 2),
    (("elastics", 1, "law", "stiffnessNPerMm"), 0),
    (("elastics", 1, "law", "stiffnessNPerMm"), 1001),
    (("elastics", 1, "law", "restLengthMm"), -1),
    (("elastics", 1, "law", "restLengthMm"), 201),
    (("elastics", 1, "law", "forceN"), 2),
    (("expanders", 0, "id"), "private-expander"),
    (("expanders", 0, "left"), []),
    (("expanders", 0, "left"), ["21", "21"]),
    (("expanders", 0, "left"), ["22"]),
    (("expanders", 0, "left"), ["11"]),
    (("expanders", 0, "left"), ["21", "11"]),
    (("expanders", 0, "activationMm"), -0.1),
    (("expanders", 0, "activationMm"), 2.01),
    (("expanders", 0, "stiffnessNPerMm"), 0),
    (("expanders", 0, "stiffnessNPerMm"), 1001),
    (("expanders", 0, "palateStiffnessNPerMm"), 0),
    (("expanders", 0, "palateStiffnessNPerMm"), 1001),
    (("expanders", 0, "palateStiffnessNPerMm"), "20"),
])
def test_invalid_mechanics_never_reaches_provider_or_echoes_private_values(client, monkeypatch, path, value):
    payload = mechanics_request()
    replace(payload, path, value)
    provider = AsyncMock()
    monkeypatch.setattr(analysis, "analyze_with_openai", provider)
    response = client.post("/api/analyze-teaching", json=payload)
    assert response.status_code == 422
    assert "private" not in response.text and "input" not in response.text
    provider.assert_not_called()


@pytest.mark.parametrize("path", [
    ("support", "translationNPerMm"), ("support", "rotationNmmPerRad"),
    ("tads", 0, "position", 0), ("elastics", 0, "from", "local", 0),
    ("elastics", 0, "law", "forceN"), ("elastics", 1, "law", "stiffnessNPerMm"),
    ("elastics", 1, "law", "restLengthMm"), ("expanders", 0, "activationMm"),
    ("expanders", 0, "stiffnessNPerMm"), ("expanders", 0, "palateStiffnessNPerMm"),
])
@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_all_new_numerical_facts_reject_nonfinite_values(client, monkeypatch, path, value):
    payload = mechanics_request()
    replace(payload, path, value)
    provider = AsyncMock()
    monkeypatch.setattr(analysis, "analyze_with_openai", provider)
    response = client.post("/api/analyze-teaching", content=json.dumps(payload), headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    provider.assert_not_called()


@pytest.mark.parametrize("field,count", [("tads", "tadCount"), ("elastics", "elasticCount"), ("expanders", "expanderCount")])
def test_appliance_lists_respect_existing_object_limits(client, monkeypatch, field, count):
    payload = mechanics_request()
    appliances = payload["context"]["appliances"]
    size = {"tads": 9, "elastics": 13, "expanders": 2}[field]
    appliances[field] = [copy.deepcopy(appliances[field][0]) for _ in range(size)]
    appliances[count] = size
    provider = AsyncMock()
    monkeypatch.setattr(analysis, "analyze_with_openai", provider)
    assert client.post("/api/analyze-teaching", json=payload).status_code == 422
    provider.assert_not_called()


def test_duplicate_tad_ids_and_same_tad_endpoints_are_rejected(client, monkeypatch):
    provider = AsyncMock()
    monkeypatch.setattr(analysis, "analyze_with_openai", provider)
    payload = mechanics_request()
    appliances = payload["context"]["appliances"]
    appliances["tads"].append(copy.deepcopy(appliances["tads"][0]))
    appliances["tadCount"] = 2
    assert client.post("/api/analyze-teaching", json=payload).status_code == 422
    payload = mechanics_request()
    elastic = payload["context"]["appliances"]["elastics"][0]
    elastic["from"] = copy.deepcopy(elastic["to"])
    assert client.post("/api/analyze-teaching", json=payload).status_code == 422
    provider.assert_not_called()


def test_expander_cannot_reference_present_lower_teeth(client, monkeypatch):
    provider = AsyncMock()
    monkeypatch.setattr(analysis, "analyze_with_openai", provider)
    payload = mechanics_request()
    payload["context"]["teeth"].append({"id": "31", "translationMm": [0, 0, 0], "rotationDeg": [0, 0, 0], "locked": False})
    payload["context"]["appliances"]["expanders"][0]["left"] = ["31"]
    assert client.post("/api/analyze-teaching", json=payload).status_code == 422
    provider.assert_not_called()


def test_sdk_receives_anonymous_connections_exact_inputs_and_no_inferred_response(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-only")
    sdk = MagicMock()
    sdk.responses.parse = AsyncMock()
    sdk.responses.parse.return_value = SimpleNamespace(output_parsed=analysis.SceneExplanation(**explanation()))
    factory = MagicMock()
    factory.return_value.__aenter__.return_value = sdk
    monkeypatch.setattr(analysis, "AsyncOpenAI", factory)
    original = mechanics_request()
    payload = analysis.AnalysisRequest.model_validate(original)
    assert asyncio.run(analysis.analyze_with_openai(payload, 20)).model_dump() == explanation()
    call = sdk.responses.parse.call_args.kwargs
    sent = json.loads(call["input"][1]["content"])
    assert sent == original
    assert sent["context"]["result"] is None
    assert "from_" not in call["input"][1]["content"]
    assert all("id" not in item for item in sent["context"]["appliances"]["elastics"])
    assert all("id" not in item for item in sent["context"]["appliances"]["expanders"])
    assert call["store"] is False and "tools" not in call
    instructions = call["input"][0]["content"]
    for required in ["READ ONLY", "virtual teaching assumptions", "mechanical anchorage",
                     "only prevents geometric", "configured load", "not proof of extension",
                     "scene-space", "local frame", "incomplete geometry", "not biological progression"]:
        assert required in instructions
