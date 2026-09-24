"""Independent source/parameter auditing for conversational appliance intents."""
import copy
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
import main


IDS = ["11", "12", "13", "21", "22", "23", "16", "26"]


def context():
    return {"mode": "case", "workflowId": None, "stepIndex": 0, "selected": "11", "selectedIds": ["11", "21"], "availableIds": IDS, "synthetic": True, "revision": 1, "view": "perspective", "arch": "both", "speed": 1,
            "pointed": {"tooth": "11", "localPoint": [1, 2, 3], "worldPoint": [6, 7, 8]},
            "mechanics": {"config": {"brackets": {}, "wires": [], "tads": [], "elastics": [], "expanders": [], "support": "standard", "fixedTeeth": []}, "bracketAnchors": {tooth: [0, 0, 3] for tooth in IDS}, "focus": {}, "stageIndex": 0, "stageCount": 1, "hasResult": False, "wirePreset": {"material": "stainless-steel", "section": {"shape": "round", "diameterMm": .4}}}}


def with_wire():
    scene = context()
    scene["mechanics"]["config"]["brackets"] = {"11": [0, 0, 3], "21": [0, 0, 3]}
    scene["mechanics"]["config"]["wires"] = [{"id": "wire-1", "teeth": ["11", "21"], "material": "stainless-steel", "section": {"shape": "round", "diameterMm": .4}, "expansionMm": .1, "torqueDeg": 0}]
    scene["mechanics"]["focus"] = {"wireId": "wire-1", "lastParameter": "wire-section"}
    return scene


def wrap(*actions):
    return {"actions": [{"kind": "mechanics", "action": action} for action in actions], "summary": "Update the teaching experiment.", "clarification": None}


@pytest.fixture
def client():
    return TestClient(main.app)


def post(client, monkeypatch, source, result, scene=None):
    provider = MagicMock(return_value=result)
    monkeypatch.setattr(main, "interpret_teaching_with_openai", provider)
    response = client.post("/api/interpret-teaching", json={"text": source, "context": scene or context()})
    return response, provider


def test_select_then_brackets_then_visible_wire_preset(client, monkeypatch):
    result = wrap({"type": "brackets", "teeth": ["11", "21"], "installed": True}, {"type": "wire", "id": "wire-1", "teeth": ["11", "21"], "material": "stainless-steel", "section": {"shape": "round", "diameterMm": .4}})
    response, _ = post(client, monkeypatch, "install brackets here and put a wire through these brackets", result)
    assert response.status_code == 200, response.text
    assert response.json() == result  # Optional wire settings must not become null fields.


def test_gingiva_point_preserves_surface_and_actual_tad_position(client, monkeypatch):
    scene = context()
    scene["pointed"]["surface"] = "gingiva"
    scene["selectedIds"] = ["21"]
    result = wrap({"type": "brackets", "teeth": ["11"], "installed": True}, {"type": "tad", "id": "tad-1", "position": [6, 7, 8]})
    response, provider = post(client, monkeypatch, "install brackets here and put a TAD here", result, scene)
    assert response.status_code == 200, response.text
    assert provider.call_args.args[0].context.pointed.surface == "gingiva"
    scene["pointed"]["surface"] = "unknown"
    response, provider = post(client, monkeypatch, "put a TAD here", result, scene)
    assert response.status_code == 422
    provider.assert_not_called()


def test_pointed_tad_and_equal_total_tension(client, monkeypatch):
    scene = with_wire()
    actions = [{"type": "tad", "id": "tad-1", "position": [6, 7, 8]}]
    for index, tooth in enumerate(("11", "21")):
        actions.append({"type": "elastic", "id": f"elastic-{index+1}", "from": {"kind": "tad", "id": "tad-1"}, "to": {"kind": "tooth", "tooth": tooth, "local": [0, 0, 3]}, "law": {"kind": "constant", "forceN": .5}})
    actions.append({"type": "solve"})
    result = wrap(*actions)
    response, _ = post(client, monkeypatch, "put a TAD here and connect it to these teeth at 1 N then show what happens", result, scene)
    assert response.status_code == 200, response.text
    assert response.json() == result


def test_replacement_recalculates_current_wire_without_accumulation(client, monkeypatch):
    scene = with_wire()
    scene["mechanics"]["hasResult"] = True
    expected = wrap({"type": "wire-section", "id": "wire-1", "section": {"shape": "round", "diameterMm": .5}}, {"type": "solve"})
    response, _ = post(client, monkeypatch, "make that 0.5 mm instead", expected, scene)
    assert response.status_code == 200, response.text
    assert response.json() == expected
    response, _ = post(client, monkeypatch, "make that 0.5 mm instead", {**expected, "actions": expected["actions"][:1]}, scene)
    assert response.status_code == 422
    scene["mechanics"]["config"]["wires"][0]["section"] = {"shape": "rectangle", "widthMm": .5, "heightMm": .4}
    response, _ = post(client, monkeypatch, "make that 0.5 mm instead", expected, scene)
    assert response.status_code == 422
    assert "both height and width" in response.json()["detail"]


@pytest.mark.parametrize("separator", ["by", "x", "×"])
def test_rectangular_wire_uses_dental_height_then_width(client, monkeypatch, separator):
    expected = wrap({"type": "wire-section", "id": "wire-1", "section": {"shape": "rectangle", "heightMm": .4826, "widthMm": .635}})
    response, _ = post(client, monkeypatch, f"use a 0.019 {separator} 0.025 inch wire instead", expected, with_wire())
    assert response.status_code == 200, response.text
    assert response.json() == expected


@pytest.mark.parametrize("source,action", [
    ("put a TAD here", {"type": "tad", "id": "tad-1", "position": [9, 9, 9]}),
    ("install brackets here", {"type": "brackets", "teeth": ["16", "26"], "installed": True}),
    ("use a 0.5 mm wire instead", {"type": "wire-section", "id": "wire-1", "section": {"shape": "round", "diameterMm": .4}}),
    ("use a thicker wire instead", {"type": "wire-section", "id": "wire-1", "section": {"shape": "round", "diameterMm": .5}}),
    ("show roots", {"type": "solve"}),
])
def test_provider_cannot_invent_targets_numeric_settings_or_results(client, monkeypatch, source, action):
    response, _ = post(client, monkeypatch, source, wrap(action), with_wire())
    assert response.status_code == 422, response.text


def test_no_silent_omitted_appliance_or_duplicate_creation(client, monkeypatch):
    brackets = {"type": "brackets", "teeth": ["11", "21"], "installed": True}
    wire = {"type": "wire", "id": "wire-1", "teeth": ["11", "21"], "material": "stainless-steel", "section": {"shape": "round", "diameterMm": .4}}
    source = "install brackets here and put a wire through these brackets"
    for result in (wrap(brackets), wrap(brackets, wire, {**wire, "id": "wire-2"})):
        response, _ = post(client, monkeypatch, source, result)
        assert response.status_code == 422, response.text


def test_passive_brackets_do_not_invent_response(client, monkeypatch):
    response, _ = post(client, monkeypatch, "install brackets here and show what happens", wrap({"type": "brackets", "teeth": ["11", "21"], "installed": True}, {"type": "solve"}))
    assert response.status_code == 422
    assert "activation" in response.json()["detail"]


@pytest.mark.parametrize("change", [
    {"synthetic": False}, {"mode": "workflow", "workflowId": "fixed-braces"}, {"pointed": None},
])
def test_tad_placement_requires_synthetic_free_workspace_and_real_point(client, monkeypatch, change):
    scene = {**context(), **change}
    response, _ = post(client, monkeypatch, "put a TAD here", wrap({"type": "tad", "id": "tad-1", "position": [6, 7, 8]}), scene)
    assert response.status_code == 422


@pytest.mark.parametrize("invalid", [
    {"position": [201, 0, 0]}, {"position": [1, 2]}, {"position": [True, 2, 3]}, {"position": ["1", 2, 3]}, {"position": [1, 2, 3], "script": "bad"},
])
def test_strict_provider_shape_rejects_extra_and_invalid_coordinates(client, monkeypatch, invalid):
    response, _ = post(client, monkeypatch, "put a TAD here", wrap({"type": "tad", "id": "tad-1", **invalid}))
    assert response.status_code == 502


def test_context_rejects_unknown_model_references_before_provider(client, monkeypatch):
    scene = context()
    scene["mechanics"]["bracketAnchors"]["47"] = [1, 2, 3]
    response, provider = post(client, monkeypatch, "show roots", {"actions": [{"kind": "toggle", "target": "roots", "visible": True}], "summary": "", "clarification": None}, scene)
    assert response.status_code == 422
    provider.assert_not_called()


def test_context_serializes_elastic_from_alias_and_no_meshes():
    scene = context()
    scene["mechanics"]["config"]["tads"] = [{"id": "tad-1", "position": [1, 2, 3]}]
    scene["mechanics"]["config"]["elastics"] = [{"id": "elastic-1", "from": {"kind": "tad", "id": "tad-1"}, "to": {"kind": "tooth", "tooth": "11", "local": [0, 0, 3]}, "law": {"kind": "constant", "forceN": 1}}]
    payload = main.TeachingRequest.model_validate({"text": "show roots", "context": copy.deepcopy(scene)})
    sent = payload.model_dump(exclude_none=True, by_alias=True)
    assert "from" in sent["context"]["mechanics"]["config"]["elastics"][0]
    assert "from_" not in str(sent)
    assert "meshes" not in str(sent)


def test_politely_worded_appliance_commands_use_the_same_evidence(client, monkeypatch):
    result = wrap({"type": "brackets", "teeth": ["11", "21"], "installed": True}, {"type": "wire", "id": "wire-1", "teeth": ["11", "21"], "material": "stainless-steel", "section": {"shape": "round", "diameterMm": .4}})
    response, _ = post(client, monkeypatch, "Could you attach brackets over here and thread a wire through these brackets?", result)
    assert response.status_code == 200, response.text


def test_expander_uses_explicit_parameters_and_replacement_activation(client, monkeypatch):
    action = {"type": "expander", "id": "expander-1", "left": ["26"], "right": ["16"], "activationMm": .1, "stiffnessNPerMm": 10}
    source = "install a palatal expander on upper molars with activation 0.1 mm and stiffness 10 N/mm then show what happens"
    response, _ = post(client, monkeypatch, source, wrap(action, {"type": "solve"}))
    assert response.status_code == 200, response.text
    scene = context()
    scene["mechanics"]["config"]["expanders"] = [{key: value for key, value in action.items() if key != "type"}]
    scene["mechanics"]["hasResult"] = True
    result = wrap({**action, "activationMm": .2}, {"type": "solve"})
    response, _ = post(client, monkeypatch, "activate the expander to 0.2 mm", result, scene)
    assert response.status_code == 200, response.text
    response, _ = post(client, monkeypatch, "install a palatal expander here", wrap(action))
    assert response.status_code == 422


@pytest.mark.parametrize("solve", [False, True])
def test_expander_long_instruction_keeps_all_three_parameters_atomic(client, monkeypatch, solve):
    action = {"type": "expander", "id": "expander-1", "left": ["26"], "right": ["16"], "activationMm": .1, "stiffnessNPerMm": 10, "palateStiffnessNPerMm": 20}
    source = "install a palatal expander on upper molars with activation 0.1 mm and stiffness 10 N/mm and palate stiffness 20 N/mm"
    if solve:
        source += " then show what happens"
    result = wrap(action, *([{"type": "solve"}] if solve else []))
    response, _ = post(client, monkeypatch, source, result)
    assert response.status_code == 200, response.text
    assert response.json() == result
    assert len(response.json()["actions"]) == (2 if solve else 1)


def test_last_wire_dimension_can_retain_its_explicit_prior_unit(client, monkeypatch):
    result = wrap({"type": "wire-section", "id": "wire-1", "section": {"shape": "round", "diameterMm": .5}})
    response, _ = post(client, monkeypatch, "make that 0.5 instead", result, with_wire())
    assert response.status_code == 200, response.text
