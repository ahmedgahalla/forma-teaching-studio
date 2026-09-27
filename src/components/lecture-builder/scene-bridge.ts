import type { CaseStudioApi } from '../case/api';
import type { ClassroomSnapshot } from '../case/types';
import type { LectureScene, LectureStep, LectureSource } from '@/lib/lecture-documents';
import { lectureSceneModel, validateLectureScene } from '@/lib/lecture-documents';
import { createTryState } from '@/lib/try-mode';
import { createMechanicsExperiment } from '@/lib/mechanics';
import { getTeachingCase, sampleCaseDemonstration } from '@/lib/teaching-cases';

/** Store visible poses and model references, never renderer geometry or undo stacks. */
export function captureLectureScene(api: CaseStudioApi, source?: LectureSource): LectureScene {
  if (api.sandbox.pending || api.dragPreview || api.busy)
    throw new Error('Apply or discard the preview and finish loading before capturing this view.');
  if (!api.model.demo || api.workflowOrigin)
    throw new Error('Capture a synthetic workspace or attach a prepared example to this step.');
  const setup = api.session().lectureSetup!;
  const mechanics = api.mechanics
    ? {
        ...createMechanicsExperiment(api.model, api.shown),
        config: api.mechanics.config,
        stages: api.mechanics.stages,
        stageIndex: api.mechanics.stageIndex,
      }
    : undefined;
  return validateLectureScene({
    source: api.scenario
      ? { kind: 'case', id: api.scenario.caseId }
      : (source ??
        (api.dentalArrangement
          ? { kind: 'arrangement', id: api.dentalArrangement.id }
          : { kind: 'reference' })),
    transforms: structuredClone(api.shown),
    setup: { ...setup, stage: 10, mechanicsResponse: false, reverse: false },
    roots: api.roots,
    braces: api.braces,
    attachments: api.attachments,
    bracketStyle: api.bracketStyle,
    ligatureColor: api.ligatureColor,
    applianceDisplay: api.applianceDisplay,
    isolated: api.isolated,
    ...(api.toothStudy
      ? { toothStudy: { tooth: api.toothStudy.tooth, view: api.toothStudy.view } }
      : {}),
    attachmentsByTooth: Object.fromEntries(
      api.model.teeth.filter(t => t.attachment).map(t => [t.id, t.attachment]),
    ),
    ...(mechanics ? { mechanics } : {}),
  });
}

/** Build an absolute scene. Loading the same step twice cannot accumulate movement. */
export function lectureStepSnapshot(step: LectureStep, base: ClassroomSnapshot): ClassroomSnapshot {
  const scene = validateLectureScene(step.scene),
    model = lectureSceneModel(scene);
  const setup = scene.setup;
  const definition = step.demo ? getTeachingCase(step.demo.caseId) : null;
  const variant = definition?.variants.find(item => item.id === step.demo?.variantId);
  if (step.demo && !variant) throw new Error('This demonstration is no longer available.');
  const transforms = step.demo
    ? sampleCaseDemonstration(step.demo.caseId, step.demo.variantId, 0)
    : structuredClone(scene.transforms);
  const selectedIds = [...setup.selectedIds];
  const prior = {
    camera: setup.camera,
    selected: selectedIds[0],
    selectedIds,
    isolated: scene.isolated,
    roots: scene.roots,
    gums: setup.gums,
    labels: setup.labels,
    arch: setup.arch,
    view: setup.view,
    anatomy: { ...setup.anatomy },
  };
  const toothStudy = scene.toothStudy
    ? {
        ...scene.toothStudy,
        model,
        prior,
        revision: 0,
        explanationVisible: false,
      }
    : null;
  return {
    ...base,
    toothStudy,
    glossaryId: null,
    mechanics: scene.mechanics ?? null,
    wirePreset: setup.wirePreset,
    magnification: setup.magnification,
    forceVectors: setup.forceVectors,
    predictResponse: false,
    responseRevealed: true,
    pointed: null,
    mechanicsFocus: {},
    scenario:
      step.demo && definition
        ? {
            caseId: definition.id,
            variantId: step.demo.variantId,
            model,
            returnProgress: 0,
            exploring: false,
            answerVisible: false,
          }
        : null,
    applianceDisplay: variant?.appliance ?? scene.applianceDisplay,
    workflowOrigin: null,
    returnWorkspace: null,
    sandbox: { ...createTryState(transforms, transforms), active: !step.demo },
    comparisonName: null,
    traces: false,
    curveVisible: false,
    reverse: false,
    lesson: {
      model,
      transforms,
      selected: selectedIds[0],
      selectedIds,
      arch: setup.arch,
      view: setup.view,
      ghost: false,
      roots: scene.roots,
      braces: variant
        ? variant.appliance.preset !== 'none' || !!variant.removableRetainer
        : scene.braces,
      attachments: scene.attachments,
      gums: setup.gums,
      labels: setup.labels,
      grid: setup.grid,
      stage: step.demo ? 0 : 10,
      stages: 10,
      opening: setup.opening,
      toothStudy,
      isolated: scene.isolated,
      anatomy: setup.anatomy,
      camera: setup.camera,
    },
    history: { current: transforms, past: [], future: [] },
    checkpoints: [],
    speed: setup.playbackSpeed ?? 1,
    anatomy: setup.anatomy,
    camera: setup.camera,
    lessonId: '',
    lessonStep: -1,
    lessonSnapshots: [],
    bracketStyle: scene.bracketStyle,
    ligatureColor: scene.ligatureColor,
    lecture: false,
    isolated: scene.isolated,
    tool: 'orbit',
    measureTo: '',
    measureMode: false,
    landmarks: [],
  };
}
