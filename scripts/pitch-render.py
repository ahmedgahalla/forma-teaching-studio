"""Render labelled-as-illustration pitch stills from the bundled dental GLB.

Run with Blender, not a browser:
  blender --background --python scripts/pitch-render.py -- --source MODEL.glb --output DIR
The source is never modified. These are standalone model illustrations, not app captures.
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def options():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--samples", type=int, default=40)
    parser.add_argument("--shots", nargs="+", default=None)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def configure_scene(args):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.transparent_max_bounces = 4
    preferences = bpy.context.preferences.addons["cycles"].preferences
    device = "CPU"
    for kind in ("OPTIX", "CUDA", "HIP", "METAL"):
        try:
            preferences.compute_device_type = kind
            preferences.get_devices()
            accelerators = [item for item in preferences.devices if item.type != "CPU"]
            if accelerators:
                for item in preferences.devices:
                    item.use = item.type != "CPU"
                scene.cycles.device = "GPU"
                device = kind
                break
        except (TypeError, RuntimeError):
            continue
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.7, 0.75, 0.85, 1)
    background.inputs["Strength"].default_value = 0.2
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    return scene, device


def load_model(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    teeth = {obj.name.removeprefix("tooth_"): obj for obj in meshes if obj.name.startswith("tooth_")}
    expected = {f"{quadrant}{tooth}" for quadrant in range(1, 5) for tooth in range(1, 9)}
    if set(teeth) != expected:
        raise RuntimeError(f"Unexpected GLB tooth inventory: {sorted(teeth)}")
    # The source millimetre coordinates are scaled only for light transport in Blender.
    model = bpy.data.objects.new("Pitch model scale", None)
    bpy.context.collection.objects.link(model)
    for obj in list(bpy.context.scene.objects):
        if obj != model and obj.parent is None:
            obj.parent = model
    model.scale = (0.01, 0.01, 0.01)
    bpy.context.view_layer.update()
    # Keep source geometry and imported vertex-color material links. Adjust only
    # standalone studio roughness/subsurface response, not clinical/anatomic data.
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        surface = next((n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if surface is None:
            continue
        gum = "gingiva" in material.name
        surface.inputs["Roughness"].default_value = 0.55 if gum else 0.35
        surface.inputs["Subsurface Weight"].default_value = 0.04 if gum else 0.015
    return meshes


def visible_for(shot, obj):
    name = obj.name
    if name.startswith("tooth_") and name.endswith("8"):
        return False
    if shot == "roots":
        return name.startswith("tooth_")
    if shot == "upper-occlusal":
        return name == "gum_upper" or name.startswith(("tooth_1", "tooth_2"))
    if shot == "canine-closeup":
        return name == "tooth_13"
    return True


def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return points, (low + high) * 0.5, (high - low).length


def area_light(name, center, offset, power, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = center + Vector(offset)
    obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def frame(scene, objects, direction):
    points, center, diameter = bounds(objects)
    camera = scene.camera
    camera.location = center + Vector(direction).normalized() * max(diameter * 3, 2)
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    inverse = camera.matrix_world.inverted()
    camera_points = [inverse @ point for point in points]
    span_x = max(p.x for p in camera_points) - min(p.x for p in camera_points)
    span_y = max(p.y for p in camera_points) - min(p.y for p in camera_points)
    aspect = scene.render.resolution_x / scene.render.resolution_y
    # Blender's orthographic scale is horizontal at a landscape render aspect.
    camera.data.ortho_scale = max(span_x, span_y * aspect) * 1.15
    return center


def main():
    args = options()
    args.source = args.source.resolve(strict=True)
    args.output.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(args.source.read_bytes()).hexdigest()
    scene, device = configure_scene(args)
    meshes = load_model(args.source)
    camera_data = bpy.data.cameras.new("Pitch camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("Pitch camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    # glTF's +Y up / +Z front becomes Blender's +Z up / -Y front on import.
    shots = {
        "hero-threequarter": (-3.0, -6.0, 0.7),
        "front": (0, -6, 0),
        "upper-occlusal": (0, -0.1, -6),
        "roots": (-2.5, -6, 1.0),
        "canine-closeup": (-2, -6, 0.5),
        "side": (-6, -0.3, 0.5),
    }
    selected = args.shots or list(shots)
    if any(name not in shots for name in selected):
        raise ValueError(f"Shot names must be chosen from: {', '.join(shots)}")
    outputs = []
    for name in selected:
        for obj in meshes:
            obj.hide_render = not visible_for(name, obj)
        visible = [obj for obj in meshes if not obj.hide_render]
        center = frame(scene, visible, shots[name])
        orientation = camera.rotation_euler.to_matrix()
        lights = [
            area_light("Key", center, orientation @ Vector((-1, 1.4, 1.5)), 100, 1.1, (1.0, 0.94, 0.86)),
            area_light("Fill", center, orientation @ Vector((1.2, 0.4, 0.8)), 60, 1.2, (0.78, 0.86, 1.0)),
            area_light("Rim", center, orientation @ Vector((0.8, 1, -1)), 90, 0.8, (1.0, 0.92, 0.85)),
        ]
        path = args.output / f"{name}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        outputs.append({"shot": name, "file": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        for obj in lights:
            bpy.data.objects.remove(obj, do_unlink=True)
    if hashlib.sha256(args.source.read_bytes()).hexdigest() != source_hash:
        raise RuntimeError("Source GLB changed during rendering")
    manifest = {
        "description": "Standalone model illustrations; not screenshots or recordings of the app.",
        "source": str(args.source),
        "source_sha256": source_hash,
        "blender": bpy.app.version_string,
        "engine": "Cycles",
        "device": device,
        "samples": args.samples,
        "dimensions": [args.width, args.height],
        "transparent": True,
        "model_changes": "Wisdom teeth hidden; no geometry changes. Source vertex colors retained; studio material/light response.",
        "outputs": outputs,
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"PITCH_RENDER_COMPLETE: {len(outputs)} illustrations; source {source_hash}")


if __name__ == "__main__":
    main()
