"""Build original editable teaching anatomy and the matching browser GLB.

blender --background --factory-startup --python scripts/anatomy/refine_blender.py -- source.json APP_ROOT
Numeric GLB world coordinates intentionally remain millimetres, as in the app.
Blender authoring maps case (x,y,z) to Blender (x,-z,y); glTF export reverses it.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sculpt_teeth import sculpt_crown, sculpt_root

args = sys.argv[sys.argv.index('--') + 1:]
source_file, app_root = args[0], os.path.abspath(args[1])
with open(source_file, encoding='utf-8') as handle: source = json.load(handle)
meta = source['metadata']
asset_dir = os.path.join(app_root, 'assets', 'anatomy')
public_dir = os.path.join(app_root, 'public', 'models')
os.makedirs(asset_dir, exist_ok=True); os.makedirs(public_dir, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = .001
scene.unit_settings.length_unit = 'MILLIMETERS'
anatomy = bpy.data.collections.new('FORMA | Runtime anatomy · mm'); scene.collection.children.link(anatomy)
teeth = {tooth['id']: tooth for tooth in meta['teeth']}
to_blender = lambda p: Vector((p[0], -p[2], p[1]))

def material(name, colour, roughness, subsurface=0):
    mat = bpy.data.materials.new(name); mat.diffuse_color = (*colour, 1); mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Subsurface Weight'].default_value = subsurface
    shader.inputs['Subsurface Radius'].default_value = (.9, .45, .22)
    return mat
enamel = material('Enamel | warm ivory', (.82, .78, .66), .34, .025)
dentine = material('Root | schematic dentine', (.72, .60, .43), .50, .025)
gingiva = material('Gingiva | muted coral', (.40, .105, .12), .47, .055)
anchor_errors = []

def modifier(obj, kind, name, **values):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new(name, kind)
    for key, value in values.items(): setattr(mod, key, value)
    bpy.ops.object.modifier_apply(modifier=mod.name)

objects = []
for piece in source['meshes']:
    coords = [to_blender(piece['vertices'][i:i+3]) for i in range(0, len(piece['vertices']), 3)]
    faces = [piece['indices'][i:i+3] for i in range(0, len(piece['indices']), 3)]
    mesh = bpy.data.meshes.new(piece['name'] + '_surface'); mesh.from_pydata(coords, [], faces); mesh.update()
    obj = bpy.data.objects.new(piece['name'], mesh); anatomy.objects.link(obj); obj.location = to_blender(piece['position'])
    obj['units'] = 'mm'; obj['schematic'] = True; obj['part'] = piece['kind']
    if piece.get('tooth'): obj['fdi'] = piece['tooth']
    mesh.materials.append(enamel if piece['kind'] == 'crown' else dentine if piece['kind'] == 'root' else gingiva)
    protected = sculpt_crown(obj, teeth[piece['tooth']]) if piece['kind'] == 'crown' else None
    if piece['kind'] == 'root': sculpt_root(obj, teeth[piece['tooth']], modifier)
    # Alternating fairing removes triangulation ripple with negligible global shrink.
    settings = {'factor': .27, 'iterations': 2}
    if protected: settings['vertex_group'] = protected
    modifier(obj, 'SMOOTH', 'Surface fairing', **settings)
    settings['factor'] = -.275
    modifier(obj, 'SMOOTH', 'Volume-preserving fairing', **settings)
    obj.data.calc_loop_triangles()
    ratio = .50 if piece['kind'] == 'crown' else min(.85, 3400 / len(obj.data.loop_triangles)) if piece['kind'] == 'root' else .34
    modifier(obj, 'DECIMATE', 'Runtime simplification', ratio=ratio, use_collapse_triangulate=True)
    for polygon in obj.data.polygons: polygon.use_smooth = True
    # Explicitly recalculate orientation after Blender's applied topology changes.
    bm = bmesh.new(); bm.from_mesh(obj.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(obj.data); bm.free()
    obj.data.update(); objects.append(obj)
    if piece['kind'] == 'crown':
        tooth = teeth[piece['tooth']]; outward = to_blender(tooth['buccal']); anchor = to_blender(tooth['bracketPosition'])
        bv = BVHTree.FromPolygons([v.co for v in obj.data.vertices], [p.vertices[:] for p in obj.data.polygons])
        hit, normal, index, distance = bv.ray_cast(anchor + outward * 15, -outward, 30)
        if hit is None: raise RuntimeError('Missing bracket surface: ' + piece['tooth'])
        clearance = (anchor - hit).dot(outward); anchor_errors.append({'id': tooth['id'], 'clearanceMm': round(clearance, 5)})
        if not .10 < clearance < .34: raise RuntimeError('Bracket patch drift: ' + str(anchor_errors[-1]))

counts = {'crowns': 0, 'roots': 0, 'gums': 0}
for obj in objects:
    obj.data.calc_loop_triangles(); counts[{'crown':'crowns','root':'roots','gum':'gums'}[obj['part']]] += len(obj.data.loop_triangles)
meta['assetInfo'] = {
    'generator': 'Blender ' + bpy.app.version_string, 'originalSource': 'Forma procedural teaching geometry',
    'schematic': True, 'patientSpecific': False, 'meshCount': len(objects), 'revision': 'permanent-landmarks-2',
    'triangles': {**counts, 'total': sum(counts.values())},
    'refinement': ['distinct permanent class cusp/ridge/fossa patterns', 'anterior cingula and marginal ridges', 'rounded asymmetric incisal corners', 'continuous multi-root cervical trunks and furcations', 'curved roots with fuller middle thirds and rounded apices', 'explicit root-branch support envelopes', 'protected bracket seats', 'adaptive mesh decimation'],
    'bracketClearanceMm': anchor_errors,
    'coordinateNote': 'GLB world coordinates are millimetres. Do not multiply by 1000. Apply node matrixWorld, then subtract metadata position for crown-local geometry.',
}
with open(os.path.join(public_dir, 'forma-teaching-v1.json'), 'w', encoding='utf-8') as f: json.dump(meta, f, ensure_ascii=False, indent=2)
scene['purpose'] = 'Original schematic teaching anatomy. Not patient anatomy or clinical planning.'
scene['glb_coordinate_contract'] = meta['assetInfo']['coordinateNote']
bpy.ops.object.select_all(action='DESELECT')
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(public_dir, 'forma-teaching-v1.glb'), export_format='GLB', use_selection=True, export_yup=True, export_extras=True, export_apply=True, export_cameras=False, export_lights=False)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            space = area.spaces.active; space.clip_end = 10000; space.shading.color_type = 'MATERIAL'
            space.region_3d.view_distance = 115; space.region_3d.view_location = (0, 0, 0)
            space.region_3d.view_rotation = Vector((-70, 100, -60)).to_track_quat('-Z', 'Y')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(asset_dir, 'forma-teaching-v1.blend'), compress=True)

# Contact sheet: linked duplicates preserve the actual delivered runtime surfaces.
presentation = bpy.data.collections.new('PRESENTATION | linked runtime surfaces'); scene.collection.children.link(presentation)
anatomy.hide_render = True
def duplicates(label, filter_fn, target, rotation):
    source_objects = [obj for obj in objects if filter_fn(obj)]
    corners = [obj.matrix_world @ Vector(corner) for obj in source_objects for corner in obj.bound_box]
    centre = (Vector(tuple(min(v[i] for v in corners) for i in range(3))) + Vector(tuple(max(v[i] for v in corners) for i in range(3)))) / 2
    group = bpy.data.objects.new(label, None); presentation.objects.link(group); group.location = target; group.rotation_euler = rotation
    for src in source_objects:
        copy = src.copy(); copy.data = src.data; presentation.objects.link(copy); copy.parent = group; copy.location = src.location - centre
    return group
duplicates('A | Complete dentition', lambda obj: obj['part'] != 'root', (-44, 0, 34), (math.radians(12), 0, math.radians(-15)))
duplicates('B | Upper occlusal', lambda obj: obj['part'] != 'root' and (obj.name == 'gum_upper' or obj.get('fdi', '0')[0] in '12'), (44, 0, 34), (math.radians(-90), 0, 0))
duplicates('C | Lower occlusal', lambda obj: obj['part'] != 'root' and (obj.name == 'gum_lower' or obj.get('fdi', '0')[0] in '34'), (-44, 0, -37), (math.radians(90), 0, 0))
for tooth_id, dx in [('11', -19), ('13', -5), ('16', 12), ('36', 30)]:
    buccal = teeth[tooth_id]['buccal']; turn = math.atan2(-buccal[0], buccal[2])
    duplicates('Specimen ' + tooth_id, lambda obj, tid=tooth_id: obj.get('fdi') == tid, (44 + dx, 0, -35), (0, 0, turn))

ink = material('Presentation ink', (.11, .20, .23), .8)
nodes = ink.node_tree.nodes; nodes.clear(); emission = nodes.new('ShaderNodeEmission'); emission.inputs['Color'].default_value = (.035, .085, .10, 1); emission.inputs['Strength'].default_value = 1
ink.node_tree.links.new(emission.outputs[0], nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
def text_label(body, location, size):
    curve = bpy.data.curves.new(body, 'FONT'); curve.body = body; curve.size = size; curve.align_x = 'LEFT'; curve.extrude = 0
    obj = bpy.data.objects.new(body, curve); presentation.objects.link(obj); obj.location = location; obj.rotation_euler = (math.pi / 2, 0, 0); curve.materials.append(ink)
text_label('FORMA  /  Permanent anatomy · refinement 2', (-83, -21, 82), 3.7)
text_label('28 individual crowns + roots  /  original schematic model  /  millimetres', (-83, -21, 76), 2.3)
for label, x, z in [('01   COMPLETE DENTITION', -82, 66), ('02   UPPER OCCLUSAL', 7, 66), ('03   LOWER OCCLUSAL', -82, -4), ('04   CROWN + ROOT FORMS', 7, -4)]: text_label(label, (x, -30, z), 2.5)
text_label('Central incisor    Canine       Upper molar    Lower molar', (19, -25, -62), 1.7)
text_label('Editable .blend source + separate-mesh GLB  |  Teaching geometry, not patient reconstruction', (-83, -25, -76), 2)

camera_data = bpy.data.cameras.new('Contact sheet camera'); camera = bpy.data.objects.new('Contact sheet camera', camera_data); scene.collection.objects.link(camera)
camera.location = (0, -300, 3); direction = Vector((0, 0, 3)) - camera.location; camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler(); camera_data.type = 'ORTHO'; camera_data.ortho_scale = 180; scene.camera = camera
def area(name, location, energy, size):
    light = bpy.data.lights.new(name, 'AREA'); light.energy = energy; light.shape = 'DISK'; light.size = size
    obj = bpy.data.objects.new(name, light); scene.collection.objects.link(obj); obj.location = location; obj.rotation_euler = (Vector((0, 0, 0)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
area('Soft key', (-75, -125, 145), 190000, 85)
area('Broad fill', (110, -100, 65), 65000, 95)
area('Edge light', (0, 90, 120), 125000, 80)
scene.world.color = (.6, .66, .7)
scene.render.engine = 'CYCLES'; scene.cycles.samples = 40; scene.cycles.use_denoising = True
scene.render.resolution_x = 1800; scene.render.resolution_y = 1700; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'; scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
scene.world.use_nodes = True; background = scene.world.node_tree.nodes.get('Background'); background.inputs['Color'].default_value = (.79, .83, .84, 1); background.inputs['Strength'].default_value = .28
world_nodes = scene.world.node_tree.nodes
camera_background = world_nodes.new('ShaderNodeBackground'); camera_background.inputs['Color'].default_value = (.94, .96, .97, 1); camera_background.inputs['Strength'].default_value = 1.6
mix = world_nodes.new('ShaderNodeMixShader'); rays = world_nodes.new('ShaderNodeLightPath')
scene.world.node_tree.links.new(rays.outputs['Is Camera Ray'], mix.inputs[0]); scene.world.node_tree.links.new(background.outputs[0], mix.inputs[1]); scene.world.node_tree.links.new(camera_background.outputs[0], mix.inputs[2]); scene.world.node_tree.links.new(mix.outputs[0], world_nodes.get('World Output').inputs['Surface'])
scene.render.filepath = os.path.join(asset_dir, 'forma-teaching-contact-sheet.png')
bpy.ops.render.render(write_still=True)

# A closer atlas shows all fourteen authored crown/root classes in the actual GLB.
presentation.hide_render = True
presentation = bpy.data.collections.new('PRESENTATION | permanent class atlas'); scene.collection.children.link(presentation)
camera.location.z = 8; camera_data.ortho_scale = 145
names = ['Central incisor', 'Lateral incisor', 'Canine', 'First premolar', 'Second premolar', 'First molar', 'Second molar']
for quadrant, z, tilt in [('1', 25, -25), ('4', -18, 25)]:
    for i in range(7):
        tooth_id = quadrant + str(i + 1); x = -48 + i * 16
        buccal = teeth[tooth_id]['buccal']; turn = math.atan2(-buccal[0], buccal[2])
        rotation = (Matrix.Rotation(math.radians(tilt), 4, 'X') @ Matrix.Rotation(turn, 4, 'Z')).to_euler()
        duplicates('Atlas ' + tooth_id, lambda obj, tid=tooth_id: obj.get('fdi') == tid, (x, 0, z), rotation)
        text_label(tooth_id + '  ' + names[i], (x - 6.7, -24, z - 17), 1.32)
text_label('FORMA  /  Permanent crown and root landmarks', (-65, -28, 54), 3)
text_label('Upper dentition', (-65, -28, 42), 1.7)
text_label('Lower dentition', (-65, -28, -1), 1.7)
text_label('Original reference-informed teaching forms · not patient anatomy · educator review pending', (-65, -25, -43), 1.5)
scene.render.resolution_x = 2100; scene.render.resolution_y = 1500
scene.render.filepath = os.path.join(asset_dir, 'forma-anatomy-landmarks.png')
bpy.ops.render.render(write_still=True)
print('FORMA_ASSET_COMPLETE', json.dumps(meta['assetInfo']))
