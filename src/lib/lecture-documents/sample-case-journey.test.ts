import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Euler, MathUtils, Mesh, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as assets from '../anatomy-assets';
import { dentalCaseFromAtlas } from '../atlas-assets';
import { findSurfaceIntersections, toothMatrix } from '../analysis';
import { applyJawMatrix } from '../jaw-opening';
import type { Vec3 } from '../model';
import type { DentalCase } from '../geometry';
import { stageTransforms } from '../planning';
import { createCaseJourneyLecture } from './sample-case-journey';
import { caseJourneyPoses } from './sample-case-journey-scenes';
import { validateLectureDocument } from './documents';

let model: DentalCase;
beforeAll(async () => {
  const bytes = readFileSync('public/models/forma-atlas-v1.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model = dentalCaseFromAtlas(
    scene,
    JSON.parse(readFileSync('public/models/forma-atlas-v1.json', 'utf8')),
  );
  scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material =>
      material.dispose(),
    );
  });
  vi.spyOn(assets, 'getTeachingAssetCase').mockImplementation(() => model);
});
afterAll(() => {
  vi.restoreAllMocks();
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

describe('one continuous authored case lecture', () => {
  it('validates all seventeen steps on the actual model with independent restart data', () => {
    const original = createCaseJourneyLecture();
    expect(original.steps).toHaveLength(17);
    expect(validateLectureDocument(JSON.parse(JSON.stringify(original)))).toEqual(original);
    const edited = createCaseJourneyLecture();
    edited.steps[0].scene.transforms['11'].translation[0] = 60;
    edited.steps[0].scene.setup.selectedIds.length = 0;
    expect(createCaseJourneyLecture()).toEqual(original);
    expect(edited.steps[1]).toEqual(original.steps[1]);
    for (const { scene } of original.steps) {
      expect(scene.source).toEqual({ kind: 'reference' });
      expect(Object.keys(scene.transforms).sort()).toEqual(
        model.teeth.map(tooth => tooth.id).sort(),
      );
      expect(scene.applianceDisplay.palate).toBe(false);
    }
  });

  it('changes teeth only at the three declared motion steps; placement and removal stay still', () => {
    const { steps } = createCaseJourneyLecture();
    for (let index = 1; index < steps.length; index++) {
      const current = steps[index],
        previous = steps[index - 1];
      if (current.motion) {
        expect(current.motion.from).toEqual(previous.scene.transforms);
        expect(current.scene.transforms).not.toEqual(previous.scene.transforms);
        expect(current.scene.mechanics).toBeUndefined();
      } else expect(current.scene.transforms).toEqual(previous.scene.transforms);
    }
    expect(steps.filter(step => step.motion)).toHaveLength(3);
    expect(steps.filter(step => step.comparison).map(step => step.comparison)).toEqual([
      'start',
      'finish',
    ]);
  });

  it('preserves the corrected posterior width and the opposing arch while alignment finishes', () => {
    const { start, expanded, aligned, finish } = caseJourneyPoses();
    for (const tooth of model.teeth) {
      if (Number(tooth.id[0]) >= 3) {
        expect(start[tooth.id]).toEqual(finish[tooth.id]);
        expect(expanded[tooth.id]).toEqual(finish[tooth.id]);
        expect(aligned[tooth.id]).toEqual(finish[tooth.id]);
      } else if (Number(tooth.id[1]) >= 3) {
        expect(aligned[tooth.id]).toEqual(expanded[tooth.id]);
        expect(finish[tooth.id]).toEqual(expanded[tooth.id]);
      }
    }
    const width = (poses: typeof start) =>
      Math.abs(
        model.teeth.find(t => t.id === '26')!.position[0] +
          poses['26'].translation[0] -
          model.teeth.find(t => t.id === '16')!.position[0] -
          poses['16'].translation[0],
      );
    expect(width(expanded)).toBeGreaterThan(width(start));
    expect(width(finish)).toBeCloseTo(width(expanded));
  });

  it('keeps both-arch overview surfaces clear in their declared jaw display poses', () => {
    for (const step of createCaseJourneyLecture().steps.filter(
      item => item.scene.setup.arch === 'both',
    )) {
      const poses = structuredClone(step.scene.transforms);
      for (const tooth of model.teeth.filter(item => Number(item.id[0]) >= 3)) {
        const matrix = applyJawMatrix(toothMatrix(tooth, poses), step.scene.setup.jawOpen);
        const position = new Vector3(),
          rotation = new Quaternion(),
          scale = new Vector3();
        matrix.decompose(position, rotation, scale);
        const angles = new Euler().setFromQuaternion(rotation);
        poses[tooth.id] = {
          translation: position.sub(new Vector3(...tooth.position)).toArray() as Vec3,
          rotation: [angles.x, angles.y, angles.z].map(MathUtils.radToDeg) as Vec3,
        };
      }
      expect(findSurfaceIntersections(model, poses), step.id).toEqual([]);
    }
  });

  it('has no crown or root surface intersections in the displayed upper-arch motions', () => {
    const visible = { ...model, teeth: model.teeth.filter(tooth => Number(tooth.id[0]) < 3) };
    const roots = {
      ...visible,
      teeth: visible.teeth.map(tooth => ({ ...tooth, geometry: tooth.rootGeometry! })),
    };
    for (const step of createCaseJourneyLecture().steps.filter(item => item.motion)) {
      for (const progress of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
        const poses = stageTransforms(
          step.scene.transforms,
          [],
          progress * 2,
          2,
          step.motion!.from,
        );
        expect(
          findSurfaceIntersections(visible, poses),
          `${step.id} at ${progress}: crowns`,
        ).toEqual([]);
        expect(findSurfaceIntersections(roots, poses), `${step.id} at ${progress}: roots`).toEqual(
          [],
        );
      }
    }
  }, 120000);
});
