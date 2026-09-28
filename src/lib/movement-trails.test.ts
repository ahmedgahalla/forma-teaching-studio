import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { BufferGeometry, MathUtils, Mesh, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAsset } from './anatomy-assets';
import type { DentalCase, DentalTooth } from './geometry';
import { createMovementTrail } from './movement-trails';
import type { Transforms, Vec3 } from './model';
import { previewPose, type TryPreview } from './try-mode';

let model: DentalCase;
let tooth: DentalTooth;
beforeAll(async () => {
  const bytes = readFileSync('public/models/forma-teaching-v1.glb');
  const asset = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model = dentalCaseFromAsset(
    asset.scene,
    JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8')),
  );
  tooth = model.teeth.find(item => item.id === '13')!;
  asset.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.dispose();
  });
});
afterAll(() => {
  for (const item of model.teeth) {
    item.geometry.dispose();
    item.rootGeometry?.dispose();
  }
  for (const gum of model.gums) gum.geometry.dispose();
});

const pointAt = (points: Float32Array, index: number) => new Vector3().fromArray(points, index * 3);
const pose = (translation: Vec3, rotation: Vec3 = [0, 0, 0]): Transforms => ({
  [tooth.id]: { translation, rotation },
});
const expectVector = (actual: Vector3, expected: Vector3) =>
  expect(actual.distanceTo(expected)).toBeLessThan(0.00001);

describe('movement trails follow displayed model paths', () => {
  it('tracks actual asset crown/root reference points with identical translation deltas', () => {
    const trail = createMovementTrail(tooth, progress => pose([3 * progress, 2 * progress, 0]))!;
    expect(trail.toothId).toBe('13');
    expect(trail.progress).toHaveLength(65);
    const crownStart = pointAt(trail.crown, 0);
    const rootStart = pointAt(trail.root!, 0);
    for (let index = 0; index < trail.progress.length; index++) {
      const delta = new Vector3(3 * trail.progress[index], 2 * trail.progress[index], 0);
      expectVector(pointAt(trail.crown, index).sub(crownStart), delta);
      expectVector(pointAt(trail.root!, index).sub(rootStart), delta);
    }
    const vertices = tooth.geometry.getAttribute('position');
    const direction = new Vector3(...tooth.occlusal!);
    const crownProjection = new Vector3(...trail.crownPoint).dot(direction);
    let actualVertex = false;
    for (let index = 0; index < vertices.count; index++) {
      const vertex = new Vector3().fromBufferAttribute(vertices, index);
      expect(vertex.dot(direction)).toBeLessThanOrEqual(crownProjection + 1e-10);
      if (vertex.equals(new Vector3(...trail.crownPoint))) actualVertex = true;
    }
    expect(actualVertex).toBe(true);
    expect(trail.rootPoint).toEqual(tooth.rootAnatomy!.branches[0].at(-1)!.center);
  });

  it('shows unequal curved crown/root motion when the displayed tooth tips', () => {
    const trail = createMovementTrail(tooth, progress => pose([0, 0, 0], [30 * progress, 0, 0]))!;
    const crownDelta = pointAt(trail.crown, 64).sub(pointAt(trail.crown, 0));
    const rootDelta = pointAt(trail.root!, 64).sub(pointAt(trail.root!, 0));
    expect(crownDelta.distanceTo(rootDelta)).toBeGreaterThan(3);
    expect(crownDelta.dot(rootDelta)).toBeLessThan(0);
    for (const points of [trail.crown, trail.root!]) {
      const chordMidpoint = pointAt(points, 0).lerp(pointAt(points, 64), 0.5);
      expect(pointAt(points, 32).distanceTo(chordMidpoint)).toBeGreaterThan(0.05);
    }
  });

  it('preserves a supplied rigid pivot arc beyond 180 degrees instead of taking a short chord', () => {
    const pivot = new Vector3(10, 20, 30);
    const original = new Vector3(...tooth.position);
    const axis = new Vector3(0, 0, 1);
    const rotation = new Quaternion().setFromAxisAngle(axis, MathUtils.degToRad(270));
    const displacement = original
      .clone()
      .sub(pivot)
      .applyQuaternion(rotation)
      .add(pivot)
      .sub(original);
    const demonstration: Pick<TryPreview, 'from' | 'to' | 'affectedIds' | 'motion'> = {
      from: {},
      to: pose(displacement.toArray() as Vec3, [0, 0, 270]),
      affectedIds: [tooth.id],
      motion: {
        type: 'rigid',
        centroid: pivot.toArray() as Vec3,
        centres: { [tooth.id]: tooth.position },
        axis: 'z',
        amount: 270,
      },
    };
    const trail = createMovementTrail(tooth, progress => previewPose(demonstration, progress))!;
    const start = new Vector3(...trail.crownPoint).add(original);
    for (const index of [0, 16, 32, 48, 64]) {
      const q = new Quaternion().setFromAxisAngle(axis, MathUtils.degToRad((270 * index) / 64));
      expectVector(
        pointAt(trail.crown, index),
        start.clone().sub(pivot).applyQuaternion(q).add(pivot),
      );
    }
    const incorrectShortArc = start
      .clone()
      .sub(pivot)
      .applyQuaternion(new Quaternion().setFromAxisAngle(axis, MathUtils.degToRad(-45)))
      .add(pivot);
    expect(pointAt(trail.crown, 32).distanceTo(incorrectShortArc)).toBeGreaterThan(10);
  });

  it('includes exact authored corners once, sorts them, and excludes invalid breakpoints', () => {
    const sample = vi.fn((progress: number) =>
      pose([Math.min(progress / 0.3, 1), Math.max(0, (progress - 0.3) / 0.7), 0]),
    );
    const trail = createMovementTrail(tooth, sample, [0.3, 0.25, 0.3, NaN, -1, 2, 0, 1])!;
    expect(trail.progress).toHaveLength(66);
    expect(trail.progress).toEqual([...trail.progress].sort((a, b) => a - b));
    expect(sample.mock.calls.map(([progress]) => progress)).toEqual(trail.progress);
    const corner = trail.progress.indexOf(0.3);
    expect(corner).toBeGreaterThan(0);
    expectVector(pointAt(trail.crown, corner).sub(pointAt(trail.crown, 0)), new Vector3(1, 0, 0));
  });

  it('is deterministic and leaves source geometry, anatomical metadata and poses untouched', () => {
    const vertices = tooth.geometry.getAttribute('position');
    const before = Array.from(vertices.array);
    const rootBefore = structuredClone(tooth.rootAnatomy);
    const transforms = pose([1, 2, 3], [4, 5, 6]);
    const saved = structuredClone(transforms);
    const first = createMovementTrail(tooth, () => transforms)!;
    const second = createMovementTrail(tooth, () => transforms)!;
    expect(first).toEqual(second);
    expect(first.crown).not.toBe(second.crown);
    first.crownPoint[0] += 5;
    first.rootPoint![0] += 5;
    expect(Array.from(vertices.array)).toEqual(before);
    expect(tooth.rootAnatomy).toEqual(rootBefore);
    expect(transforms).toEqual(saved);
  });

  it('uses one actual most-rootward multi-root endpoint, never their average', () => {
    const molar = model.teeth.find(item => item.id === '16')!;
    const endpoints = molar.rootAnatomy!.branches.map(branch => branch.at(-1)!.center);
    expect(endpoints).toHaveLength(3);
    const trail = createMovementTrail(molar, () => ({}))!;
    const direction = new Vector3(...molar.occlusal!).negate();
    const chosen = new Vector3(...trail.rootPoint!).dot(direction);
    expect(endpoints).toContainEqual(trail.rootPoint);
    for (const endpoint of endpoints)
      expect(new Vector3(...endpoint).dot(direction)).toBeLessThanOrEqual(chosen);
  });

  it('uses a real root geometry vertex when root metadata is absent', () => {
    const fallback = { ...tooth, rootAnatomy: undefined };
    const trail = createMovementTrail(fallback, () => ({}))!;
    const vertices = tooth.rootGeometry!.getAttribute('position');
    const rootward = new Vector3(...tooth.occlusal!).negate();
    const reference = new Vector3(...trail.rootPoint!);
    let actualVertex = false;
    for (let index = 0; index < vertices.count; index++) {
      const vertex = new Vector3().fromBufferAttribute(vertices, index);
      if (vertex.equals(reference)) actualVertex = true;
      expect(vertex.dot(rootward)).toBeLessThanOrEqual(reference.dot(rootward) + 1e-10);
    }
    expect(actualVertex).toBe(true);
  });

  it('has no fabricated root for crown-only geometry and adds no lower-jaw opening', () => {
    const lower = model.teeth.find(item => item.id === '33')!;
    const trail = createMovementTrail({ ...lower, rootGeometry: undefined }, () => ({}))!;
    expect(trail.root).toBeNull();
    expect(trail.rootPoint).toBeNull();
    expectVector(
      pointAt(trail.crown, 0),
      new Vector3(...trail.crownPoint).add(new Vector3(...lower.position)),
    );
  });

  it('skips uncalibrated imports, invalid frames and unusable crowns before sampling', () => {
    const sample = vi.fn(() => ({}));
    const empty = new BufferGeometry();
    for (const unsupported of [
      { ...tooth, calibrated: false },
      { ...tooth, occlusal: undefined },
      { ...tooth, occlusal: [0, 0, 0] as Vec3 },
      { ...tooth, mesial: tooth.buccal },
      { ...tooth, geometry: empty },
    ])
      expect(createMovementTrail(unsupported, sample)).toBeNull();
    expect(sample).not.toHaveBeenCalled();
    empty.dispose();
  });
});
