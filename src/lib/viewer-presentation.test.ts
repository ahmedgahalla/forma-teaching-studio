import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { DentalCase } from './geometry';
import { toothMatrix } from './analysis';
import {
  cameraViewDirection,
  displayedToothBounds,
  isToothVisible,
  layoutToothLabels,
  selectionContourMaterial,
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

  it('adds depth-tested back-face contours without owning or deforming geometry', () => {
    const material = selectionContourMaterial('#73d6f1');
    expect(material.side).toBe(THREE.BackSide);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.uniforms.thickness.value).toBeLessThan(2);
    const mesh = new THREE.Mesh(crown, material);
    material.dispose();
    expect(mesh.geometry).toBe(crown);
  });
});
