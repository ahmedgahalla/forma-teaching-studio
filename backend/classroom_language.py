"""Explicit classroom wording aliases shared with the frontend; never fill missing values."""
import re

_BOUNDARY = r"(^|(?:[;,\n]|[.!?](?=\s)|\b(?:and then|then|also|after that|and)\b)\s*)"
_VERBS = "show|hide|reveal|conceal|display|see|look|view|take|select|highlight|focus|zoom|move|translate|rotate|tip|torque|intrude|extrude|expand|constrict|reset|add|remove|install|bond|put|thread|connect|use|set|change|make|activate|calculate|solve|compare|save|open|start|play|pause|stop|repeat|return|undo|redo|explain|analyze|analyse|lock|unlock"
_GUARDED = re.compile(r"\b(?:don't|do not|not to|never|avoid|not|cannot|can't|unless|if|what would|what might|should i|should we|would it|could it|how much|how far|is it safe|prescribe|diagnose|recommend treatment|treatment plan|my patient|biologically safe)\b")
_GERUNDS = {"showing": "show", "hiding": "hide", "selecting": "select", "highlighting": "highlight", "moving": "move", "rotating": "rotate", "installing": "install", "putting": "put", "adding": "add", "removing": "remove", "looking": "look", "revealing": "reveal", "explaining": "explain", "comparing": "compare"}
_ANATOMY = r"(roots?|gums|gingiva|bone|tooth numbers)"


def _layer(value: str) -> str:
    return {"root": "roots", "gingiva": "gums"}.get(value, value)


def normalize_classroom_language(text: str) -> str:
    value = re.sub(r"[ \t\r\f\v]+", " ", text.lower().replace("’", "'").replace("‘", "'").replace("−", "-")).strip()
    if _GUARDED.search(value):
        return value

    def rewrite(pattern, replacement):
        nonlocal value
        value = re.sub(_BOUNDARY + pattern, lambda match: replacement(*match.groups()), value)

    for _ in range(4):
        rewrite(r"(?:for (?:this|the|our|my) (?:lecture|class|lesson|demonstration|demo)[,:]?\s+)", lambda prefix: prefix)
        rewrite(rf"(?:please |(?:(?:can|could|would) you(?: please)? |(?:i would like|i'd like|i want)(?: you)? to |let us |let's ))(?=(?:{_VERBS}|please|would you mind)\b)", lambda prefix: prefix)
        rewrite(rf"would you mind (?:please )?({'|'.join(_GERUNDS)})\b", lambda prefix, verb: prefix + _GERUNDS[verb])
    rewrite(r"(?:take a look|look|view)(?: at (?:it|the model|the teeth))? from (?:the )?(above|top|front|right|left)(?: side)?\b", lambda prefix, direction: f"{prefix}show {'occlusal' if direction in ('above', 'top') else direction} view")
    rewrite(r"(?:(?:show|switch to|give me) (?:a |the )?)?(?:top[- ]down|overhead) view\b", lambda prefix: f"{prefix}show occlusal view")
    rewrite(rf"make (?:the )?{_ANATOMY} (disappear|invisible|visible|appear)\b", lambda prefix, target, state: f"{prefix}{'hide' if state in ('disappear', 'invisible') else 'show'} {_layer(target)}")
    rewrite(rf"(reveal|display|conceal|see|show|hide) (?:me )?(?:the )?{_ANATOMY}\b", lambda prefix, action, target: f"{prefix}{'hide' if action in ('conceal', 'hide') else 'show'} {_layer(target)}")
    # Named anatomical groups must be resolved before spoken numerals become quantities.
    value = re.sub(r"\b(upper|lower|maxillary|mandibular) (?:front (?:six|6)|(?:six|6) front)(?: teeth)?\b", r"\1 anterior teeth", value)
    value = re.sub(r"\b(upper|lower|maxillary|mandibular) (?:front (?:four|4)|(?:four|4) front)(?: teeth)?\b", r"\1 incisors", value)
    value = re.sub(r"\b(upper|lower) (front|back) teeth\b", lambda m: f"{m[1]} {'anterior' if m[2] == 'front' else 'posterior'} teeth", value)
    value = re.sub(r"\b(upper|lower) teeth at the (front|back)\b", lambda m: f"{m[1]} {'anterior' if m[2] == 'front' else 'posterior'} teeth", value)
    return value
