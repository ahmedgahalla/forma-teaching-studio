import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as assets from '../anatomy-assets';
import * as geometry from '../geometry';
import { createMechanicsExperiment } from '../mechanics/state';
import { createTeachingCase } from '../teaching-cases';
import { lectureSceneModel, validateLectureScene } from './index';
import { fixtureScene } from './documents.fixtures';

let base: geometry.DentalCase;
beforeAll(() => {
  base = geometry.createDemo();
  const copy = (): geometry.DentalCase => ({
    ...base,
    teeth: base.teeth.map(({ geometry, rootGeometry, ...metadata }) => ({
      ...structuredClone(metadata),
      geometry,
      rootGeometry,
    })),
    gums: base.gums.map(gum => ({ ...gum, position: [...gum.position] })),
  });
  vi.spyOn(geometry, 'createDemo').mockImplementation(copy);
  vi.spyOn(assets, 'getTeachingAssetCase').mockImplementation(copy);
});
afterAll(() => {
  vi.restoreAllMocks();
  base.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  base.gums.forEach(gum => gum.geometry.dispose());
});

describe('lecture scene boundaries', () => {
  it.each([
    [
      'unknown model',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.source = { kind: 'case', id: 'missing' };
      },
    ],
    [
      'unknown arrangement',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.source = { kind: 'arrangement', id: 'missing' };
      },
    ],
    [
      'unknown tooth',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.transforms['18'] = scene.transforms['11'];
      },
    ],
    [
      'nonfinite pose',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.transforms['11'].translation[1] = NaN;
      },
    ],
    [
      'out of bounds pose',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.transforms['11'].rotation[0] = 10001;
      },
    ],
    [
      'unknown selection',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.setup.selectedIds = ['99'];
      },
    ],
    [
      'duplicate selection',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.setup.selectedIds = ['11', '11'];
      },
    ],
    [
      'nonfinite camera',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.setup.camera!.position[0] = Infinity;
      },
    ],
    [
      'zero camera direction',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.setup.camera!.position = [...scene.setup.camera!.target];
      },
    ],
    [
      'unsupported colour',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.ligatureColor = 'url(example)';
      },
    ],
    [
      'unknown studied tooth',
      (scene: ReturnType<typeof fixtureScene>) => {
        scene.toothStudy = { tooth: '99', view: 'buccal' };
      },
    ],
  ])('rejects %s', (_, change) => {
    const scene = fixtureScene();
    change(scene);
    expect(() => validateLectureScene(scene)).toThrow();
  });

  it('rejects missing teeth from a valid extraction case in every tooth-bearing field', () => {
    const scene = fixtureScene();
    scene.source = { kind: 'case', id: 'anchorage-space-closure' };
    scene.setup.selectedIds = ['14'];
    expect(() => validateLectureScene(scene)).toThrow();
    scene.setup.selectedIds = ['11'];
    scene.transforms['14'] = scene.transforms['11'];
    expect(() => validateLectureScene(scene)).toThrow();
    delete scene.transforms['14'];
    scene.toothStudy = { tooth: '24', view: 'mesial' };
    expect(() => validateLectureScene(scene)).toThrow();
  });

  it('rejects unknown nested fields instead of retaining geometry or executable metadata', () => {
    const scene = fixtureScene();
    expect(() => validateLectureScene({ ...scene, model: base })).toThrow(/fields/);
    expect(() =>
      validateLectureScene({ ...scene, setup: { ...scene.setup, custom: true } }),
    ).toThrow(/fields/);
    expect(() =>
      validateLectureScene({
        ...scene,
        transforms: { '11': { ...scene.transforms['11'], vertices: [1, 2, 3] } },
      }),
    ).toThrow(/fields/);
  });

  it('reconstructs source origins and attachment metadata without mutating the canonical model', () => {
    const scene = fixtureScene();
    scene.source = { kind: 'case', id: 'movement-types' };
    scene.attachmentsByTooth = {
      '11': {
        shape: 'rectangle',
        width: 2,
        height: 3,
        depth: 1,
        offsetMesial: 0.2,
        offsetOcclusal: -0.1,
        rotation: 15,
      },
    };
    const validated = validateLectureScene(scene),
      model = lectureSceneModel(validated);
    expect(model.teeth[0].position).toEqual(
      createTeachingCase(base, 'movement-types').model.teeth[0].position,
    );
    expect(model.teeth[0].geometry).toBe(base.teeth[0].geometry);
    expect(model.teeth[0].attachment).toEqual(scene.attachmentsByTooth['11']);
    model.teeth[0].attachment!.width = 4;
    expect(scene.attachmentsByTooth['11'].width).toBe(2);
    expect(base.teeth[0].attachment).toBeUndefined();
    scene.attachmentsByTooth['11'].height = 100;
    expect(() => validateLectureScene(scene)).toThrow(/dimensions/);
  });

  it('validates mechanics against the reconstructed source and discards computed results', () => {
    const scene = fixtureScene();
    scene.mechanics = createMechanicsExperiment(base, scene.transforms);
    const result = validateLectureScene(scene);
    expect(result.mechanics).toEqual(scene.mechanics);
    expect(result.mechanics).not.toBe(scene.mechanics);
    const untrusted = structuredClone(scene);
    Object.assign(untrusted.mechanics!, {
      result: { poisoned: true },
      applied: { poisoned: true },
    });
    expect(validateLectureScene(untrusted).mechanics).toMatchObject({
      result: null,
      applied: null,
      comparison: null,
    });
    untrusted.mechanics!.reference.teeth[0].position[0] += 1;
    expect(() => validateLectureScene(untrusted)).toThrow(/does not match/);
  });
});
