"""Bounded, anonymous mechanics facts for read-only scene explanations."""
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_serializer, model_validator

from mechanics import BracketAngle, Law, LocalPoint, Material, Point, Section, Support, Teeth, Tooth, ToothEndpoint


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


TadId = Annotated[str, Field(pattern=r"^tad-[1-8]$")]
SUPPORT_COEFFICIENTS = {"standard": (100, 1000), "soft": (50, 500), "firm": (200, 2000)}


class SceneSupport(Strict):
    preset: Support
    translationNPerMm: float
    rotationNmmPerRad: float

    @model_validator(mode="after")
    def matching_preset(self):
        if (self.translationNPerMm, self.rotationNmmPerRad) != SUPPORT_COEFFICIENTS[self.preset]:
            raise ValueError("Virtual support coefficients must match the preset.")
        return self


class SceneWire(Strict):
    teeth: list[Tooth] = Field(min_length=2, max_length=32)
    material: Material
    section: Section
    expansionMm: float = Field(ge=-2, le=2)
    torqueDeg: float = Field(ge=-20, le=20)


class SceneTad(Strict):
    id: TadId
    position: Point


class SceneTadEndpoint(Strict):
    kind: Literal["tad"]
    id: TadId


class SceneElastic(Strict):
    from_: Union[ToothEndpoint, SceneTadEndpoint] = Field(alias="from")
    to: Union[ToothEndpoint, SceneTadEndpoint]
    law: Law

    @model_validator(mode="after")
    def distinct_endpoints(self):
        if self.from_ == self.to:
            raise ValueError("An elastic needs two different attachment points.")
        return self


class SceneExpander(Strict):
    left: Teeth
    right: Teeth
    activationMm: float = Field(ge=0, le=2)
    stiffnessNPerMm: float = Field(ge=.001, le=1000)
    palateStiffnessNPerMm: Union[float, None] = Field(ge=.001, le=1000)

    @model_validator(mode="after")
    def opposite_upper_sides(self):
        left_sides = {tooth[0] for tooth in self.left}
        right_sides = {tooth[0] for tooth in self.right}
        if len(left_sides) != 1 or len(right_sides) != 1 or left_sides | right_sides != {"1", "2"}:
            raise ValueError("An expander requires opposite sides of the upper arch.")
        return self


class SceneBracketPlacement(Strict):
    tooth: Tooth
    slotLocal: LocalPoint
    referenceSlotLocal: LocalPoint
    angleDeg: BracketAngle


class SceneAppliances(Strict):
    bracketTeeth: list[Tooth] = Field(max_length=32)
    bracketPlacements: list[SceneBracketPlacement] = Field(default_factory=list, max_length=32)
    wires: list[SceneWire] = Field(max_length=4)
    support: Union[SceneSupport, None]
    fixedTeeth: list[Tooth] = Field(max_length=32)
    tads: list[SceneTad] = Field(max_length=8)
    elastics: list[SceneElastic] = Field(max_length=12)
    expanders: list[SceneExpander] = Field(max_length=1)
    tadCount: int = Field(ge=0, le=8)
    elasticCount: int = Field(ge=0, le=12)
    expanderCount: int = Field(ge=0, le=1)

    @model_serializer(mode="wrap")
    def preserve_optional_placement_facts(self, handler):
        result = handler(self)
        if "bracketPlacements" not in self.model_fields_set:
            result.pop("bracketPlacements", None)
        return result

    @model_validator(mode="after")
    def consistent_configuration(self):
        placements = [item.tooth for item in self.bracketPlacements]
        if len(placements) != len(set(placements)) or not set(placements) <= set(self.bracketTeeth):
            raise ValueError("Bracket placements must refer to unique installed brackets.")
        if (self.tadCount, self.elasticCount, self.expanderCount) != (
            len(self.tads), len(self.elastics), len(self.expanders)
        ):
            raise ValueError("Appliance counts must match the supplied lists.")
        if self.support is None and any((
            self.bracketTeeth, self.wires, self.fixedTeeth, self.tads, self.elastics, self.expanders
        )):
            raise ValueError("An absent experiment must have empty appliance lists.")
        tad_ids = {tad.id for tad in self.tads}
        if len(tad_ids) != len(self.tads):
            raise ValueError("TAD references must be unique.")
        for elastic in self.elastics:
            for endpoint in (elastic.from_, elastic.to):
                if isinstance(endpoint, SceneTadEndpoint) and endpoint.id not in tad_ids:
                    raise ValueError("Elastic TAD references must be available.")
        return self

    def validate_targets(self, available: set[str]):
        groups = [self.bracketTeeth, self.fixedTeeth, *[wire.teeth for wire in self.wires]]
        groups.extend(side for expander in self.expanders for side in (expander.left, expander.right))
        groups.extend(
            [endpoint.tooth] for elastic in self.elastics for endpoint in (elastic.from_, elastic.to)
            if isinstance(endpoint, ToothEndpoint)
        )
        for ids in groups:
            if len(set(ids)) != len(ids) or not set(ids) <= available:
                raise ValueError("Scene references must be unique and available.")
        for wire in self.wires:
            if not set(wire.teeth) <= set(self.bracketTeeth):
                raise ValueError("Wire targets require installed brackets.")
            if len({int(tooth[0]) <= 2 for tooth in wire.teeth}) != 1:
                raise ValueError("Each wire must belong to one arch.")
