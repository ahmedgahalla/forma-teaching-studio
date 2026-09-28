import { afterAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { DentalCase } from './geometry';
import { toothMatrix } from './analysis';
import {
  cameraViewDirection,
  createSelectionGlow,
  displayedFitPoints,
  displayedToothBounds,
  displayedToothPoints,
  isToothVisible,
  layoutToothLabels,
  selectionGlowMaterial,
} from './viewer-presentation';
import { perspectiveFitDistance } from './camera-fit';

const crown = new THREE.BoxGeometry(6, 8, 4),
  root = new THREE.BoxGeometry(3, 14, 3).translate(0, 9, 0);
const model: DentalCase = {
  name: 'View test',
  demo: true,
  gums: [],
  teeth: [
    {
      id: '11',
      name: 'Upper',
      geometry: crown,
      rootGeometry: root,
      position: [-12, 6, 12],
      buccal: [0, 0, 1],
      mesial: [1, 0, 0],
      calibrated: true,
    },
    {
      id: '21',
      name: 'Upper',
      geometry: crown,
      rootGeometry: root,
      position: [12, 6, 12],
      buccal: [0, 0, 1],
      mesial: [-1, 0, 0],
      calibrated: true,
    },
    {
      id: '31',
      name: 'Lower',
      geometry: crown,
      position: [4, -6, 10],
      buccal: [0, 0, 1],
      mesial: [-1, 0, 0],
      calibrated: true,
    },
  ],
};
afterAll(() => {
  crown.dispose();
  root.dispose();
});

describe('lecture viewer presentation', () => {
  it('fits every selected posed crown and visible root, including lower-arch opening', () => {
    const transforms = {
      '11': {
        translation: [3, 2, 1] as [number, number, number],
        rotation: [20, 30, -12] as [number, number, number],
      },
    };
    const before = Array.from(crown.getAttribute('position').array);
    const ids = ['11', '21', '31'],
      bounds = displayedToothBounds(model, transforms, ids, true, 8);
    const crownOnly = displayedToothBounds(model, transforms, ids, false, 8);
    expect(bounds.max.y).toBeGreaterThan(crownOnly.max.y + 5);
    expect(bounds.min.y).toBe(-18);
    const direction = new THREE.Vector3(0.6, 0.4, 1).normalize(),
      camera = new THREE.PerspectiveCamera(34, 0.7, 0.1, 1000),
      center = bounds.getCenter(new THREE.Vector3());
    camera.position
      .copy(center)
      .addScaledVector(
        direction,
        perspectiveFitDistance(bounds, direction, camera.up, camera.fov, camera.aspect, 1.25),
      );
    camera.lookAt(center);
    camera.updateMatrixWorld();
    for (const tooth of model.teeth)
      for (const geometry of [
        tooth.geometry,
        ...(tooth.rootGeometry ? [tooth.rootGeometry] : []),
      ]) {
        const matrix = toothMatrix(tooth, transforms);
        if (tooth.id === '31') matrix.elements[13] -= 8;
        const positions = geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          const point = new THREE.Vector3()
            .fromBufferAttribute(positions, i)
            .applyMatrix4(matrix)
            .project(camera);
          expect(Math.abs(point.x)).toBeLessThan(1);
          expect(Math.abs(point.y)).toBeLessThan(1);
          expect(point.z).toBeLessThan(1);
        }
      }
    expect(Array.from(crown.getAttribute('position').array)).toEqual(before);
    expect(displayedToothBounds(model, transforms, ['missing'], true, 0).isEmpty()).toBe(true);
  });

  it('isolates only selected teeth within the current arch and restores ordinary visibility', () => {
    const options = { arch: 'upper' as const, selectedIds: ['11', '31'], isolateSelection: true };
    expect(model.teeth.filter(t => isToothVisible(t.id, options)).map(t => t.id)).toEqual(['11']);
    expect(
      model.teeth
        .filter(t => isToothVisible(t.id, { ...options, isolateSelection: false }))
        .map(t => t.id),
    ).toEqual(['11', '21']);
    expect(
      model.teeth.filter(t => isToothVisible(t.id, { ...options, cutawayId: '31' })).map(t => t.id),
    ).toEqual(['31']);
  });

  it('streams transformed crown/root vertices for exact fitting without mutating buffers', () => {
    const transforms = {
      '11': {
        translation: [3, 2, 1] as [number, number, number],
        rotation: [20, 30, -12] as [number, number, number],
      },
    };
    const original = Array.from(crown.getAttribute('position').array);
    const points = Array.from(displayedToothPoints(model, transforms, ['11', '31'], true, 8), p =>
      p.clone(),
    );
    expect(points).toHaveLength(
      crown.getAttribute('position').count * 2 + root.getAttribute('position').count,
    );
    expect(points[0]).toEqual(
      new THREE.Vector3()
        .fromBufferAttribute(crown.getAttribute('position'), 0)
        .applyMatrix4(toothMatrix(model.teeth[0], transforms)),
    );
    expect(points.at(-1)!.y).toBeLessThan(0);
    const bounds = displayedToothBounds(model, transforms, ['11', '31'], true, 8);
    expect(points.every(point => bounds.containsPoint(point))).toBe(true);
    expect(Array.from(crown.getAttribute('position').array)).toEqual(original);
    expect([...displayedToothPoints(model, transforms, [], true, 0)]).toEqual([]);
  });

  it('uses matching left/right lateral views with stable superior orientation', () => {
    const left = cameraViewDirection('left', 'both'),
      right = cameraViewDirection('right', 'both');
    expect(left.x).toBe(-right.x);
    expect(left.x).toBeGreaterThan(0.99);
    expect(left.y).toBe(right.y);
    expect(left.z).toBe(0);
    expect(cameraViewDirection('occlusal', 'upper').y).toBeLessThan(-0.99);
    expect(cameraViewDirection('occlusal', 'lower').y).toBeGreaterThan(0.99);
  });

  it.each(['11', '31'])('includes only shown gingiva and arch-independent gums for %s', id => {
    const withGums: DentalCase = {
      ...model,
      gums: [
        { id: 'upper', arch: 'upper', geometry: crown, position: [2, 20, 3] },
        { id: 'lower', arch: 'lower', geometry: crown, position: [4, -20, 5] },
        { id: 'unassigned', geometry: crown, position: [6, 7, 8] },
      ],
    };
    const before = Array.from(crown.getAttribute('position').array);
    const teeth = Array.from(displayedToothPoints(withGums, {}, [id], true, 8), p => p.clone());
    const points = Array.from(displayedFitPoints(withGums, {}, [id], true, 8, true), p =>
      p.clone(),
    );
    const count = crown.getAttribute('position').count;
    expect(points).toHaveLength(teeth.length + count * 2);
    expect(points.slice(0, teeth.length)).toEqual(teeth);
    const first = new THREE.Vector3().fromBufferAttribute(crown.getAttribute('position'), 0);
    expect(points[teeth.length]).toEqual(
      first.clone().add(id === '11' ? new THREE.Vector3(2, 20, 3) : new THREE.Vector3(4, -28, 5)),
    );
    expect(points[teeth.length + count]).toEqual(first.clone().add(new THREE.Vector3(6, 7, 8)));
    expect(
      Array.from(displayedFitPoints(withGums, {}, [id], true, 8, false), p => p.clone()),
    ).toEqual(teeth);
    expect(Array.from(crown.getAttribute('position').array)).toEqual(before);
  });

  it('keeps selected labels and omits overlapping, clipped and offscreen labels deterministically', () => {
    const anchors = [
      { id: '11', x: 50, y: 50, depth: 0.5, selected: false, locked: false },
      { id: '21', x: 56, y: 52, depth: 0.5, selected: true, locked: false },
      { id: '31', x: 150, y: 50, depth: 0.5, selected: false, locked: true },
      { id: '41', x: 155, y: 60, depth: 0.5, selected: false, locked: false },
      { id: '42', x: 0, y: 5, depth: 0.5, selected: false, locked: false },
      { id: '43', x: 240, y: 50, depth: 2, selected: true, locked: false },
    ];
    const original = structuredClone(anchors),
      placed = layoutToothLabels(anchors, 300, 180);
    expect(placed.map(p => p.id)).toEqual(['21', '31']);
    expect(layoutToothLabels([...anchors].reverse(), 300, 180)).toEqual(placed);
    expect(anchors).toEqual(original);
  });

  it('uses the source Fresnel glow on visible surfaces without a silhouette expansion', () => {
    const material = selectionGlowMaterial();
    expect(material).toMatchObject({
      side: THREE.FrontSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    expect(material.uniforms.uColor.value.getHex()).toBe(0x8fc3e0);
    expect(material.uniforms.uBase.value).toBe(0.02);
    expect(material.uniforms.uRim.value).toBe(0.6);
    expect(material.vertexShader).toContain('gl_Position = projectionMatrix * mv;');
    expect(material.vertexShader).not.toMatch(/thickness|viewport/);
    expect(material.fragmentShader).toContain('dot(normalize(vN), normalize(vV))');
    for (const chunk of ['tonemapping_fragment', 'colorspace_fragment'] as const) {
      expect(material.fragmentShader).toContain(`#include <${chunk}>`);
      expect(THREE.ShaderChunk[chunk]).toBeTruthy();
    }
    material.dispose();
  });

  it('shares immutable surfaces, inherits tooth poses, ignores picking and disposes only the shared material', () => {
    const group = new THREE.Group(),
      enamel = new THREE.MeshStandardMaterial({ color: 0xf8f3e8 }),
      natural = new THREE.Mesh(crown, enamel),
      material = selectionGlowMaterial();
    group.add(natural);
    const positions = crown.getAttribute('position').array.slice();
    const update = createSelectionGlow(group, crown, root, material);
    const overlays = group.children.slice(1) as THREE.Mesh[];
    expect(overlays.map(mesh => mesh.geometry)).toEqual([crown, root]);
    expect(overlays.every(mesh => mesh.material === material && mesh.renderOrder === 10)).toBe(
      true,
    );
    update(true, true);
    group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 30), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(group).every(hit => hit.object === natural)).toBe(true);
    expect(ray.intersectObject(group).length).toBeGreaterThan(0);
    group.position.set(2, -12, 4);
    group.rotation.set(0.2, 0.4, 0.1);
    group.updateMatrixWorld(true);
    for (const overlay of overlays)
      expect(overlay.matrixWorld.equals(natural.matrixWorld)).toBe(true);
    expect(natural.material).toBe(enamel);
    expect(enamel.color.getHex()).toBe(0xf8f3e8);
    expect(crown.getAttribute('position').array).toEqual(positions);
    const geometryDisposed = vi.fn(),
      materialDisposed = vi.fn();
    crown.addEventListener('dispose', geometryDisposed);
    root.addEventListener('dispose', geometryDisposed);
    material.addEventListener('dispose', materialDisposed);
    material.dispose();
    expect(materialDisposed).toHaveBeenCalledOnce();
    expect(geometryDisposed).not.toHaveBeenCalled();
    crown.removeEventListener('dispose', geometryDisposed);
    root.removeEventListener('dispose', geometryDisposed);
    enamel.dispose();
  });

  it('updates each selected tooth independently and suppresses hidden roots, arches and isolation', () => {
    const material = selectionGlowMaterial(),
      first = new THREE.Group(),
      second = new THREE.Group();
    const a = createSelectionGlow(first, crown, root, material),
      b = createSelectionGlow(second, crown, undefined, material);
    expect(first.children.every(mesh => !mesh.visible)).toBe(true);
    a(true, false);
    b(true, true);
    expect(first.children.map(mesh => mesh.visible)).toEqual([true, false]);
    expect(second.children[0].visible).toBe(true);
    a(true, true);
    expect(first.children.map(mesh => mesh.visible)).toEqual([true, true]);
    a(true, true, true);
    expect(first.children.every(mesh => !mesh.visible)).toBe(true);
    first.visible = false;
    a(true, true);
    expect(first.children.every(mesh => !mesh.visible)).toBe(true);
    first.visible = true;
    a(true, true);
    b(false, true);
    expect(first.children.every(mesh => mesh.visible)).toBe(true);
    expect(second.children[0].visible).toBe(false);
    material.dispose();
  });
});
