"""Deterministic source-text parsing used to audit provider plans."""

import math
import re
from typing import Union

from fastapi import HTTPException

import mechanics as mechanics_api
from classroom_language import normalize_classroom_language
from commands import Command, InterpretRequest, Move, MoveGroup, Orthodontic, Reset, Rotate, RotateGroup, resolve_targets
from teaching_schema import TeachingRequest

_NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?"
_SPOKEN = {word: index for index, word in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split())}
_SPOKEN.update(dict(zip("twenty thirty forty fifty sixty seventy eighty ninety".split(), range(20, 100, 10))))


def normalized_teaching_text(text: str) -> str:
    """Only known numeric speech forms; this supplies evidence, never missing values."""
    text = normalize_classroom_language(text)
    text = re.sub(r"[ \t\r\f\v]+", " ", text.lower().replace("−", "-")).strip()
    text = re.sub(r"^please ", "", text)
    text = re.sub(r"^(?:(?:can|could|would) you (?:please )?|i want you to )", "", text)
    digit = r"(?:zero|one|two|three|four|five|six|seven|eight|nine)"
    unit = r"(?:one|two|three|four|five|six|seven|eight|nine)"
    tens = r"(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)"
    under_hundred = rf"(?:{tens}(?: {unit})?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|{digit})"
    whole = rf"(?:{unit} hundred(?: (?:and )?{under_hundred})?|{under_hundred})"

    def integer(words: str) -> int:
        pieces = [word for word in words.split() if word != "and"]
        if "hundred" in pieces:
            return _SPOKEN[pieces[0]] * 100 + sum(_SPOKEN[word] for word in pieces[2:])
        return sum(_SPOKEN[word] for word in pieces)

    text = re.sub(rf"\b({tens})-({unit})\b", r"\1 \2", text)
    text = re.sub(rf"\b({whole}) and (?:a )?half\b", lambda m: str(integer(m[1]) + 0.5), text)
    text = re.sub(r"\b(?:a half|half(?: a)?) (?=mm\b|millimet(?:er|re)s?\b)", "0.5 ", text)
    text = re.sub(r"\b(?:a quarter|quarter(?: a)?) (?=mm\b|millimet(?:er|re)s?\b)", "0.25 ", text)
    text = re.sub(rf"\bpoint ({digit}(?: {digit})*)\b", lambda m: "point " + "".join(str(_SPOKEN[word]) for word in m[1].split()), text)
    text = re.sub(rf"\b{whole}\b", lambda m: str(integer(m[0])), text)
    text = re.sub(r"\b(\d+) point (\d+)\b", r"\1.\2", text)
    text = re.sub(r"\bpoint (\d+)\b", r"0.\1", text)
    text = re.sub(r"\b(?:minus|negative) (?=\d)", "-", text)
    text = re.sub(r"\b(?:plus|positive) (?=\d)", "+", text)
    text = re.sub(r"\bmillimet(?:er|re)s?\b", "mm", text)
    text = re.sub(r"\bdegrees?\b", "degrees", text)
    return text


def teaching_source_problem(text: str) -> Union[str, None]:
    text = text.replace("’", "'")
    if re.search(r"\b(?:javascript|eval|script|fetch|execute code|run code)\b|<script|=>|```", text, re.I):
        return "Use supported classroom actions instead of executable code."
    if re.search(r"\b(?:don't|do not|not to|never|avoid|what if|should i|would it|could it|how much|how far|is it safe|prescribe|diagnose|recommend treatment|treatment plan|my patient|biologically safe)\b", text, re.I):
        return "Give an explicit classroom instruction; clinical planning, hypothetical and negated edits are not supported."
    return None


def _clauses(text: str) -> list[str]:
    verbs = r"show|hide|move|translate|select|highlight|focus|zoom|rotate|tip|torque|intrude|extrude|expand|retract|protract|constrict|distalize|mesialize|reset|add|remove|create|generate|start|play|pause|stop|switch|isolate|explain|narrate|read|reveal|repeat|return|undo|redo|install|bond|insert|engage|put|connect|use|set|change|make|activate|widen|calculate|solve|compare|save|go|fix|release|attach|run|thread|replace"
    return [part.strip(" ,.?!") for part in re.split(rf"\b(?:and then|then|also|after that)\b|[;\n]|[.,](?=\s+(?:{verbs})\b)|\band\b(?=\s+(?:{verbs})\b)", text) if part.strip(" ,.?!")]


def _source_targets(text: str, available_ids: list[str], selected: str, selected_ids: list[str], arch: str) -> list[str]:
    text = re.sub(r"\b(?:them|these teeth|those teeth)\b", "selected teeth", text)
    family = re.search(r"\b(?:incisors?|canines?|premolars?|molars?|anteriors?|posteriors?)\b", text)
    without_amounts = re.sub(rf"{_NUMBER}\s*(?:mm|cm|millimet(?:er|re)s?|degrees?|deg|°)(?!\w)", " ", text)
    explicit = re.search(r"(?<![\w.])\d+(?![\w.])", without_amounts)
    if family and arch != "both" and not explicit and not re.search(r"\b(?:upper|lower|maxillary|mandibular|all)\b", text):
        text = f"{arch} {text}"
    # Context is already validated; the teaching endpoint permits longer clauses
    # than the legacy endpoint's 500-character request envelope.
    target_context = InterpretRequest.model_construct(text=text, selected_tooth=selected or None, selected_teeth=selected_ids, available_teeth=available_ids)
    return resolve_targets(target_context)


def _audit_movement(command: Command, source: str) -> None:
    is_move = isinstance(command, (Move, MoveGroup))
    unit = r"(mm|cm|millimet(?:er|re)s?)" if is_move else r"(degrees?|deg|°)"
    matches = list(re.finditer(rf"(?<![\w.])({_NUMBER})\s*{unit}(?!\w)", source))
    if len(matches) != 1:
        raise HTTPException(422, "Every movement needs one explicit numeric amount and unit; no amount can be inferred.")
    amount = float(matches[0][1]) * (10 if is_move and matches[0][2] == "cm" else 1)
    if command.amount == 0 or not math.isfinite(amount) or not math.isclose(command.amount, amount, rel_tol=1e-12, abs_tol=0):
        raise HTTPException(422, "The interpreted movement amount does not match the explicit instruction.")
    if is_move:
        aliases = {
            "buccal": r"buccal(?:ly)?|expand|expansion|protract",
            "lingual": r"lingual(?:ly)?|retract|constrict",
            "mesial": r"mesial(?:ly)?|mesialize", "distal": r"distal(?:ly)?|distalize",
            "intrude": r"intrude|intrusion", "extrude": r"extrude|extrusion",
            "x": "x", "y": "y", "z": "z",
        }
        found = [direction for direction, pattern in aliases.items() if re.search(rf"\b(?:{pattern})\b", source)]
        if found != [command.direction]:
            raise HTTPException(422, "Name one explicit movement direction; the proposed direction must match it.")
    elif isinstance(command, Orthodontic):
        movement = "torque" if re.search(r"\btorque\b", source) else "tip" if re.search(r"\btip(?:ping)?\b", source) else "rotate" if re.search(r"\b(?:rotate|rotation)\b", source) else None
        if movement != command.movement or re.search(r"\b[xyz]\b", source):
            raise HTTPException(422, "The proposed orthodontic rotation does not match the requested movement.")
        if movement == "rotate" and len(command.teeth) == 1 and not re.search(r"\b(?:axial|axially|long axis|teeth|them|incisors?|canines?|premolars?|molars?|anterior|posterior|arch)\b", source):
            raise HTTPException(422, "An ordinary single-tooth rotation defaults to world Y, not an inferred anatomical axis.")
    else:
        axes = re.findall(r"\b([xyz])\b", source)
        expected = axes[0] if len(axes) == 1 else "y" if not axes and isinstance(command, Rotate) else None
        if command.axis != expected or re.search(r"\b(?:tip|torque|axial|axially|long axis)\b", source):
            raise HTTPException(422, "The proposed world rotation does not match the requested axis.")

