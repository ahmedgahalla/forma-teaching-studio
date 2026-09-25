import { afterAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createOrthodonticDemo } from './demo';
import {
  anatomyCutawayTooth,
  createTeachingAnatomy,
  DEFAULT_ANATOMY,
  layoutAnatomyLabels,
  type AnatomyViewState,
} from './teaching-anatomy';
import { toothMatrix } from './analysis';
import type { Transforms } from './model';

const model = createOrthodonticDemo();
const state = (overrides: Partial<AnatomyViewState> = {}): AnatomyViewState => ({
  ...DEFAULT_ANATOMY,
  ...(overrides.cutaway ? { bone: true, ligament: true } : {}),
  ...overrides,
});
const meshes = (group: THREE.Group) =>
  group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
afterAll(() => {
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

describe('synthetic support anatomy', () => {
  it('generates separate finite sockets and exaggerated PDL sleeves for all 42 existing root branches', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ bone: true, ligament: true }), { selected: '11' });
    expect(meshes(kit.group).filter(mesh => mesh.name.startsWith('bone-'))).toHaveLength(42);
    expect(meshes(kit.group).filter(mesh => mesh.name.startsWith('ligament-'))).toHaveLength(42);
    for (const mesh of meshes(kit.group)) {
      expect([...mesh.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
      expect([...mesh.geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
      expect(mesh.geometry.boundingBox!.isEmpty()).toBe(false);
    }
    expect(kit.group.visible).toBe(true);
    expect(kit.labels).toHaveLength(0);
    kit.dispose();
  });

  it('leaves all source crown, root and gingiva positions, indices and authored poses untouched', () => {
    const source = [
      ...model.teeth.flatMap(t => [t.geometry, t.rootGeometry!]),
      ...model.gums.map(g => g.geometry),
    ];
    const snapshots = source.map(g => ({
      position: [...g.getAttribute('position').array],
      index: g.index && [...g.index.array],
    }));
    const positions = model.teeth.map(t => [...t.position]);
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ bone: true, ligament: true }), { selected: '11' });
    kit.update(
      { '16': { translation: [2, 0, 1], rotation: [5, 0, 3] } },
      state({ cutaway: true }),
      { selected: '16' },
    );
    kit.dispose();
    source.forEach((g, i) => {
      expect([...g.getAttribute('position').array]).toEqual(snapshots[i].position);
      expect(g.index && [...g.index.array]).toEqual(snapshots[i].index);
    });
    expect(model.teeth.map(t => t.position)).toEqual(positions);
  });

  it('never generates support anatomy or a cutaway for imported or rootless teeth', () => {
    for (const source of [
      { ...model, demo: false },
      { ...model, teeth: model.teeth.map(t => ({ ...t, rootGeometry: undefined })) },
    ]) {
      const kit = createTeachingAnatomy(source);
      kit.update({}, state({ bone: true, ligament: true, cutaway: true }), { selected: '11' });
      expect(kit.group.children).toHaveLength(0);
      expect(kit.labels).toHaveLength(0);
      expect(kit.cutawayTooth).toBeUndefined();
      expect(anatomyCutawayTooth(source, state({ cutaway: true }), '11')).toBeUndefined();
      kit.dispose();
    }
  });

  it('respects arch isolation, lower display opening, and opacity without moving either source arch', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ bone: true, opacity: 0.3 }), { selected: '31', arch: 'lower' });
    expect(meshes(kit.group)).toHaveLength(18);
    const before = meshes(kit.group).map(mesh => ({
      name: mesh.name,
      position: mesh.position.clone(),
    }));
    kit.update({}, state({ bone: true, opacity: 0.8 }), {
      selected: '31',
      arch: 'lower',
      opening: 7,
    });
    for (const [i, mesh] of meshes(kit.group).entries()) {
      expect(mesh.name).toBe(before[i].name);
      expect(
        mesh.position.distanceTo(before[i].position.add(new THREE.Vector3(0, -7, 0))),
      ).toBeLessThan(1e-9);
      expect(mesh.material.opacity).toBe(0.8);
    }
    kit.dispose();
  });

  it('accepts a non-indexed copy of existing demo roots without changing topology-dependent branch counts', () => {
    const root = model.teeth.find(t => t.id === '16')!.rootGeometry!.toNonIndexed();
    const source = {
      ...model,
      teeth: model.teeth.filter(t => t.id === '16').map(t => ({ ...t, rootGeometry: root })),
    };
    const kit = createTeachingAnatomy(source);
    kit.update({}, state({ cutaway: true }), { selected: '16' });
    expect(kit.group.children).toHaveLength(6);
    expect(kit.labels).toHaveLength(5);
    kit.dispose();
    root.dispose();
  });

  it.each(['11', '31'])(
    'encloses the apex of %s with a PDL cup and a separate rounded volume of bone',
    id => {
      const kit = createTeachingAnatomy(model);
      kit.update({}, state({ bone: true, ligament: true }), { selected: id });
      const tooth = model.teeth.find(t => t.id === id)!,
        rootward = new THREE.Vector3(...tooth.occlusal!).negate();
      const p = tooth.rootGeometry!.getAttribute('position'),
        point = new THREE.Vector3();
      let axial = -Infinity,
        apex = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i);
        const d = point.dot(rootward);
        if (d > axial) {
          axial = d;
          apex = point.clone();
        }
      }
      const origin = apex
        .clone()
        .add(new THREE.Vector3(...tooth.position))
        .addScaledVector(rootward, 0.015);
      const ray = new THREE.Raycaster(origin, rootward),
        bone = kit.group.getObjectByName(`bone-${id}-0`)!,
        ligament = kit.group.getObjectByName(`ligament-${id}-0`)!;
      const tissueHits = ray.intersectObject(ligament),
        boneHits = ray.intersectObject(bone);
      // Inner and outer apical surfaces both exist: there is no open tube below the root.
      expect(tissueHits.length).toBeGreaterThanOrEqual(2);
      expect(boneHits.length).toBeGreaterThanOrEqual(2);
      expect(tissueHits[0].distance).toBeGreaterThan(0);
      expect(tissueHits.at(-1)!.distance).toBeLessThan(0.6);
      expect(boneHits[0].distance).toBeGreaterThan(0.6);
      expect(boneHits.at(-1)!.distance).toBeGreaterThan(2);
      // Beyond the cavity there is a broad solid basal section, rather than a triangular sleeve.
      const buccal = new THREE.Vector3(...tooth.buccal),
        basal = origin.clone().addScaledVector(rootward, 1.1).addScaledVector(buccal, 12);
      const crossSection = new THREE.Raycaster(basal, buccal.clone().negate()).intersectObject(
        bone,
      );
      expect(crossSection).toHaveLength(2);
      expect(crossSection[1].distance - crossSection[0].distance).toBeGreaterThan(3);
      kit.dispose();
    },
  );
});

describe('focused tooth cutaway', () => {
  it('shows only the selected socket, including the correct number of root branches and all five tissue labels', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ cutaway: true }), { selected: '16', arch: 'lower' });
    expect(kit.cutawayTooth?.id).toBe('16');
    expect(kit.group.children).toHaveLength(6);
    expect(kit.group.children.every(mesh => mesh.name.includes('-16-'))).toBe(true);
    expect(kit.labels.map(label => label.name)).toEqual([
      'Crown',
      'Root',
      'Gingiva',
      'Periodontal ligament',
      'Supporting bone',
    ]);
    kit.update({}, state({ cutaway: true }), { selected: '31' });
    expect(kit.group.children).toHaveLength(2);
    expect(kit.group.children.every(mesh => mesh.name.includes('-31-'))).toBe(true);
    kit.update({}, state({ cutaway: true }), { selected: 'missing' });
    expect(kit.group.children).toHaveLength(0);
    expect(kit.labels).toHaveLength(0);
    kit.dispose();
  });

  it('makes capped half-sections with a visible buccal opening instead of exposing hollow zero-thickness skins', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ bone: true, ligament: true }), { selected: '11', arch: 'upper' });
    const tooth = model.teeth.find(t => t.id === '11')!,
      buccal = new THREE.Vector3(...tooth.buccal);
    const full = meshes(kit.group).find(m => m.name === 'bone-11-0')!,
      fullPositions = full.geometry.getAttribute('position');
    let fullBuccal = -Infinity;
    const point = new THREE.Vector3();
    for (let i = 0; i < fullPositions.count; i++)
      fullBuccal = Math.max(fullBuccal, point.fromBufferAttribute(fullPositions, i).dot(buccal));
    kit.update({}, state({ cutaway: true }), { selected: '11' });
    for (const mesh of meshes(kit.group)) {
      const p = mesh.geometry.getAttribute('position'),
        index = mesh.geometry.index!,
        edges = new Map<string, number>();
      let volume = 0,
        halfBuccal = -Infinity;
      // Section faces deliberately split normals: assess physical edges after welding.
      const keys = Array.from({ length: p.count }, (_, i) =>
        [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(','),
      );
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      for (let i = 0; i < p.count; i++)
        halfBuccal = Math.max(halfBuccal, point.fromBufferAttribute(p, i).dot(buccal));
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(p, ids[0]);
        b.fromBufferAttribute(p, ids[1]);
        c.fromBufferAttribute(p, ids[2]);
        volume += a.dot(b.cross(c)) / 6;
        for (let k = 0; k < 3; k++) {
          const key = [keys[ids[k]], keys[ids[(k + 1) % 3]]].sort().join('/');
          edges.set(key, (edges.get(key) || 0) + 1);
        }
      }
      expect(volume).toBeGreaterThan(1);
      expect([...edges.values()].every(count => count === 2)).toBe(true);
      expect(halfBuccal).toBeLessThan(fullBuccal - 1);
    }
    kit.dispose();
  });

  it('keeps supporting sockets stationary while the original crown/root labels follow combined tooth rotation and translation', () => {
    const kit = createTeachingAnatomy(model);
    const view = state({ cutaway: true });
    kit.update({}, view, { selected: '11' });
    const bone = kit.group.getObjectByName('bone-11-0')!,
      geometry = (bone as THREE.Mesh).geometry,
      reference = bone.position.clone();
    const originalLabels = kit.labels.map(l => l.position.clone()),
      tooth = model.teeth.find(t => t.id === '11')!;
    const transforms: Transforms = { '11': { translation: [3, -2, 1], rotation: [12, 3, -8] } };
    kit.update(transforms, view, { selected: '11' });
    expect(kit.group.getObjectByName('bone-11-0')!.position.equals(reference)).toBe(true);
    expect((kit.group.getObjectByName('bone-11-0') as THREE.Mesh).geometry).toBe(geometry);
    const matrix = toothMatrix(tooth, transforms);
    for (const i of [0, 1])
      expect(
        kit.labels[i].position.distanceTo(
          originalLabels[i].sub(new THREE.Vector3(...tooth.position)).applyMatrix4(matrix),
        ),
      ).toBeLessThan(1e-8);
    for (const i of [2, 3, 4]) expect(kit.labels[i].position.equals(originalLabels[i])).toBe(true);
    for (const geometry of [tooth.geometry, tooth.rootGeometry!]) {
      const p = geometry.getAttribute('position'),
        point = new THREE.Vector3();
      for (let i = 0; i < p.count; i++)
        expect(kit.bounds.containsPoint(point.fromBufferAttribute(p, i).applyMatrix4(matrix))).toBe(
          true,
        );
    }
    kit.dispose();
  });

  it('separates cut-face normals from the smooth socket wall without adding cracks or degenerate faces', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ cutaway: true }), { selected: '11' });
    for (const mesh of meshes(kit.group)) {
      const p = mesh.geometry.getAttribute('position'),
        normal = mesh.geometry.getAttribute('normal'),
        index = mesh.geometry.index!;
      const normals = new Map<string, THREE.Vector3[]>(),
        a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      let hasHardEdge = false;
      for (let i = 0; i < p.count; i++) {
        const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join('/'),
          previous = normals.get(key) || [];
        const n = new THREE.Vector3().fromBufferAttribute(normal, i);
        if (previous.some(other => other.dot(n) < 0.5)) hasHardEdge = true;
        previous.push(n);
        normals.set(key, previous);
      }
      for (let i = 0; i < index.count; i += 3) {
        a.fromBufferAttribute(p, index.getX(i));
        b.fromBufferAttribute(p, index.getX(i + 1));
        c.fromBufferAttribute(p, index.getX(i + 2));
        expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-12);
      }
      expect(hasHardEdge).toBe(true);
      expect(mesh.material.vertexColors).toBe(true);
    }
    kit.dispose();
  });

  it('clips gingiva to a finite box and lingual half-space, with jaw opening applied once', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ cutaway: true }), { selected: '31' });
    expect(kit.gumPlanes).toHaveLength(7);
    const sourcePlanes = kit.gumPlanes.map(p => p.clone()),
      rootLabel = kit.labels[1].position.clone();
    const inner = rootLabel
      .clone()
      .addScaledVector(new THREE.Vector3(...model.teeth.find(t => t.id === '31')!.buccal), -0.2);
    expect(kit.gumPlanes.every(plane => plane.distanceToPoint(inner) >= -1e-8)).toBe(true);
    for (const coordinate of ['x', 'y', 'z'] as const)
      for (const sign of [-1, 1]) {
        const exterior = inner.clone();
        exterior[coordinate] += sign * 100;
        expect(kit.gumPlanes.some(plane => plane.distanceToPoint(exterior) < 0)).toBe(true);
      }
    kit.update({}, state({ cutaway: true }), { selected: '31', opening: 8 });
    expect(
      kit.labels[1].position.distanceTo(rootLabel.add(new THREE.Vector3(0, -8, 0))),
    ).toBeLessThan(1e-8);
    kit.gumPlanes.forEach((plane, i) => {
      expect(plane.normal.equals(sourcePlanes[i].normal)).toBe(true);
      expect(plane.distanceToPoint(inner.clone().add(new THREE.Vector3(0, -8, 0)))).toBeCloseTo(
        sourcePlanes[i].distanceToPoint(inner),
      );
    });
    kit.dispose();
  });
});

describe('anatomy visibility and lifecycle', () => {
  it('respects bone, ligament, root and gingiva visibility independently inside the cutaway', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ cutaway: true, bone: false, ligament: false }), {
      selected: '11',
      roots: false,
      gums: false,
    });
    expect(kit.group.children).toHaveLength(0);
    expect(kit.labels.map(label => label.name)).toEqual(['Crown']);
    expect(kit.bounds.getSize(new THREE.Vector3()).y).toBeLessThan(11);
    kit.update({}, state({ cutaway: true, bone: false }), {
      selected: '11',
      roots: true,
      gums: false,
    });
    expect(kit.group.children.map(mesh => mesh.name)).toEqual(['ligament-11-0']);
    expect(kit.labels.map(label => label.name)).toEqual(['Crown', 'Root', 'Periodontal ligament']);
    kit.update({}, state({ cutaway: true, ligament: false }), {
      selected: '11',
      roots: false,
      gums: true,
    });
    expect(kit.group.children.map(mesh => mesh.name)).toEqual(['bone-11-0']);
    expect(kit.labels.map(label => label.name)).toEqual(['Crown', 'Gingiva', 'Supporting bone']);
    kit.dispose();
  });

  it('clears clipping planes, labels and bounds when returning to the full arch', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ cutaway: true }), { selected: '11' });
    kit.update({}, DEFAULT_ANATOMY, { selected: '11' });
    expect(kit.group.visible).toBe(false);
    expect(kit.group.children).toHaveLength(0);
    expect(kit.gumPlanes).toHaveLength(0);
    expect(kit.labels).toHaveLength(0);
    expect(kit.bounds.isEmpty()).toBe(true);
    kit.dispose();
  });

  it('disposes every cached full and half mesh once, without disposing borrowed anatomy', () => {
    const kit = createTeachingAnatomy(model);
    kit.update({}, state({ bone: true, ligament: true }), { selected: '11' });
    const full = meshes(kit.group);
    kit.update({}, state({ cutaway: true }), { selected: '11' });
    const cut = meshes(kit.group);
    const owned = [...new Set([...full, ...cut].map(mesh => mesh.geometry))].map(g =>
      vi.spyOn(g, 'dispose'),
    );
    const materials = [...new Set([...full, ...cut].map(mesh => mesh.material))].map(m =>
      vi.spyOn(m, 'dispose'),
    );
    const borrowed = [
      model.teeth[0].geometry,
      model.teeth[0].rootGeometry!,
      model.gums[0].geometry,
    ].map(g => vi.spyOn(g, 'dispose'));
    kit.update({}, undefined, { selected: '11' });
    owned.forEach(spy => expect(spy).not.toHaveBeenCalled());
    kit.dispose();
    kit.dispose();
    [...owned, ...materials].forEach(spy => expect(spy).toHaveBeenCalledOnce());
    borrowed.forEach(spy => {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
    kit.update({}, state({ bone: true }), { selected: '11' });
    expect(kit.group.children).toHaveLength(0);
  });

  it.each([-1, 1.1, NaN, Infinity])(
    'rejects invalid bone opacity %s and clears old overlays',
    opacity => {
      const kit = createTeachingAnatomy(model);
      kit.update({}, state({ cutaway: true }), { selected: '11' });
      expect(() => kit.update({}, state({ bone: true, opacity }), { selected: '11' })).toThrow(
        /opacity/,
      );
      expect(kit.group.children).toHaveLength(0);
      kit.dispose();
    },
  );

  it.each([
    [320, 260],
    [480, 430],
    [1280, 720],
  ])(
    'keeps projected tissue labels inside a %sx%s viewport without overlapping each column',
    (width, height) => {
      const kit = createTeachingAnatomy(model);
      kit.update({}, state({ cutaway: true }), { selected: '11' });
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 1000),
        center = kit.bounds.getCenter(new THREE.Vector3());
      camera.position.copy(center).add(new THREE.Vector3(0, 0, 60));
      camera.lookAt(center);
      camera.updateMatrixWorld();
      const layout = layoutAnatomyLabels(kit.labels, camera, width, height);
      expect(layout).toHaveLength(5);
      for (const label of layout) {
        expect(label.x).toBeGreaterThanOrEqual(0);
        expect(label.x + label.width).toBeLessThanOrEqual(width);
        expect(label.y).toBeGreaterThanOrEqual(0);
        expect(label.y + 28).toBeLessThan(height);
      }
      for (const side of ['left', 'right']) {
        const column = layout.filter(l => l.side === side).sort((a, b) => a.y - b.y);
        for (let i = 1; i < column.length; i++)
          expect(column[i].y - column[i - 1].y).toBeGreaterThanOrEqual(28);
      }
      kit.dispose();
    },
  );
});
