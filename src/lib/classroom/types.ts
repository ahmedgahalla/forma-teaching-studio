import type { TeachingAction } from '../lecture';
import { TEACHING_CASES } from '../teaching-cases';
import { WORKFLOWS } from '../workflows';
import type { MechanicsCommandContext, PointedReference } from '../mechanics-commands';

export type TeachingContext = {
  mode: 'case' | 'workflow';
  workflowId: string | null;
  stepIndex: number;
  selected: string;
  selectedIds: string[];
  availableIds: string[];
  synthetic: boolean;
  revision: number;
  view: 'front' | 'right' | 'left' | 'occlusal' | 'perspective';
  arch: 'upper' | 'lower' | 'both';
  speed: 0.5 | 1 | 2;
  stage?: number;
  stages?: number;
  playing?: boolean;
  lessonActive?: boolean;
  canReturnToLesson?: boolean;
  canRestoreWorkspace?: boolean;
  hasWorkflowOrigin?: boolean;
  caseId?: string;
  caseVariantId?: string;
  caseExploring?: boolean;
  lastActions?: TeachingAction[];
  layers?: Partial<
    Record<
      | 'roots'
      | 'gums'
      | 'braces'
      | 'labels'
      | 'grid'
      | 'attachments'
      | 'bone'
      | 'cutaway'
      | 'ligament',
      boolean
    >
  >;
  boneOpacity?: number;
  tryMode?: boolean;
  lockedIds?: string[];
  tryPreview?: boolean;
  tryLastMovement?: boolean;
  tryLastIds?: string[];
  savedArrangementNames?: string[];
  tryArchTargets?: Partial<Record<'upper' | 'lower', { width: number; depth: number }>>;
  pointed?: PointedReference;
  mechanics?: MechanicsCommandContext;
  autoApply?: boolean;
};
export type TeachingPlan = {
  actions: TeachingAction[];
  summary: string;
  clarification: string | null;
};
export type PlanValidationOptions = {
  sourceText?: string;
  expectedRevision?: number;
  allowLocalActions?: boolean;
};
export const DEMO_IDS = [1, 2, 3, 4].flatMap(q =>
  Array.from({ length: 7 }, (_, i) => `${q}${i + 1}`),
);
export const VIEWS = ['front', 'right', 'left', 'occlusal', 'perspective'];
export const PHASES = ['assessment', 'brackets', 'wire', 'forces', 'movement', 'retention'];

export function record(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new Error('A teaching action must be an object.');
  return value as Record<string, unknown>;
}
export function fields(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  if (
    required.some(key => !Object.hasOwn(value, key)) ||
    Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))
  )
    throw new Error('Missing or unexpected teaching action fields.');
}
export function oneOf<T extends string | number>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new Error('Unsupported teaching action value.');
  return value as T;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Visibility must be true or false.');
  return value;
}
export function toothIds(value: unknown, context: TeachingContext): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 32 ||
    new Set(value).size !== value.length ||
    value.some(
      id =>
        typeof id !== 'string' || !/^[1-4][1-8]$/.test(id) || !context.availableIds.includes(id),
    )
  )
    throw new Error('Choose unique tooth IDs present in the current teaching model.');
  return [...value];
}

/** Strict external action schema; never pass provider output directly to a scene executor. */

export function copyContext(context: TeachingContext): TeachingContext {
  if (
    !Number.isInteger(context.revision) ||
    context.revision < 0 ||
    !Array.isArray(context.availableIds) ||
    !context.availableIds.length ||
    context.availableIds.length > 32 ||
    new Set(context.availableIds).size !== context.availableIds.length ||
    context.availableIds.some(id => !/^[1-4][1-8]$/.test(id))
  )
    throw new Error('Invalid teaching context.');
  if (
    !context.availableIds.includes(context.selected) ||
    context.selectedIds.some(id => !context.availableIds.includes(id)) ||
    new Set(context.selectedIds).size !== context.selectedIds.length
  )
    throw new Error('The teaching selection is stale.');
  if (context.mode !== 'case' && context.mode !== 'workflow')
    throw new Error('Invalid teaching mode.');
  if (context.caseId !== undefined) {
    const definition = TEACHING_CASES.find(item => item.id === context.caseId);
    if (
      !definition ||
      (context.caseVariantId !== undefined &&
        !definition.variants.some(item => item.id === context.caseVariantId))
    )
      throw new Error('The prepared case context is stale or unsupported.');
  } else if (context.caseVariantId !== undefined || context.caseExploring === true)
    throw new Error('Load a prepared case before referring to its variation.');
  if (context.caseExploring !== undefined && typeof context.caseExploring !== 'boolean')
    throw new Error('Invalid prepared case exploration state.');
  if (context.mode === 'workflow') {
    const count =
      context.workflowId === 'anatomy'
        ? 4
        : WORKFLOWS.find(w => w.id === context.workflowId)?.steps.length;
    if (
      !count ||
      !Number.isInteger(context.stepIndex) ||
      context.stepIndex < 0 ||
      context.stepIndex >= count
    )
      throw new Error('The workflow context is stale or unsupported.');
  }
  if (
    context.lockedIds &&
    (context.lockedIds.some(id => !context.availableIds.includes(id)) ||
      new Set(context.lockedIds).size !== context.lockedIds.length)
  )
    throw new Error('The locked tooth selection is stale.');
  if (
    context.pointed &&
    (!context.availableIds.includes(context.pointed.tooth) ||
      (context.pointed.surface !== undefined &&
        !['crown', 'root', 'gingiva'].includes(context.pointed.surface)) ||
      [context.pointed.localPoint, context.pointed.worldPoint].some(
        point =>
          !Array.isArray(point) ||
          point.length !== 3 ||
          point.some(value => !Number.isFinite(value)),
      ))
  )
    throw new Error('Point to a valid location in the current model.');
  return {
    ...context,
    selectedIds: [...context.selectedIds],
    availableIds: [...context.availableIds],
    layers: { ...context.layers },
    lockedIds: [...(context.lockedIds || [])],
    tryLastIds: context.tryLastIds && [...context.tryLastIds],
    savedArrangementNames: [...(context.savedArrangementNames || [])],
    tryArchTargets: { ...context.tryArchTargets },
    ...(context.pointed ? { pointed: structuredClone(context.pointed) } : {}),
    ...(context.mechanics ? { mechanics: structuredClone(context.mechanics) } : {}),
  };
}
