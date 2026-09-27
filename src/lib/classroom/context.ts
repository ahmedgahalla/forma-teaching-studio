import type { TeachingAction } from '../lecture';
import { LOCAL_ONLY_KINDS, type TeachingContext } from './types';

/** Destination routing and interpreter context are shared with the provider and unit-tested. */
export function teachingActionMode(
  action: TeachingAction,
  current: TeachingContext['mode'],
): TeachingContext['mode'] {
  if (
    action.kind === 'case' ||
    action.kind === 'dental-arrangement' ||
    action.kind === 'tooth-study' ||
    action.kind === 'glossary' ||
    action.kind === 'lesson' ||
    (action.kind === 'workflow' && action.action === 'exit')
  )
    return 'case';
  if (action.kind === 'anatomy-lesson' || (action.kind === 'workflow' && action.action === 'start'))
    return 'workflow';
  return current;
}

export function interpreterTeachingContext(context: TeachingContext): TeachingContext {
  const wire = { ...context };
  for (const field of [
    'caseId',
    'caseVariantId',
    'caseExploring',
    'tryMode',
    'lockedIds',
    'tryPreview',
    'tryLastMovement',
    'tryLastIds',
    'savedArrangementNames',
    'tryArchTargets',
    'canRestoreWorkspace',
    'hasWorkflowOrigin',
    'autoApply',
    'toothStudy',
    'glossaryId',
    'canStepStages',
  ] as const)
    delete wire[field];
  if (wire.lastActions?.some(action => LOCAL_ONLY_KINDS.includes(action.kind)))
    delete wire.lastActions;
  return wire;
}
