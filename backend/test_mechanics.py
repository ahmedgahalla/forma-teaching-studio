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


@pytest.mark.parametrize("source", ["Please thread a wire through these brackets.", "Could you put a wire through these brackets?", "Please install a wire through these brackets."])
def test_natural_wire_request_requires_exactly_the_passive_preset_action(client, monkeypatch, source):
    scene = with_wire()
    scene["mechanics"]["config"]["wires"] = []
    scene["mechanics"]["focus"] = {}
    wire = {"type": "wire", "id": "wire-1", "teeth": ["11", "21"], "material": "stainless-steel", "section": {"shape": "round", "diameterMm": .4}}
    result = wrap(wire)
    response, _ = post(client, monkeypatch, source, result, scene)
    assert response.status_code == 200, response.text
    assert response.json() == result

    response, _ = post(client, monkeypatch, source, wrap(wire, {"type": "solve"}), scene)
    assert response.status_code == 422
    assert "no matching source instruction" in response.json()["detail"]
    response, _ = post(client, monkeypatch, source, wrap({**wire, "section": {"shape": "round", "diameterMm": .5}}), scene)
    assert response.status_code == 422


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


@pytest.mark.parametrize("has_result", [False, True])
def test_adjacent_explicit_solve_satisfies_replacement_recalculation_once(client, monkeypatch, has_result):
    scene = with_wire()
    scene["mechanics"]["hasResult"] = has_result
    source = "Use a 0.018 inch wire instead, then show me what happens."
    replacement = {"type": "wire-section", "id": "wire-1", "section": {"shape": "round", "diameterMm": .018 * 25.4}}
    solve = {"type": "solve"}
    expected = wrap(replacement, solve)
    response, _ = post(client, monkeypatch, source, expected, scene)
    assert response.status_code == 200, response.text
    assert response.json() == expected
    for invalid in [wrap(replacement), wrap(replacement, solve, solve), wrap({**replacement, "section": {"shape": "round", "diameterMm": .5}}, solve)]:
        response, _ = post(client, monkeypatch, source, invalid, scene)
        assert response.status_code == 422


def test_replacement_does_not_consume_a_nonadjacent_explicit_solve(client, monkeypatch):
    scene = with_wire()
    scene["mechanics"]["hasResult"] = True
    source = "Use a 0.018 inch wire instead then hide gums then show what happens"
    result = wrap({"type": "wire-section", "id": "wire-1", "section": {"shape": "round", "diameterMm": .018 * 25.4}}, {"type": "solve"})
    result["actions"].append({"kind": "toggle", "target": "gums", "visible": False})
    response, _ = post(client, monkeypatch, source, result, scene)
    assert response.status_code == 422
    result["actions"].append({"kind": "mechanics", "action": {"type": "solve"}})
    response, _ = post(client, monkeypatch, source, result, scene)
    assert response.status_code == 200, response.text


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


UPPER_PATH = ["16", "13", "12", "11", "21", "22", "23", "26"]


def passive_wire(teeth, identity="wire-1"):
    return {"type": "wire", "id": identity, "teeth": teeth, "material": "stainless-steel", "section": {"shape": "round", "diameterMm": .4}}


@pytest.mark.parametrize("source", ["put wire on all teeth", "fit a wire on every tooth", "thread wire through all the teeth", "place an archwire on the whole upper arch"])
def test_whole_visible_arch_wire_adds_only_missing_brackets(client, monkeypatch, source):
    scene = context()
    scene["arch"] = "upper"
    scene["mechanics"]["config"]["brackets"]["11"] = [1, 2, 3]
    result = wrap({"type": "brackets", "teeth": [tooth for tooth in UPPER_PATH if tooth != "11"], "installed": True}, passive_wire(UPPER_PATH))
    before = copy.deepcopy(scene)
    response, _ = post(client, monkeypatch, source, result, scene)
    assert response.status_code == 200, response.text
    assert response.json() == result
    assert scene == before


@pytest.mark.parametrize("source", ["put wires on both arches", "put wire on the whole mouth", "put wire on all teeth"])
def test_two_arch_wire_request_remains_one_atomic_passive_setup(client, monkeypatch, source):
    scene = context()
    scene["availableIds"] = scene["availableIds"] + ["31", "41", "36", "46"]
    scene["mechanics"]["bracketAnchors"].update({tooth: [0, 0, 3] for tooth in ["31", "41", "36", "46"]})
    lower = ["46", "41", "31", "36"]
    result = wrap({"type": "brackets", "teeth": UPPER_PATH, "installed": True}, passive_wire(UPPER_PATH), {"type": "brackets", "teeth": lower, "installed": True}, passive_wire(lower, "wire-2"))
    response, _ = post(client, monkeypatch, source, result, scene)
    assert response.status_code == 200, response.text
    assert response.json() == result
    assert len(result["actions"]) == 4
    if source != "put wire on all teeth":
        scene["arch"] = "upper"
        response, _ = post(client, monkeypatch, source, result, scene)
        assert response.status_code == 200, response.text


def test_explicit_arch_overrides_visibility_and_braces_is_a_bracket_request(client, monkeypatch):
    scene = context()
    scene["arch"] = "lower"
    result = wrap({"type": "brackets", "teeth": UPPER_PATH, "installed": True}, passive_wire(UPPER_PATH))
    response, _ = post(client, monkeypatch, "put wire on all upper teeth", result, scene)
    assert response.status_code == 200, response.text
    result = wrap({"type": "brackets", "teeth": IDS, "installed": True})
    response, _ = post(client, monkeypatch, "put braces on every upper tooth", result, scene)
    assert response.status_code == 200, response.text


def test_existing_identical_wire_is_reused_with_its_activation_preserved(client, monkeypatch):
    scene = with_wire()
    result = wrap({"type": "wire", **scene["mechanics"]["config"]["wires"][0]})
    response, _ = post(client, monkeypatch, "put a wire on these teeth", result, scene)
    assert response.status_code == 200, response.text
    assert response.json() == result
    response, _ = post(client, monkeypatch, "put a wire on these teeth", wrap(passive_wire(["11", "21"], "wire-2")), scene)
    assert response.status_code == 422
    extended = wrap({"type": "brackets", "teeth": [tooth for tooth in UPPER_PATH if tooth not in ("11", "21")], "installed": True}, {"type": "wire", **scene["mechanics"]["config"]["wires"][0], "teeth": UPPER_PATH})
    response, _ = post(client, monkeypatch, "put wire on all upper teeth", extended, scene)
    assert response.status_code == 200, response.text
    assert response.json() == extended
    scene["mechanics"]["config"]["wires"][0]["teeth"] = UPPER_PATH
    scene["mechanics"]["config"]["brackets"] = {tooth: [0, 0, 3] for tooth in UPPER_PATH}
    response, _ = post(client, monkeypatch, "put wire on upper incisors", result, scene)
    assert response.status_code == 422
    assert "extend beyond" in response.json()["detail"]


@pytest.mark.parametrize("alter", ["omit-brackets", "reverse-path", "invent-activation", "invent-solve"])
def test_whole_arch_cannot_skip_prerequisites_change_path_or_invent_response(client, monkeypatch, alter):
    scene = context()
    scene["arch"] = "upper"
    bracket, wire = {"type": "brackets", "teeth": UPPER_PATH, "installed": True}, passive_wire(UPPER_PATH)
    actions = [bracket, wire]
    if alter == "omit-brackets":
        actions = [wire]
    elif alter == "reverse-path":
        wire["teeth"] = list(reversed(UPPER_PATH))
    elif alter == "invent-activation":
        wire["expansionMm"] = .5
    else:
        actions.append({"type": "solve"})
    response, _ = post(client, monkeypatch, "put wire on all teeth", wrap(*actions), scene)
    assert response.status_code == 422, response.text


def test_pronoun_can_use_recent_appliance_tooth_focus_but_explicit_selection_cannot(client, monkeypatch):
    scene = context()
    scene["selectedIds"], scene["selected"] = [], ""
    scene["mechanics"]["focus"]["teeth"] = ["11", "21"]
    result = wrap({"type": "brackets", "teeth": ["11", "21"], "installed": True})
    response, _ = post(client, monkeypatch, "put brackets on them", result, scene)
    assert response.status_code == 200, response.text
    response, _ = post(client, monkeypatch, "put brackets on selected teeth", result, scene)
    assert response.status_code == 422


@pytest.mark.parametrize("arch", ["upper", "both"])
def test_normal_28_tooth_model_never_requires_absent_third_molars(client, monkeypatch, arch):
    scene = context()
    scene["availableIds"] = [f"{quadrant}{position}" for quadrant in range(1, 5) for position in range(1, 8)]
    scene["arch"] = arch
    scene["mechanics"]["bracketAnchors"] = {tooth: [0, 0, 3] for tooth in scene["availableIds"]}
    upper = [f"1{position}" for position in range(7, 0, -1)] + [f"2{position}" for position in range(1, 8)]
    lower = [f"4{position}" for position in range(7, 0, -1)] + [f"3{position}" for position in range(1, 8)]
    actions = [{"type": "brackets", "teeth": upper, "installed": True}, passive_wire(upper)]
    if arch == "both":
        actions += [{"type": "brackets", "teeth": lower, "installed": True}, passive_wire(lower, "wire-2")]
    result = wrap(*actions)
    response, _ = post(client, monkeypatch, "Put wire on all teeth", result, scene)
    assert response.status_code == 200, response.text
    assert response.json() == result
    assert all(tooth not in ("18", "28", "38", "48") for action in response.json()["actions"] for tooth in action["action"]["teeth"])
    assert "normal synthetic adult model has 28 teeth" in main.TEACHING_INSTRUCTIONS


def test_provider_hints_ground_entire_compound_setup_against_empty_active_experiment():
    scene = context()
    before = copy.deepcopy(scene)
    payload = main.TeachingRequest.model_validate({"text": "Select the upper anterior teeth, install brackets on them, and put a wire through those brackets.", "context": scene})
    teeth = ["11", "12", "13", "21", "22", "23"]
    path = ["13", "12", "11", "21", "22", "23"]
    grounded = main.grounded_mechanics_plan(payload)
    assert grounded is not None
    assert [action.model_dump(exclude_none=True, by_alias=True) for action in grounded.actions] == [
        {"kind": "select", "teeth": teeth},
        {"kind": "mechanics", "action": {"type": "brackets", "teeth": teeth, "installed": True}},
        {"kind": "mechanics", "action": passive_wire(path)},
    ]
    assert scene == before
    hint = main.teaching_interpretation_instructions(payload)
    assert "recognized the ENTIRE current request" in hint
    assert "empty config is already an ACTIVE" in hint


@pytest.mark.parametrize("source", [
    "put wire on all teeth and invent a movement",
    "put wire on upper teeth except 11",
    "put wire on all teeth and show what happens",
    "use a thicker wire instead",
    "select six upper teeth",
])
def test_partial_unsupported_or_ambiguous_requests_receive_no_canonical_hint(source):
    payload = main.TeachingRequest.model_validate({"text": source, "context": context()})
    assert main.grounded_mechanics_plan(payload) is None
    assert main.teaching_interpretation_instructions(payload) == main.TEACHING_INSTRUCTIONS
