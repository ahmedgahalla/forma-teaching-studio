import { CommandValidationError, UnrecognizedCommandError, validateCommand } from './commands';
import { normalizeSpeechCommand, parseTeachingCommand, type TeachingAction } from './lecture';
import { WORKFLOWS } from './workflows';
import { validateTryAction, type TryAction } from './try-mode';
import { TEACHING_CASES } from './teaching-cases';
import { advanceMechanicsContext, isMechanicsClause, isMechanicsSolveClause, planMechanicsClause, sameMechanicsIntent, type MechanicsCommandContext, type PointedReference } from './mechanics-commands';
import { validateMechanicsAction } from './mechanics/validation';
import type { MechanicsAction } from './mechanics/types';

export type TeachingContext = {
  mode: 'case' | 'workflow'; workflowId: string | null; stepIndex: number;
  selected: string; selectedIds: string[]; availableIds: string[]; synthetic: boolean; revision: number;
  view: 'front' | 'right' | 'left' | 'occlusal' | 'perspective'; arch: 'upper' | 'lower' | 'both'; speed: 0.5 | 1 | 2;
  stage?: number; stages?: number; playing?: boolean; lessonActive?: boolean; canReturnToLesson?: boolean;
  canRestoreWorkspace?: boolean; hasWorkflowOrigin?: boolean;
  caseId?: string; caseVariantId?: string; caseExploring?: boolean;
  lastActions?: TeachingAction[];
  layers?: Partial<Record<'roots' | 'gums' | 'braces' | 'labels' | 'grid' | 'attachments' | 'bone' | 'cutaway' | 'ligament', boolean>>;
  boneOpacity?: number;
  tryMode?: boolean; lockedIds?: string[]; tryPreview?: boolean; tryLastMovement?: boolean; tryLastIds?: string[];
  savedArrangementNames?: string[];
  tryArchTargets?: Partial<Record<'upper' | 'lower', { width: number; depth: number }>>;
  pointed?: PointedReference; mechanics?: MechanicsCommandContext; autoApply?: boolean;
};
export type TeachingPlan = { actions: TeachingAction[]; summary: string; clarification: string | null };
export type PlanValidationOptions = { sourceText?: string; expectedRevision?: number; allowLocalActions?: boolean };
const DEMO_IDS = [1, 2, 3, 4].flatMap(q => Array.from({ length: 7 }, (_, i) => `${q}${i + 1}`));
const VIEWS = ['front', 'right', 'left', 'occlusal', 'perspective'];
const PHASES = ['assessment', 'brackets', 'wire', 'forces', 'movement', 'retention'];

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('A teaching action must be an object.');
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw new Error('Missing or unexpected teaching action fields.');
}
function oneOf<T extends string | number>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new Error('Unsupported teaching action value.');
  return value as T;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Visibility must be true or false.');
  return value;
}
function toothIds(value: unknown, context: TeachingContext): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 32 || new Set(value).size !== value.length || value.some(id => typeof id !== 'string' || !/^[1-4][1-8]$/.test(id) || !context.availableIds.includes(id))) throw new Error('Choose unique tooth IDs present in the current teaching model.');
  return [...value];
}

/** Strict external action schema; never pass provider output directly to a scene executor. */
function validateAction(value: unknown, context: TeachingContext): TeachingAction {
  const action = record(value), only = (...names: string[]) => fields(action, ['kind', ...names]);
  switch (action.kind) {
    case 'mechanics': only('action'); return { kind: 'mechanics', action: validateMechanicsAction(action.action) };
    case 'dental-arrangement': only('id'); return { kind: 'dental-arrangement', id: oneOf(action.id, ['dental-class-i', 'dental-class-ii-division-1', 'dental-class-ii-division-2', 'dental-class-iii'] as const) };
    case 'case': {
      if (action.action === 'load' || action.action === 'variant') {
        only('action', 'id');
        if (typeof action.id !== 'string') throw new Error('Choose an authored teaching case or variation.');
        return { kind: 'case', action: action.action, id: action.id };
      }
      if (action.action === 'progress') {
        only('action', 'value');
        if (typeof action.value !== 'number' || !Number.isFinite(action.value) || action.value < 0 || action.value > 1) throw new Error('Set prepared case progress between 0 and 1.');
        return { kind: 'case', action: 'progress', value: action.value };
      }
      only('action'); return { kind: 'case', action: oneOf(action.action, ['play', 'pause', 'reset', 'explore', 'return'] as const) };
    }
    case 'workspace': only('action'); return { kind: 'workspace', action: oneOf(action.action, ['explore', 'restore', 'lesson'] as const) };
    case 'appliance-display': {
      fields(action, ['kind', 'preset'], ['progress', 'palate']);
      const display: Extract<TeachingAction, { kind: 'appliance-display' }> = { kind: 'appliance-display', preset: oneOf(action.preset, ['none', 'brackets', 'braces', 'expander-bands', 'palatal-expander', 'retainer'] as const) };
      if (Object.hasOwn(action, 'progress')) {
        if (typeof action.progress !== 'number' || !Number.isFinite(action.progress) || action.progress < 0 || action.progress > 1) throw new Error('Appliance illustration progress must be between 0 and 1.');
        display.progress = action.progress;
      }
      if (Object.hasOwn(action, 'palate')) display.palate = boolean(action.palate);
      return display;
    }
    case 'try': only('action'); return { kind: 'try', action: validateTryAction(action.action, context.availableIds) };
    case 'try-display': only('target', 'visible'); return { kind: 'try-display', target: oneOf(action.target, ['traces', 'curve'] as const), visible: boolean(action.visible) };
    case 'try-playback': only('direction'); return { kind: 'try-playback', direction: oneOf(action.direction, ['forward', 'reverse'] as const) };
    case 'history':
      only('action', 'count');
      if (typeof action.count !== 'number' || !Number.isInteger(action.count) || action.count < 1 || action.count > 10) throw new Error('Undo or redo between 1 and 10 complete requests.');
      return { kind: 'history', action: oneOf(action.action, ['undo', 'redo'] as const), count: action.count };
    case 'dental': {
      only('command'); const command = record(action.command);
      if ('teeth' in command) toothIds(command.teeth, context);
      return { kind: 'dental', command: validateCommand(command, context.selected, context.availableIds, context.selectedIds) };
    }
    case 'select': only('teeth'); return { kind: 'select', teeth: toothIds(action.teeth, context) };
    case 'focus': only('tooth'); return { kind: 'focus', tooth: toothIds([action.tooth], context)[0] };
    case 'view': only('view'); return { kind: 'view', view: oneOf(action.view, VIEWS) as TeachingContext['view'] };
    case 'arch': only('arch'); return { kind: 'arch', arch: oneOf(action.arch, ['upper', 'lower', 'both'] as const) };
    case 'toggle': only('target', 'visible'); return { kind: 'toggle', target: oneOf(action.target, ['braces', 'roots', 'gums', 'labels', 'grid', 'attachments'] as const), visible: boolean(action.visible) };
    case 'comparison': only('mode'); return { kind: 'comparison', mode: oneOf(action.mode, ['before', 'after', 'overlay', 'off'] as const) };
    case 'stage':
      if (action.action === 'exact') {
        only('action', 'stage');
        if (typeof action.stage !== 'number' || !Number.isInteger(action.stage) || action.stage < 0 || action.stage > 50) throw new Error('Choose a display stage from 0 to 50.');
        return { kind: 'stage', action: 'exact', stage: action.stage };
      }
      only('action'); return { kind: 'stage', action: oneOf(action.action, ['next', 'previous'] as const) };
    case 'stop': case 'return-lesson': only(); return { kind: action.kind };
    case 'lecture': only('enabled'); return { kind: 'lecture', enabled: boolean(action.enabled) };
    case 'lesson-step': only('action'); return { kind: 'lesson-step', action: oneOf(action.action, ['next', 'previous', 'restart'] as const) };
    case 'workflow':
      if (action.action === 'start') {
        only('action', 'id'); return { kind: 'workflow', action: 'start', id: oneOf(action.id, WORKFLOWS.map(w => w.id)) };
      }
      if (action.action === 'phase') {
        only('action', 'phase'); return { kind: 'workflow', action: 'phase', phase: oneOf(action.phase, PHASES) as Extract<TeachingAction, { kind: 'workflow'; action: 'phase' }>['phase'] };
      }
      only('action'); return { kind: 'workflow', action: oneOf(action.action, ['next', 'previous', 'restart', 'play', 'pause', 'exit'] as const) };
    case 'anatomy':
      if (action.action === 'opacity') {
        only('action', 'value');
        if (typeof action.value !== 'number' || !Number.isFinite(action.value) || action.value < 0 || action.value > 1) throw new Error('Use bone opacity from 0 to 1.');
        return { kind: 'anatomy', action: 'opacity', value: action.value };
      }
      only('action', 'visible'); return { kind: 'anatomy', action: oneOf(action.action, ['bone', 'cutaway', 'ligament'] as const), visible: boolean(action.visible) };
    case 'speed': only('value'); return { kind: 'speed', value: oneOf(action.value, [0.5, 1, 2] as const) };
    case 'narrate': only('target'); return { kind: 'narrate', target: oneOf(action.target, ['step', 'answer'] as const) };
    case 'question': only('visible'); return { kind: 'question', visible: boolean(action.visible) };
    case 'progress':
      only('value');
      if (typeof action.value !== 'number' || !Number.isFinite(action.value) || action.value < 0 || action.value > 1) throw new Error('Set demonstration progress between 0 and 1.');
      return { kind: 'progress', value: action.value };
    case 'replay': only('slower'); return { kind: 'replay', slower: boolean(action.slower) };
    case 'anatomy-lesson': only('action'); return { kind: 'anatomy-lesson', action: oneOf(action.action, ['start', 'translation', 'tipping'] as const) };
    case 'attachment': {
      if (action.action === 'remove') { only('action', 'teeth'); return { kind: 'attachment', action: 'remove', teeth: toothIds(action.teeth, context) }; }
      fields(action, ['kind', 'action', 'teeth'], ['shape']);
      oneOf(action.action, ['add']);
      return { kind: 'attachment', action: 'add', teeth: toothIds(action.teeth, context), shape: action.shape === undefined ? 'rectangle' : oneOf(action.shape, ['rectangle', 'ellipsoid', 'beveled'] as const) };
    }
    default: throw new Error('Unsupported classroom action.');
  }
}

function copyContext(context: TeachingContext): TeachingContext {
  if (!Number.isInteger(context.revision) || context.revision < 0 || !Array.isArray(context.availableIds) || !context.availableIds.length || context.availableIds.length > 32 || new Set(context.availableIds).size !== context.availableIds.length || context.availableIds.some(id => !/^[1-4][1-8]$/.test(id))) throw new Error('Invalid teaching context.');
  if (!context.availableIds.includes(context.selected) || context.selectedIds.some(id => !context.availableIds.includes(id)) || new Set(context.selectedIds).size !== context.selectedIds.length) throw new Error('The teaching selection is stale.');
  if (context.mode !== 'case' && context.mode !== 'workflow') throw new Error('Invalid teaching mode.');
  if (context.caseId !== undefined) {
    const definition = TEACHING_CASES.find(item => item.id === context.caseId);
    if (!definition || context.caseVariantId !== undefined && !definition.variants.some(item => item.id === context.caseVariantId)) throw new Error('The prepared case context is stale or unsupported.');
  } else if (context.caseVariantId !== undefined || context.caseExploring === true) throw new Error('Load a prepared case before referring to its variation.');
  if (context.caseExploring !== undefined && typeof context.caseExploring !== 'boolean') throw new Error('Invalid prepared case exploration state.');
  if (context.mode === 'workflow') {
    const count = context.workflowId === 'anatomy' ? 4 : WORKFLOWS.find(w => w.id === context.workflowId)?.steps.length;
    if (!count || !Number.isInteger(context.stepIndex) || context.stepIndex < 0 || context.stepIndex >= count) throw new Error('The workflow context is stale or unsupported.');
  }
  if (context.lockedIds && (context.lockedIds.some(id => !context.availableIds.includes(id)) || new Set(context.lockedIds).size !== context.lockedIds.length)) throw new Error('The locked tooth selection is stale.');
  if (context.pointed && (!context.availableIds.includes(context.pointed.tooth) || (context.pointed.surface !== undefined && !['crown', 'root', 'gingiva'].includes(context.pointed.surface)) || [context.pointed.localPoint, context.pointed.worldPoint].some(point => !Array.isArray(point) || point.length !== 3 || point.some(value => !Number.isFinite(value))))) throw new Error('Point to a valid location in the current model.');
  return { ...context, selectedIds: [...context.selectedIds], availableIds: [...context.availableIds], layers: { ...context.layers }, lockedIds: [...(context.lockedIds || [])], tryLastIds: context.tryLastIds && [...context.tryLastIds], savedArrangementNames: [...(context.savedArrangementNames || [])], tryArchTargets: { ...context.tryArchTargets }, ...(context.pointed ? { pointed: structuredClone(context.pointed) } : {}), ...(context.mechanics ? { mechanics: structuredClone(context.mechanics) } : {}) };
}

type Overrides = { arch: boolean; view: boolean; selection: boolean };
/** Advance a private preflight context; no scene, mesh, or caller state is changed. */
function advance(context: TeachingContext, action: TeachingAction, overrides: Overrides) {
  const workflow = () => {
    if (context.mode === 'workflow' && context.workflowId === 'anatomy') return { retentionStepIndex: -1, steps: ['assessment', 'movement', 'movement', 'comparison'].map(phase => ({ phase, arch: 'upper' as const, view: context.view })) };
    const definition = WORKFLOWS.find(w => context.mode === 'workflow' && w.id === context.workflowId);
    if (!definition) throw new Error('Start a teaching workflow first.');
    return definition;
  };
  const step = (index: number) => {
    const definition = workflow(), next = definition.steps[index];
    if (!next) throw new Error('That step is outside the current workflow.');
    context.stepIndex = index;
    if (!overrides.arch) context.arch = next.arch;
    if (!overrides.view) context.view = next.view;
    context.playing = false;
  };
  const select = (ids: string[]) => { context.selectedIds = [...ids]; context.selected = ids[0]; overrides.selection = true; };
  const previewSelection = (ids: string[]) => {
    const locked = ids.filter(id => context.lockedIds?.includes(id));
    if (locked.length) throw new Error(`Unlock ${locked.join(', ')} before changing its pose.`);
    select(ids); context.tryLastIds = [...ids]; context.stage = 0;
  };
  if (action.kind === 'dental-arrangement') {
    if (context.mode === 'case' && context.tryPreview) throw new Error('Apply or discard the preview before loading a dental arrangement.');
    context.mode = 'case'; context.synthetic = true; context.availableIds = [...DEMO_IDS]; context.workflowId = null; context.playing = false;
  } else if (action.kind === 'mechanics') {
    advanceMechanicsContext(context, action.action);
  } else if (action.kind === 'case') {
    if (action.action !== 'pause' && context.tryPreview) throw new Error('Apply or discard the preview before changing the prepared case.');
    if (action.action === 'load') {
      const definition = TEACHING_CASES.find(item => item.id === action.id);
      if (!definition) throw new Error('Choose a supported prepared teaching case.');
      context.mode = 'case'; context.workflowId = null; context.caseId = definition.id; context.caseVariantId = definition.variants[0].id; context.caseExploring = false; context.playing = false;
      return;
    }
    const definition = context.mode === 'case' && TEACHING_CASES.find(item => item.id === context.caseId);
    if (!definition) throw new Error('Load a prepared teaching case first.');
    if (action.action === 'variant' && !definition.variants.some(item => item.id === action.id)) throw new Error(`Choose an authored variation: ${definition.variants.map(item => item.title).join('; ')}.`);
    if (context.caseExploring && ['variant', 'play', 'reset', 'progress'].includes(action.action)) throw new Error('Return to the prepared case before changing its variation or playback.');
    if (action.action === 'variant') { context.caseVariantId = action.id; context.playing = false; }
    if (action.action === 'play') context.playing = true;
    if (action.action === 'pause' || action.action === 'reset' || action.action === 'progress') context.playing = false;
    if (action.action === 'explore') { if (context.caseExploring) throw new Error('This arrangement is already open for free exploration.'); context.caseExploring = true; context.playing = false; }
    if (action.action === 'return') { context.caseExploring = false; context.playing = false; }
  } else if (action.kind === 'workspace') {
    if (context.mode === 'case' && context.tryPreview) throw new Error('Apply or discard the preview before changing workspaces.');
    if (action.action === 'explore' && context.mode !== 'workflow') throw new Error('Open a teaching workflow before exploring its setup.');
    if (action.action === 'restore' && !context.canRestoreWorkspace) throw new Error('There is no saved workspace to restore.');
    if (action.action === 'lesson' && (context.mode !== 'case' || !context.hasWorkflowOrigin)) throw new Error('This workspace has no source lesson to return to.');
    // Transfers are standalone: the host restores the destination model and its context.
  } else if (action.kind === 'appliance-display') {
    if (context.mode !== 'case') throw new Error('Explore this setup in your workspace before placing a teaching appliance.');
    if (!context.synthetic && !['none', 'braces'].includes(action.preset)) throw new Error('This teaching appliance preset requires a synthetic model. Imported cases support braces or no appliance.');
  } else if (action.kind === 'try-display' || action.kind === 'try-playback') {
    if (context.mode !== 'case' || !context.tryMode) throw new Error('Enter Try Mode in your case before using its display controls.');
    if (action.kind === 'try-playback') { context.playing = true; context.stage = action.direction === 'reverse' ? 0 : context.stages ?? 10; }
  } else if (action.kind === 'try') {
    if (context.mode !== 'case') throw new Error('Return to your case before using Try Mode.');
    const edit = action.action;
    if (edit.type === 'enter') { context.tryMode = true; return; }
    if (!context.tryMode) throw new Error('Enter Try Mode before using this command.');
    if (edit.type === 'exit') { if (context.tryPreview) throw new Error('Apply or discard the preview before leaving Try Mode.'); context.tryMode = false; return; }
    if (edit.type === 'apply' || edit.type === 'cancel') {
      if (!context.tryPreview) throw new Error('Create a preview first.');
      context.tryPreview = false; context.stage = context.stages ?? 10;
      if (edit.type === 'apply' && context.tryLastIds?.some(id => context.lockedIds?.includes(id))) throw new Error('Unlock the previewed teeth before applying their movement.');
    } else if (edit.type === 'lock') {
      const locked = new Set(context.lockedIds);
      edit.teeth.forEach(id => edit.locked ? locked.add(id) : locked.delete(id)); context.lockedIds = [...locked];
    } else if (edit.type === 'set-arch') {
      context.tryArchTargets![edit.arch] = { width: edit.width, depth: edit.depth }; context.arch = edit.arch;
    } else if (edit.type === 'save-snapshot') {
      if (context.tryPreview) throw new Error('Apply or discard the preview before saving an arrangement.');
      if (!context.savedArrangementNames!.includes(edit.name)) context.savedArrangementNames!.push(edit.name);
    } else if (edit.type === 'delete-snapshot') {
      if (!context.savedArrangementNames!.includes(edit.name)) throw new Error('Name a saved arrangement in this case.');
      context.savedArrangementNames = context.savedArrangementNames!.filter(name => name !== edit.name);
    } else if (edit.type === 'compare-snapshot') {
      if (edit.name !== null && !context.savedArrangementNames!.includes(edit.name)) throw new Error('Name a saved arrangement in this case.');
    } else if (edit.type === 'preview-snapshot' || edit.type === 'preview-original') {
      if (edit.type === 'preview-snapshot' && !context.savedArrangementNames!.includes(edit.name)) throw new Error('Name a saved arrangement in this case.');
      if (context.tryPreview) throw new Error('Apply or discard the current preview before making another.');
      context.tryPreview = true; context.tryLastMovement = false; previewSelection(context.availableIds);
    } else if (edit.type === 'revise') {
      if (!context.tryLastMovement) throw new Error('Preview a numeric movement before changing its amount.');
      context.tryPreview = true;
      if (context.tryLastIds) previewSelection(context.tryLastIds);
    } else if (edit.type === 'preview') {
      if (context.tryPreview) throw new Error('Apply or discard the current preview before making another.');
      if (edit.edit.type === 'fit-arch' && (!context.synthetic || !context.tryArchTargets?.[edit.edit.arch])) throw new Error('Arch fitting requires a synthetic model and an explicit arch width and depth.');
      context.tryPreview = true;
      const operation = edit.edit;
      const ids = operation.type === 'dental' ? 'teeth' in operation.command ? operation.command.teeth : [operation.command.tooth] : operation.type === 'poses' ? Object.keys(operation.poses) : operation.type === 'close-gap' && operation.rule !== 'equal' ? [operation.teeth[operation.rule === 'first' ? 0 : 1]] : operation.teeth;
      previewSelection(ids);
      context.tryLastMovement = operation.type === 'dental' ? 'amount' in operation.command : ['segment-translate', 'segment-rotate', 'change-width'].includes(operation.type);
    }
  } else if (action.kind === 'workflow') {
    if (action.action === 'start') {
      context.mode = 'workflow'; context.workflowId = action.id; context.synthetic = true; context.availableIds = [...DEMO_IDS]; context.canReturnToLesson = true;
      if (overrides.selection) { if (!context.selectedIds.length || context.selectedIds.some(id => !DEMO_IDS.includes(id))) throw new Error('The selected teeth do not exist in the synthetic workflow.'); context.selected = context.selectedIds[0]; }
      else { context.selectedIds = ['11']; context.selected = '11'; }
      step(0); return;
    }
    const definition = workflow();
    if (action.action === 'exit') { context.mode = 'case'; context.workflowId = null; context.playing = false; return; }
    if (action.action === 'phase') step(action.phase === 'retention' ? definition.retentionStepIndex : definition.steps.findIndex(s => s.phase === action.phase));
    if (action.action === 'next') step(context.stepIndex + 1);
    if (action.action === 'previous') step(context.stepIndex - 1);
    if (action.action === 'restart') step(0);
    if (action.action === 'play') { if (definition.steps[context.stepIndex].phase !== 'movement') step(definition.steps.findIndex(s => s.phase === 'movement')); context.playing = true; }
    if (action.action === 'pause') context.playing = false;
  } else if (action.kind === 'anatomy-lesson') {
    context.mode = 'workflow'; context.workflowId = 'anatomy'; context.stepIndex = action.action === 'start' ? 0 : action.action === 'translation' ? 1 : 2; context.synthetic = true; context.availableIds = [...DEMO_IDS]; context.lessonActive = true; context.canReturnToLesson = true;
    select(['11']); context.arch = 'upper'; context.playing = false;
  } else if (action.kind === 'anatomy') {
    if (!context.synthetic && (action.action === 'opacity' || action.visible)) throw new Error('Anatomy layers require a synthetic teaching model. Imported cases have no reconstructed bone or ligament.');
    if (action.action === 'opacity') context.boneOpacity = action.value;
    else context.layers![action.action] = action.visible;
  } else if (action.kind === 'select') select(action.teeth);
  else if (action.kind === 'focus') select([action.tooth]);
  else if (action.kind === 'arch') { context.arch = action.arch; overrides.arch = true; }
  else if (action.kind === 'view') { context.view = action.view; overrides.view = true; }
  else if (action.kind === 'speed') context.speed = action.value;
  else if (action.kind === 'toggle') context.layers![action.target] = action.visible;
  else if (action.kind === 'stop') context.playing = false;
  else if (action.kind === 'progress') {
    if (context.mode === 'workflow') { const definition = workflow(); if (definition.steps[context.stepIndex].phase !== 'movement') step(definition.steps.findIndex(item => item.phase === 'movement')); }
    context.stage = action.value * (context.stages ?? 10); context.playing = false;
  }
  else if (action.kind === 'question') {
    if (context.mode !== 'workflow' && !context.caseId) throw new Error('Open a prepared teaching case or workflow with an authored question before revealing or hiding its answer.');
  }
  else if (action.kind === 'narrate') {
    if (context.mode !== 'workflow' && !context.lessonActive) throw new Error('Start a lesson or workflow before asking for its explanation.');
  } else if (action.kind === 'return-lesson') {
    if (!context.canReturnToLesson && context.mode !== 'workflow') throw new Error('There is no saved lesson to return to.');
  } else if (action.kind === 'replay') {
    if (context.mode !== 'workflow' && !context.lastActions?.length) throw new Error('There is no completed demonstration to repeat.');
    if (action.slower) context.speed = 0.5;
  } else if (action.kind === 'lesson-step') {
    if (context.mode === 'workflow') step(action.action === 'restart' ? 0 : context.stepIndex + (action.action === 'next' ? 1 : -1));
    else if (!context.lessonActive) throw new Error('Start a lesson before navigating its steps.');
  } else if (action.kind === 'stage') {
    if (context.mode === 'workflow') throw new Error('Use workflow steps in this demonstration.');
    const next = action.action === 'exact' ? action.stage : (context.stage ?? context.stages ?? 10) + (action.action === 'next' ? 1 : -1);
    if (next < 0 || next > (context.stages ?? 10)) throw new Error('That stage is outside the current demonstration.');
    context.stage = next;
  } else if (action.kind === 'attachment') {
    if (context.mode === 'workflow') context.canReturnToLesson = true;
  } else if (action.kind === 'dental') {
    const command = action.command;
    if (context.mode === 'case' && context.tryMode && ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(command.type)) {
      if (context.tryPreview) throw new Error('Apply or discard the current preview before making another.');
      context.tryPreview = true; context.tryLastMovement = 'amount' in command;
      previewSelection('teeth' in command ? command.teeth : 'tooth' in command ? [command.tooth] : []);
    }
    if (context.mode === 'workflow' && command.type === 'stages') throw new Error('Use workflow steps in this demonstration.');
    if (context.mode === 'workflow' && ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(command.type)) context.canReturnToLesson = true;
    if ('teeth' in command) select(command.teeth); else if ('tooth' in command) select([command.tooth]);
    if (command.type === 'stages') { context.stages = command.count; context.stage = command.count; }
    if (command.type === 'play') {
      if (context.mode === 'workflow') { const definition = workflow(); if (definition.steps[context.stepIndex].phase !== 'movement') step(definition.steps.findIndex(s => s.phase === 'movement')); }
      context.playing = true;
    }
  }
}

function auditNumbers(text: string, actions: TeachingAction[]) {
  const source = normalizeSpeechCommand(text).replace(/°/g, ' degrees');
  if (/\b(?:don't|do not|never|avoid|what if|should i|is it safe|prescribe|diagnose|treatment plan)\b/.test(source)) throw new Error('Give an explicit classroom action; hypothetical or clinical instructions are not executable commands.');
  const quantities = [...source.matchAll(/([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|degrees?|deg)\b/g)].map(m => ({ amount: Number(m[1]) * (m[2] === 'cm' ? 10 : 1), unit: /^(?:mm|cm)$/.test(m[2]) ? 'distance' : 'angle' }));
  for (const action of actions) if (action.kind === 'dental' && 'amount' in action.command) {
    const command = action.command, unit = command.type === 'move' || command.type === 'move_group' ? 'distance' : 'angle';
    const index = quantities.findIndex(q => q.unit === unit && Math.abs(q.amount - command.amount) < 1e-10);
    if (index < 0) throw new Error('Every tooth movement needs its explicit requested amount and unit; an interpreter cannot invent a value.');
    quantities.splice(index, 1);
  }
  const progressClauses = clauses(source).filter(clause => /\b(?:progress|halfway|percent)\b|%/.test(clause));
  for (const action of actions) if (action.kind === 'progress') {
    const index = progressClauses.findIndex(clause => {
      if (clause === 'pause halfway') return action.value === 0.5;
      const values = [...clause.matchAll(/(?<![\w.])([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(%|percent)?(?![\w.])/g)];
      return values.length === 1 && Math.abs(Number(values[0][1]) / (values[0][2] ? 100 : 1) - action.value) < 1e-10;
    });
    if (index < 0) throw new Error('Demonstration progress needs its requested fraction, percentage, or the explicit “pause halfway” preset.');
    progressClauses.splice(index, 1);
  }
}

/** Validate against CURRENT context; async callers pass the revision captured when requesting interpretation. */
export function validateTeachingPlan(value: unknown, context: TeachingContext, options: PlanValidationOptions = {}): TeachingPlan {
  if (options.expectedRevision !== undefined && options.expectedRevision !== context.revision) throw new Error('The teaching context changed. Repeat the request for the current scene.');
  const plan = record(value); fields(plan, ['actions', 'summary', 'clarification']);
  if (!Array.isArray(plan.actions) || plan.actions.length > 8 || typeof plan.summary !== 'string' || plan.summary.length > 600 || (plan.clarification !== null && (typeof plan.clarification !== 'string' || !plan.clarification.trim() || plan.clarification.length > 600))) throw new Error('Invalid classroom plan.');
  if (plan.clarification !== null) {
    if (plan.actions.length) throw new Error('A clarification cannot contain executable actions.');
    return { actions: [], summary: plan.summary, clarification: plan.clarification as string };
  }
  if (!plan.actions.length) throw new Error('A classroom plan needs at least one action.');
  const automatic = new Set<unknown>();
  let requestedActions = plan.actions;
  // Only text/voice requests opt in. Numeric controls and explicit previews remain reviewable.
  if (context.autoApply && context.mode === 'case' && context.tryMode && options.sourceText !== undefined && !clauses(normalizeSpeechCommand(options.sourceText)).some(clause => /^preview\b/.test(clause))) {
    requestedActions = [];
    for (const [index, raw] of plan.actions.entries()) {
      requestedActions.push(raw);
      const movement = raw?.kind === 'dental' && ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(raw.command?.type) || raw?.kind === 'try' && ['preview', 'revise'].includes(raw.action?.type);
      const applied = plan.actions[index + 1]?.kind === 'try' && plan.actions[index + 1]?.action?.type === 'apply';
      if (movement && !applied) { const apply = { kind: 'try', action: { type: 'apply' } }; requestedActions.push(apply); automatic.add(apply); }
    }
    if (requestedActions.length > 8) throw new Error('Use at most eight actions in one classroom request, including movement application.');
  }
  const next = copyContext(context), overrides = { arch: false, view: false, selection: false }, actions: TeachingAction[] = [];
  const sourceClauses = options.sourceText === undefined || options.allowLocalActions ? [] : clauses(normalizeSpeechCommand(options.sourceText));
  const mechanicsClauses = sourceClauses.map((text, index) => ({ text, index })).filter(clause => isMechanicsClause(clause.text));
  let mechanicsCursor = 0;
  let expectedMechanics: MechanicsAction[] = [];
  for (const [index, raw] of requestedActions.entries()) {
    const action = validateAction(raw, next);
    if (action.kind === 'mechanics' && action.action.type === 'stage' && requestedActions.length !== 1) throw new Error('Recall an experiment stage as a separate request, then give instructions for its setup.');
    if (action.kind === 'mechanics' && options.sourceText !== undefined && !options.allowLocalActions) {
      if (!expectedMechanics.length) {
        const source = mechanicsClauses[mechanicsCursor++];
        expectedMechanics = planMechanicsClause(source?.text || '', next) || [];
        // An adjacent explicit solve is satisfied by the replacement's required solve.
        if (source && expectedMechanics.length > 1 && expectedMechanics.at(-1)?.type === 'solve' && isMechanicsSolveClause(sourceClauses[source.index + 1] || '')) mechanicsCursor++;
      }
      if (!sameMechanicsIntent(expectedMechanics.shift(), action.action)) throw new Error('The appliance action must match the requested targets, explicit values or visible preset.');
    }
    if (['case', 'dental-arrangement', 'try', 'history', 'try-display', 'try-playback', 'workspace', 'appliance-display'].includes(action.kind) && !options.allowLocalActions && !automatic.has(raw)) throw new Error('Prepared cases, Try Mode mechanics, workspace transfers, appliance placement and counted history use local commands only.');
    if (action.kind === 'dental-arrangement' && requestedActions.length !== 1) throw new Error('Load a dental arrangement as a separate request, then give commands for its model.');
    if (action.kind === 'case' && plan.actions.length !== 1) throw new Error('Use a prepared case command as a separate request, then give commands for its arrangement.');
    if (action.kind === 'workspace' && plan.actions.length !== 1) throw new Error('Change workspaces as a separate request, then give commands for the destination model.');
    if (action.kind === 'history' && plan.actions.length !== 1) throw new Error('Use counted undo or redo as a separate request.');
    if (action.kind === 'dental' && ['undo', 'redo'].includes(action.command.type) && plan.actions.length !== 1) throw new Error('Use undo or redo as a separate request.');
    if (action.kind === 'replay' && plan.actions.length !== 1) throw new Error('Use replay as a separate request; say “repeat that more slowly” to change its speed.');
    const enteringTry = action.kind === 'workflow' && action.action === 'exit' && index === requestedActions.length - 2 && requestedActions[index + 1]?.kind === 'try' && requestedActions[index + 1]?.action?.type === 'enter';
    if ((action.kind === 'return-lesson' || action.kind === 'workflow' && action.action === 'exit') && index !== requestedActions.length - 1 && !enteringTry) throw new Error('Return to the lesson or case before giving another request.');
    advance(next, action, overrides); actions.push(action);
  }
  if (expectedMechanics.length || mechanicsCursor < mechanicsClauses.length && context.mode !== 'workflow') throw new Error('The plan omitted part of the requested appliance instructions.');
  if (options.sourceText !== undefined) auditNumbers(options.sourceText, actions);
  return { actions, summary: plan.summary, clarification: null };
}

const VERBS = '(?:load|choose|show|hide|highlight|select|focus|zoom|move|rotate|tip|torque|intrude|extrude|retract|protract|expand|constrict|distali[sz]e|mesiali[sz]e|reset|start|open|isolate|switch|install|bond|insert|engage|fit|activate|demonstrate|compare|play|animate|pause|stop|next|previous|restart|create|generate|add|remove|set|make|turn|repeat|replay|do|undo|redo|explain|narrate|read|reveal|return|go|back|lecture|enter|exit|end|leave|lock|unlock|close|change|increase|decrease|save|apply|accept|discard|cancel|try|explore|restore|place|put|connect|use|calculate|solve|fix|release|widen|attach|run|thread|replace|preview)';
function clauses(text: string): string[] {
  // Split only before an action verb: commas/"and" inside tooth lists and appliance names stay intact.
  return text.split(new RegExp(`(?:,\\s*(?:(?:and|then)\\s+)?|\\s+(?:and then|and|then)\\s+|[;.]\\s+)(?=${VERBS}\\b)`, 'i')).map(part => part.trim()).filter(Boolean);
}

const caseName = (text: string) => text.toLowerCase().replace(/[-·]/g, ' ').replace(/\s+/g, ' ').trim();
const caseControl = /^(?:(?:play|pause|reset|restart) (?:the )?(?:prepared )?case|(?:explore|try) this arrangement|return to (?:the )?prepared case|(?:set|show) (?:the )?case progress\b)/;
function isCaseClause(text: string, context: TeachingContext): boolean {
  return /^load\b|^(?:open|start) (?:a |the )?(?:prepared |teaching )?case\b|^choose\b/.test(text) || caseControl.test(text) ||
    !!context.caseId && context.mode === 'case' && !context.caseExploring && /^(?:(?:play|pause) demonstration|pause halfway)$/.test(text) ||
    !!context.caseId && context.mode === 'case' && /^(?:demonstrate\b|try this setup$|explore this setup$|(?:return|go back|back) to (?:the )?lesson$|(?:how (?:do|should) (?:i|we) )?(?:treat|correct|fix|recommend|suggest|plan)\b)/.test(text);
}

/** Case aliases select only catalog entries; selecting a variation never implies playback. */
function parseCaseAction(text: string, context: TeachingContext): Extract<TeachingAction, { kind: 'case' }> | undefined {
  if (!isCaseClause(text, context)) return undefined;
  const separate = () => { if (clauses(text).length > 1) throw new CommandValidationError('Use a prepared case command as a separate request, then give commands for its arrangement.'); };
  const load = text.match(/^(?:load|open|start) (?:(?:a|the) )?(?:(?:prepared|teaching) )?(?:case )?(.+?)(?: case)?$/);
  if (load) {
    const name = caseName(load[1]);
    const definition = TEACHING_CASES.find(item => [item.id, item.title, ...(item.aliases || [])].some(alias => caseName(alias) === name));
    if (definition) return { kind: 'case', action: 'load', id: definition.id };
    separate(); throw new CommandValidationError(`Choose a prepared case: ${TEACHING_CASES.map(item => item.aliases?.[0] || item.title).join(', ')}.`);
  }
  const control = text.match(/^(play|pause|reset|restart) (?:the )?(?:prepared )?case$/);
  if (control) return { kind: 'case', action: control[1] === 'restart' ? 'reset' : control[1] as 'play' | 'pause' | 'reset' };
  if (/^(play|pause) demonstration$/.test(text)) return { kind: 'case', action: text.startsWith('play') ? 'play' : 'pause' };
  if (text === 'pause halfway') return { kind: 'case', action: 'progress', value: 0.5 };
  if (/^(?:(?:explore|try) this arrangement|try this setup|explore this setup)$/.test(text)) return { kind: 'case', action: 'explore' };
  if (/^(?:return|go back|back) to (?:the )?(?:prepared case|lesson)$/.test(text)) return { kind: 'case', action: 'return' };
  const progress = text.match(/^(?:set|show) (?:the )?case progress (?:to )?([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|percent)?$/);
  if (progress) return { kind: 'case', action: 'progress', value: Number(progress[1]) / (progress[2] ? 100 : 1) };
  const definition = TEACHING_CASES.find(item => item.id === context.caseId);
  if (!definition || context.mode !== 'case') throw new CommandValidationError('Load a prepared teaching case before choosing its authored variation.');
  const requested = text.match(/^(?:demonstrate|choose) (?:the )?(?:variation |variant |approach )?(.+)$/);
  const movementAliases: Record<string, string[]> = { tip: ['tipping', 'crown tipping'], torque: ['torque'], 'axial-rotation': ['rotation'], 'anterior-intrusion': ['intrusion', 'incisor intrusion', 'anterior intrusion'] };
  const variant = requested && definition.variants.find(item => [item.id, item.title, ...(item.aliases || []), ...(movementAliases[item.id] || [])].some(alias => caseName(alias) === caseName(requested[1])));
  if (variant) return { kind: 'case', action: 'variant', id: variant.id };
  separate(); throw new CommandValidationError(`Choose an authored variation for ${definition.title}: ${definition.variants.map(item => item.title).join('; ')}. These are prepared teaching examples.`);
}

/** Destination routing and interpreter context are shared with the provider and unit-tested. */
export function teachingActionMode(action: TeachingAction, current: TeachingContext['mode']): TeachingContext['mode'] {
  if (action.kind === 'case' || action.kind === 'dental-arrangement' || action.kind === 'workflow' && action.action === 'exit') return 'case';
  if (action.kind === 'anatomy-lesson' || action.kind === 'workflow' && action.action === 'start') return 'workflow';
  return current;
}

export function interpreterTeachingContext(context: TeachingContext): TeachingContext {
  const wire = { ...context };
  for (const field of ['caseId', 'caseVariantId', 'caseExploring', 'tryMode', 'lockedIds', 'tryPreview', 'tryLastMovement', 'tryLastIds', 'savedArrangementNames', 'tryArchTargets', 'canRestoreWorkspace', 'hasWorkflowOrigin', 'autoApply'] as const) delete wire[field];
  if (wire.lastActions?.some(action => ['case', 'dental-arrangement', 'try', 'history', 'try-display', 'try-playback', 'workspace', 'appliance-display'].includes(action.kind))) delete wire.lastActions;
  return wire;
}

function isWorkspaceClause(text: string, context: TeachingContext) {
  return /^(?:try this setup|explore this setup|explore this lesson|restore my workspace|back to my saved case|return to source lesson)$/.test(text) ||
    context.mode === 'case' && context.hasWorkflowOrigin && /^(?:return|go back|back) to (?:the )?lesson$/.test(text);
}

function isApplianceClause(text: string) {
  return /^(?:place (?:brackets|braces|expander|palatal|fixed)|remove teaching appliance)\b/.test(text);
}

function isTryClause(text: string) {
  return /^(?:(?:enter|start|open|exit|leave) try(?: mode)?|return to (?:the )?try mode|(?:lock|unlock|close|save (?:arrangement|group)|change (?:the )?last movement|make (?:the )?last movement|halve (?:the )?last movement)|(?:move|rotate) (?:the )?(?:selected )?segment|(?:change|increase|decrease) (?:the )?width|fit .+ (?:to|onto) (?:the )?(?:(?:upper|lower) )?arch|(?:apply|accept|discard|cancel) (?:the )?preview|compare (?:with )?(?:the )?(?:original|saved|arrangement)|unrestricted (?:movement )?(?:on|off)|(?:show|hide) (?:the )?(?:displacement traces|arch curve)|play (?:in reverse|forward)|reverse animation|pause halfway)\b/.test(text);
}

/** Explicit geometric mechanics only; values and allocation rules are never guessed. */
function parseTryActions(text: string, context: TeachingContext): TeachingAction[] | undefined {
  if (!isTryClause(text)) return undefined;
  const wrap = (...actions: TryAction[]): TeachingAction[] => actions.map(action => ({ kind: 'try', action }));
  const select = (selector = 'selected teeth'): string[] => {
    const parsed = parseTeachingCommand(`select ${selector}`, context.selected, context.availableIds, context.selectedIds);
    if (parsed.kind !== 'select') throw new Error('Select the teeth for this preview.');
    return parsed.teeth;
  };
  const pair = (selector: string): [string, string] => {
    const teeth = select(selector);
    if (teeth.length !== 2) throw new Error('Select or name exactly two teeth; first and second follow the stated selection order.');
    return [teeth[0], teeth[1]];
  };
  const quantity = '([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))';
  if (/^return to (?:the )?try mode$/.test(text)) return context.mode === 'workflow' ? [{ kind: 'workflow', action: 'exit' }, ...wrap({ type: 'enter' })] : wrap({ type: 'enter' });
  const display = text.match(/^(show|hide) (?:the )?(displacement traces|arch curve)$/);
  if (display) return [{ kind: 'try-display', target: display[2] === 'arch curve' ? 'curve' : 'traces', visible: display[1] === 'show' }];
  if (/^(?:play in reverse|reverse animation|play forward)$/.test(text)) return [{ kind: 'try-playback', direction: text === 'play forward' ? 'forward' : 'reverse' }];
  if (text === 'pause halfway') {
    return [{ kind: 'progress', value: 0.5 }];
  }
  if (/^(?:enter|start|open) try(?: mode)?$/.test(text)) return wrap({ type: 'enter' });
  if (/^(?:exit|leave) try(?: mode)?$/.test(text)) return wrap({ type: 'exit' });
  if (/^(?:apply|accept) (?:the )?preview$/.test(text)) return wrap({ type: 'apply' });
  if (/^(?:discard|cancel) (?:the )?preview$/.test(text)) return wrap({ type: 'cancel' });
  const lock = text.match(/^(lock|unlock) (.+)$/);
  if (lock) return wrap({ type: 'lock', teeth: select(lock[2]), locked: lock[1] === 'lock' });
  const unrestricted = text.match(/^unrestricted (?:movement )?(on|off)$/);
  if (unrestricted) return wrap({ type: 'unrestricted', enabled: unrestricted[1] === 'on' });
  const movement = text.match(new RegExp(`^move (?:the )?(?:selected )?segment(?: of)?(?: (.+?))? (posterior(?:ly)?|anterior(?:ly)?|upward|up|downward|down|[xyz]) (?:by )?${quantity} mm$`));
  if (movement) {
    const direction = movement[2], axis = /^[xyz]$/.test(direction) ? direction as 'x' | 'y' | 'z' : /^(?:posterior|anterior)/.test(direction) ? 'z' : 'y';
    const sign = /^(?:posterior|down)/.test(direction) ? -1 : 1;
    return wrap({ type: 'preview', edit: { type: 'segment-translate', teeth: select(movement[1]), axis, amount: Number(movement[3]) * sign } });
  }
  const rotation = text.match(new RegExp(`^rotate (?:the )?(?:selected )?segment(?: of)?(?: (.+?))? (?:by )?${quantity} degrees (?:around|about|on) (?:case )?([xyz])(?: axis)?$`));
  if (rotation) return wrap({ type: 'preview', edit: { type: 'segment-rotate', teeth: select(rotation[1]), amount: Number(rotation[2]), axis: rotation[3] as 'x' | 'y' | 'z' } });
  const gap = text.match(new RegExp(`^close (?:(?:the )?selected gap|(?:the )?gap between (.+?))(?: to ${quantity} mm)? (?:(?:with|using) )?(equal(?:ly)?|first|second)(?: (?:movement|tooth(?: only)?))?$`));
  if (gap) return wrap({ type: 'preview', edit: { type: 'close-gap', teeth: pair(gap[1] || 'selected teeth'), gap: gap[2] ? Number(gap[2]) : 0, rule: gap[3].startsWith('equal') ? 'equal' : gap[3] as 'first' | 'second' } });
  const width = text.match(new RegExp(`^(change|increase|decrease) (?:the )?width between (.+?) (?:by )?${quantity} mm symmetrically$`));
  if (width) {
    if (width[1] !== 'change' && Number(width[3]) <= 0) throw new Error('Use a positive amount with increase or decrease, or a signed amount with change.');
    return wrap({ type: 'preview', edit: { type: 'change-width', teeth: pair(width[2]), amount: Number(width[3]) * (width[1] === 'decrease' ? -1 : 1) } });
  }
  const fit = text.match(new RegExp(`^fit (.+?) (?:to|onto) (?:the )?(?:(upper|lower) )?arch(?: curve)? (?:with )?width ${quantity} mm (?:and )?depth ${quantity} mm$`));
  if (fit) {
    const teeth = select(fit[1]), arches = new Set(teeth.map(id => Number(id[0]) <= 2 ? 'upper' : 'lower'));
    if (arches.size !== 1 || fit[2] && !arches.has(fit[2] as 'upper' | 'lower')) throw new Error('Fit teeth from one named arch at a time.');
    const arch = teeth[0][0] < '3' ? 'upper' : 'lower';
    return wrap({ type: 'set-arch', arch, width: Number(fit[3]), depth: Number(fit[4]) }, { type: 'preview', edit: { type: 'fit-arch', teeth, arch } });
  }
  const revise = text.match(new RegExp(`^change (?:the )?last movement to ${quantity} (mm|degrees)$`));
  if (revise) return wrap({ type: 'revise', amount: Number(revise[1]), unit: revise[2] as 'mm' | 'degrees' });
  if (/^(?:make (?:the )?last movement (?:smaller|half(?: as (?:large|big))?)|halve (?:the )?last movement)$/.test(text)) return wrap({ type: 'revise', factor: 0.5 });
  const saved = text.match(/^save (arrangement|group) (?:as )?(.+)$/);
  if (saved) { const name = saved[2].replace(/^["']|["']$/g, ''); return wrap(saved[1] === 'group' ? { type: 'save-group', name, teeth: select() } : { type: 'save-snapshot', name }); }
  if (/^compare (?:with )?(?:the )?original(?: arrangement)?$/.test(text)) return [{ kind: 'comparison', mode: 'overlay' }];
  const compare = text.match(/^compare (?:with )?(?:saved(?: arrangement)?|arrangement) (.+)$/);
  if (compare) {
    const name = compare[1].replace(/^["']|["']$/g, '');
    return wrap({ type: 'compare-snapshot', name: context.savedArrangementNames?.find(saved => saved.toLowerCase() === name) || name });
  }
  if (/^close\b/.test(text)) throw new Error('Which two teeth and allocation rule: equal movement, first tooth only, or second tooth only?');
  if (/^rotate\b/.test(text)) throw new Error('How many degrees, and around which fixed case axis: x, y, or z?');
  if (/^move\b/.test(text)) throw new Error('How many millimetres should the segment move? Use posterior (−Z), anterior (+Z), upward (+Y), downward (−Y), or case x/y/z.');
  if (/^fit\b/.test(text)) throw new Error('Specify the arch curve width and depth in millimetres, and select teeth from one arch.');
  if (/^(?:change|increase|decrease) (?:the )?width\b/.test(text)) throw new Error('Name two teeth, a width change in millimetres, and say “symmetrically”.');
  if (/^save (?:arrangement|group)\b/.test(text)) throw new Error('What name should the saved arrangement or group have?');
  if (/^(?:change|make|halve)\b/.test(text)) throw new Error('Give the replacement amount with mm or degrees, or say “make last movement smaller” to halve its original amount.');
  throw new Error('Use one explicit Try Mode action, including the selected teeth and any required amount.');
}

/** Local English planner. Unknown wording throws without applying any part of a request. */
function buildTeachingPlan(text: string, context: TeachingContext): TeachingPlan {
  if (typeof text !== 'string' || !text.trim() || text.length > 1500) throw new Error('Give a classroom request of at most 1500 characters.');
  const normalized = normalizeSpeechCommand(text);
  const source = /^(?:stop|pause)(?:[.;,]| and| then)\s*(?:undo|redo)(?: that)?$/.test(normalized) ? normalized.match(/(?:undo|redo)(?: that)?$/)![0] : normalized;
  const next = copyContext(context), overrides = { arch: false, view: false, selection: false }, actions: TeachingAction[] = [];
  if (isDentalArrangementClause(source)) {
    const match = source.match(/^(?:load|open|show) (?:the )?(?:dental )?class (i|ii|iii|1|2|3)(?: (?:division|div) (1|2))?(?: arrangement)?$/);
    if (!match || (match[1] === 'ii' || match[1] === '2') && !match[2]) throw new CommandValidationError('Choose dental Class I, Class II division 1, Class II division 2, or Class III as a separate request.');
    if (match[2] && !['ii', '2'].includes(match[1])) throw new CommandValidationError('Divisions 1 and 2 belong to the dental Class II examples.');
    const id = ['i', '1'].includes(match[1]) ? 'dental-class-i' : ['iii', '3'].includes(match[1]) ? 'dental-class-iii' : match[2] === '1' ? 'dental-class-ii-division-1' : 'dental-class-ii-division-2';
    return validateTeachingPlan({ actions: [{ kind: 'dental-arrangement', id }], summary: source, clarification: null }, context, { allowLocalActions: true });
  }
  if (clauses(source).some(isDentalArrangementClause)) throw new CommandValidationError('Load a dental arrangement as a separate request, then give commands for its model.');
  // Match complete catalog titles before splitting their commas and conjunctions.
  const caseAction = parseCaseAction(source, context);
  if (caseAction) {
    try { return validateTeachingPlan({ actions: [caseAction], summary: source, clarification: null }, context, { sourceText: source, allowLocalActions: true }); }
    catch (error) { throw new CommandValidationError(error instanceof Error ? error.message : 'Choose an available prepared case.'); }
  }
  if (clauses(source).length > 1 && clauses(source).some(clause => isCaseClause(clause, context))) throw new CommandValidationError('Use a prepared case command as a separate request, then give commands for its arrangement.');
  if (clauses(source).length > 1 && clauses(source).some(clause => isWorkspaceClause(clause, context))) throw new CommandValidationError('Change workspaces as a separate request, then give commands for the destination model.');
  if (clauses(source).length > 1 && clauses(source).some(clause => /^return to (?:the )?try mode$/.test(clause))) throw new Error('Return to Try Mode as a separate request, then give commands for the restored case.');
  const append = (action: TeachingAction) => {
    try { if (actions.length >= 8) throw new Error('Use at most eight actions in one classroom request.'); advance(next, action, overrides); actions.push(action); }
    catch (error) { throw new CommandValidationError(error instanceof Error ? error.message : 'This action is unavailable in the current scene.'); }
  };
  const sourceClauses = clauses(source);
  for (let clauseIndex = 0; clauseIndex < sourceClauses.length; clauseIndex++) {
    let clause = sourceClauses[clauseIndex];
    const mechanicsActions = planMechanicsClause(clause, next);
    if (mechanicsActions) {
      mechanicsActions.forEach(action => append({ kind: 'mechanics', action }));
      if (mechanicsActions.length > 1 && mechanicsActions.at(-1)?.type === 'solve' && isMechanicsSolveClause(sourceClauses[clauseIndex + 1] || '')) clauseIndex++;
      continue;
    }
    if (clause === 'compare translation and tipping') {
      for (const action of ['translation', 'tipping'] as const) { append({ kind: 'anatomy-lesson', action }); append({ kind: 'workflow', action: 'play' }); }
      continue;
    }
    const anatomyDemonstration = clause.match(/^demonstrate (?:tooth )?(translation|tipping)(?: (?:in the )?anatomy lesson)?$/);
    if (anatomyDemonstration) { append({ kind: 'anatomy-lesson', action: anatomyDemonstration[1] as 'translation' | 'tipping' }); append({ kind: 'workflow', action: 'play' }); continue; }
    const demonstration = clause.match(/^(?:demonstrate|show) (?:the )?(fixed braces|braces|palatal expansion|archwire expansion)(?: (?:more )?slowly)?$/);
    if (demonstration) {
      append({ kind: 'workflow', action: 'start', id: demonstration[1] === 'palatal expansion' ? 'palatal-expansion' : demonstration[1] === 'archwire expansion' ? 'archwire-expansion' : 'fixed-braces' });
      if (/slowly$/.test(clause)) append({ kind: 'speed', value: 0.5 });
      append({ kind: 'workflow', action: 'play' }); continue;
    }
    if (/^(?:demonstrate|show) expansion(?: slowly)?$/.test(clause)) throw new Error('Name palatal expansion or archwire expansion.');
    if (/\bthem\b/.test(clause)) { if (!next.selectedIds.length) throw new CommandValidationError('Select a tooth group before referring to them.'); clause = clause.replace(/\bthem\b/g, 'selected teeth'); }
    if (next.arch !== 'both' && !/^(?:save (?:arrangement|group)|compare (?:with )?(?:saved|arrangement))\b/.test(clause)) clause = clause.replace(/\b(?:incisors?|canines?|premolars?|molars?|anterior teeth|posterior teeth)\b/g, (family, offset: number, full: string) => /(?:upper|lower|maxillary|mandibular)(?: (?:left|right))?\s+$/.test(full.slice(0, offset)) ? family : `${next.arch} ${family}`);
    const explicitPreview = /^preview /.test(clause);
    if (explicitPreview) clause = clause.slice(8);
    const replacement = clause.match(/^make (?:that|it) ([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?: (mm|degrees))?(?: instead)?$/);
    if (replacement && next.tryLastMovement && !replacement[2]) {
      append({ kind: 'try', action: { type: 'revise', amount: Number(replacement[1]) } });
      if (next.autoApply && !explicitPreview) append({ kind: 'try', action: { type: 'apply' } });
      continue;
    }
    if (replacement && next.tryLastMovement) clause = `change last movement to ${replacement[1]} ${replacement[2]}`;
    const tryActions = parseTryActions(clause, next);
    if (tryActions) { tryActions.forEach(append); if (next.autoApply && !explicitPreview && tryActions.some(action => action.kind === 'try' && ['preview', 'revise'].includes(action.action.type))) append({ kind: 'try', action: { type: 'apply' } }); continue; }
    if (/^(?:move|intrude|extrude|retract|protract|expand|constrict|distali[sz]e|mesiali[sz]e|rotate|tip|torque)\b/.test(clause) && !/\b(?:mm|cm|degrees?|deg)\b|°/.test(clause)) {
      const angular = /^(?:rotate|tip|torque)\b/.test(clause);
      try {
        // This placeholder checks only whether the requested target/direction is known.
        // It is never included in the returned plan or sent to the executor.
        parseTeachingCommand(`${clause} 1 ${angular ? 'degrees' : 'mm'}`, next.selected, next.availableIds, next.selectedIds);
        return { actions: [], summary: '', clarification: angular ? 'How many degrees should the teeth rotate?' : 'How many millimetres should the teeth move?' };
      } catch { /* Other unsupported wording remains available to the optional interpreter. */ }
    }
    const action = parseTeachingCommand(clause, next.selected, next.availableIds, next.selectedIds);
    append(action.kind === 'return-lesson' && next.mode === 'case' && next.hasWorkflowOrigin ? { kind: 'workspace', action: 'lesson' } : action);
    if (next.autoApply && !explicitPreview && next.tryMode && action.kind === 'dental' && ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(action.command.type)) append({ kind: 'try', action: { type: 'apply' } });
  }
  try { return validateTeachingPlan({ actions, summary: actions.length === 1 ? source : `${actions.length} classroom actions`, clarification: null }, context, { sourceText: source, allowLocalActions: true }); }
  catch (error) { throw new CommandValidationError(error instanceof Error ? error.message : 'The local command is invalid.'); }
}

export function parseTeachingPlan(text: string, context: TeachingContext): TeachingPlan {
  try { return buildTeachingPlan(text, context); }
  catch (error) {
    if (error instanceof UnrecognizedCommandError) throw error;
    // New mechanics stay deterministic and local, including useful validation errors.
    if (context.tryMode && error instanceof CommandValidationError || typeof text === 'string' && clauses(normalizeSpeechCommand(text)).some(clause => isDentalArrangementClause(clause) || isMechanicsClause(clause) || isCaseClause(clause, context) || isTryClause(clause) || isWorkspaceClause(clause, context) || isApplianceClause(clause) || /^(?:undo|redo) (?:the )?(?:last )?\d/.test(clause) || /^(?:show|reveal|hide) (?:the )?(?:answer|explanation)$/.test(clause))) return { actions: [], summary: '', clarification: error instanceof Error ? error.message : 'Specify an explicit local classroom command.' };
    throw error;
  }
}

function isDentalArrangementClause(text: string): boolean { return /^(?:load|open|show) (?:the )?(?:dental )?class\b/.test(text); }
