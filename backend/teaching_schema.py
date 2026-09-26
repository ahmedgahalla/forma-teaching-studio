"""Teaching-plan request/response models shared with the frontend contract."""

from typing import Literal, Union

from pydantic import Field, field_validator, model_validator

import mechanics as mechanics_api
from commands import Command, Tooth, ToothGroup
from core import StrictModel

View = Literal["front", "right", "left", "occlusal", "perspective"]
Arch = Literal["upper", "lower", "both"]
WorkflowId = Literal["fixed-braces", "palatal-expansion", "archwire-expansion"]


class TeachingDental(StrictModel):
    kind: Literal["dental"]
    command: Command


class TeachingSelect(ToothGroup):
    kind: Literal["select"]


class TeachingView(StrictModel):
    kind: Literal["view"]
    view: View


class TeachingArch(StrictModel):
    kind: Literal["arch"]
    arch: Arch


class TeachingToggle(StrictModel):
    kind: Literal["toggle"]
    target: Literal["braces", "roots", "gums", "labels", "grid", "attachments"]
    visible: bool


class TeachingComparison(StrictModel):
    kind: Literal["comparison"]
    mode: Literal["before", "after", "overlay", "off"]


class TeachingStage(StrictModel):
    kind: Literal["stage"]
    action: Literal["next", "previous"]


class TeachingExactStage(StrictModel):
    kind: Literal["stage"]
    action: Literal["exact"]
    stage: int = Field(ge=0, le=50)


class TeachingStop(StrictModel):
    kind: Literal["stop"]


class TeachingFocus(StrictModel):
    kind: Literal["focus"]
    tooth: Tooth


class TeachingLecture(StrictModel):
    kind: Literal["lecture"]
    enabled: bool


class TeachingLessonStep(StrictModel):
    kind: Literal["lesson-step"]
    action: Literal["next", "previous", "restart"]


class TeachingWorkflowStart(StrictModel):
    kind: Literal["workflow"]
    action: Literal["start"]
    id: WorkflowId


class TeachingWorkflow(StrictModel):
    kind: Literal["workflow"]
    action: Literal["next", "previous", "restart", "play", "pause", "exit"]


class TeachingWorkflowPhase(StrictModel):
    kind: Literal["workflow"]
    action: Literal["phase"]
    phase: Literal["assessment", "brackets", "wire", "forces", "movement", "retention"]


class TeachingAttachmentAdd(ToothGroup):
    kind: Literal["attachment"]
    action: Literal["add"]
    shape: Literal["rectangle", "ellipsoid", "beveled"]


class TeachingAttachmentRemove(ToothGroup):
    kind: Literal["attachment"]
    action: Literal["remove"]


class TeachingAnatomy(StrictModel):
    kind: Literal["anatomy"]
    action: Literal["bone", "cutaway", "ligament"]
    visible: bool


class TeachingOpacity(StrictModel):
    kind: Literal["anatomy"]
    action: Literal["opacity"]
    value: float = Field(ge=0, le=1)


class TeachingSpeed(StrictModel):
    kind: Literal["speed"]
    value: float

    @field_validator("value")
    @classmethod
    def allowed_speed(cls, value):
        if value not in (0.5, 1, 2):
            raise ValueError("Choose a supported playback speed.")
        return value


class TeachingNarrate(StrictModel):
    kind: Literal["narrate"]
    target: Literal["step", "answer"]


class TeachingQuestion(StrictModel):
    kind: Literal["question"]
    visible: bool


class TeachingProgress(StrictModel):
    kind: Literal["progress"]
    value: float = Field(ge=0, le=1)


class TeachingReplay(StrictModel):
    kind: Literal["replay"]
    slower: bool


class TeachingReturn(StrictModel):
    kind: Literal["return-lesson"]


class TeachingAnatomyLesson(StrictModel):
    kind: Literal["anatomy-lesson"]
    action: Literal["start", "translation", "tipping"]


TeachingAction = Union[
    mechanics_api.TeachingMechanics,
    TeachingDental, TeachingSelect, TeachingView, TeachingArch, TeachingToggle,
    TeachingComparison, TeachingStage, TeachingExactStage, TeachingStop, TeachingFocus,
    TeachingLecture, TeachingLessonStep, TeachingWorkflowStart, TeachingWorkflow,
    TeachingWorkflowPhase, TeachingAttachmentAdd, TeachingAttachmentRemove,
    TeachingAnatomy, TeachingOpacity, TeachingSpeed, TeachingNarrate, TeachingQuestion, TeachingProgress, TeachingReplay,
    TeachingReturn, TeachingAnatomyLesson,
]


class TeachingPlan(StrictModel):
    actions: list[TeachingAction] = Field(max_length=8)
    summary: str = Field(max_length=600)
    clarification: Union[str, None] = Field(max_length=400)

    @model_validator(mode="after")
    def complete_or_clarify(self):
        if self.clarification is not None:
            if not self.clarification.strip() or self.actions:
                raise ValueError("A clarification must be nonempty and contain no actions.")
        elif not self.actions:
            raise ValueError("Return at least one action or a clarification.")
        return self


class TeachingLayers(StrictModel):
    roots: Union[bool, None] = None
    gums: Union[bool, None] = None
    braces: Union[bool, None] = None
    labels: Union[bool, None] = None
    grid: Union[bool, None] = None
    attachments: Union[bool, None] = None
    bone: Union[bool, None] = None
    cutaway: Union[bool, None] = None
    ligament: Union[bool, None] = None


class TeachingContext(StrictModel):
    mode: Literal["case", "workflow"]
    workflowId: Union[WorkflowId, Literal["anatomy"], None]
    # Case mode uses -1 when no short-lesson step has been entered yet.
    stepIndex: int = Field(ge=-1, le=50)
    selected: str = Field(pattern=r"^(?:[1-4][1-8])?$")
    selectedIds: list[Tooth] = Field(max_length=32)
    availableIds: list[Tooth] = Field(max_length=32)
    synthetic: bool
    revision: int = Field(ge=0)
    view: View
    arch: Arch
    speed: float
    # Scrubbing and playback report fractional positions, not just numbered stages.
    stage: Union[float, None] = Field(default=None, ge=0, le=50)
    stages: Union[int, None] = Field(default=None, ge=2, le=50)
    playing: Union[bool, None] = None
    lessonActive: Union[bool, None] = None
    canReturnToLesson: Union[bool, None] = None
    lastActions: Union[list[TeachingAction], None] = Field(default=None, max_length=8)
    layers: Union[TeachingLayers, None] = None
    boneOpacity: Union[float, None] = Field(default=None, ge=0, le=1)
    pointed: Union[mechanics_api.Pointed, None] = None
    mechanics: Union[mechanics_api.Context, None] = None

    @model_validator(mode="after")
    def valid_context(self):
        mechanics_api.validate_context(self.mechanics, self.availableIds)
        if self.pointed and self.pointed.tooth not in self.availableIds:
            raise ValueError("The pointed tooth must exist in the current model.")
        if self.speed not in (0.5, 1, 2):
            raise ValueError("Choose a supported speed.")
        if len(set(self.availableIds)) != len(self.availableIds) or len(set(self.selectedIds)) != len(self.selectedIds):
            raise ValueError("Tooth IDs must be unique.")
        if self.selected and self.selected not in self.availableIds:
            raise ValueError("Selected tooth must be available.")
        if any(tooth not in self.availableIds for tooth in self.selectedIds):
            raise ValueError("Selected teeth must be available.")
        if self.mode == "workflow" and self.workflowId is None:
            raise ValueError("An active workflow requires an ID.")
        if self.mode == "workflow" and not 0 <= self.stepIndex <= (3 if self.workflowId == "anatomy" else 6):
            raise ValueError("The workflow step is outside this lesson.")
        if self.stage is not None and self.stages is not None and self.stage > self.stages:
            raise ValueError("Stage cannot exceed the stage count.")
        return self


class TeachingRequest(StrictModel):
    text: str = Field(min_length=1, max_length=1500)
    context: TeachingContext

    @field_validator("text")
    @classmethod
    def nonempty_text(cls, value):
        if not value.strip():
            raise ValueError("Enter a teaching instruction.")
        return value.strip()

