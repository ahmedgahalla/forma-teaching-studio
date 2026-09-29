import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as assets from '@/lib/anatomy-assets';
import * as geometry from '@/lib/geometry';
import { fixtureScene, createLectureStep } from '@/lib/lecture-documents/documents.fixtures';
import { createLectureSample } from '@/lib/lecture-documents';
import { sampleCaseDemonstration } from '@/lib/teaching-cases';
import { createTryState } from '@/lib/try-mode';
import type { ClassroomSnapshot } from '../case/types';
import { lectureStepSnapshot } from './scene-bridge';

let base: geometry.DentalCase;
function modelCopy(): geometry.DentalCase {
  return {
    ...base,
    teeth: base.teeth.map(({ geometry, rootGeometry, ...metadata }) => ({
      ...structuredClone(metadata),
      geometry,
      rootGeometry,
    })),
    gums: base.gums.map(gum => ({ ...gum, position: [...gum.position] })),
  };
}
beforeAll(() => {
  base = geometry.createDemo();
  vi.spyOn(geometry, 'createDemo').mockImplementation(modelCopy);
  vi.spyOn(assets, 'getTeachingAssetCase').mockImplementation(modelCopy);
});
afterAll(() => {
  vi.restoreAllMocks();
  base.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  base.gums.forEach(gum => gum.geometry.dispose());
});

function snapshot(): ClassroomSnapshot {
  const scene = fixtureScene(),
    setup = scene.setup;
  return {
    toothStudy: null,
    glossaryId: 'enamel',
    mechanics: null,
    wirePreset: setup.wirePreset,
    magnification: 10,
    predictResponse: true,
    responseRevealed: true,
    forceVectors: true,
    pointed: null,
    mechanicsFocus: {},
    scenario: null,
    applianceDisplay: scene.applianceDisplay,
    workflowOrigin: null,
    returnWorkspace: null,
    sandbox: createTryState(),
    comparisonName: 'Old view',
    traces: true,
    curveVisible: true,
    reverse: true,
    lesson: {
      transforms: {},
      model: modelCopy(),
      selected: '21',
      selectedIds: ['21'],
      arch: 'lower',
      view: 'right',
      ghost: true,
      roots: false,
      braces: true,
      attachments: false,
      gums: true,
      labels: true,
      grid: true,
      stage: 9,
      stages: 20,
      opening: 15,
    },
    history: { current: {}, past: [{ label: 'Old edit', value: {} }], future: [] },
    checkpoints: [{ id: 'old', name: 'Old', transforms: {} }],
    speed: 2,
    anatomy: setup.anatomy,
    camera: setup.camera,
    lessonId: 'old-lesson',
    lessonStep: 3,
    lessonSnapshots: [],
    bracketStyle: 'metal',
    ligatureColor: '#123456',
    lecture: true,
    isolated: false,
    tool: 'translate',
    measureTo: '21',
    measureMode: true,
    landmarks: [],
  };
}

describe('absolute lecture step restoration', () => {
  it('restores the same poses repeatedly without accumulated motion or stale editing history', () => {
    const scene = fixtureScene(),
      step = createLectureStep(scene);
    const first = lectureStepSnapshot(step, snapshot());
    first.history.current['11'].translation[0] = 20;
    first.camera!.position[0] = 99;
    first.history.past.push({ label: 'Live edit', value: {} });
    const second = lectureStepSnapshot(step, first);
    expect(second.history).toEqual({ current: scene.transforms, past: [], future: [] });
    expect(second.lesson.transforms).toEqual(scene.transforms);
    expect(second.camera).toEqual(scene.setup.camera);
    expect(second.lesson).toMatchObject({ stage: 10, stages: 10 });
    expect(second.sandbox.current).toEqual(scene.transforms);
    expect(second.sandbox.original).toEqual(scene.transforms);
    expect(second).toMatchObject({
      scenario: null,
      glossaryId: null,
      lessonId: '',
      lessonStep: -1,
      comparisonName: null,
      traces: false,
      reverse: false,
      tool: 'orbit',
      checkpoints: [],
    });
    expect(step.scene).toEqual(scene);
  });

  it('starts an attached demonstration from its authored zero frame with the answer hidden', () => {
    const step = createLectureSample().steps[1];
    step.scene.transforms = sampleCaseDemonstration('movement-types', 'translation', 1);
    step.scene.setup.stage = 10;
    const restored = lectureStepSnapshot(step, snapshot());
    expect(restored.history.current).toEqual(
      sampleCaseDemonstration('movement-types', 'translation', 0),
    );
    expect(restored.lesson).toMatchObject({ stage: 0, stages: 10, braces: false });
    expect(restored.scenario).toMatchObject({
      caseId: 'movement-types',
      variantId: 'translation',
      returnProgress: 0,
      answerVisible: false,
      exploring: false,
    });
    expect(restored.scenario!.model).toBe(restored.lesson.model);
    expect(restored.sandbox.active).toBe(false);
  });

  it('restores camera, layers, attachments and a tooth-study presentation without aliasing the step', () => {
    const scene = fixtureScene();
    scene.isolated = true;
    scene.toothStudy = { tooth: '11', view: 'lingual' };
    scene.bracketStyle = 'ceramic';
    scene.ligatureColor = '#f0a1b2';
    scene.attachments = true;
    scene.setup.labels = true;
    scene.setup.anatomy = { bone: true, ligament: true, cutaway: true, opacity: 0.42 };
    scene.attachmentsByTooth = {
      '11': {
        shape: 'beveled',
        width: 2,
        height: 3,
        depth: 1,
        offsetMesial: 0,
        offsetOcclusal: 0,
        rotation: 12,
      },
    };
    const restored = lectureStepSnapshot(createLectureStep(scene), snapshot());
    expect(restored.camera).toEqual(scene.setup.camera);
    expect(restored.anatomy).toEqual(scene.setup.anatomy);
    expect(restored.lesson).toMatchObject({
      roots: true,
      labels: true,
      attachments: true,
      isolated: true,
    });
    expect(restored.toothStudy).toMatchObject({
      tooth: '11',
      view: 'lingual',
      explanationVisible: false,
    });
    expect(restored.toothStudy!.model).toBe(restored.lesson.model);
    expect(restored.toothStudy!.prior.camera).toEqual(scene.setup.camera);
    expect(restored.lesson.model.teeth.find(tooth => tooth.id === '11')!.attachment).toEqual(
      scene.attachmentsByTooth['11'],
    );
    restored.anatomy.opacity = 0.9;
    restored.lesson.model.teeth[0].attachment!.width = 5;
    expect(scene.setup.anatomy.opacity).toBe(0.42);
    expect(scene.attachmentsByTooth['11'].width).toBe(2);
    expect(base.teeth[0].attachment).toBeUndefined();
  });
});

it('retains only the current viewing frame when loading an authored tooth study', () => {
  const scene = fixtureScene();
  scene.toothStudy = { tooth: '11', view: 'lingual' };
  const before = snapshot();
  before.camera = {
    ...before.camera!,
    view: 'occlusal',
    position: [4, 90, 10],
    target: [3, 2, 1],
  };
  before.lesson.view = 'front';
  const step = createLectureStep(scene);
  const restored = lectureStepSnapshot(step, before, true);
  expect(restored.lesson).toMatchObject({ view: 'occlusal', arch: 'lower', camera: before.camera });
  expect(restored.toothStudy!.prior).toMatchObject({
    view: 'occlusal',
    arch: 'lower',
    camera: before.camera,
  });
  expect(restored.lesson.transforms).toEqual(scene.transforms);
  expect(restored.anatomy).toEqual(scene.setup.anatomy);
  expect(restored.toothStudy).toMatchObject({ tooth: '11', view: 'lingual' });
  restored.camera!.position[0] = 99;
  expect(before.camera.position).toEqual([4, 90, 10]);
  expect(step.scene).toEqual(scene);
});
