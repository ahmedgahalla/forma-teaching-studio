"""Independent semantic validation of provider teaching plans."""

import math
import re
from typing import Union

from fastapi import HTTPException
from pydantic import ValidationError

import mechanics as mechanics_api
from commands import Appliance, Command, Ghost, InterpretRequest, Move, MoveGroup, Orthodontic, Playback, Reset, Rotate, RotateGroup, Stages, resolve_targets
from teaching_schema import *  # noqa: F401,F403 -- the validator touches most action models
from teaching_source import _NUMBER, _audit_movement, _clauses, _source_targets, normalized_teaching_text, teaching_source_problem

def validate_teaching_plan(payload: TeachingRequest, plan: TeachingPlan) -> TeachingPlan:
    if plan.clarification is not None:
        return plan
    context = payload.context
    selected, selected_ids, arch = context.selected, list(context.selectedIds), context.arch
    available_ids = list(context.availableIds)
    workflow, synthetic = context.mode == "workflow", context.synthetic
    workflow_id, step = context.workflowId, context.stepIndex
    explicit_selection, explicit_arch = False, False
    can_return = bool(context.canReturnToLesson or workflow)
    stages = context.stages or 10
    current_stage = context.stage if context.stage is not None else stages
    clauses = _clauses(normalized_teaching_text(payload.text))
    source_cursor = 0
    audited_sources: set[int] = set()
    mechanics_scene = context.model_dump(exclude_none=True, by_alias=True)
    expected_mechanics: list[dict] = []

    def go_step(next_step: int) -> None:
        nonlocal step, arch
        if not 0 <= next_step <= (3 if workflow_id == "anatomy" else 6):
            raise HTTPException(422, "The requested step is outside the active workflow.")
        step = next_step
        if not explicit_arch:
            if workflow_id == "anatomy":
                arch = "upper"
            elif workflow_id == "palatal-expansion":
                arch = "both" if step == 6 else "upper"
            else:
                arch = "both" if step == 5 or workflow_id == "fixed-braces" and step == 0 else "upper"

    def evidence(pattern: str) -> str:
        nonlocal source_cursor
        for i, clause in enumerate(clauses):
            if i >= source_cursor and re.search(pattern, clause):
                source_cursor = i + 1
                audited_sources.add(i)
                return clause
        raise HTTPException(422, "A proposed tooth action has no matching explicit instruction.")

    # Known authored demonstrations have a stable contract shared with the local
    # planner. Selecting their lesson card alone would silently omit the playback.
    signatures = [(action.kind, getattr(action, "action", None)) for action in plan.actions]
    for clause in clauses:
        expected_sequence = None
        if re.fullmatch(r"compare translation and tipping", clause):
            expected_sequence = [("anatomy-lesson", "translation"), ("workflow", "play"), ("anatomy-lesson", "tipping"), ("workflow", "play")]
        else:
            demonstration = re.fullmatch(r"(?:demonstrate|show) (?:tooth )?(translation|tipping)(?: (?:in the )?anatomy lesson)?", clause)
            if demonstration:
                expected_sequence = [("anatomy-lesson", demonstration[1]), ("workflow", "play")]
        if expected_sequence and not any(signatures[i:i + len(expected_sequence)] == expected_sequence for i in range(len(signatures))):
            raise HTTPException(422, "An anatomy demonstration must select and play each requested movement in order.")

    for index, action in enumerate(plan.actions):
        if len(plan.actions) > 1 and (isinstance(action, TeachingReplay) or isinstance(action, TeachingDental) and isinstance(action.command, Playback) and action.command.type in ("undo", "redo")):
            raise HTTPException(422, "Use undo, redo or replay as a standalone request.")
        if index != len(plan.actions) - 1 and (isinstance(action, TeachingReturn) or isinstance(action, TeachingWorkflow) and action.action == "exit"):
            raise HTTPException(422, "Return to a lesson or exit a workflow only at the end of a request.")
        if isinstance(action, mechanics_api.TeachingMechanics):
            if action.action.type == "stage" and len(plan.actions) != 1:
                raise HTTPException(422, "Recall an experiment stage as a separate request, then give instructions for its setup.")
            mechanics_scene.update(mode="workflow" if workflow else "case", synthetic=synthetic, selected=selected, selectedIds=selected_ids, availableIds=available_ids, arch=arch)
            if not expected_mechanics:
                source_index = next((i for i, clause in enumerate(clauses) if i >= source_cursor and mechanics_api.source_is_mechanics(clause)), None)
                if source_index is None:
                    raise HTTPException(422, "The appliance action has no matching source instruction.")
                source_cursor = source_index + 1
                audited_sources.add(source_index)
                try:
                    expected_mechanics = mechanics_api.expected_actions(clauses[source_index], mechanics_scene, lambda selector: _source_targets(selector, available_ids, selected, selected_ids, arch))
                    # One required recalculation also satisfies the adjacent explicit solve.
                    if len(expected_mechanics) > 1 and expected_mechanics[-1]["type"] == "solve" and source_index + 1 < len(clauses) and mechanics_api.source_is_solve(clauses[source_index + 1]):
                        audited_sources.add(source_index + 1)
                        source_cursor = source_index + 2
                except (ValueError, KeyError) as error:
                    raise HTTPException(422, str(error)) from None
            value = mechanics_api.as_dict(action.action)
            if not expected_mechanics or not mechanics_api.same_intent(value, expected_mechanics.pop(0)):
                raise HTTPException(422, "Appliance targets, values and coordinates must match the explicit instruction or visible preset.")
            try:
                mechanics_api.advance(mechanics_scene, value)
                selected_ids, selected = mechanics_scene["selectedIds"], mechanics_scene["selected"]
            except (ValueError, KeyError) as error:
                raise HTTPException(422, str(error)) from None
        elif isinstance(action, TeachingWorkflowStart):
            workflow, synthetic, can_return = True, True, True
            workflow_id, step = action.id, 0
            available_ids = [f"{q}{p}" for q in range(1, 5) for p in range(1, 8)]
            if explicit_selection:
                if any(tooth not in available_ids for tooth in selected_ids):
                    raise HTTPException(422, "The preceding selection is not available in the synthetic workflow.")
            else:
                selected_ids, selected = ["11"], "11"
            go_step(0)
        elif isinstance(action, TeachingWorkflow):
            if not workflow:
                raise HTTPException(422, "Start a workflow before controlling its steps or playback.")
            if action.action == "exit":
                workflow = False
            elif action.action in ("next", "previous", "restart"):
                go_step(0 if action.action == "restart" else step + (1 if action.action == "next" else -1))
            elif action.action == "play":
                go_step(step if workflow_id == "anatomy" and step in (1, 2) else 1 if workflow_id == "anatomy" else 4)
        elif isinstance(action, TeachingWorkflowPhase):
            if not workflow:
                raise HTTPException(422, "Start a workflow before choosing a phase.")
            if workflow_id == "anatomy":
                if action.phase not in ("assessment", "movement"):
                    raise HTTPException(422, "That appliance phase is not available in the anatomy lesson.")
                go_step(0 if action.phase == "assessment" else 1)
            else:
                go_step({"assessment": 0, "brackets": 1, "wire": 2, "forces": 3, "movement": 4, "retention": 5 if workflow_id == "palatal-expansion" else 6}[action.phase])
        elif isinstance(action, TeachingArch):
            arch = action.arch
            explicit_arch = True
        elif isinstance(action, TeachingReturn):
            if not can_return:
                raise HTTPException(422, "There is no saved lesson to return to.")
            workflow = workflow_id is not None
        elif isinstance(action, TeachingNarrate):
            if not (workflow or context.lessonActive):
                raise HTTPException(422, "Open a lesson before requesting its narration.")
        elif isinstance(action, TeachingQuestion):
            if not workflow:
                raise HTTPException(422, "Open a teaching workflow with an authored question before revealing or hiding its answer.")
        elif isinstance(action, TeachingProgress):
            source = evidence(r"\b(?:progress|halfway|percent)\b|%")
            if re.fullmatch(r"(?:please )?pause halfway", source):
                expected_progress = 0.5
            else:
                values = re.findall(rf"(?<![\w.])({_NUMBER})\s*(%|percent)?(?![\w.])", source)
                if len(values) != 1:
                    raise HTTPException(422, "Request an explicit demonstration progress fraction or percentage.")
                expected_progress = float(values[0][0]) / (100 if values[0][1] else 1)
            if not math.isclose(action.value, expected_progress, rel_tol=1e-12, abs_tol=0):
                raise HTTPException(422, "The proposed progress must match the requested fraction or percentage.")
            if workflow:
                go_step(step if workflow_id == "anatomy" and step in (1, 2) else 1 if workflow_id == "anatomy" else 4)
            current_stage = action.value * stages
        elif isinstance(action, TeachingReplay):
            if not (workflow or context.lastActions):
                raise HTTPException(422, "There is no previous demonstration to replay.")
        elif isinstance(action, TeachingAnatomyLesson):
            synthetic, can_return, workflow = True, True, True
            workflow_id, step = "anatomy", {"start": 0, "translation": 1, "tipping": 2}[action.action]
            available_ids = [f"{q}{p}" for q in range(1, 5) for p in range(1, 8)]
            selected, selected_ids, arch = "11", ["11"], "upper"
            explicit_selection = True
        elif isinstance(action, (TeachingAnatomy, TeachingOpacity)):
            enabling = not isinstance(action, TeachingAnatomy) or action.visible
            if enabling and not synthetic:
                raise HTTPException(422, "Anatomy illustrations are available only in synthetic teaching models.")
            if isinstance(action, TeachingOpacity):
                source = evidence(r"\b(?:opacity|opaque|transparent|transparency|translucent)\b")
                preset = re.fullmatch(r"(?:please )?make (?:the )?bone (transparent|opaque)", source)
                if preset:
                    expected_opacity = 0.25 if preset[1] == "transparent" else 1
                else:
                    values = re.findall(rf"(?<![\w.])({_NUMBER})\s*(%|percent)?(?![\w.])", source)
                    if len(values) != 1:
                        raise HTTPException(422, "Request a bone opacity value or the transparent/opaque display preset.")
                    expected_opacity = float(values[0][0]) / (100 if values[0][1] else 1)
                    if re.search(r"\b(?:transparent|transparency)\b", source) and not re.search(r"\bopacity\b", source):
                        expected_opacity = 1 - expected_opacity
                if not math.isclose(action.value, expected_opacity, rel_tol=1e-12, abs_tol=0):
                    raise HTTPException(422, "The proposed opacity must match an explicit value from 0 to 1 or a percentage.")
        elif isinstance(action, TeachingLessonStep):
            if not (workflow or context.lessonActive):
                raise HTTPException(422, "Open a lesson before changing its step.")
            if workflow:
                go_step(0 if action.action == "restart" else step + (1 if action.action == "next" else -1))
        elif isinstance(action, TeachingStage):
            if workflow:
                raise HTTPException(422, "Timeline stages are not available inside a teaching workflow.")
            # Match frontend Math.round for nonnegative fractional playback stages.
            current_stage = math.floor(current_stage + 0.5) + (1 if action.action == "next" else -1)
            if not 0 <= current_stage <= stages:
                raise HTTPException(422, "The requested stage is outside the current timeline.")
        elif isinstance(action, TeachingExactStage):
            if workflow:
                raise HTTPException(422, "Timeline stages are not available inside a teaching workflow.")
            if action.stage > stages:
                raise HTTPException(422, "The requested stage is outside the current timeline.")
            source = evidence(r"\bstage \d+\b")
            match = re.search(r"\bstage (\d+)\b", source)
            if not match or int(match[1]) != action.stage:
                raise HTTPException(422, "The proposed stage must match the explicit instruction.")
            current_stage = action.stage
        elif isinstance(action, (TeachingSelect, TeachingFocus, TeachingAttachmentAdd, TeachingAttachmentRemove)):
            source = evidence(r"\b(?:select|highlight)\b" if isinstance(action, TeachingSelect) else r"\b(?:focus|zoom)\b" if isinstance(action, TeachingFocus) else r"\b(?:add|remove)\b")
            targets = [action.tooth] if isinstance(action, TeachingFocus) else action.teeth
            expected = _source_targets(source, available_ids, selected, selected_ids, arch)
            if not expected or set(targets) != set(expected):
                raise HTTPException(422, "The proposed targets do not match the requested available teeth.")
            if isinstance(action, (TeachingAttachmentAdd, TeachingAttachmentRemove)):
                can_return = can_return or workflow
            if isinstance(action, (TeachingSelect, TeachingFocus)):
                selected_ids, selected = list(targets), targets[0]
                explicit_selection = True
        elif isinstance(action, TeachingDental):
            command = action.command
            if isinstance(command, (Move, Rotate, ToothGroup)):
                source = evidence(r"\breset\b" if isinstance(command, Reset) else r"\b(?:move|translate|rotate|rotation|tip|tipping|torque|intrude|extrude|expand|retract|protract|constrict|distalize|mesialize)\b")
                targets = [command.tooth] if isinstance(command, (Move, Rotate)) else command.teeth
                expected = _source_targets(source, available_ids, selected, selected_ids, arch)
                if not expected or set(targets) != set(expected):
                    raise HTTPException(422, "The proposed movement targets do not match the requested available teeth.")
                if not isinstance(command, Reset):
                    _audit_movement(command, source)
                can_return = can_return or workflow
                selected_ids, selected = list(targets), targets[0]
                explicit_selection = True
            elif isinstance(command, Stages):
                if workflow:
                    raise HTTPException(422, "Timeline stages are not available inside a teaching workflow.")
                source = evidence(r"\b(?:create|generate)\b")
                match = re.search(r"\b(\d+) stages?\b", source)
                if not match or int(match[1]) != command.count:
                    raise HTTPException(422, "The proposed stage count must match the explicit instruction.")
                stages = command.count
                current_stage = stages
            elif isinstance(command, Playback) and command.type == "play" and workflow:
                go_step(step if workflow_id == "anatomy" and step in (1, 2) else 1 if workflow_id == "anatomy" else 4)
    for i, clause in enumerate(clauses):
        if i not in audited_sources and mechanics_api.source_is_mechanics(clause) and not workflow:
            raise HTTPException(422, "The plan omitted a requested appliance instruction.")
        if i not in audited_sources and re.search(r"\b(?:move|translate|rotate|tip|torque|intrude|extrude|expand|retract|protract|constrict|distalize|mesialize|reset|select|highlight|focus|zoom)\b", clause):
            # Authored anatomy/workflow demonstrations are distinct from numeric edits.
            authored_clause = re.search(r"^(?:demonstrate|show|compare)\b.*\b(?:translation|tipping)\b", clause)
            if not authored_clause or not any(isinstance(action, TeachingAnatomyLesson) for action in plan.actions):
                raise HTTPException(422, "The plan omitted part of the requested tooth instructions. Ask for a clarification instead.")
    if expected_mechanics:
        raise HTTPException(422, "The plan omitted part of the requested appliance connection or recalculation.")
    return plan


def grounded_mechanics_plan(payload: TeachingRequest) -> Union[TeachingPlan, None]:
    """Supply provider hints only for fully recognized, independently valid requests."""
    context = payload.context
    if context.mode != "case" or not context.synthetic or context.mechanics is None:
        return None
    scene = context.model_dump(exclude_none=True, by_alias=True)
    actions = []
    def targets(selector):
        selector = re.sub(r"^the ", "", selector).strip()
        named = r"(?:all )?(?:(?:upper|lower|maxillary|mandibular) )?(?:all )?(?:teeth|arch|incisors?|canines?|premolars?|molars?|anterior(?: teeth)?|posterior(?: teeth)?)"
        explicit = r"(?:tooth )?\d{2}|(?:teeth )?\d{2}(?:(?:\s*,\s*|\s+and\s+|\s+)\d{2})*"
        if not re.fullmatch(rf"selected teeth|selection|it|{named}|{explicit}", selector):
            raise ValueError("The complete target selector must be recognized before supplying a hint.")
        return _source_targets(selector, scene["availableIds"], scene["selected"], scene["selectedIds"], scene["arch"])
    try:
        for clause in _clauses(normalized_teaching_text(payload.text)):
            selection = re.fullmatch(r"(?:select|highlight) (.+)", clause)
            if selection:
                teeth = targets(selection[1])
                actions.append({"kind": "select", "teeth": teeth})
                scene["selectedIds"], scene["selected"] = teeth, teeth[0]
            elif mechanics_api.source_is_mechanics(clause):
                expected = mechanics_api.expected_actions(clause, scene, targets)
                for action in expected:
                    actions.append({"kind": "mechanics", "action": action})
                    mechanics_api.advance(scene, action)
            else:
                return None
            if len(actions) > 8:
                return None
        plan = TeachingPlan.model_validate({"actions": actions, "summary": "", "clarification": None})
        return validate_teaching_plan(payload, plan)
    except (HTTPException, ValidationError, ValueError, KeyError, IndexError):
        return None


