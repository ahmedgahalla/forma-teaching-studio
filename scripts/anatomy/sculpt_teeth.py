"""Original permanent-tooth sculpt fields; no scan, image tracing or random noise.

Anatomical landmarks are reference-informed teaching forms, not population averages.
References: University of Al Maarif dental anatomy lectures 9, 11, 14;
https://pubmed.ncbi.nlm.nih.gov/34714481/ (root variation, not a universal root count).
"""
import bpy, bmesh, math
from mathutils import Vector

UPPER = [(8.5, 6.7, 10.4), (6.6, 6.3, 9.2), (7.5, 7.6, 10.8), (6.8, 8.9, 7.3), (6.5, 8.6, 7.1), (9.8, 10.8, 6.5), (9.2, 10.2, 6.3)]
LOWER = [(5.3, 5.7, 8.8), (5.7, 6.0, 9.1), (6.6, 7.0, 10.0), (6.7, 7.3, 7.2), (6.8, 8.0, 7.0), (10.1, 10.0, 6.4), (9.5, 9.5, 6.2)]
G = lambda value, sigma: math.exp(-.5 * (value / sigma) ** 2)
B = lambda p: Vector((p[0], -p[2], p[1]))
C = lambda p: [round(p.x, 6), round(p.z, 6), round(-p.y, 6)]

def occlusal(u, v, family, upper):
    """Distinct premolar patterns and molar cusp/ridge/fossa arrangements."""
    if family < 6:
        if upper:
            cusps = [(0, .49, 1.95), (.06, -.47, 1.52 if family == 4 else 1.83)]
        elif family == 4:
            cusps = [(.04, .47, 2.08), (.03, -.49, .81)]
        else:
            cusps = [(0, .47, 1.96), (.36, -.42, 1.56), (-.39, -.40, 1.30)]
        y = -.40 + sum(a * G(u - x, .35 if len(cusps) == 2 else .29) * G(v - z, .34) for x, z, a in cusps)
        y += .22 * (G(u - .78, .12) + G(u + .78, .12)) * G(v, .46)
        if not upper and family == 5:
            # Y pattern separates the two lingual cusps and reaches a central pit.
            y -= .24 * G(u, .065) * G(v + .40, .30)
            y -= .17 * G(v - .18 * abs(u), .07) * G(u, .63)
        else:
            y -= (.17 if upper else .11) * G(v + .035, .055) * G(u, .59)
        if not upper and family == 4:
            y -= .15 * G(u - .58, .12) * G(v + .30, .18)
        y -= .12 * (G(u - .43, .12) + G(u + .43, .12)) * G(v, .17)
        return y
    if upper:
        cusps = [(.42, .43, 1.96), (-.43, .42, 1.72), (.39, -.43, 2.12), (-.43, -.42, 1.50 if family == 6 else 1.02)]
    else:
        cusps = [(.42, .43, 1.89), (-.35, .45, 1.69), (.42, -.44, 2.04), (-.39, -.43, 1.91)]
        if family == 6: cusps.append((-.78, .02, 1.00))
    y = -.48 + sum(a * G(u - x, .31) * G(v - z, .31) for x, z, a in cusps)
    # Triangular ridges join each cusp toward its fossa; no random etched noise.
    for x, z, _ in cusps[:4]:
        length = math.hypot(x, z); cross = (u * z - v * x) / length
        along = (u * x + v * z) / length
        y += (.13 if upper else .23) * G(cross, .12) * G(along - .29, .21)
    y += .26 * (G(u - .79, .12) + G(u + .79, .12)) * G(v, .47)
    if upper:
        # The upper groove system ends against the oblique ridge; it is not the
        # lower second molar's continuous cruciform pattern painted onto an upper.
        y -= .17 * G(v + .02, .07) * G(u - .28, .30)
        y -= .13 * G(u - .05, .075) * G(v - .37, .27)
        y -= .13 * G(v - .62 * u + .06, .075) * G(u + .45, .24)
    else:
        y -= .19 * G(v + .025 * math.sin(u * 4), .065) * G(u, .66)
        y -= .16 * G(u + (.12 * v if family == 6 else 0), .067) * G(v, .67)
    y -= .13 * (G(u - .47, .12) + G(u + .45, .12)) * G(v, .17)
    if upper:
        # Mesiolingual to distobuccal oblique ridge and a modest Carabelli tubercle.
        y += .48 * G(v + .88 * u, .14) * G(u + .01, .43)
        if family == 6: y += .29 * G(u - .46, .17) * G(v + .78, .14)
    elif family == 6:
        y -= .13 * G(u + .59, .07) * G(v - .26, .26)
    return y

def sculpt_crown(obj, tooth):
    family = int(tooth['id'][1]); upper = tooth['id'][0] in '12'
    width, depth, height = (UPPER if upper else LOWER)[family - 1]
    buccal, axis, mesial = [B(tooth[key]) for key in ['buccal', 'occlusal', 'mesial']]
    vertices = obj.data.vertices
    neck = sum((v.co for v in vertices[:64]), Vector()) / 64
    anchor = B(tooth['bracketPosition']) - buccal * .22
    weight = obj.vertex_groups.new(name='Sculpt | fixed bracket contact')
    for vertex in vertices:
        p = vertex.co.copy(); relative = p - neck
        axial = relative.dot(axis); t = max(0, min(1, axial / height))
        u, v = relative.dot(mesial) / (width * .5), relative.dot(buccal) / (depth * .5)
        distance = (p - anchor).length
        # The central bracket contact remains exactly pinned; the transition is C1.
        patch = max(0, min(1, (distance - .48) / 1.30)); patch = patch * patch * (3 - 2 * patch)
        envelope = math.sin(math.pi * t) ** 2
        delta = Vector()
        # A shallow scalloped CEJ replaces the straight crown/root paint boundary.
        angle = math.atan2(v, u)
        delta += axis * ((.27 if upper else .20) * math.cos(2 * angle) * G(t, .10))
        if family <= 3:
            labial = max(0, v) ** 2; lingual = max(0, -v) ** 2
            ridges = G(u, .25) + .38 * (G(u - .55, .17) + G(u + .52, .18))
            delta += buccal * ((.20 if family == 3 else .13) * ridges * envelope * labial)
            delta -= buccal * (.07 * (G(u - .29, .08) + G(u + .28, .09)) * envelope * labial)
            strength = 1 if upper else .56
            # Cingulum, marginal ridges and fossa are structural anatomy in geometry.
            delta += buccal * (strength * .44 * G(t - .60, .18) * G(u, .47) * lingual)
            delta -= buccal * (strength * (.27 * G(t - .23, .115) * G(u - .08, .38) + .25 * G(abs(u) - .72, .11) * G(t - .60, .25)) * lingual)
            if family == 3:
                delta -= buccal * (strength * .35 * G(u, .16) * G(t - .58, .27) * lingual)
                delta -= axis * (.30 * G(u + .65, .26) * max(0, (t - .62) / .38) ** 2)
            else:
                rounding = .36 if upper and family == 2 else .23 if upper else .12
                delta -= axis * (rounding * G(u + .86, .18) * max(0, (t - .66) / .34) ** 2)
                delta -= mesial * (.11 * u * G(t - .22, .20) * envelope)
                if not upper and family == 2: delta -= buccal * (.19 * G(u + .66, .24) * G(t - .93, .12))
        else:
            # Replace the source occlusal cap with the authored class pattern.
            if 2304 <= vertex.index < 4097:
                ring = (vertex.index // 64 - 36) if vertex.index < 4096 else 28
                lift = math.sin(ring / 28 * math.pi / 2)
                cap_u, cap_v = u / .89, v / .89
                target = height - 1.32 + 1.32 * lift + occlusal(cap_u, cap_v, family, upper) * lift * lift
                delta += axis * (target - axial)
            # Buccal developmental grooves remain smooth and shallow on the side.
            groove = G(u, .095) if family >= 6 else 0
            if not upper and family == 6: groove += .62 * G(u + .57, .08)
            delta -= buccal * (.14 * groove * G(t - .70, .18) * max(0, v) ** 2)
            delta += buccal * (.10 * v * G(t - .34, .20) * G(u, .72))
            if not upper and family == 4: delta += buccal * (.18 * max(0, -v) ** 2 * G(t - .77, .20))
        vertex.co += delta * patch
        weight.add([vertex.index], patch, 'REPLACE')
    return weight.name

def root_collar(obj, neck, right, buccal, rootward, rx, rz, length):
    """Closed neck trunk overlaps every branch before the voxel union."""
    vertices, faces = [], []
    rings, sides = 16, 64
    for j in range(rings + 1):
        t = j / rings; taper = 1 - .16 * t - .26 * t * t
        for k in range(sides):
            a = k * 2 * math.pi / sides
            # A mild longitudinal waist forms a natural trunk instead of a cylinder.
            p = neck + rootward * (length * t - .12) + right * (rx * taper * math.cos(a)) + buccal * (rz * taper * math.sin(a))
            vertices.append(p)
    for j in range(rings):
        for k in range(sides):
            a = j * sides + k; b = j * sides + (k + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    vertices.extend([neck - rootward * .12, neck + rootward * (length - .12)])
    for k in range(sides):
        faces.append((len(vertices) - 2, (k + 1) % sides, k))
        faces.append((len(vertices) - 1, rings * sides + k, rings * sides + (k + 1) % sides))
    bm = bmesh.new(); bm.from_mesh(obj.data)
    added = [bm.verts.new(p) for p in vertices]
    for face in faces: bm.faces.new([added[i] for i in face])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(obj.data); bm.free()

def sculpt_root(obj, tooth, modifier):
    vertices = obj.data.vertices; parent = list(range(len(vertices)))
    def find(i):
        while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for edge in obj.data.edges: parent[find(edge.vertices[0])] = find(edge.vertices[1])
    groups = {}
    for vertex in vertices: groups.setdefault(find(vertex.index), []).append(vertex)
    axis = B(tooth['occlusal']); rootward = -axis; buccal = B(tooth['buccal']); right = rootward.cross(buccal).normalized(); distal = -B(tooth['mesial'])
    branch_data = []
    for branch in groups.values():
        rings = {}
        for vertex in branch: rings.setdefault(round(vertex.co.dot(axis), 5), []).append(vertex)
        neck_ring = rings[max(rings)]; neck = sum((v.co for v in neck_ring), Vector()) / len(neck_ring)
        branch_data.append((rings, neck))
    neck = sum((center for _, center in branch_data), Vector()) / len(branch_data)
    paths = []
    for rings, start in branch_data:
        lo, hi = min(rings), max(rings); path = []
        for height, ring in sorted(rings.items(), reverse=True):
            t = max(0, min(1, (hi - height) / (hi - lo)))
            centre = sum((v.co for v in ring), Vector()) / len(ring)
            # Fuller cervical/middle thirds followed by a rounded apical narrowing.
            old_taper = max(.0001, (1 - .72 * t) * math.sqrt(max(0, 1 - t * t)))
            new_taper = (1 - .19 * t - .44 * t * t) * math.sqrt(max(0, 1 - t ** 3))
            ratio = new_taper / old_taper if t < .99999 else 1
            splay = (start - neck) * (1.02 * t + .15 * math.sin(math.pi * t))
            sweep = distal * ((.95 if len(groups) == 1 else .58) * t ** 2.5) - buccal * .24 * t * t
            target = start + axis * (height - hi) + splay + sweep
            for vertex in ring:
                radial = vertex.co - centre; radial -= axis * radial.dot(axis)
                vertex.co = target + radial * ratio
            rx = max(.025, max(abs((v.co - target).dot(right)) for v in ring)); rz = max(.025, max(abs((v.co - target).dot(buccal)) for v in ring))
            path.append({'center': C(target), 'radii': [round(rx, 6), round(rz, 6)]})
        paths.append(path)
    trunk = None
    if len(groups) > 1:
        family = int(tooth['id'][1]); upper = tooth['id'][0] in '12'
        width, depth, _ = (UPPER if upper else LOWER)[family - 1]
        length = 4.0 if family == 4 else 3.35 if upper else 2.9
        root_collar(obj, neck, right, buccal, rootward, width * .35, depth * .365, length)
        # Voxel remeshing here performs an actual joined trunk/furcation union.
        # It is limited to roots: crown landmarks and bracket seats never remesh.
        modifier(obj, 'REMESH', 'Continuous root trunk and furcation', mode='VOXEL', voxel_size=.115, use_smooth_shade=True)
        trunk = [{'center': C(neck + rootward * (length * j / 12 - .10)), 'radii': [round(width * .35 * (1 - .16 * j / 12 - .26 * (j / 12) ** 2), 6), round(depth * .365 * (1 - .16 * j / 12 - .26 * (j / 12) ** 2), 6)]} for j in range(13)]
        # Distal branch envelopes start beneath the shared cervical trunk.
        cutoff = neck.dot(rootward) + length * .65
        paths = [[p for p in path if B(p['center']).dot(rootward) >= cutoff] for path in paths]
    upper = tooth['id'][0] in '12'
    for vertex in obj.data.vertices:
        relative = vertex.co - neck
        angle = math.atan2(relative.dot(buccal), relative.dot(right))
        vertex.co += axis * ((.27 if upper else .20) * math.cos(2 * angle) * G(relative.dot(rootward), .9))
    tooth['rootAnatomy'] = {'version': 1, **({'trunk': trunk} if trunk else {}), 'branches': paths}
