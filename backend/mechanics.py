"""Strict, text-only appliance intents. Geometry and force calculations stay in the app."""
import copy
import math
import re
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, model_serializer, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)

    @model_serializer(mode="wrap")
    def omit_absent(self, handler):
        return {key: value for key, value in handler(self).items() if value is not None}


Id = Annotated[str, Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,47}$")]
Tooth = Annotated[str, Field(pattern=r"^[1-4][1-8]$")]
Coordinate = Annotated[float, Field(ge=-200, le=200)]
LocalCoordinate = Annotated[float, Field(ge=-30, le=30)]
Point = Annotated[list[Coordinate], Field(min_length=3, max_length=3)]
LocalPoint = Annotated[list[LocalCoordinate], Field(min_length=3, max_length=3)]
Material = Literal["stainless-steel", "beta-titanium"]
Support = Literal["standard", "soft", "firm"]
Teeth = Annotated[list[Tooth], Field(min_length=1, max_length=32)]


class RoundSection(Strict):
    shape: Literal["round"]
    diameterMm: float = Field(ge=.2, le=.022 * 25.4)


class RectangleSection(Strict):
    shape: Literal["rectangle"]
    widthMm: float = Field(ge=.2, le=.028 * 25.4)
    heightMm: float = Field(ge=.2, le=.022 * 25.4)


Section = Union[RoundSection, RectangleSection]


class ToothEndpoint(Strict):
    kind: Literal["tooth"]
    tooth: Tooth
    local: LocalPoint


class TadEndpoint(Strict):
    kind: Literal["tad"]
    id: Id


Endpoint = Union[ToothEndpoint, TadEndpoint]


class ConstantLaw(Strict):
    kind: Literal["constant"]
    forceN: float = Field(ge=0, le=20)


class SpringLaw(Strict):
    kind: Literal["spring"]
    stiffnessNPerMm: float = Field(ge=.001, le=1000)
    restLengthMm: float = Field(ge=0, le=200)


Law = Union[ConstantLaw, SpringLaw]


class Brackets(Strict):
    type: Literal["brackets"]
    teeth: Teeth
    installed: bool


class BracketPosition(Strict):
    type: Literal["bracket-position"]
    tooth: Tooth
    local: LocalPoint


class Wire(Strict):
    type: Literal["wire"]
    id: Id
    teeth: Teeth
    material: Material
    section: Section
    expansionMm: Union[float, None] = Field(default=None, ge=-2, le=2)
    torqueDeg: Union[float, None] = Field(default=None, ge=-20, le=20)


class WireMaterial(Strict):
    type: Literal["wire-material"]
    id: Id
    material: Material


class WireSection(Strict):
    type: Literal["wire-section"]
    id: Id
    section: Section


class WireActivation(Strict):
    type: Literal["wire-activation"]
    id: Id
    expansionMm: float = Field(ge=-2, le=2)
    torqueDeg: Union[float, None] = Field(default=None, ge=-20, le=20)


class Tad(Strict):
    type: Literal["tad"]
    id: Id
    position: Point


class Elastic(Strict):
    type: Literal["elastic"]
    id: Id
    from_: Endpoint = Field(alias="from")
    to: Endpoint
    law: Law


class Expander(Strict):
    type: Literal["expander"]
    id: Id
    left: Teeth
    right: Teeth
    activationMm: float = Field(ge=0, le=2)
    stiffnessNPerMm: float = Field(ge=.001, le=1000)
    palateStiffnessNPerMm: Union[float, None] = Field(default=None, ge=.001, le=1000)


class Remove(Strict):
    type: Literal["remove"]
    kind: Literal["wire", "tad", "elastic", "expander"]
    id: Id


class SupportAction(Strict):
    type: Literal["support"]
    preset: Support


class Anchor(Strict):
    type: Literal["anchor"]
    teeth: Teeth
    fixed: bool


class SaveStage(Strict):
    type: Literal["save-stage"]
    label: str = Field(min_length=1, max_length=80)


class Stage(Strict):
    type: Literal["stage"]
    index: int = Field(ge=0, le=19)


class Compare(Strict):
    type: Literal["compare-without-tad"]
    id: Id


class Operation(Strict):
    type: Literal["solve", "explain", "apply", "discard"]


Action = Union[Brackets, BracketPosition, Wire, WireMaterial, WireSection, WireActivation, Tad, Elastic, Expander, Remove, SupportAction, Anchor, SaveStage, Stage, Compare, Operation]


class TeachingMechanics(Strict):
    kind: Literal["mechanics"]
    action: Action


class ConfigWire(Strict):
    id: Id
    teeth: Teeth
    material: Material
    section: Section
    expansionMm: float = Field(ge=-2, le=2)
    torqueDeg: float = Field(ge=-20, le=20)


class ConfigTad(Strict):
    id: Id
    position: Point


class ConfigElastic(Strict):
    id: Id
    from_: Endpoint = Field(alias="from")
    to: Endpoint
    law: Law


class ConfigExpander(Strict):
    id: Id
    left: Teeth
    right: Teeth
    activationMm: float = Field(ge=0, le=2)
    stiffnessNPerMm: float = Field(ge=.001, le=1000)
    palateStiffnessNPerMm: Union[float, None] = Field(default=None, ge=.001, le=1000)


class Config(Strict):
    brackets: dict[Tooth, LocalPoint]
    wires: list[ConfigWire] = Field(max_length=4)
    tads: list[ConfigTad] = Field(max_length=8)
    elastics: list[ConfigElastic] = Field(max_length=12)
    expanders: list[ConfigExpander] = Field(max_length=1)
    support: Support
    fixedTeeth: list[Tooth] = Field(max_length=32)


class Focus(Strict):
    teeth: Union[list[Tooth], None] = Field(default=None, max_length=32)
    wireId: Union[Id, None] = None
    tadId: Union[Id, None] = None
    elasticId: Union[Id, None] = None
    expanderId: Union[Id, None] = None
    lastParameter: Union[Literal["wire-section", "wire-activation", "elastic-force"], None] = None


class Pointed(Strict):
    tooth: Tooth
    localPoint: LocalPoint
    worldPoint: Point
    surface: Union[Literal["crown", "root", "gingiva"], None] = None


class WirePreset(Strict):
    material: Material
    section: Section


class Context(Strict):
    config: Config
    bracketAnchors: dict[Tooth, LocalPoint]
    focus: Focus
    stageIndex: int = Field(ge=-1, le=19)
    stageCount: int = Field(ge=0, le=20)
    hasResult: bool
    wirePreset: Union[WirePreset, None] = None
    elasticPreset: Union[Law, None] = None

    @model_validator(mode="after")
    def valid(self):
        if self.stageIndex >= self.stageCount:
            raise ValueError("Choose an existing experiment stage.")
        for name in ("wires", "tads", "elastics", "expanders"):
            values = getattr(self.config, name)
            if len({value.id for value in values}) != len(values):
                raise ValueError("Appliance IDs must be unique.")
        groups = [self.config.fixedTeeth, *(wire.teeth for wire in self.config.wires)]
        if any(len(set(group)) != len(group) for group in groups):
            raise ValueError("Tooth groups must be unique.")
        return self


def validate_context(context, available):
    if not context:
        return
    config = context.config
    ids = set(config.brackets) | set(config.fixedTeeth) | set(context.bracketAnchors)
    ids.update(tooth for wire in config.wires for tooth in wire.teeth)
    ids.update(tooth for expander in config.expanders for tooth in expander.left + expander.right)
    ids.update(endpoint.tooth for elastic in config.elastics for endpoint in (elastic.from_, elastic.to) if isinstance(endpoint, ToothEndpoint))
    if not ids.issubset(available):
        raise ValueError("Appliance references must belong to this model.")


def as_dict(value):
    return value.model_dump(exclude_none=True, by_alias=True)


def same_intent(first, second):
    if isinstance(first, (float, int)) and not isinstance(first, bool) and isinstance(second, (float, int)) and not isinstance(second, bool):
        return math.isclose(first, second, rel_tol=1e-10, abs_tol=1e-10)
    if isinstance(first, list) or isinstance(second, list):
        return isinstance(first, list) and isinstance(second, list) and len(first) == len(second) and all(same_intent(a, b) for a, b in zip(first, second))
    if isinstance(first, dict) or isinstance(second, dict):
        return isinstance(first, dict) and isinstance(second, dict) and first.keys() == second.keys() and all(same_intent(first[key], second[key]) for key in first)
    return first == second


def source_is_mechanics(source):
    source = normalize_wording(source)
    if re.match(r"(?:(?:install|add|place|put) (?:a |the )?(?:palatal )?expander\b|activate (?:the |this |that )?expander\b|remove (?:the |this |that )?(?:wire|tad|elastic|expander)\b)", source):
        return True
    return bool(re.search(r"^(?:(?:install|add|bond|remove) (?:the |a |an )?brackets?\b|(?:put|insert|make|create|add|install|engage) (?:the |a |an )?(?:arch)?wires?\b|(?:put|place|add|install) (?:a |the )?(?:tad|mini[ -]?screw)\b|connect\b|(?:use|set|change|make)\b.*\b(?:wire|steel|titanium|tension|force)\b|(?:set|change|make) (?:that|it)\b|(?:show|calculate|solve|explain|compare)\b.*\b(?:happens?|response|result|movement|tad)\b|(?:activate|expand|widen) (?:the |this |that )?(?:arch)?wires?\b|(?:save|show|go to) (?:mechanics |experiment )?stage\b|(?:fix|release)\b.*\bmechanically\b)", source))


def source_is_solve(source):
    return bool(re.fullmatch(r"(?:show what (?:will )?happen(?:s)?(?: after that)?|(?:calculate|show|solve) (?:the |this )?(?:initial |mechanical )?(?:response|result))", normalize_wording(source)))


def expected_actions(source, scene, resolve_targets):
    """Independent canonical evidence, shared only as a wire contract with the TS parser."""
    source = normalize_wording(source)
    context = scene.get("mechanics")
    if scene["mode"] != "case" or not scene["synthetic"] or not context:
        raise ValueError("Mechanical experiments need the synthetic free workspace.")
    config, focus = context["config"], context["focus"]
    def targets(selector=None):
        selector = re.sub(r"^(?:on|to|for|through) ", "", selector or "selected teeth")
        selector = re.sub(r"^the ", "", selector)
        selector = re.sub(r"\bsegment\b", "teeth", selector)
        selector = re.sub(r"^all (?:of )?the ", "all ", selector)
        selector = re.sub(r"^every (upper|lower) tooth$", r"all \1 teeth", selector)
        selector = re.sub(r"^(?:all |every )?(?:teeth|tooth) (?:in|on) (?:the )?(upper|lower) arch$", r"\1 teeth", selector)
        selector = re.sub(r"^(?:whole|entire) (upper|lower) (?:arch|jaw)$", r"\1 teeth", selector)
        if re.fullmatch(r"all teeth|every tooth|all brackets|whole arch|entire arch", selector):
            arch = scene.get("arch", "both")
            return [tooth for tooth in scene["availableIds"] if arch == "both" or (int(tooth[0]) < 3) == (arch == "upper")]
        if re.fullmatch(r"both (?:arches|jaws)|(?:the )?(?:whole|entire) mouth|all teeth in both arches", selector):
            return scene["availableIds"][:]
        if re.fullmatch(r"(?:the )?(?:these|those) brackets|them|these(?: teeth)?|those(?: teeth)?|selected|this group|that group", selector):
            selected = scene["selectedIds"]
            if not selected and re.fullmatch(r"them|these(?: teeth)?|those(?: teeth)?|this group|that group", selector):
                selected = focus.get("teeth") or []
                if any(tooth not in scene["availableIds"] for tooth in selected):
                    raise ValueError("The referenced teeth are no longer in this model.")
            return selected[:]
        if selector in ("here", "there", "this tooth", "that tooth"):
            pointed = scene.get("pointed")
            if not pointed:
                raise ValueError("Point to the target first.")
            if selector in ("here", "there") and pointed["tooth"] in scene["selectedIds"]:
                return scene["selectedIds"]
            return [pointed["tooth"]]
        return resolve_targets(selector)
    def chosen(kind):
        values = config[f"{kind}s"]
        found = next((value for value in values if value["id"] == focus.get(f"{kind}Id")), None)
        if not found and len(values) == 1:
            found = values[0]
        if not found:
            raise ValueError(f"Select one {kind} first.")
        return found
    def new_id(prefix, values):
        used = {value["id"] for value in values}
        n = 1
        while f"{prefix}-{n}" in used:
            n += 1
        return f"{prefix}-{n}"
    quantity = r"([+-]?(?:\d+(?:\.\d+)?|\.\d+))"
    remove = re.fullmatch(r"remove (?:the |this |that )?(wire|tad|elastic|expander)", source)
    if remove:
        return [{"type": "remove", "kind": remove[1], "id": chosen(remove[1])["id"]}]
    install = re.fullmatch(rf"(?:install|add|place|put) (?:a |the )?(?:palatal )?expander(?: on (.+?))? with activation {quantity} mm (?:and )?stiffness {quantity} n/mm(?: (?:and )?palate stiffness {quantity} n/mm)?", source)
    activate = re.fullmatch(rf"activate (?:the |this |that )?expander (?:by |to )?{quantity} mm", source)
    if install or activate:
        if install:
            teeth = targets(install[1])
            left, right = [tooth for tooth in teeth if tooth[0] == "2"], [tooth for tooth in teeth if tooth[0] == "1"]
            if not left or not right or len(left) + len(right) != len(teeth):
                raise ValueError("Choose upper teeth on both sides for this expander.")
            value = {"type": "expander", "id": new_id("expander", config["expanders"]), "left": left, "right": right, "activationMm": float(install[2]), "stiffnessNPerMm": float(install[3])}
            if install[4] is not None:
                value["palateStiffnessNPerMm"] = float(install[4])
        else:
            value = {"type": "expander", **chosen("expander"), "activationMm": float(activate[1])}
        return [value, {"type": "solve"}] if context["hasResult"] else [value]
    bracket = re.fullmatch(r"(install|add|bond|remove) (?:the )?brackets?(?: (?:on|to|from))?(?: (.+))?", source)
    if bracket:
        return [{"type": "brackets", "teeth": targets(bracket[2]), "installed": bracket[1] != "remove"}]
    wire = re.fullmatch(r"(?:put|insert|make|create|add|install|engage) (?:a |an |the )?(?:arch)?wires?(?: (?:through|on|for))?(?: (.+))?", source)
    if wire:
        if not context.get("wirePreset"):
            raise ValueError("Select the visible wire preset first.")
        teeth, actions, used = targets(wire[1]), [], copy.deepcopy(config["wires"])
        if not teeth:
            raise ValueError("Select teeth present in this model.")
        for upper in (True, False):
            group = sorted((tooth for tooth in teeth if (int(tooth[0]) < 3) == upper), key=lambda tooth: 8 - int(tooth[1]) if tooth[0] in ("1", "4") else 8 + int(tooth[1]))
            if not group:
                continue
            if len(group) < 2:
                raise ValueError("A wire needs at least two teeth in each requested arch.")
            overlapping = [item for item in config["wires"] if set(item["teeth"]) & set(group)]
            existing = next((item for item in overlapping if set(item["teeth"]).issubset(group)), None)
            if overlapping and (len(overlapping) != 1 or existing is None):
                raise ValueError("Existing wires extend beyond this group or overlap. Remove the conflicting wire or include all of its teeth.")
            missing = [tooth for tooth in group if tooth not in config["brackets"]]
            if missing:
                actions.append({"type": "brackets", "teeth": missing, "installed": True})
            if existing:
                actions.append({"type": "wire", **copy.deepcopy(existing), "teeth": group})
            else:
                if len(used) >= 4:
                    raise ValueError("This experiment supports up to four wires. Remove an unused wire first.")
                value = {"type": "wire", "id": new_id("wire", used), "teeth": group, **context["wirePreset"]}
                actions.append(value)
                used.append(value)
        return actions
    if re.fullmatch(r"(?:put|place|add|install) (?:a |the )?(?:tad|mini[ -]?screw) (?:here|there)", source):
        if not scene.get("pointed"):
            raise ValueError("Point to a synthetic location first.")
        return [{"type": "tad", "id": new_id("tad", config["tads"]), "position": scene["pointed"]["worldPoint"]}]
    if source_is_solve(source):
        return [{"type": "solve"}]
    if re.fullmatch(r"explain (?:that |this |the )?(?:movement|response|result)(?: aloud)?", source):
        return [{"type": "explain"}]
    if re.fullmatch(r"compare (?:it |this |that )?without (?:the |this |that )?tad", source):
        return [{"type": "compare-without-tad", "id": chosen("tad")["id"]}]
    actions = []
    activation = re.fullmatch(rf"(?:activate|expand|widen) (?:the |this |that )?(?:arch)?wire (?:by |to )?{quantity} mm", source)
    torque = re.fullmatch(rf"(?:set|change|make) (?:the |this |that )?wire torque (?:to )?{quantity} degrees", source)
    if activation or torque:
        value = chosen("wire")
        actions = [{"type": "wire-activation", "id": value["id"], "expansionMm": float(activation[1]) if activation else value["expansionMm"], "torqueDeg": float(torque[1]) if torque else value["torqueDeg"]}]
    elif re.match(r"(?:use|set|change|make)\b", source) and re.search(r"\b(?:wire|steel|titanium|tma)\b", source):
        value = chosen("wire")
        if re.search(r"\b(?:niti|nickel[ -]?titanium)\b", source):
            raise ValueError("NiTi is unavailable in this elastic model.")
        material = "stainless-steel" if re.search(r"\b(?:stainless(?: steel)?|steel)\b", source) else "beta-titanium" if re.search(r"\b(?:beta[ -]?titanium|tma)\b", source) else None
        if material:
            actions.append({"type": "wire-material", "id": value["id"], "material": material})
        rectangular = re.search(rf"{quantity}\s*(?:x|by|×)\s*{quantity}\s*(mm|inch(?:es)?|in)\b", source)
        rounded = re.search(rf"{quantity}\s*(mm|inch(?:es)?|in)\b", source)
        section = None
        if rectangular:
            scale = 1 if rectangular[3] == "mm" else 25.4
            section = {"shape": "rectangle", "heightMm": float(rectangular[1]) * scale, "widthMm": float(rectangular[2]) * scale}
        elif rounded:
            section = {"shape": "round", "diameterMm": float(rounded[1]) * (1 if rounded[2] == "mm" else 25.4)}
        if section:
            actions.append({"type": "wire-section", "id": value["id"], "section": section})
    else:
        replacement = re.fullmatch(rf"(?:make|set|change) (?:that|it) (?:to )?{quantity}(?: (mm|n|newtons?|gf|grams? force))?(?: instead)?", source)
        if replacement:
            amount, unit = float(replacement[1]), replacement[2] or ("mm" if focus.get("lastParameter", "").startswith("wire-") else None)
            if unit == "mm" and focus.get("lastParameter") == "wire-section":
                value = chosen("wire")
                if value["section"]["shape"] != "round":
                    raise ValueError("Give both height and width for this rectangular wire, or explicitly request a round wire diameter.")
                actions = [{"type": "wire-section", "id": value["id"], "section": {"shape": "round", "diameterMm": amount}}]
            elif unit == "mm" and focus.get("lastParameter") == "wire-activation":
                value = chosen("wire")
                actions = [{"type": "wire-activation", "id": value["id"], "expansionMm": amount, "torqueDeg": value["torqueDeg"]}]
            elif unit and unit != "mm" and focus.get("lastParameter") == "elastic-force":
                actions = [{"type": "elastic", **chosen("elastic"), "law": {"kind": "constant", "forceN": amount * (.00980665 if unit.startswith(("gf", "gram")) else 1)}}]
        connection = re.fullmatch(r"connect (?:the |this |that )?(?:tad|mini[ -]?screw|it) to (.+?)(?: (?:at|with) ([\d.]+)\s*(n|newtons?|gf|grams? force)(?: (?:total|each))?)?", source)
        if connection:
            anchor, teeth = chosen("tad"), targets(connection[1])
            law = {"kind": "constant", "forceN": float(connection[2]) * (.00980665 if connection[3].startswith(("gf", "gram")) else 1)} if connection[2] else context.get("elasticPreset")
            if not law or not teeth or len(teeth) > 1 and (law["kind"] == "spring" or source.endswith(" each")):
                raise ValueError("Specify total group tension, or connect one explicit spring.")
            used = copy.deepcopy(config["elastics"])
            for tooth in teeth:
                point = scene.get("pointed")
                local = config["brackets"].get(tooth) or (point["localPoint"] if point and point["tooth"] == tooth else None)
                if local is None:
                    raise ValueError("Choose an existing bracket or pointed attachment.")
                identity = new_id("elastic", used)
                value = {"type": "elastic", "id": identity, "from": {"kind": "tad", "id": anchor["id"]}, "to": {"kind": "tooth", "tooth": tooth, "local": local}, "law": {"kind": "constant", "forceN": law["forceN"] / len(teeth)} if law["kind"] == "constant" else law}
                actions.append(value)
                used.append(value)
        tension = re.fullmatch(rf"(?:set|change|make) (?:the |this |that )?(?:elastic )?(?:tension|force) (?:to )?{quantity} (n|newtons?|gf|grams? force)", source)
        if tension:
            actions = [{"type": "elastic", **chosen("elastic"), "law": {"kind": "constant", "forceN": float(tension[1]) * (.00980665 if tension[2].startswith(("gf", "gram")) else 1)}}]
    if actions:
        if context["hasResult"]:
            actions.append({"type": "solve"})
        return actions
    stage = re.fullmatch(r"save (?:mechanics |experiment )?stage (?:as )?(.+)", source)
    if stage:
        return [{"type": "save-stage", "label": stage[1].strip("\"'")}]
    go = re.fullmatch(r"(?:show|go to) (?:mechanics |experiment )stage (\d+)", source)
    if go:
        return [{"type": "stage", "index": int(go[1])}]
    anchor = re.fullmatch(r"(fix|release) (.+?) mechanically", source)
    if anchor:
        return [{"type": "anchor", "teeth": targets(anchor[2]), "fixed": anchor[1] == "fix"}]
    raise ValueError("The appliance instruction needs explicit targets and settings.")


def normalize_wording(source):
    if re.fullmatch(r"place (?:braces|brackets only)", source):
        return source
    source = re.sub(r"^(install|add|bond|remove|attach|fit|put|place) (?:the )?braces\b", r"\1 brackets", source)
    source = re.sub(r"^(?:attach|fit|put|place) (?:the )?brackets\b", "install brackets", source)
    source = re.sub(r"^(?:run|thread|fit|place|attach) (a |an |the )?((?:arch)?wires?)\b", r"put \1\2", source)
    source = re.sub(r"^show me what ", "show what ", source)
    source = re.sub(r"^(?:replace|switch) (?:the |this |that )?wire (?:with|to) ", "change the wire to ", source)
    return re.sub(r"\bover here\b", "here", source)


def advance(scene, action):
    context, available = scene["mechanics"], scene["availableIds"]
    config, focus, kind = context["config"], context["focus"], action["type"]
    def present(teeth):
        if not teeth or len(set(teeth)) != len(teeth) or any(tooth not in available for tooth in teeth):
            raise ValueError("Choose unique teeth present in this model.")
    def entity(name, identity):
        value = next((value for value in config[name] if value["id"] == identity), None)
        if value is None:
            raise ValueError("The referenced appliance is unavailable.")
        return value
    def replace(name, value):
        config[name] = [item for item in config[name] if item["id"] != value["id"]] + [value]
    if kind == "brackets":
        present(action["teeth"])
        for tooth in action["teeth"]:
            if action["installed"]:
                if tooth not in context["bracketAnchors"]:
                    raise ValueError("No synthetic bracket anchor exists.")
                config["brackets"].setdefault(tooth, context["bracketAnchors"][tooth])
            else:
                config["brackets"].pop(tooth, None)
        focus["teeth"] = action["teeth"]
        scene["selectedIds"], scene["selected"] = action["teeth"], action["teeth"][0]
    elif kind == "wire":
        present(action["teeth"])
        if len(action["teeth"]) < 2 or any(tooth not in config["brackets"] for tooth in action["teeth"]) or len({int(tooth[0]) < 3 for tooth in action["teeth"]}) != 1:
            raise ValueError("A wire needs brackets on at least two teeth in one arch.")
        replace("wires", {key: value for key, value in {**action, "expansionMm": action.get("expansionMm", 0), "torqueDeg": action.get("torqueDeg", 0)}.items() if key != "type"})
        focus["wireId"] = action["id"]
        scene["selectedIds"], scene["selected"] = action["teeth"], action["teeth"][0]
    elif kind in ("wire-material", "wire-section", "wire-activation"):
        value = entity("wires", action["id"])
        value.update({key: value for key, value in action.items() if key not in ("type", "id")})
        focus["wireId"] = action["id"]
        if kind != "wire-material":
            focus["lastParameter"] = kind
    elif kind == "tad":
        replace("tads", {"id": action["id"], "position": action["position"]})
        focus["tadId"] = action["id"]
    elif kind == "elastic":
        for endpoint in (action["from"], action["to"]):
            entity("tads", endpoint["id"]) if endpoint["kind"] == "tad" else present([endpoint["tooth"]])
        replace("elastics", {key: value for key, value in action.items() if key != "type"})
        focus["elasticId"], focus["lastParameter"] = action["id"], "elastic-force"
    elif kind == "anchor":
        present(action["teeth"])
        config["fixedTeeth"] = list(dict.fromkeys(config["fixedTeeth"] + action["teeth"])) if action["fixed"] else [tooth for tooth in config["fixedTeeth"] if tooth not in action["teeth"]]
    elif kind == "expander":
        present(action["left"] + action["right"])
        replace("expanders", {key: value for key, value in action.items() if key != "type"})
        focus["expanderId"] = action["id"]
    elif kind == "remove":
        name = f"{action['kind']}s"
        entity(name, action["id"])
        if action["kind"] == "tad":
            config["elastics"] = [elastic for elastic in config["elastics"] if not any(endpoint["kind"] == "tad" and endpoint["id"] == action["id"] for endpoint in (elastic["from"], elastic["to"]))]
        config[name] = [value for value in config[name] if value["id"] != action["id"]]
    elif kind == "save-stage":
        if context["stageCount"] >= 20:
            raise ValueError("An experiment can contain up to 20 stages.")
        context["stageCount"] += 1
        context["stageIndex"] = context["stageCount"] - 1
        return
    elif kind == "stage":
        if action["index"] >= context["stageCount"]:
            raise ValueError("Choose an existing stage.")
        context["stageIndex"] = action["index"]
    elif kind == "solve":
        active = any(wire["expansionMm"] or wire["torqueDeg"] for wire in config["wires"]) or any(elastic["law"]["kind"] == "spring" or elastic["law"].get("forceN", 0) > 0 for elastic in config["elastics"]) or any(expander["activationMm"] for expander in config["expanders"])
        if not active:
            raise ValueError("Set a wire activation, elastic tension or expander activation first.")
        context["hasResult"] = True
        return
    elif kind in ("explain", "apply", "compare-without-tad"):
        if not context["hasResult"]:
            raise ValueError("Calculate a valid response first.")
        if kind == "compare-without-tad":
            entity("tads", action["id"])
        return
    else:
        raise ValueError("Use the explicit appliance controls for this operation.")
    context["hasResult"] = False
    Context.model_validate(context)
