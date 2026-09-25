import type { DentalCase } from './geometry';
import { WORKFLOWS, getWorkflowFrame, type WorkflowFrame, type WorkflowStep } from './workflows';
import { applyDentalCommand, type Transforms } from './model';
import type { TeachingAction } from './lecture';
import type { AnatomyViewState } from './teaching-anatomy';

const anatomySteps: WorkflowStep[] = [
  {
    title: 'Explore the tooth and socket',
    action: 'Inspect the labelled cutaway',
    explanation:
      'The crown and root belong to the tooth. Gingiva surrounds its neck; the periodontal ligament connects the root covering to the supporting alveolar bone. The coloured ligament sleeve is enlarged for visibility.',
    observe:
      'Locate the crown, root, gingiva, ligament and supporting bone. Orbit to inspect the open section.',
    question: 'Is the coloured ligament sleeve drawn at its true thickness?',
    answer: 'No. It is deliberately exaggerated to make the relationship visible in a lecture.',
    phase: 'assessment',
    view: 'perspective',
    arch: 'upper',
    arrows: false,
    palate: false,
  },
  {
    title: 'Demonstrate translation',
    action: 'Move the whole tooth sideways without rotating it',
    explanation:
      'Translation gives each point the same displacement while maintaining orientation. The root and crown move together. The fixed socket and enlarged ligament are reference illustrations; they do not calculate living tissue response.',
    observe:
      'Watch the crown and root shift mesially across the front view by the same amount. Use the original overlay to compare their positions.',
    question: 'Does the root remain stationary during translation?',
    answer: 'No. In this geometric example the root and crown have the same displacement.',
    phase: 'movement',
    view: 'front',
    arch: 'upper',
    arrows: false,
    palate: false,
  },
  {
    title: 'Demonstrate tipping',
    action: 'Rotate the tooth about an illustrative pivot',
    explanation:
      'An angular change alters the tooth orientation, so its points have different displacements. This example rotates about the existing crown-centre geometric pivot, not a calculated centre of resistance.',
    observe:
      'Compare root and crown movement. Turn on the original overlay to make the angular difference visible.',
    question: 'Does the animation identify the clinical centre of resistance?',
    answer: 'No. The pivot is chosen to demonstrate geometry and does not solve a force system.',
    phase: 'movement',
    view: 'front',
    arch: 'upper',
    arrows: false,
    palate: false,
  },
  {
    title: 'Compare and discuss',
    action: 'Compare translation with tipping',
    explanation:
      'Translation preserves orientation; tipping changes it. Return to either movement step to replay it, or make a temporary variation with an explicit tooth movement. Return to the lesson restores its authored setup.',
    observe:
      'Use the Translation and Tipping buttons to compare the same tooth, then repeat more slowly.',
    question: 'Can visible crown displacement alone describe the entire movement?',
    answer:
      'No. Root displacement and orientation also matter, and a geometric model does not establish the biological response.',
    phase: 'retention',
    view: 'front',
    arch: 'upper',
    arrows: false,
    palate: false,
  },
];
const anatomyDefinition = {
  id: 'anatomy',
  title: 'Inside a tooth: translation and tipping',
  learningGoal:
    'Identify the tissues around a tooth, then compare displacement with a change in orientation.',
  steps: anatomySteps,
  sources: [
    {
      title: 'NIDCR: tooth and supporting-tissue anatomy',
      url: 'https://www.nidcr.nih.gov/sites/default/files/2021-04/Open-Wide-and-Trek-Inside.pdf',
    },
  ],
};
export type WorkflowScene = {
  id: string;
  step: number;
  progress: number;
  playing: boolean;
  speed: 0.5 | 1 | 2;
  selected: string[];
  arch: 'upper' | 'lower' | 'both';
  view: 'front' | 'right' | 'left' | 'occlusal' | 'perspective';
  roots: boolean;
  gums: boolean;
  labels: boolean;
  arrows: boolean;
  ghost: boolean;
  braces: boolean;
  attachments: boolean;
  anatomy: AnatomyViewState;
  variation: Transforms | null;
  model: DentalCase;
  stages: number;
};
export const classroomDefinition = (id: string) =>
  id === 'anatomy' ? anatomyDefinition : WORKFLOWS.find(item => item.id === id) || WORKFLOWS[0];
export function initialWorkflowScene(model: DentalCase, id = 'fixed-braces'): WorkflowScene {
  const step = classroomDefinition(id).steps[0];
  return {
    id,
    step: 0,
    progress: 0,
    playing: false,
    speed: 1,
    selected: ['11'],
    arch: step.arch,
    view: step.view,
    roots: id === 'anatomy',
    gums: id !== 'palatal-expansion',
    labels: false,
    arrows: true,
    ghost: false,
    braces: id !== 'anatomy',
    attachments: false,
    anatomy: {
      bone: id === 'anatomy',
      opacity: 1,
      cutaway: id === 'anatomy',
      ligament: id === 'anatomy',
    },
    variation: null,
    model,
    stages: 10,
  };
}
export function workflowSceneFrame(s: WorkflowScene): WorkflowFrame {
  if (s.id !== 'anatomy')
    return getWorkflowFrame(s.id as 'fixed-braces', s.step, s.progress, s.model.teeth);
  const progress = s.step === 0 ? 0 : s.step === 3 ? 1 : s.progress;
  const transforms =
    progress === 0
      ? {}
      : applyDentalCommand(
          {},
          s.model.teeth,
          s.step === 1
            ? { type: 'move', tooth: '11', direction: 'mesial', amount: 1.2 * progress }
            : { type: 'orthodontic', teeth: ['11'], movement: 'tip', amount: 12 * progress },
        );
  return {
    transforms,
    appliance: 'braces',
    phase: anatomySteps[s.step].phase,
    progress,
    arrows: false,
    palate: false,
    selectedIds: ['11'],
  };
}
export function workflowSceneStep(
  s: WorkflowScene,
  index: number,
  base: DentalCase,
): WorkflowScene {
  const step = classroomDefinition(s.id).steps[index];
  if (!step)
    throw new Error(
      index < 0
        ? 'You are at the first step.'
        : 'This lesson is complete. Restart or choose another demonstration.',
    );
  const next = {
    ...s,
    step: index,
    progress: 0,
    playing: false,
    variation: null,
    model: base,
    arch: step.arch,
    view: step.view,
  };
  return next;
}
/** Pure scene changes support full-plan preflight and reversible classroom experiments. */
export function applyWorkflowAction(
  s: WorkflowScene,
  action: TeachingAction,
  base: DentalCase,
): WorkflowScene {
  if (action.kind === 'workflow') {
    if (action.action === 'start') return initialWorkflowScene(base, action.id);
    if (action.action === 'next') return workflowSceneStep(s, s.step + 1, base);
    if (action.action === 'previous') return workflowSceneStep(s, s.step - 1, base);
    if (action.action === 'restart') return workflowSceneStep(s, 0, base);
    if (action.action === 'pause') return { ...s, playing: false };
    if (action.action === 'play') {
      let next = s;
      if (classroomDefinition(s.id).steps[s.step].phase !== 'movement')
        next = workflowSceneStep(s, s.id === 'anatomy' ? 1 : 4, base);
      return {
        ...next,
        variation: null,
        playing: true,
        progress: next.progress >= 1 ? 0 : next.progress,
      };
    }
    if (action.action === 'phase') {
      if (s.id === 'anatomy')
        throw new Error('Choose an appliance workflow for that installation step.');
      const def = WORKFLOWS.find(item => item.id === s.id)!;
      return workflowSceneStep(
        s,
        action.phase === 'retention'
          ? def.retentionStepIndex
          : def.steps.findIndex(step => step.phase === action.phase),
        base,
      );
    }
    return s;
  }
  if (action.kind === 'anatomy-lesson') {
    const next =
      s.id === 'anatomy' ? { ...s, selected: ['11'] } : initialWorkflowScene(base, 'anatomy');
    return workflowSceneStep(
      next,
      action.action === 'translation' ? 1 : action.action === 'tipping' ? 2 : 0,
      base,
    );
  }
  if (action.kind === 'return-lesson') return workflowSceneStep(s, s.step, base);
  if (action.kind === 'lesson-step')
    return workflowSceneStep(
      s,
      action.action === 'restart' ? 0 : s.step + (action.action === 'next' ? 1 : -1),
      base,
    );
  if (action.kind === 'stop') return { ...s, playing: false };
  // Answer visibility belongs to the component's captured display state.
  if (action.kind === 'question') return s;
  if (action.kind === 'progress') {
    const index =
        classroomDefinition(s.id).steps[s.step].phase === 'movement'
          ? s.step
          : s.id === 'anatomy'
            ? 1
            : 4,
      next =
        index === s.step
          ? { ...s, variation: null, model: base }
          : workflowSceneStep(s, index, base);
    return { ...next, progress: action.value, playing: false };
  }
  if (action.kind === 'speed') return { ...s, speed: action.value };
  if (action.kind === 'anatomy')
    return {
      ...s,
      anatomy:
        action.action === 'opacity'
          ? { ...s.anatomy, bone: true, opacity: action.value }
          : {
              ...s.anatomy,
              [action.action]: action.visible,
              ...(action.action === 'cutaway' && action.visible
                ? { bone: true, ligament: true }
                : {}),
            },
      roots: action.action === 'cutaway' && action.visible ? true : s.roots,
      gums: action.action === 'cutaway' && action.visible ? true : s.gums,
    };
  if (action.kind === 'view')
    return {
      ...s,
      view: action.view,
      arch: action.view === 'occlusal' && s.arch === 'both' ? 'upper' : s.arch,
    };
  if (action.kind === 'arch')
    return {
      ...s,
      arch: action.arch,
      view: action.arch === 'both' && s.view === 'occlusal' ? 'perspective' : s.view,
    };
  if (action.kind === 'select' || action.kind === 'focus') {
    const selected = action.kind === 'focus' ? [action.tooth] : action.teeth,
      arches = new Set(selected.map(id => (Number(id[0]) < 3 ? 'upper' : 'lower')));
    return {
      ...s,
      selected,
      arch:
        arches.size > 1
          ? 'both'
          : s.arch === 'both'
            ? 'both'
            : Number(selected[0][0]) < 3
              ? 'upper'
              : 'lower',
    };
  }
  if (action.kind === 'toggle') {
    if (action.target === 'grid') return s;
    return { ...s, [action.target]: action.visible };
  }
  if (action.kind === 'comparison') {
    if (action.mode === 'overlay' || action.mode === 'off')
      return { ...s, ghost: action.mode === 'overlay' };
    const next = workflowSceneStep(s, s.id === 'anatomy' ? (s.step === 2 ? 2 : 1) : 4, base);
    return { ...next, progress: action.mode === 'after' ? 1 : 0 };
  }
  if (action.kind === 'stage') {
    const index =
      action.action === 'exact'
        ? action.stage
        : Math.round(workflowSceneFrame(s).progress * s.stages) +
          (action.action === 'next' ? 1 : -1);
    if (index < 0 || index > s.stages) throw new Error(`Choose a stage from 0 to ${s.stages}.`);
    return { ...s, progress: index / s.stages, playing: false };
  }
  if (action.kind === 'attachment') {
    const model = {
      ...s.model,
      teeth: s.model.teeth.map(tooth =>
        action.teeth.includes(tooth.id)
          ? {
              ...tooth,
              attachment:
                action.action === 'remove'
                  ? undefined
                  : {
                      shape: action.shape || 'rectangle',
                      width: 2.5,
                      height: 3.5,
                      depth: 1,
                      offsetMesial: 0,
                      offsetOcclusal: 0,
                      rotation: 0,
                    },
            }
          : tooth,
      ),
    };
    return {
      ...s,
      model,
      attachments: true,
      variation: s.variation || workflowSceneFrame(s).transforms,
    };
  }
  if (action.kind === 'dental') {
    const command = action.command;
    if (command.type === 'play')
      return applyWorkflowAction(s, { kind: 'workflow', action: 'play' }, base);
    if (command.type === 'ghost') return { ...s, ghost: command.visible };
    if (command.type === 'appliance') return { ...s, braces: command.visible };
    if (command.type === 'stages') return { ...s, stages: command.count };
    if (command.type === 'undo' || command.type === 'redo') return s;
    const variation = applyDentalCommand(
        s.variation || workflowSceneFrame(s).transforms,
        s.model.teeth,
        command,
      ),
      selected =
        'teeth' in command ? command.teeth : 'tooth' in command ? [command.tooth] : s.selected;
    return { ...s, variation, selected, playing: false };
  }
  return s;
}
