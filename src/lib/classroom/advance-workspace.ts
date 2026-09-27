import type { TeachingAction } from '../lecture';
import type { TeachingContext } from './types';

/** Transfers are standalone; the host restores the destination model and context. */
export function advanceWorkspace(
  context: TeachingContext,
  action: Extract<TeachingAction, { kind: 'workspace' }>,
) {
  if (context.mode === 'case' && context.tryPreview)
    throw new Error('Apply or discard the preview before changing workspaces.');
  if (action.action === 'explore' && context.mode !== 'workflow')
    throw new Error('Open a teaching workflow before exploring its setup.');
  if (action.action === 'restore' && !context.canRestoreWorkspace)
    throw new Error('There is no saved workspace to restore.');
  if (action.action === 'lesson' && (context.mode !== 'case' || !context.hasWorkflowOrigin))
    throw new Error('This workspace has no source lesson to return to.');
}
