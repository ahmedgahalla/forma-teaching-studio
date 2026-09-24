"""Teaching-plan contract and semantic audits; all provider calls are mocked."""

import copy
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import APITimeoutError, AuthenticationError, RateLimitError, APIStatusError
from openai.lib._pydantic import to_strict_json_schema

import main


IDS = [f"{q}{p}" for q in range(1, 5) for p in range(1, 9)]


def context(**overrides):
    return {"mode": "case", "workflowId": None, "stepIndex": 0, "selected": "11",
            "selectedIds": ["11", "12"], "availableIds": IDS, "synthetic": True,
            "revision": 4, "view": "perspective", "arch": "both", "speed": 1,
            "stage": 10, "stages": 10, **overrides}


def request(text="Show roots", **overrides):
    return {"text": text, "context": context(**overrides)}


def plan(*actions, clarification=None):
    return {"actions": list(actions), "summary": "A classroom demonstration.", "clarification": clarification}


def dental(tooth="11", amount=1, direction="buccal"):
    return {"kind": "dental", "command": {"type": "move", "tooth": tooth, "direction": direction, "amount": amount}}


def fake(monkeypatch, result):
    provider = MagicMock(return_value=result)
    monkeypatch.setattr(main, "interpret_teaching_with_openai", provider)
    return provider


def wire_context():
    return {"config": {"brackets": {"11": [0, 0, 3], "21": [0, 0, 3]},
            "wires": [{"id": "wire-1", "teeth": ["11", "21"], "material": "stainless-steel",
                       "section": {"shape": "round", "diameterMm": .4}, "expansionMm": 0, "torqueDeg": 0}],
            "tads": [], "elastics": [], "expanders": [], "support": "standard", "fixedTeeth": []},
            "bracketAnchors": {"11": [0, 0, 3], "21": [0, 0, 3]}, "focus": {"wireId": "wire-1"},
            "stageIndex": 0, "stageCount": 1, "hasResult": False}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    return TestClient(main.app)


def post(client, payload):
    return client.post("/api/interpret-teaching", json=payload)


@pytest.mark.parametrize("wording,field,amount", [
    ("activate that wire by half a millimeter", "expansionMm", .5),
    ("activate that wire by half a millimetre", "expansionMm", .5),
    ("activate that wire by zero point five millimeters", "expansionMm", .5),
    ("activate that wire by zero point five millimetres", "expansionMm", .5),
    ("activate that wire by one and a half millimeters", "expansionMm", 1.5),
    ("activate that wire by a quarter millimetre", "expansionMm", .25),
    ("set that wire torque to one degree", "torqueDeg", 1),
    ("set that wire torque to five degrees", "torqueDeg", 5),
])
def test_natural_wire_units_preserve_exact_activation_and_solve(client, monkeypatch, wording, field, amount):
    action = {"type": "wire-activation", "id": "wire-1", "expansionMm": 0, "torqueDeg": 0, field: amount}
    expected = plan({"kind": "mechanics", "action": action}, {"kind": "mechanics", "action": {"type": "solve"}})
    fake(monkeypatch, expected)
    payload = request(f"Could you {wording}, then show me what happens?", mechanics=wire_context())
    response = post(client, payload)
    assert response.status_code == 200, response.text
    assert response.json() == expected

    wrong = {**action, field: amount + .1}
    fake(monkeypatch, plan({"kind": "mechanics", "action": wrong}, {"kind": "mechanics", "action": {"type": "solve"}}))
    assert post(client, payload).status_code == 422


@pytest.mark.parametrize("wording", ["activate that wire by millimeters", "activate that wire by half", "activate that wire by five degrees"])
def test_natural_wire_normalization_never_supplies_missing_amount_or_unit(client, monkeypatch, wording):
    fake(monkeypatch, plan({"kind": "mechanics", "action": {"type": "wire-activation", "id": "wire-1", "expansionMm": .5, "torqueDeg": 0}}))
    assert post(client, request(wording, mechanics=wire_context())).status_code == 422


def test_teaching_missing_key_is_actionable(client):
    result = post(client, request())
    assert result.status_code == 503
    assert "OPENAI_API_KEY" in result.json()["detail"]


@pytest.mark.parametrize("lesson_active", [False, True])
def test_case_before_first_lesson_step_accepts_fractional_playback_context(client, monkeypatch, lesson_active):
    expected = plan({"kind": "toggle", "target": "roots", "visible": True})
    provider = fake(monkeypatch, expected)
    result = post(client, request(stepIndex=-1, lessonActive=lesson_active, stage=4.375))
    assert result.status_code == 200, result.text
    assert result.json() == expected
    sent = provider.call_args.args[0].context
    assert sent.stepIndex == -1
    assert sent.stage == 4.375


@pytest.mark.parametrize("stage", [None, 0, 0.001, 49.999, 50])
def test_playback_context_keeps_optional_and_integer_stage_compatibility(client, monkeypatch, stage):
    fake(monkeypatch, plan({"kind": "stop"}))
    assert post(client, request(stage=stage, stages=50)).status_code == 200


@pytest.mark.parametrize("stage,action,status", [
    (9.49, "next", 200), (9.5, "next", 422),
    (0.49, "previous", 422), (0.5, "previous", 200),
])
def test_relative_stage_bounds_round_fractional_positions_like_the_frontend(client, monkeypatch, stage, action, status):
    fake(monkeypatch, plan({"kind": "stage", "action": action}))
    result = post(client, request(f"{action} stage", stage=stage))
    assert result.status_code == status, result.text


@pytest.mark.parametrize("field,value", [
    ("stepIndex", -2), ("stepIndex", 51), ("stepIndex", 0.5), ("stepIndex", True), ("stepIndex", "-1"),
    ("stage", -0.001), ("stage", 50.001), ("stage", 10.001), ("stage", True), ("stage", "4.375"),
    *[(field, value) for field in ("stage", "stepIndex") for value in (float("nan"), float("inf"), float("-inf"))],
])
def test_invalid_playback_context_is_rejected_before_provider(client, monkeypatch, field, value):
    provider = fake(monkeypatch, plan({"kind": "stop"}))
    # Raw JSON also exercises rejection of nonstandard NaN/Infinity tokens.
    result = client.post("/api/interpret-teaching", content=json.dumps(request(**{field: value})), headers={"Content-Type": "application/json"})
    assert result.status_code == 422
    provider.assert_not_called()


@pytest.mark.parametrize("workflow_id", ["fixed-braces", "archwire-expansion", "palatal-expansion", "anatomy"])
def test_no_lesson_step_sentinel_is_not_a_workflow_step(client, monkeypatch, workflow_id):
    provider = fake(monkeypatch, plan({"kind": "stop"}))
    assert post(client, request(mode="workflow", workflowId=workflow_id, stepIndex=-1)).status_code == 422
    provider.assert_not_called()


@pytest.mark.parametrize("text,action", [
    ("Show roots", {"kind": "toggle", "target": "roots", "visible": True}),
    ("Hide gums", {"kind": "toggle", "target": "gums", "visible": False}),
    ("Show occlusal view", {"kind": "view", "view": "occlusal"}),
    ("Show upper arch", {"kind": "arch", "arch": "upper"}),
    ("Show original overlay", {"kind": "comparison", "mode": "overlay"}),
    ("Show bone", {"kind": "anatomy", "action": "bone", "visible": True}),
    ("Show cutaway", {"kind": "anatomy", "action": "cutaway", "visible": True}),
    ("Show ligament", {"kind": "anatomy", "action": "ligament", "visible": True}),
    ("Set bone opacity to 0.4", {"kind": "anatomy", "action": "opacity", "value": 0.4}),
    ("Play slowly", {"kind": "speed", "value": 0.5}),
    ("Enter lecture mode", {"kind": "lecture", "enabled": True}),
    ("Pause", {"kind": "stop"}),
    ("Show stage 4", {"kind": "stage", "action": "exact", "stage": 4}),
    ("Previous stage", {"kind": "stage", "action": "previous"}),
    ("Undo", {"kind": "dental", "command": {"type": "undo"}}),
    ("Redo", {"kind": "dental", "command": {"type": "redo"}}),
])
def test_allowlisted_display_actions(client, monkeypatch, text, action):
    expected = plan(action)
    fake(monkeypatch, expected)
    result = post(client, request(text))
    assert result.status_code == 200, result.text
    assert result.json() == expected


def test_sequential_arch_selection_and_pronouns_are_audited(client, monkeypatch):
    upper = ["11", "12", "21", "22"]
    expected = plan({"kind": "arch", "arch": "upper"}, {"kind": "select", "teeth": upper},
                    {"kind": "dental", "command": {"type": "move_group", "teeth": upper, "direction": "buccal", "amount": 0.5}},
                    {"kind": "dental", "command": {"type": "rotate", "tooth": "11", "axis": "z", "amount": 5}})
    fake(monkeypatch, expected)
    result = post(client, request("Show upper arch; select incisors; move them buccally 0.5 mm; rotate it 5 degrees around z"))
    assert result.status_code == 200, result.text
    assert result.json() == expected


def test_movement_changes_following_pronoun_reference(client, monkeypatch):
    fake(monkeypatch, plan(dental("21"), dental("21", 0.5, "lingual")))
    result = post(client, request("move 21 buccally 1 mm then move it lingually 0.5 mm"))
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("text,action", [
    ("Move 11 buccally one mm", dental()),
    ("Move 11 buccally half a millimeter", dental(amount=0.5)),
    ("Move tooth eleven buccally zero point zero five millimeters", dental(amount=0.05)),
    ("Move 11 buccally one and a half mm", dental(amount=1.5)),
    ("Move 11 buccally 0.1 cm", dental()),
    ("Move 11 x 1e-7 mm", dental(amount=1e-7, direction="x")),
    ("Rotate 11 minus five degrees around z", {"kind": "dental", "command": {"type": "rotate", "tooth": "11", "axis": "z", "amount": -5}}),
    ("Rotate 11 one hundred and five degrees around z", {"kind": "dental", "command": {"type": "rotate", "tooth": "11", "axis": "z", "amount": 105}}),
    ("Torque lower incisors -3 degrees", {"kind": "dental", "command": {"type": "orthodontic", "teeth": ["31", "32", "41", "42"], "movement": "torque", "amount": -3}}),
])
def test_explicit_numeric_units_and_named_groups(client, monkeypatch, text, action):
    fake(monkeypatch, plan(action))
    result = post(client, request(text))
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("text,action", [
    ("Move 11 buccally", dental()),
    ("Move 11 1 mm", dental()),
    ("Move 11 buccally 1 mm", dental(amount=2)),
    ("Move 11 buccally 1 mm", dental(direction="lingual")),
    ("Move 11 buccally 1 mm", dental("12")),
    ("Move 11 buccally 0 mm", dental(amount=0)),
    ("Move 11 buccally 1 mm and lingually 2 mm", dental()),
    ("Rotate 11 5 degrees around z", {"kind": "dental", "command": {"type": "rotate", "tooth": "11", "axis": "x", "amount": 5}}),
    ("Tip 11 5 degrees", {"kind": "dental", "command": {"type": "orthodontic", "teeth": ["11"], "movement": "torque", "amount": 5}}),
    ("Rotate 11 5 degrees around z", {"kind": "dental", "command": {"type": "orthodontic", "teeth": ["11"], "movement": "rotate", "amount": 5}}),
    ("Rotate 11 5 degrees", {"kind": "dental", "command": {"type": "orthodontic", "teeth": ["11"], "movement": "rotate", "amount": 5}}),
    ("Create 10 stages", {"kind": "dental", "command": {"type": "stages", "count": 12}}),
    ("Show roots", dental()),
])
def test_model_cannot_invent_amounts_directions_or_targets(client, monkeypatch, text, action):
    fake(monkeypatch, plan(action))
    assert post(client, request(text)).status_code == 422


def test_sequential_amounts_cannot_be_swapped_or_silently_omitted(client, monkeypatch):
    payload = request("Move 11 buccally 1 mm then move 12 lingually 2 mm")
    fake(monkeypatch, plan(dental("11", 2), dental("12", 1, "lingual")))
    assert post(client, payload).status_code == 422
    fake(monkeypatch, plan(dental("11")))
    assert post(client, payload).status_code == 422


def test_targeted_instructions_cannot_be_reordered(client, monkeypatch):
    fake(monkeypatch, plan(dental(), {"kind": "select", "teeth": ["11"]}))
    assert post(client, request("Select 11 then move it buccally 1 mm")).status_code == 422


def test_them_requires_a_group_not_active_tooth_fallback(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "dental", "command": {"type": "move_group", "teeth": ["11"], "direction": "buccal", "amount": 1}}))
    assert post(client, request("Move them buccally 1 mm", selectedIds=[])).status_code == 422


def test_available_but_wrong_arch_family_targets_are_rejected(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "select", "teeth": ["11", "12", "21", "22", "31", "32", "41", "42"]}))
    assert post(client, request("Select incisors", arch="upper")).status_code == 422


def test_workflow_start_speed_and_play_are_ordered(client, monkeypatch):
    expected = plan({"kind": "workflow", "action": "start", "id": "palatal-expansion"},
                    {"kind": "speed", "value": 0.5}, {"kind": "workflow", "action": "play"})
    fake(monkeypatch, expected)
    assert post(client, request("Demonstrate palatal expansion slowly")).json() == expected
    fake(monkeypatch, plan(expected["actions"][2], expected["actions"][0]))
    assert post(client, request("Demonstrate palatal expansion slowly")).status_code == 422


def test_workflow_free_edit_and_return_preserve_lesson_support(client, monkeypatch):
    expected = plan(dental(), {"kind": "return-lesson"})
    fake(monkeypatch, expected)
    result = post(client, request("Move 11 buccally 1 mm then return to lesson", mode="workflow", workflowId="fixed-braces", stepIndex=4))
    assert result.status_code == 200, result.text
    assert result.json() == expected


@pytest.mark.parametrize("action,text", [
    ({"kind": "attachment", "action": "add", "teeth": ["11"], "shape": "rectangle"}, "Add rectangular attachments to tooth 11"),
    ({"kind": "attachment", "action": "remove", "teeth": ["11"]}, "Remove attachments from tooth 11"),
])
def test_workflow_attachment_edits_are_reversible_variations(client, monkeypatch, action, text):
    expected = plan(action, {"kind": "return-lesson"})
    fake(monkeypatch, expected)
    result = post(client, request(f"{text} then return to the lesson", mode="workflow", workflowId="anatomy"))
    assert result.status_code == 200, result.text
    assert result.json() == expected


def test_explicit_selection_survives_workflow_start_and_play(client, monkeypatch):
    expected = plan({"kind": "select", "teeth": ["21", "22"]},
                    {"kind": "workflow", "action": "start", "id": "fixed-braces"},
                    {"kind": "workflow", "action": "play"},
                    {"kind": "dental", "command": {"type": "move_group", "teeth": ["21", "22"], "direction": "buccal", "amount": 1}})
    fake(monkeypatch, expected)
    result = post(client, request("Select 21 and 22 then start braces workflow then play demonstration then move them buccally 1 mm"))
    assert result.status_code == 200, result.text


def test_workflow_cannot_silently_drop_a_preceding_selection(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "select", "teeth": ["18"]}, {"kind": "workflow", "action": "start", "id": "fixed-braces"}))
    assert post(client, request("Select 18 then start braces workflow")).status_code == 422


@pytest.mark.parametrize("action", ["translation", "tipping"])
def test_each_anatomy_lesson_variant_enters_fresh_synthetic_context(client, monkeypatch, action):
    fake(monkeypatch, plan({"kind": "anatomy-lesson", "action": action}, {"kind": "anatomy", "action": "bone", "visible": True}))
    result = post(client, request(f"Open the anatomy {action} step; show bone", synthetic=False))
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("movement", ["translation", "tipping"])
def test_anatomy_demonstration_selects_then_plays_without_inventing_amounts(client, monkeypatch, movement):
    expected = plan({"kind": "anatomy-lesson", "action": movement}, {"kind": "workflow", "action": "play"})
    fake(monkeypatch, expected)
    result = post(client, request(f"Demonstrate {movement}", synthetic=False, availableIds=["31"], selected="31", selectedIds=["31"]))
    assert result.status_code == 200, result.text
    assert result.json() == expected


def test_compare_translation_and_tipping_returns_two_ordered_playbacks(client, monkeypatch):
    expected = plan({"kind": "anatomy-lesson", "action": "translation"}, {"kind": "workflow", "action": "play"},
                    {"kind": "anatomy-lesson", "action": "tipping"}, {"kind": "workflow", "action": "play"})
    fake(monkeypatch, expected)
    result = post(client, request("Compare translation and tipping"))
    assert result.status_code == 200, result.text
    assert result.json() == expected


@pytest.mark.parametrize("text,actions", [
    ("Demonstrate translation", [{"kind": "anatomy-lesson", "action": "translation"}]),
    ("Demonstrate tipping", [{"kind": "anatomy-lesson", "action": "tipping"}]),
    ("Compare translation and tipping", [{"kind": "anatomy-lesson", "action": "start"}]),
    ("Compare translation and tipping", [{"kind": "anatomy-lesson", "action": "tipping"}, {"kind": "workflow", "action": "play"}, {"kind": "anatomy-lesson", "action": "translation"}, {"kind": "workflow", "action": "play"}]),
])
def test_anatomy_demonstration_cannot_omit_or_reverse_requested_playback(client, monkeypatch, text, actions):
    fake(monkeypatch, plan(*actions))
    assert post(client, request(text)).status_code == 422


@pytest.mark.parametrize("play", [{"kind": "workflow", "action": "play"}, {"kind": "dental", "command": {"type": "play"}}])
def test_anatomy_play_preserves_tipping_step_before_sequential_navigation(client, monkeypatch, play):
    fake(monkeypatch, plan(play, {"kind": "workflow", "action": "next"}))
    result = post(client, request("Play demonstration then next workflow step", mode="workflow", workflowId="anatomy", stepIndex=2))
    assert result.status_code == 200, result.text
    fake(monkeypatch, plan(play, {"kind": "workflow", "action": "next"}, {"kind": "workflow", "action": "next"}))
    # Tipping stays step2, so two advances exceed the final comparison step3.
    assert post(client, request("Play demonstration then next workflow step then next workflow step", mode="workflow", workflowId="anatomy", stepIndex=2)).status_code == 422


def test_anatomy_play_from_comparison_opens_first_movement_step(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "workflow", "action": "play"}, {"kind": "workflow", "action": "next"}, {"kind": "workflow", "action": "next"}))
    result = post(client, request("Play demonstration then next workflow step then next workflow step", mode="workflow", workflowId="anatomy", stepIndex=3))
    assert result.status_code == 200, result.text


def test_anatomy_example_does_not_allow_omitting_a_following_explicit_edit(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "anatomy-lesson", "action": "tipping"}, {"kind": "workflow", "action": "play"}))
    assert post(client, request("Demonstrate tipping then move 11 buccally 1 mm")).status_code == 422


def test_anatomy_lesson_can_start_from_import_then_enable_layers(client, monkeypatch):
    expected = plan({"kind": "anatomy-lesson", "action": "start"}, {"kind": "anatomy", "action": "cutaway", "visible": True}, dental())
    fake(monkeypatch, expected)
    result = post(client, request("Start anatomy lesson; show cutaway; move 11 buccally 1 mm", synthetic=False, availableIds=["31"], selected="31", selectedIds=["31"]))
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("action", [
    {"kind": "anatomy", "action": "bone", "visible": True},
    {"kind": "anatomy", "action": "ligament", "visible": True},
    {"kind": "anatomy", "action": "opacity", "value": 0.2},
])
def test_imported_geometry_cannot_gain_invented_anatomy(client, monkeypatch, action):
    fake(monkeypatch, plan(action))
    assert post(client, request("Show anatomy", synthetic=False)).status_code == 422


def test_fresh_workflow_resets_available_teeth_and_default_selection(client, monkeypatch):
    expected = plan({"kind": "workflow", "action": "start", "id": "fixed-braces"},
                    {"kind": "dental", "command": {"type": "move_group", "teeth": ["11"], "direction": "buccal", "amount": 1}})
    fake(monkeypatch, expected)
    result = post(client, request("Start braces workflow then move them buccally 1 mm", synthetic=False, availableIds=["31"], selected="31", selectedIds=["31"]))
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("action", [
    {"kind": "workflow", "action": "play"}, {"kind": "workflow", "action": "phase", "phase": "wire"},
    {"kind": "narrate", "target": "step"}, {"kind": "narrate", "target": "answer"},
    {"kind": "replay", "slower": True}, {"kind": "return-lesson"},
    {"kind": "lesson-step", "action": "next"},
])
def test_lesson_controls_require_existing_context(client, monkeypatch, action):
    fake(monkeypatch, plan(action))
    assert post(client, request()).status_code == 422


def test_narration_and_repeat_use_lesson_context(client, monkeypatch):
    for text, action in [("Explain the answer", {"kind": "narrate", "target": "answer"}), ("Repeat more slowly", {"kind": "replay", "slower": True})]:
        fake(monkeypatch, plan(action))
        result = post(client, request(text, mode="workflow", workflowId="anatomy", stepIndex=2, lessonActive=True))
        assert result.status_code == 200, result.text


def test_left_camera_is_supported_in_actions_and_current_context(client, monkeypatch):
    expected = plan({"kind": "view", "view": "left"})
    fake(monkeypatch, expected)
    result = post(client, request("Show left view", view="left"))
    assert result.status_code == 200, result.text
    assert result.json() == expected


@pytest.mark.parametrize("scene", [{}, {"mode": "workflow", "workflowId": "fixed-braces"}, {"mode": "workflow", "workflowId": "anatomy", "stepIndex": 2}])
def test_halfway_is_one_direct_presentation_action_even_with_odd_stages(client, monkeypatch, scene):
    expected = plan({"kind": "progress", "value": .5})
    fake(monkeypatch, expected)
    result = post(client, request("Pause halfway", stages=9, stage=9, **scene))
    assert result.status_code == 200, result.text
    assert result.json() == expected


@pytest.mark.parametrize("text,value", [("Show progress 37.5 percent", .375), ("Set progress 0", 0), ("Show progress 100%", 1)])
def test_progress_requires_the_requested_fraction_or_percentage(client, monkeypatch, text, value):
    fake(monkeypatch, plan({"kind": "progress", "value": value}))
    assert post(client, request(text)).status_code == 200
    fake(monkeypatch, plan({"kind": "progress", "value": .7}))
    assert post(client, request(text)).status_code == 422


def test_progress_enters_movement_before_sequential_navigation_and_preserves_tipping(client, monkeypatch):
    actions = [{"kind": "progress", "value": .5}, {"kind": "lesson-step", "action": "next"}, {"kind": "lesson-step", "action": "next"}]
    fake(monkeypatch, plan(*actions))
    text = "Pause halfway then next step then next step"
    assert post(client, request(text, mode="workflow", workflowId="anatomy", stepIndex=3)).status_code == 200
    assert post(client, request(text, mode="workflow", workflowId="anatomy", stepIndex=2)).status_code == 422


@pytest.mark.parametrize("value", [None, "0.5", True, -.01, 1.01])
def test_progress_schema_is_strict_and_bounded(client, monkeypatch, value):
    fake(monkeypatch, plan({"kind": "progress", "value": value}))
    assert post(client, request("Pause halfway")).status_code == 502


def test_progress_cannot_invent_a_position(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "progress", "value": .25}))
    assert post(client, request("Pause halfway")).status_code == 422
    assert post(client, request("Show progress")).status_code == 422


@pytest.mark.parametrize("workflow_id", ["fixed-braces", "palatal-expansion", "archwire-expansion", "anatomy"])
def test_authored_answer_display_remains_separate_from_narration(client, monkeypatch, workflow_id):
    expected = plan({"kind": "question", "visible": True}, {"kind": "question", "visible": False},
                    {"kind": "narrate", "target": "answer"})
    fake(monkeypatch, expected)
    result = post(client, request("Reveal answer then hide explanation then explain answer aloud", mode="workflow", workflowId=workflow_id))
    assert result.status_code == 200, result.text
    assert result.json() == expected


@pytest.mark.parametrize("lesson_active", [False, True])
@pytest.mark.parametrize("visible", [False, True])
def test_free_cases_and_old_short_lessons_have_no_authored_question(client, monkeypatch, lesson_active, visible):
    fake(monkeypatch, plan({"kind": "view", "view": "left"}, {"kind": "question", "visible": visible}))
    result = post(client, request("Show left view then reveal answer", lessonActive=lesson_active))
    assert result.status_code == 422
    assert "authored question" in result.json()["detail"]


def test_answer_display_checks_the_sequential_workflow_context(client, monkeypatch):
    start = {"kind": "anatomy-lesson", "action": "start"}
    answer = {"kind": "question", "visible": True}
    fake(monkeypatch, plan(start, answer))
    assert post(client, request("Start anatomy lesson then reveal answer")).status_code == 200
    fake(monkeypatch, plan(answer, start))
    assert post(client, request("Reveal answer then start anatomy lesson")).status_code == 422


@pytest.mark.parametrize("action", [
    {"kind": "question"}, {"kind": "question", "visible": "true"}, {"kind": "question", "visible": 1},
    {"kind": "question", "visible": None}, {"kind": "question", "visible": True, "answer": "Invented explanation"},
])
def test_authored_answer_schema_requires_only_a_strict_visibility_boolean(client, monkeypatch, action):
    fake(monkeypatch, plan(action))
    assert post(client, request("Reveal answer", mode="workflow", workflowId="anatomy")).status_code == 502


def test_anatomy_navigation_respects_four_step_boundaries(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "lesson-step", "action": "next"}))
    assert post(client, request("Next step", mode="workflow", workflowId="anatomy", stepIndex=3)).status_code == 422
    assert post(client, request("Next step", mode="workflow", workflowId="anatomy", stepIndex=2)).status_code == 200


def test_play_advances_to_movement_step_before_following_navigation(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "workflow", "action": "play"}, {"kind": "workflow", "action": "next"}))
    assert post(client, request("Play demonstration then next workflow step", mode="workflow", workflowId="fixed-braces", stepIndex=6)).status_code == 200


def test_workflow_navigation_updates_family_arch_scope_but_preserves_explicit_arch(client, monkeypatch):
    upper = ["11", "12", "21", "22"]
    actions = [{"kind": "workflow", "action": "next"}, {"kind": "select", "teeth": upper}]
    fake(monkeypatch, plan(*actions))
    assert post(client, request("Next workflow step then select incisors", mode="workflow", workflowId="fixed-braces", stepIndex=0, arch="both")).status_code == 200
    lower = ["31", "32", "41", "42"]
    fake(monkeypatch, plan({"kind": "arch", "arch": "lower"}, actions[0], {"kind": "select", "teeth": lower}))
    assert post(client, request("Show lower arch then next workflow step then select incisors", mode="workflow", workflowId="fixed-braces", stepIndex=0, arch="both")).status_code == 200


@pytest.mark.parametrize("action", [
    {"kind": "workflow", "action": "phase", "phase": "wire"},
    {"kind": "workflow", "action": "phase", "phase": "retention"},
    {"kind": "stage", "action": "exact", "stage": 1},
    {"kind": "dental", "command": {"type": "stages", "count": 10}},
])
def test_anatomy_rejects_appliance_phases_and_timeline_stages(client, monkeypatch, action):
    fake(monkeypatch, plan(action))
    assert post(client, request("Show teaching step", mode="workflow", workflowId="anatomy")).status_code == 422


@pytest.mark.parametrize("action", [
    {"kind": "replay", "slower": True},
    {"kind": "dental", "command": {"type": "undo"}},
    {"kind": "dental", "command": {"type": "redo"}},
])
def test_history_and_replay_are_standalone(client, monkeypatch, action):
    fake(monkeypatch, plan(action, {"kind": "toggle", "target": "roots", "visible": True}))
    assert post(client, request("Repeat then show roots", mode="workflow", workflowId="fixed-braces")).status_code == 422


@pytest.mark.parametrize("action", [{"kind": "return-lesson"}, {"kind": "workflow", "action": "exit"}])
def test_restoration_must_be_last_action(client, monkeypatch, action):
    fake(monkeypatch, plan(action, {"kind": "toggle", "target": "roots", "visible": True}))
    assert post(client, request("Return then show roots", mode="workflow", workflowId="fixed-braces")).status_code == 422


@pytest.mark.parametrize("text,action", [
    ("Set opacity to 40 percent", {"kind": "anatomy", "action": "opacity", "value": 0.4}),
    ("Set opacity to 40%", {"kind": "anatomy", "action": "opacity", "value": 0.4}),
])
def test_explicit_opacity_percentages(client, monkeypatch, text, action):
    fake(monkeypatch, plan(action))
    result = post(client, request(text))
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("text,value", [("Make the bone transparent", 0.25), ("Make bone transparent", 0.25), ("Make the bone opaque", 1), ("Make bone opaque", 1), ("Set bone transparency to 40 percent", 0.6)])
def test_explicit_bone_display_presets_and_transparency(client, monkeypatch, text, value):
    fake(monkeypatch, plan({"kind": "anatomy", "action": "opacity", "value": value}))
    result = post(client, request(text))
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("text,action", [
    ("Set opacity to 0.5", {"kind": "anatomy", "action": "opacity", "value": 0.4}),
    ("Make bone transparent", {"kind": "anatomy", "action": "opacity", "value": 0.4}),
    ("Show stage 4", {"kind": "stage", "action": "exact", "stage": 5}),
    ("Show stage 12", {"kind": "stage", "action": "exact", "stage": 12}),
    ("Next stage", {"kind": "stage", "action": "next"}),
])
def test_display_numeric_values_must_match_source_and_current_bounds(client, monkeypatch, text, action):
    fake(monkeypatch, plan(action))
    assert post(client, request(text)).status_code == 422


def test_new_stage_count_updates_sequential_timeline_bounds(client, monkeypatch):
    fake(monkeypatch, plan({"kind": "dental", "command": {"type": "stages", "count": 20}}, {"kind": "stage", "action": "previous"}, {"kind": "stage", "action": "exact", "stage": 18}))
    result = post(client, request("Create 20 stages then previous stage then show stage 18"))
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("text", ["Do not move 11 buccally 1 mm", "Don’t move 11 buccally 1 mm", "Try not to move 11 buccally 1 mm", "What if I move 11 buccally 1 mm?", "How far should I move my patient’s teeth?", "Write Javascript to move teeth", "Execute code: fetch('/secret')", "Recommend treatment for crowding"])
def test_unsupported_intents_return_clarification_without_provider(client, monkeypatch, text):
    provider = fake(monkeypatch, plan(dental()))
    result = post(client, request(text))
    assert result.status_code == 200
    assert result.json()["actions"] == []
    assert result.json()["clarification"]
    provider.assert_not_called()


@pytest.mark.parametrize("result", [
    plan({"kind": "javascript", "code": "alert(1)"}),
    plan({"kind": "speed", "value": 3}),
    plan({"kind": "speed", "value": True}),
    plan({"kind": "anatomy", "action": "opacity", "value": 1.1}),
    plan({"kind": "toggle", "target": "roots", "visible": "true"}),
    plan({"kind": "stop", "extra": "not allowed"}),
    plan(*[{"kind": "stop"}] * 9),
    plan({"kind": "stop"}, clarification="What next?"),
    plan(),
    plan(clarification=""),
])
def test_strict_provider_schema_rejects_unknown_or_inconsistent_output(client, monkeypatch, result):
    fake(monkeypatch, result)
    assert post(client, request()).status_code == 502


@pytest.mark.parametrize("override", [
    {"availableIds": ["11", "11"]}, {"availableIds": ["99"]}, {"selected": "99"},
    {"selectedIds": ["11", "11"]}, {"mode": "workflow", "workflowId": None},
    {"mode": "workflow", "workflowId": "anatomy", "stepIndex": 4},
    {"revision": -1}, {"speed": True}, {"stage": 11, "stages": 10},
    {"patientId": "private-id"}, {"geometry": "private-mesh"}, {"name": "private-name"},
    {"layers": {"bone": True, "other": "private-mesh"}},
])
def test_invalid_or_excess_context_never_reaches_provider(client, monkeypatch, override):
    provider = fake(monkeypatch, plan({"kind": "stop"}))
    result = post(client, request(**override))
    assert result.status_code == 422
    assert "private-" not in result.text
    provider.assert_not_called()


def test_top_level_extra_fields_are_rejected(client, monkeypatch):
    provider = fake(monkeypatch, plan({"kind": "stop"}))
    result = post(client, {**request(), "apiKey": "private-client-key", "meshes": []})
    assert result.status_code == 422
    assert "private-client-key" not in result.text
    provider.assert_not_called()


@pytest.mark.parametrize("text", ["", "  ", "x" * 1501])
def test_empty_or_oversized_teaching_input_is_rejected(client, monkeypatch, text):
    provider = fake(monkeypatch, plan({"kind": "stop"}))
    assert post(client, request(text)).status_code == 422
    provider.assert_not_called()


def test_valid_teaching_clause_can_exceed_the_legacy_endpoint_limit(client, monkeypatch):
    fake(monkeypatch, plan(dental()))
    text = "Please " + "carefully " * 55 + "move 11 buccally 1 mm"
    result = post(client, request(text))
    assert len(text) > 500
    assert result.status_code == 200, result.text


def test_sdk_uses_server_key_minimal_context_strict_schema_and_no_storage(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "server-secret")
    monkeypatch.setenv("OPENAI_MODEL", "configured-test-model")
    sdk = MagicMock()
    sdk.__enter__.return_value = sdk
    sdk.responses.parse.return_value = SimpleNamespace(output_parsed=main.TeachingPlan.model_validate(plan({"kind": "toggle", "target": "roots", "visible": True})))
    factory = MagicMock(return_value=sdk)
    monkeypatch.setattr(main, "OpenAI", factory)
    result = post(client, request())
    assert result.status_code == 200, result.text
    factory.assert_called_once_with(api_key="server-secret", timeout=20, max_retries=0)
    arguments = sdk.responses.parse.call_args.kwargs
    assert arguments["model"] == "configured-test-model"
    assert arguments["text_format"] is main.TeachingPlan
    assert arguments["store"] is False
    sent = json.loads(arguments["input"][1]["content"])
    assert set(sent) == {"text", "context"}
    assert sent["context"]["availableIds"] == IDS
    assert "server-secret" not in arguments["input"][1]["content"]
    assert "server-secret" not in result.text
    assert "never fill in missing numbers" in arguments["input"][0]["content"]
    schema = main.TeachingPlan.model_json_schema()
    assert schema["additionalProperties"] is False
    assert all(definition.get("additionalProperties") is False for definition in schema["$defs"].values())


@pytest.mark.parametrize("name,first", [
    ("TeachingSelect", ["kind", "teeth"]),
    ("TeachingAttachmentAdd", ["kind", "action", "teeth"]),
    ("TeachingAttachmentRemove", ["kind", "action", "teeth"]),
    ("MoveGroup", ["type", "teeth"]),
    ("RotateGroup", ["type", "teeth"]),
    ("Orthodontic", ["type", "teeth"]),
    ("Reset", ["type", "teeth"]),
])
def test_strict_sdk_schema_keeps_inherited_action_discriminators_first(name, first):
    schema = to_strict_json_schema(main.TeachingPlan)
    definition = schema["$defs"][name]
    assert list(definition["properties"])[:len(first)] == first
    assert definition["required"] == list(definition["properties"])
    assert definition["additionalProperties"] is False
    assert definition["properties"][first[0]]["const"]
    assert definition["properties"]["teeth"]["items"]["pattern"] == r"^[1-4][1-8]$"


def test_schema_key_order_changes_preserve_all_validation_keywords():
    schema = main.TeachingPlan.model_json_schema()
    before = copy.deepcopy(schema)
    for definition in schema["$defs"].values():
        # Reproduce inherited-field-first input without modifying its constraints.
        definition["properties"] = dict(reversed(list(definition["properties"].items())))
        main.discriminator_first_schema(definition)
    assert schema == before  # Dictionary equality ignores key order, not constraints.
    assert schema["properties"]["actions"]["maxItems"] == 8


def test_reordered_select_schema_retains_target_and_unknown_field_audits(client, monkeypatch):
    selected = {"kind": "select", "teeth": ["11", "12", "13", "21", "22", "23"]}
    fake(monkeypatch, plan(selected))
    assert post(client, request("Please select upper anterior teeth.")).status_code == 200
    fake(monkeypatch, plan({**selected, "teeth": ["11", "12", "13"]}))
    assert post(client, request("Please select upper anterior teeth.")).status_code == 422
    fake(monkeypatch, plan({**selected, "unsafe": True}))
    assert post(client, request("Please select upper anterior teeth.")).status_code == 502


def test_provider_refusal_returns_empty_clarification(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "server-secret")
    sdk = MagicMock()
    sdk.__enter__.return_value = sdk
    sdk.responses.parse.return_value = SimpleNamespace(output_parsed=None)
    monkeypatch.setattr(main, "OpenAI", MagicMock(return_value=sdk))
    result = post(client, request())
    assert result.status_code == 200
    assert result.json()["actions"] == []
    assert result.json()["clarification"]


def test_provider_failures_do_not_echo_private_exception_details(client, monkeypatch):
    def fail(_payload):
        raise APITimeoutError(request=httpx.Request("POST", "https://example.com/private-text"))
    monkeypatch.setattr(main, "interpret_teaching_with_openai", fail)
    result = post(client, request())
    assert result.status_code == 502
    assert "private-text" not in result.text


@pytest.mark.parametrize("status,code,expected_status,message", [
    (401, "invalid_api_key", 503, "Replace OPENAI_API_KEY"),
    (429, "insufficient_quota", 429, "API billing"),
    (429, "billing_hard_limit_reached", 429, "API billing"),
    (429, "rate_limit_exceeded", 429, "Wait briefly"),
])
@pytest.mark.parametrize("endpoint", ["/api/interpret", "/api/interpret-teaching"])
def test_actionable_provider_configuration_errors_never_echo_secrets(client, monkeypatch, status, code, expected_status, message, endpoint):
    secret = "private-secret-not-for-client"
    response = httpx.Response(status, request=httpx.Request("POST", "https://example.com/private-request"))
    error_type = AuthenticationError if status == 401 else RateLimitError
    error = error_type(secret, response=response, body={"code": code, "message": secret})
    provider = "interpret_teaching_with_openai" if endpoint.endswith("teaching") else "interpret_with_openai"
    monkeypatch.setattr(main, provider, MagicMock(side_effect=error))
    payload = request() if endpoint.endswith("teaching") else {"text": "show original", "selected_tooth": "11", "available_teeth": ["11"]}
    result = client.post(endpoint, json=payload)
    assert result.status_code == expected_status, result.text
    assert message in result.json()["detail"]
    assert secret not in result.text
    assert "private-request" not in result.text


def test_openrouter_provider_label_and_credit_error_are_safe(client, monkeypatch):
    monkeypatch.setenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    assert client.get("/health").json()["provider"] == "OpenRouter"
    error = APIStatusError("secret upstream detail", response=httpx.Response(402, request=httpx.Request("POST", "https://openrouter.ai/api/v1/responses")), body={"message": "secret upstream detail"})
    monkeypatch.setattr(main, "interpret_teaching_with_openai", MagicMock(side_effect=error))
    response = post(client, request())
    assert response.status_code == 402
    assert "OpenRouter needs available API credits" in response.json()["detail"]
    assert "secret upstream detail" not in response.text
    monkeypatch.setenv("OPENAI_BASE_URL", "https://private:secret@example.invalid/api")
    health = client.get("/health")
    assert health.json()["provider"] == "Configured AI provider"
    assert "secret" not in health.text


def repair_sdk(monkeypatch, *plans):
    monkeypatch.setenv("OPENAI_API_KEY", "server-secret")
    monkeypatch.setenv("OPENAI_MODEL", "openai/gpt-6-luna")
    sdk = MagicMock()
    sdk.__enter__.return_value = sdk
    sdk.responses.parse.side_effect = [SimpleNamespace(output_parsed=main.TeachingPlan.model_validate(value)) for value in plans]
    factory = MagicMock(return_value=sdk)
    monkeypatch.setattr(main, "OpenAI", factory)
    return sdk, factory


def test_one_repair_reinterprets_original_context_then_passes_independent_validation(client, monkeypatch):
    rejected, corrected = plan(dental(tooth="12")), plan(dental())
    sdk, factory = repair_sdk(monkeypatch, rejected, corrected)
    payload = request("Move tooth 11 buccally 1 mm")
    before = copy.deepcopy(payload)
    response = post(client, payload)
    assert response.status_code == 200, response.text
    assert response.json() == corrected
    assert payload == before
    assert sdk.responses.parse.call_count == 2
    assert factory.call_count == 2
    assert factory.call_args.kwargs["timeout"] <= 10
    for call in sdk.responses.parse.call_args_list:
        assert call.kwargs["reasoning"] == {"effort": "none"}
        assert call.kwargs["store"] is False
        assert call.kwargs["text_format"] is main.TeachingPlan
    repair = sdk.responses.parse.call_args.kwargs["input"]
    assert json.loads(repair[1]["content"]) == main.TeachingRequest.model_validate(payload).model_dump(exclude_none=True, by_alias=True)
    assert json.loads(repair[1]["content"]) == json.loads(sdk.responses.parse.call_args_list[0].kwargs["input"][1]["content"])
    assert json.loads(repair[2]["content"]) == rejected
    assert "application rejected that plan" in repair[3]["content"]
    assert "server-secret" not in str(repair)


@pytest.mark.parametrize("invalid", [plan(dental(tooth="12")), plan(dental(amount=2))])
def test_invalid_repair_cannot_change_target_or_value_and_does_not_loop(client, monkeypatch, invalid):
    sdk, factory = repair_sdk(monkeypatch, plan(dental(tooth="12")), invalid)
    response = post(client, request("Move tooth 11 buccally 1 mm"))
    assert response.status_code == 422, response.text
    assert sdk.responses.parse.call_count == factory.call_count == 2
    assert "actions" not in response.json()


def test_invalid_repair_schema_is_rejected_without_a_third_attempt(client, monkeypatch):
    sdk, _ = repair_sdk(monkeypatch, plan(dental(tooth="12")))
    sdk.responses.parse.side_effect = [SimpleNamespace(output_parsed=main.TeachingPlan.model_validate(plan(dental(tooth="12")))), SimpleNamespace(output_parsed={**plan(dental()), "script": "private-payload"})]
    response = post(client, request("Move tooth 11 buccally 1 mm"))
    assert response.status_code == 502
    assert sdk.responses.parse.call_count == 2
    assert "private-payload" not in response.text


def test_missing_movement_amount_can_be_repaired_only_to_a_clarification(client, monkeypatch):
    clarification = plan(clarification="How many millimetres should tooth 11 move buccally?")
    sdk, _ = repair_sdk(monkeypatch, plan(dental()), clarification)
    response = post(client, request("Move tooth 11 buccally"))
    assert response.status_code == 200, response.text
    assert response.json() == clarification
    assert sdk.responses.parse.call_count == 2


def test_repair_does_not_run_when_request_deadline_has_insufficient_time(client, monkeypatch):
    sdk, _ = repair_sdk(monkeypatch, plan(dental(tooth="12")))
    monkeypatch.setattr(main, "monotonic", MagicMock(side_effect=[100, 116]))
    response = post(client, request("Move tooth 11 buccally 1 mm"))
    assert response.status_code == 422
    assert sdk.responses.parse.call_count == 1


def test_provider_clarification_is_not_retried_or_converted_to_an_edit(client, monkeypatch):
    clarification = plan(clarification="Choose an explicit movement amount in mm.")
    sdk, _ = repair_sdk(monkeypatch, clarification)
    response = post(client, request("Move tooth 11 buccally"))
    assert response.status_code == 200, response.text
    assert response.json() == clarification
    assert sdk.responses.parse.call_count == 1


@pytest.mark.parametrize("model", ["gpt-6-luna", "openai/gpt-6-luna", "gpt-4.1-mini"])
def test_legacy_interpreter_only_disables_reasoning_for_luna(client, monkeypatch, model):
    monkeypatch.setenv("OPENAI_API_KEY", "server-secret")
    monkeypatch.setenv("OPENAI_MODEL", model)
    sdk = MagicMock()
    sdk.__enter__.return_value = sdk
    sdk.responses.parse.return_value = SimpleNamespace(output_parsed=main.Interpretation.model_validate({"command": {"type": "ghost", "visible": True}, "reason": ""}))
    monkeypatch.setattr(main, "OpenAI", MagicMock(return_value=sdk))
    response = client.post("/api/interpret", json={"text": "show original", "selected_tooth": "11", "available_teeth": ["11"]})
    assert response.status_code == 200, response.text
    options = sdk.responses.parse.call_args.kwargs
    assert options["model"] == model
    assert options.get("reasoning") == ({"effort": "none"} if model.endswith("gpt-6-luna") else None)
    assert options["store"] is False


def test_front_six_group_and_spoken_amount_resolve_before_numeric_target_audit(client, monkeypatch):
    text = "Select the upper front six teeth and move them buccally by one millimeter."
    teeth = ["11", "12", "13", "21", "22", "23"]
    selected = {"kind": "select", "teeth": teeth}
    movement = {"kind": "dental", "command": {"type": "move_group", "teeth": teeth, "direction": "buccal", "amount": 1}}
    expected = plan(selected, movement)
    fake(monkeypatch, expected)
    payload = request(text, arch="upper", selectedIds=["11"], availableIds=[f"{q}{p}" for q in range(1, 5) for p in range(1, 8)])
    result = post(client, payload)
    assert result.status_code == 200, result.text
    assert result.json() == expected
    assert main.normalized_teaching_text(text) == "select the upper anterior teeth and move them buccally by 1 mm."
    fake(monkeypatch, plan(selected, {**movement, "command": {**movement["command"], "amount": 2}}))
    assert post(client, payload).status_code == 422
    fake(monkeypatch, plan(selected, {**movement, "command": {**movement["command"], "teeth": ["11"]}}))
    assert post(client, payload).status_code == 422


@pytest.mark.parametrize("group", ["upper front five teeth", "six upper teeth", "upper front six teeth except 11"])
def test_front_six_alias_does_not_allow_arbitrary_counts_or_exclusions(client, monkeypatch, group):
    fake(monkeypatch, plan({"kind": "select", "teeth": ["11", "12", "13", "21", "22", "23"]}))
    response = post(client, request(f"Select {group}"))
    assert response.status_code == 422, response.text
