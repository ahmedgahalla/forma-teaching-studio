"""The dental command model and independent target resolution."""

import re
from typing import Annotated, Literal, Union

from fastapi import HTTPException
from pydantic import Field, field_validator, model_validator

from classroom_language import normalize_classroom_language
from core import StrictModel

Tooth = Annotated[str, Field(pattern=r"^[1-4][1-8]$")]
Direction = Literal["buccal", "lingual", "mesial", "distal", "intrude", "extrude", "x", "y", "z"]


class Move(StrictModel):
    type: Literal["move"]
    tooth: Tooth
    direction: Direction
    amount: float = Field(ge=-10, le=10)


class Rotate(StrictModel):
    type: Literal["rotate"]
    tooth: Tooth
    axis: Literal["x", "y", "z"]
    amount: float = Field(ge=-180, le=180)


class ToothGroup(StrictModel):
    teeth: list[Tooth] = Field(min_length=1, max_length=32)

    @field_validator("teeth")
    @classmethod
    def unique_targets(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("Target teeth must be unique.")
        return value


class MoveGroup(ToothGroup):
    type: Literal["move_group"]
    direction: Direction
    amount: float = Field(ge=-10, le=10)


class RotateGroup(ToothGroup):
    type: Literal["rotate_group"]
    axis: Literal["x", "y", "z"]
    amount: float = Field(ge=-180, le=180)


class Orthodontic(ToothGroup):
    type: Literal["orthodontic"]
    movement: Literal["tip", "torque", "rotate"]
    amount: float = Field(ge=-180, le=180)


class Reset(ToothGroup):
    type: Literal["reset"]


class Appliance(StrictModel):
    type: Literal["appliance"]
    visible: bool


class Ghost(StrictModel):
    type: Literal["ghost"]
    visible: bool


class Stages(StrictModel):
    type: Literal["stages"]
    count: int = Field(ge=2, le=50)


class Playback(StrictModel):
    type: Literal["undo", "redo", "play"]


Command = Union[Move, Rotate, MoveGroup, RotateGroup, Orthodontic, Reset, Appliance, Ghost, Stages, Playback]


class InterpretRequest(StrictModel):
    text: str = Field(min_length=1, max_length=500)
    selected_tooth: Union[Tooth, None] = None
    selected_teeth: list[Tooth] = Field(default_factory=list, max_length=32)
    available_teeth: list[Tooth] = Field(max_length=32)

    @field_validator("text")
    @classmethod
    def nonempty_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Enter a command.")
        return value.strip()

    @model_validator(mode="after")
    def validate_context(self):
        if len(set(self.available_teeth)) != len(self.available_teeth):
            raise ValueError("Tooth IDs must be unique.")
        if self.selected_tooth is not None and self.selected_tooth not in self.available_teeth:
            raise ValueError("Selected tooth must exist in the current model.")
        if len(set(self.selected_teeth)) != len(self.selected_teeth):
            raise ValueError("Selected teeth must be unique.")
        if any(tooth not in self.available_teeth for tooth in self.selected_teeth):
            raise ValueError("Selected teeth must exist in the current model.")
        return self


def resolve_targets(payload: InterpretRequest) -> list[str]:
    """Audit targets independently of model output; never invent absent teeth."""
    text = normalize_classroom_language(payload.text)
    if re.search(r"\b(some|few|several|other|others|remaining|rest|except|excluding|exclude|without|or|near|neighboring|adjacent)\b", text):
        raise HTTPException(422, "Name one exact target selection; exclusions and ambiguous groups are not supported.")
    if re.search(r"\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:(?:upper|lower)\s+)?(?:teeth|incisors|canines|premolars|molars)\b", text):
        raise HTTPException(422, "Use explicit tooth IDs instead of a number of teeth.")
    # Amounts and stage counts are not tooth numbers, including scientific notation.
    without_amounts = re.sub(
        r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*(?:mm|cm|millimet(?:er|re)s?|degrees?|deg|°|stages?)(?!\w)",
        " ", text,
    )
    if re.search(r"\b\d+\s*(?:[-–—]|to\b|through\b)\s*\d+\b", without_amounts):
        raise HTTPException(422, "List each tooth ID explicitly or use a named group; tooth-number ranges are not supported.")
    explicit = list(dict.fromkeys(re.findall(r"(?<![\w.])(\d+)(?![\w.])", without_amounts)))
    if any(tooth not in payload.available_teeth for tooth in explicit):
        raise HTTPException(422, "A requested tooth is not available in the current model.")

    upper = bool(re.search(r"\b(upper|maxillary)\b", text))
    lower = bool(re.search(r"\b(lower|mandibular)\b", text))
    if upper and lower:
        raise HTTPException(422, "Use one arch selector, or 'all teeth'.")
    if re.search(r"\b(left|right|central|lateral|first|second|third)\b", text):
        raise HTTPException(422, "Use explicit tooth IDs for that more specific selection.")
    groups = [positions for pattern, positions in [
        (r"\bincisors?\b", "12"), (r"\bcanines?\b", "3"),
        (r"\bpremolars?\b", "45"), (r"\bmolars?\b", "678"),
        (r"\banteriors?\b", "123"), (r"\bposteriors?\b", "45678"),
    ] if re.search(pattern, text)]
    if len(groups) > 1:
        raise HTTPException(422, "Use one tooth-category selector or an explicit list of tooth IDs.")
    positions = groups[0] if groups else "12345678"
    def matches(tooth: str) -> bool:
        return (
            (not upper or tooth[0] in "12") and (not lower or tooth[0] in "34")
            and tooth[1] in positions
        )

    group_selector = upper or lower or bool(groups) or bool(re.search(r"\b(all|teeth)\b", text))
    selected_group = bool(re.search(r"\b(selected\s+teeth|selected\s+group|selection)\b", text))
    if explicit:
        if any(not matches(tooth) for tooth in explicit):
            raise HTTPException(422, "The requested tooth IDs do not match the named arch or category.")
        return explicit
    if selected_group:
        targets = [tooth for tooth in payload.selected_teeth if matches(tooth)]
    elif group_selector:
        targets = [tooth for tooth in payload.available_teeth if matches(tooth)]
    else:
        return [payload.selected_tooth] if payload.selected_tooth else []
    if not targets:
        raise HTTPException(422, "No available teeth match that selection.")
    return targets
