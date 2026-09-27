import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as assets from '@/lib/anatomy-assets';
import * as geometry from '@/lib/geometry';
import { fixtureScene } from '@/lib/lecture-documents/documents.fixtures';
import {
  createLectureSample,
  createLectureStep,
  validateLectureScene,
  type LectureScene,
} from '@/lib/lecture-documents';
import { createMechanicsExperiment, transitionMechanics } from '@/lib/mechanics/state';
import { solveMechanics } from '@/lib/mechanics/solver';
import { createTeachingCase, sampleCaseDemonstration } from '@/lib/teaching-cases';
import { createTryState } from '@/lib/try-mode';
import type { CaseStudioApi } from '../case/api';
import type { ClassroomSnapshot } from '../case/types';
import { captureLectureScene, lectureStepSnapshot } from './scene-bridge';

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

function captureApi(scene: LectureScene = fixtureScene()): CaseStudioApi {
  return {
    model: modelCopy(),
    sandbox: createTryState(),
    dragPreview: null,
    busy: false,
    workflowOrigin: null,
    scenario: null,
    dentalArrangement: null,
    mechanics: null,
    shown: structuredClone(scene.transforms),
    actualShown: structuredClone(scene.transforms),
    plan: { current: { '11': { translation: [8, 0, 0], rotation: [0, 0, 0] } } },
    session: () => ({ lectureSetup: structuredClone(scene.setup) }),
    roots: scene.roots,
    braces: scene.braces,
    attachments: scene.attachments,
    bracketStyle: scene.bracketStyle,
    ligatureColor: scene.ligatureColor,
    applianceDisplay: structuredClone(scene.applianceDisplay),
    isolated: scene.isolated,
    toothStudy: null,
  } as unknown as CaseStudioApi;
}

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

describe('lecture scene capture', () => {
  it('captures the visible magnified frame, independently of the response or final target', () => {
    const api = captureApi();
    api.shown = { '11': { translation: [2.5, 0, 0], rotation: [0, 3, 0] } };
    api.actualShown = { '11': { translation: [0.25, 0, 0], rotation: [0, 0.3, 0] } };
    const captured = captureLectureScene(api);
    expect(captured.transforms).toEqual(api.shown);
    expect(captured.transforms).not.toEqual(api.actualShown);
    expect(captured.transforms).not.toEqual(api.plan.current);
    expect(captured.setup).toMatchObject({ stage: 10, mechanicsResponse: false, reverse: false });
    api.shown['11'].translation[0] = 30;
    expect(captured.transforms['11'].translation[0]).toBe(2.5);
  });

  it.each(['pending', 'drag', 'loading', 'imported', 'workflow'] as const)(
    'refuses capture while %s would make the scene incomplete or unsupported',
    state => {
      const api = captureApi();
      if (state === 'pending') api.sandbox.pending = {} as NonNullable<typeof api.sandbox.pending>;
      if (state === 'drag') api.dragPreview = {} as NonNullable<typeof api.dragPreview>;
      if (state === 'loading') api.busy = true;
      if (state === 'imported') api.model.demo = false;
      if (state === 'workflow') api.workflowOrigin = {} as NonNullable<typeof api.workflowOrigin>;
      expect(() => captureLectureScene(api)).toThrow();
    },
  );

  it('preserves the source of a static extraction-case view after its scenario is gone', () => {
    const source = { kind: 'case', id: 'anchorage-space-closure' } as const;
    const prepared = createTeachingCase(modelCopy(), source.id);
    const api = captureApi();
    api.model = prepared.model;
    api.shown = structuredClone(prepared.transforms);
    api.scenario = null;
    const captured = captureLectureScene(api, source);
    const first = lectureStepSnapshot(createLectureStep(captured), snapshot());
    const ids = first.lesson.model.teeth.map(tooth => tooth.id);
    expect(captured.source).toEqual(source);
    expect(ids).not.toContain('14');
    expect(ids).not.toContain('24');
    expect(first.lesson.model.teeth.map(tooth => tooth.position)).toEqual(
      prepared.model.teeth.map(tooth => tooth.position),
    );
    expect(first.lesson.model.gums.map(gum => gum.position)).toEqual(
      prepared.model.gums.map(gum => gum.position),
    );
    api.model = first.lesson.model;
    api.shown = first.history.current;
    const recaptured = captureLectureScene(api, source);
    expect(recaptured.source).toEqual(source);
    expect(recaptured.transforms).toEqual(captured.transforms);
  });

  it('rebases complete mechanics reference data while retaining the configuration and stages', () => {
    const api = captureApi();
    let mechanics = createMechanicsExperiment(api.model);
    mechanics = transitionMechanics(mechanics, {
      type: 'brackets',
      teeth: ['11', '21'],
      installed: true,
    });
    mechanics = transitionMechanics(mechanics, {
      type: 'wire',
      id: 'wire-1',
      teeth: ['11', '21'],
      material: 'stainless-steel',
      section: { shape: 'round', diameterMm: 0.35 },
      expansionMm: 0.1,
    });
    mechanics = transitionMechanics(mechanics, { type: 'save-stage', label: 'First setup' });
    const computed = solveMechanics(mechanics);
    mechanics = { ...mechanics, result: computed, applied: computed, comparison: computed };
    api.mechanics = mechanics;
    api.shown = { '11': { translation: [1.5, 0.2, 0], rotation: [0, 5, 0] } };
    const before = structuredClone(mechanics),
      captured = captureLectureScene(api);
    const expected = createMechanicsExperiment(api.model, api.shown);
    expect(before.result).not.toBeNull();
    expect(captured.mechanics!.reference).toEqual(expected.reference);
    expect(captured.mechanics!.reference).not.toEqual(before.reference);
    expect(captured.mechanics).toMatchObject({
      config: before.config,
      stages: before.stages,
      stageIndex: before.stageIndex,
      result: null,
      applied: null,
      comparison: null,
    });
    expect(validateLectureScene(captured)).toEqual(captured);
    expect(api.mechanics).toEqual(before);
  });
});

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
    const step = createLectureSample(fixtureScene()).steps[1];
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
