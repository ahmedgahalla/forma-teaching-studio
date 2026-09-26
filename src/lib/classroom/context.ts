import type { TeachingAction } from '../lecture';
import type { TeachingContext } from './types';

/** Destination routing and interpreter context are shared with the provider and unit-tested. */
export function teachingActionMode(
  action: TeachingAction,
  current: TeachingContext['mode'],
): TeachingContext['mode'] {
  if (
    action.kind === 'case' ||
    action.kind === 'dental-arrangement' ||
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
  ] as const)
    delete wire[field];
  if (
    wire.lastActions?.some(action =>
      [
        'case',
        'dental-arrangement',
        'try',
        'history',
        'try-display',
        'try-playback',
        'workspace',
        'appliance-display',
      ].includes(action.kind),
    )
  )
    delete wire.lastActions;
  return wire;
}
