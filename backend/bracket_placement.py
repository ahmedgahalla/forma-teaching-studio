"""Mirror bracket settings in command context; all geometry and solving stay local."""
import math
from typing import Annotated
from pydantic import Field

BracketAngle = Annotated[float, Field(ge=-10, le=10)]


def bracket_wire_active(config, anchors):
    return any(
        config.get("bracketAngles", {}).get(tooth, 0) != 0
        or math.dist(config["brackets"][tooth], anchors[tooth]) > 1e-10
        for wire in config["wires"] for tooth in wire["teeth"]
        if tooth in config["brackets"] and tooth in anchors
    )


def advance_brackets(scene, action):
    context = scene["mechanics"]
    config = context["config"]
    ids = action["teeth"] if action["type"] == "brackets" else [action["tooth"]]
    if not ids or len(set(ids)) != len(ids) or not set(ids) <= set(scene["availableIds"]):
        raise ValueError("Choose unique teeth present in this model.")
    if action["type"] == "brackets":
        if not action["installed"] and any(set(wire["teeth"]) & set(ids) for wire in config["wires"]):
            raise ValueError("Remove the connected wire before removing its brackets.")
        for tooth in ids:
            if action["installed"]:
                if tooth not in context["bracketAnchors"]:
                    raise ValueError("No synthetic bracket anchor exists.")
                config["brackets"].setdefault(tooth, list(context["bracketAnchors"][tooth]))
            else:
                config["brackets"].pop(tooth, None)
                config.get("bracketAngles", {}).pop(tooth, None)
        context["focus"]["teeth"] = list(ids)
        scene["selectedIds"], scene["selected"] = list(ids), ids[0]
    else:
        tooth = action["tooth"]
        if tooth not in config["brackets"]:
            raise ValueError("Install the bracket before moving its attachment.")
        config["brackets"][tooth] = list(action["local"])
        if action.get("angleDeg") is not None:
            if action["angleDeg"]:
                config.setdefault("bracketAngles", {})[tooth] = action["angleDeg"]
            else:
                config.get("bracketAngles", {}).pop(tooth, None)
    if not config.get("bracketAngles"):
        config.pop("bracketAngles", None)
