import { afterAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Box3 } from 'three';
import { displayedTadPoints } from './mechanics-tad-view';
import { createOrthodonticDemo } from './demo';
import { createMechanicsVisuals } from './mechanics-view';
import { createMechanicsExperiment, transitionMechanics } from './mechanics/state';
import { toothMatrix } from './analysis';
import type { Vec3 } from './model';

const model = createOrthodonticDemo();
const display = {
  arch: 'both' as const,
  opening: 0,
  forces: false,
  revealed: true,
  visible: () => true,
};
const fixture = () => {
  let state = createMechanicsExperiment(model);
  const tooth = state.reference.teeth.find(item => item.id === '13')!;
  const position = new THREE.Vector3(...tooth.position)
    .addScaledVector(new THREE.Vector3(...tooth.buccal), 9)
    .toArray() as Vec3;
  state = transitionMechanics(state, { type: 'tad', id: 'teaching-anchor', position });
  state = transitionMechanics(state, {
    type: 'elastic',
    id: 'connection',
    from: { kind: 'tooth', tooth: '13', local: tooth.bracketLocal },
    to: { kind: 'tad', id: 'teaching-anchor' },
    law: { kind: 'constant', forceN: 0.2 },
  });
  return state;
};
afterAll(() => {
  for (const tooth of model.teeth) {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  }
  model.gums.forEach(gum => gum.geometry.dispose());
});

describe('schematic TAD display', () => {
  it('keeps a recognizable head and threaded body fixed while its elastic follows the tooth', () => {
    const kit = createMechanicsVisuals(model),
      state = fixture(),
      original = structuredClone(state);
    const fixed = new THREE.Vector3(...state.config.tads[0].position);
    kit.update(state, {}, display);
    const head = kit.group.getObjectByName('tad-teaching-anchor-head') as THREE.Mesh;
    const body = kit.group.getObjectByName('tad-teaching-anchor-body') as THREE.Mesh;
    const thread = kit.group.getObjectByName('tad-teaching-anchor-thread') as THREE.Mesh;
    expect(head).toBeDefined();
    expect(body).toBeDefined();
    expect(thread).toBeDefined();
    head.geometry.computeBoundingBox();
    body.geometry.computeBoundingBox();
    expect(head.geometry.boundingBox!.getSize(new THREE.Vector3()).x).toBeGreaterThan(1.5);
    expect(body.geometry.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(4);
    expect(head.position.distanceTo(fixed)).toBeLessThan(1e-10);
    const poses = { '13': { translation: [1, -0.5, 0.3] as Vec3, rotation: [0, 4, 0] as Vec3 } };
    kit.update(state, poses, display);
    expect(kit.group.getObjectByName(head.name)).toBe(head);
    expect(head.position.distanceTo(fixed)).toBeLessThan(1e-10);
    const elastic = kit.group.children.find(
      object => (object as THREE.Mesh).geometry instanceof THREE.TubeGeometry,
    ) as THREE.Mesh<THREE.TubeGeometry>;
    const expected = new THREE.Vector3(
      ...state.reference.teeth.find(t => t.id === '13')!.bracketLocal,
    ).applyMatrix4(
      toothMatrix(
        model.teeth.find(t => t.id === '13')!,
        poses,
      ),
    );
    expect(elastic.geometry.parameters.path.getPoint(0).distanceTo(expected)).toBeLessThan(1e-10);
    expect(elastic.geometry.parameters.path.getPoint(1).distanceTo(head.position)).toBeLessThan(
      1e-10,
    );
    expect(state).toEqual(original);
    kit.dispose();
  });
  it('reuses screw resources across updates and visibility changes, and disposes them once', () => {
    const kit = createMechanicsVisuals(model),
      state = fixture();
    kit.update(state, {}, display);
    const parts = kit.group.children.filter(child => child.name.startsWith('tad-')) as THREE.Mesh[];
    expect(parts.length).toBeGreaterThan(2);
    const geometries = [...new Set(parts.map(part => part.geometry))];
    const disposed = geometries.map(geometry => vi.spyOn(geometry, 'dispose'));
    kit.update(state, {}, { ...display, visible: () => false });
    expect(kit.group.children).toHaveLength(0);
    disposed.forEach(spy => expect(spy).not.toHaveBeenCalled());
    kit.update(state, {}, display);
    for (const part of parts) expect(kit.group.getObjectByName(part.name)).toBe(part);
    kit.update(null, {}, display);
    expect(kit.group.children).toHaveLength(0);
    disposed.forEach(spy => expect(spy).not.toHaveBeenCalled());
    kit.dispose();
    disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
  });
});

it('shares geometry across simultaneous anchors and reuses slots when an anchor is replaced', () => {
  const kit = createMechanicsVisuals(model),
    state = fixture();
  const firstPosition = state.config.tads[0].position;
  state.config.tads.push({
    id: 'second-anchor',
    position: [firstPosition[0], firstPosition[1] + 3, firstPosition[2]],
  });
  kit.update(state, {}, display);
  const first = kit.group.getObjectByName('tad-teaching-anchor-head') as THREE.Mesh;
  const second = kit.group.getObjectByName('tad-second-anchor-head') as THREE.Mesh;
  expect(first).not.toBe(second);
  expect(first.geometry).toBe(second.geometry);
  expect(first.position.distanceTo(second.position)).toBeCloseTo(3, 10);
  state.config.tads.shift();
  state.config.elastics = [];
  kit.update(state, {}, display);
  expect(kit.group.getObjectByName('tad-second-anchor-head')).toBe(first);
  expect(kit.group.getObjectByName('tad-teaching-anchor-head')).toBeUndefined();
  expect(first.position.toArray()).toEqual(state.config.tads[0].position);
  kit.dispose();
});

it('uses the same lower-jaw envelope and hides TADs outside the fitted teeth', () => {
  const state = createMechanicsExperiment(model);
  const lower = state.reference.teeth.find(tooth => tooth.id === '31')!;
  state.config.tads.push({ id: 'lower', position: [...lower.position] });
  const bounds = new Box3();
  for (const point of displayedTadPoints(state, ['31'], 7, true)) bounds.expandByPoint(point);
  expect(bounds.isEmpty()).toBe(false);
  expect([...displayedTadPoints(state, ['11'], 7, true)]).toHaveLength(0);
  const kit = createMechanicsVisuals(model);
  try {
    kit.update(state, {}, { ...display, opening: 7, jawOpen: true });
    kit.group.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    bounds.expandByScalar(1e-6);
    for (const object of kit.group.children) {
      const positions = (object as THREE.Mesh).geometry.getAttribute('position');
      for (let index = 0; index < positions.count; index++) {
        point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
        expect(bounds.containsPoint(point)).toBe(true);
      }
    }
  } finally {
    kit.dispose();
  }
});
