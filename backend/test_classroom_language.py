import json
from pathlib import Path

import pytest

from classroom_language import normalize_classroom_language
import main

FIXTURES = json.loads((Path(__file__).parents[1] / "src/lib/classroom-language.fixtures.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("source,expected", FIXTURES)
def test_shared_classroom_wording(source, expected):
    assert normalize_classroom_language(source) == expected
    assert normalize_classroom_language(expected) == expected


def test_never_changes_numeric_evidence():
    assert normalize_classroom_language("Could you move upper front teeth -0.5 mm and rotate them +3 degrees") == "move upper anterior teeth -0.5 mm and rotate them +3 degrees"


@pytest.mark.parametrize("source,teeth,types", [
    ("put brackets in top", ["11", "21"], ["brackets"]),
    ("put brackets in bottom", ["31", "41"], ["brackets"]),
    ("put brackets on the top teeth", ["11", "21"], ["brackets"]),
    ("Could you install brackets in the bottom jaw?", ["31", "41"], ["brackets"]),
    ("put an archwire in top", ["11", "21"], ["brackets", "wire"]),
    ("put a wire on the bottom teeth", ["41", "31"], ["brackets", "wire"]),
    ("put brackets on top front six teeth", ["11", "21"], ["brackets"]),
])
def test_casual_arch_targets_pass_the_same_independent_appliance_audit(source, teeth, types):
    ids = ["11", "21", "31", "41"]
    context = {"mode": "case", "workflowId": None, "stepIndex": 0, "selected": "11", "selectedIds": ["11"], "availableIds": ids, "synthetic": True, "revision": 1, "view": "perspective", "arch": "upper", "speed": 1,
               "mechanics": {"config": {"brackets": {}, "wires": [], "tads": [], "elastics": [], "expanders": [], "support": "standard", "fixedTeeth": []}, "bracketAnchors": {tooth: [0, 0, 3] for tooth in ids}, "focus": {}, "stageIndex": 0, "stageCount": 1, "hasResult": False, "wirePreset": {"material": "stainless-steel", "section": {"shape": "round", "diameterMm": .4}}}}
    request = main.TeachingRequest.model_validate({"text": source, "context": context})
    plan = main.grounded_mechanics_plan(request)
    assert plan is not None
    assert [action.action.type for action in plan.actions] == types
    assert all(action.action.teeth == teeth for action in plan.actions)
    assert main.validate_teaching_plan(request, plan) == plan
    assert not context["mechanics"]["config"]["brackets"]


@pytest.mark.parametrize("source", [
    "Do not put brackets in top",
    "Put brackets in top if appropriate",
    "put brackets near top",
    "show top",
    "look from bottom",
    "place a TAD in top",
])
def test_casual_arch_alias_does_not_invent_ambiguous_targets_or_attachment_points(source):
    assert normalize_classroom_language(source) == source.lower()


def test_top_bottom_alias_keeps_camera_and_numeric_meanings_separate():
    assert normalize_classroom_language("look from top") == "show occlusal view"
    assert normalize_classroom_language("move top incisors -0.5 mm and rotate bottom incisors +3 degrees") == "move upper incisors -0.5 mm and rotate lower incisors +3 degrees"
    assert normalize_classroom_language("put brackets in top then put a wire in bottom") == "put brackets on upper teeth then put a wire on lower teeth"
