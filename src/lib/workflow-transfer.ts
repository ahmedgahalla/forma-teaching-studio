import type { DentalCase } from './geometry';
import { anatomicalFrame, isPose, type Transforms, type Vec3 } from './model';
import { WORKFLOWS } from './workflows';
import { classroomDefinition, workflowSceneFrame, type WorkflowScene } from './workflow-scene';
import type { WorkflowViewState } from './workflow-appliances';
import type { AnatomyViewState } from './teaching-anatomy';
import { createTryState, type TryState } from './try-mode';

export type WorkflowTransfer = {
  model: DentalCase;
  transforms: Transforms;
  selectedIds: string[];
  source: {
    workflowId: string;
    step: number;
    progress: number;
    variation: boolean;
    label: string;
    title: string;
    stepTitle: string;
    explanation: string;
    question: string;
    answer: string;
    sources: { title: string; url: string }[];
  };
  display: {
    arch: WorkflowScene['arch'];
    view: WorkflowScene['view'];
    roots: boolean;
    gums: boolean;
    labels: boolean;
    ghost: boolean;
    braces: boolean;
    attachments: boolean;
    anatomy: AnatomyViewState;
    workflowOverlay?: WorkflowViewState;
  };
};

const sameVector = (a: Vec3 | undefined, b: Vec3 | undefined) =>
  a === undefined || b === undefined
    ? a === b
    : a.length === 3 &&
      b.length === 3 &&
      a.every((value, i) => Number.isFinite(value) && value === b[i]);

/**
 * preparedBase is the caller-owned fresh demo used to start this workflow.
 * Reference identity deliberately excludes imported, rebaked, or replacement meshes.
 * Attachment metadata and pose variations are allowed; canonical geometry is immutable.
 */
export function assertPreparedWorkflowCompatible(
  model: DentalCase,
  preparedBase: DentalCase,
): void {
  const fail = () => {
    throw new Error(
      'This arrangement no longer uses its prepared workflow geometry. Open a fresh prepared workflow before transferring it.',
    );
  };
  if (
    !model.demo ||
    !preparedBase.demo ||
    !preparedBase.teeth.length ||
    model.teeth.length !== preparedBase.teeth.length ||
    model.gums.length !== preparedBase.gums.length
  )
    fail();
  const reference = new Map(preparedBase.teeth.map(tooth => [tooth.id, tooth]));
  if (
    reference.size !== preparedBase.teeth.length ||
    new Set(model.teeth.map(tooth => tooth.id)).size !== model.teeth.length
  )
    fail();
  for (const tooth of model.teeth) {
    const base = reference.get(tooth.id);
    if (
      !base ||
      tooth.geometry !== base.geometry ||
      tooth.rootGeometry !== base.rootGeometry ||
      !tooth.calibrated ||
      !base.calibrated ||
      !sameVector(tooth.position, base.position) ||
      !sameVector(tooth.buccal, base.buccal) ||
      !sameVector(tooth.mesial, base.mesial) ||
      !sameVector(tooth.occlusal, base.occlusal) ||
      !sameVector(tooth.bracketPosition, base.bracketPosition)
    )
      fail();
    anatomicalFrame(tooth);
  }
  const gums = new Map(preparedBase.gums.map(gum => [gum.id, gum]));
  if (
    gums.size !== preparedBase.gums.length ||
    new Set(model.gums.map(gum => gum.id)).size !== model.gums.length
  )
    fail();
  for (const gum of model.gums) {
    const base = gums.get(gum.id);
    if (
      !base ||
      gum.geometry !== base.geometry ||
      gum.arch !== base.arch ||
      !sameVector(gum.position, base.position)
    )
      fail();
  }
}

function copiedPoses(transforms: Transforms, model: DentalCase): Transforms {
  const available = new Set(model.teeth.map(tooth => tooth.id));
  if (
    !transforms ||
    typeof transforms !== 'object' ||
    Array.isArray(transforms) ||
    Object.keys(transforms).length > 32 ||
    Object.entries(transforms).some(
      ([id, pose]) =>
        !available.has(id) ||
        !isPose(pose) ||
        [...pose.translation, ...pose.rotation].some(value => Math.abs(value) > 1e5),
    )
  ) {
    throw new Error('The displayed workflow contains invalid tooth poses.');
  }
  return structuredClone(transforms);
}

/** Runtime packet: pose/metadata copies own their data; immutable meshes stay borrowed. */
export function captureWorkflowArrangement(
  scene: WorkflowScene,
  preparedBase: DentalCase,
): WorkflowTransfer {
  assertPreparedWorkflowCompatible(scene.model, preparedBase);
  if (scene.id !== 'anatomy' && !WORKFLOWS.some(workflow => workflow.id === scene.id))
    throw new Error('Choose a supported prepared workflow.');
  const definition = classroomDefinition(scene.id),
    step = definition.steps[scene.step];
  if (
    !Number.isInteger(scene.step) ||
    !step ||
    !Number.isFinite(scene.progress) ||
    scene.progress < 0 ||
    scene.progress > 1
  )
    throw new Error('The workflow step or progress is invalid.');
  if (
    !['upper', 'lower', 'both'].includes(scene.arch) ||
    !['front', 'right', 'left', 'occlusal', 'perspective'].includes(scene.view)
  )
    throw new Error('The workflow view is invalid.');
  if (
    ![
      scene.roots,
      scene.gums,
      scene.labels,
      scene.ghost,
      scene.braces,
      scene.attachments,
      scene.arrows,
      scene.anatomy.bone,
      scene.anatomy.cutaway,
      scene.anatomy.ligament,
    ].every(value => typeof value === 'boolean') ||
    !Number.isFinite(scene.anatomy.opacity) ||
    scene.anatomy.opacity < 0 ||
    scene.anatomy.opacity > 1
  )
    throw new Error('The workflow display settings are invalid.');
  const available = new Set(scene.model.teeth.map(tooth => tooth.id));
  if (
    !scene.selected.length ||
    scene.selected.length > 32 ||
    new Set(scene.selected).size !== scene.selected.length ||
    scene.selected.some(id => !available.has(id))
  )
    throw new Error('The workflow selection is invalid.');
  const frame = workflowSceneFrame(scene),
    transforms = copiedPoses(scene.variation ?? frame.transforms, scene.model);
  const model: DentalCase = {
    name: scene.model.name,
    demo: true,
    teeth: scene.model.teeth.map(tooth => {
      const { geometry, rootGeometry, ...metadata } = tooth;
      return { ...structuredClone(metadata), geometry, rootGeometry };
    }),
    gums: scene.model.gums.map(gum => ({ ...gum, position: [...gum.position] as Vec3 })),
  };
  return {
    model,
    transforms,
    selectedIds: [...scene.selected],
    source: {
      workflowId: scene.id,
      step: scene.step,
      progress: frame.progress,
      variation: scene.variation !== null,
      label: `${definition.title} · ${step.title}${scene.variation !== null ? ' · temporary variation' : ''}`,
      title: definition.title,
      stepTitle: step.title,
      explanation: step.explanation,
      question: step.question,
      answer: step.answer,
      sources: definition.sources.map(source => ({ ...source })),
    },
    display: {
      arch: scene.arch,
      view: scene.view,
      roots: scene.roots,
      gums: scene.gums,
      labels: scene.labels,
      ghost: scene.ghost,
      braces: scene.braces,
      attachments: scene.attachments,
      anatomy: { ...scene.anatomy },
      ...(scene.id === 'anatomy'
        ? {}
        : {
            workflowOverlay: {
              appliance: frame.appliance,
              phase: frame.phase,
              progress: frame.progress,
              palate: frame.palate,
              arrows: frame.arrows && scene.arrows,
            },
          }),
    },
  };
}

/** Freeze the shown arrangement as an experiment; never rerun authored phases on it. */
export function createWorkflowTryState(transfer: WorkflowTransfer): TryState {
  const transforms = copiedPoses(transfer.transforms, transfer.model),
    state = createTryState(transforms);
  return {
    ...state,
    snapshots: [{ name: 'Workflow start', transforms: structuredClone(transforms) }],
  };
}
