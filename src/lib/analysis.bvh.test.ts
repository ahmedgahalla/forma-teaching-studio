import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BoxGeometry, type BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import { findSurfaceIntersections, toothMatrix, type SurfaceIntersection } from './analysis';
import { dentalCaseFromAsset } from './anatomy-assets';
import { createTeachingCase, sampleCaseDemonstration } from './teaching-cases';
import type { DentalCase } from './geometry';
import type { Transforms } from './model';

/** Previous algorithm retained as an independent regression oracle. */
function priorIntersections(model: DentalCase, transforms: Transforms): SurfaceIntersection[] {
  const pieces = model.teeth.map(tooth => {
    tooth.geometry.computeBoundingBox();
    const transform = toothMatrix(tooth, transforms);
    return { tooth, transform, box: tooth.geometry.boundingBox!.clone().applyMatrix4(transform) };
  });
  const result: SurfaceIntersection[] = [];
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i],
        b = pieces[j];
      if (!a.box.intersectsBox(b.box)) continue;
      const tree = new MeshBVH(a.tooth.geometry, { indirect: true });
      if (
        tree.intersectsGeometry(
          b.tooth.geometry,
          a.transform.clone().invert().multiply(b.transform),
        )
      )
        result.push({ a: a.tooth.id, b: b.tooth.id });
    }
  return result;
}
const bytes = (geometry: BufferGeometry) =>
  ['position', 'normal']
    .map(name => Buffer.from(geometry.getAttribute(name).array.buffer.slice(0)))
    .concat(geometry.index ? [Buffer.from(geometry.index.array.buffer.slice(0))] : []);

describe('dual-BVH exact surface regression', () => {
  it('preserves non-indexed STL triangle order and an immutable renderer cache', () => {
    const a = new BoxGeometry(2, 2, 2).toNonIndexed(),
      b = new BoxGeometry(2, 2, 2).toNonIndexed();
    const before = [bytes(a), bytes(b)],
      originalTree = new MeshBVH(b, { indirect: true });
    Object.defineProperty(b, 'boundsTree', {
      value: originalTree,
      configurable: false,
      writable: false,
    });
    const model: DentalCase = {
      demo: false,
      name: 'STL test',
      gums: [],
      teeth: [a, b].map((geometry, i) => ({
        id: String(11 + i),
        name: 'test',
        position: [i * 0.5, i * 0.2, i * 0.3],
        geometry,
        buccal: [0, 0, 1],
        mesial: [1, 0, 0],
        calibrated: false,
      })),
    };
    expect(findSurfaceIntersections(model, {})).toEqual([{ a: '11', b: '12' }]);
    [a, b].forEach((geometry, i) => {
      expect(geometry.index).toBeNull();
      bytes(geometry).forEach((array, j) => expect(array.equals(before[i][j])).toBe(true));
    });
    expect(b.boundsTree).toBe(originalTree);
  });
  it('preserves an existing boundsTree descriptor and never leaves a cache on source geometry', () => {
    const a = new BoxGeometry(2, 2, 2),
      b = new BoxGeometry(2, 2, 2),
      originalTree = new MeshBVH(b, { indirect: true });
    Object.defineProperty(b, 'boundsTree', {
      value: originalTree,
      configurable: true,
      writable: false,
      enumerable: false,
    });
    const prior = Object.getOwnPropertyDescriptor(b, 'boundsTree');
    const model: DentalCase = {
      demo: true,
      name: 'test',
      gums: [],
      teeth: [a, b].map((geometry, i) => ({
        id: String(11 + i),
        name: 'test',
        position: [i * 0.5, i * 0.2, i * 0.3],
        geometry,
        buccal: [0, 0, 1],
        mesial: [1, 0, 0],
        calibrated: true,
      })),
    };
    expect(findSurfaceIntersections(model, {})).toEqual([{ a: '11', b: '12' }]);
    expect(Object.getOwnPropertyDescriptor(b, 'boundsTree')).toEqual(prior);
    expect(Object.hasOwn(a, 'boundsTree')).toBe(false);
    delete b.boundsTree;
    findSurfaceIntersections(model, {});
    expect(Object.hasOwn(b, 'boundsTree')).toBe(false);
  });
  it.each([
    { name: 'reference occlusion', caseId: 'reference-occlusion', transforms: {} },
    {
      name: 'crowding at the position-then-rotation midpoint',
      caseId: 'crowding',
      transforms: sampleCaseDemonstration('crowding', 'position-then-rotation', 0.5),
    },
    {
      name: 'deepbite at the posterior-extrusion endpoint',
      caseId: 'deepbite',
      transforms: sampleCaseDemonstration('deepbite', 'posterior-extrusion', 1),
    },
  ])(
    'matches the previous triangle algorithm on the actual GLB: $name',
    async ({ caseId, transforms }) => {
      // A fresh asset per pose prevents an earlier test from masking geometry mutations.
      const data = readFileSync('public/models/forma-teaching-v1.glb');
      const gltf = await new GLTFLoader().parseAsync(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        '',
      );
      const base = dentalCaseFromAsset(
        gltf.scene,
        JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8')),
      );
      const before = base.teeth.map(t => bytes(t.geometry));
      const { model } = createTeachingCase(base, caseId);
      const intersections = findSurfaceIntersections(model, transforms);
      expect(intersections).toEqual(priorIntersections(model, transforms));
      if (caseId === 'deepbite') expect(intersections.length).toBeGreaterThan(0);
      base.teeth.forEach((tooth, i) => {
        const after = bytes(tooth.geometry);
        after.forEach((array, j) => expect(array.equals(before[i][j])).toBe(true));
        expect(Object.hasOwn(tooth.geometry, 'boundsTree')).toBe(false);
      });
    },
    30000,
  );
});
