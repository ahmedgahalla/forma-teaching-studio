import type { TeachingAction } from '@/lib/lecture';
import type { CaseStudioApi } from './api';

/** Keep asynchronous example/solver operations inside the same cancellable runtime request. */
export function applyCaseAction(api: CaseStudioApi, action: TeachingAction, signal?: AbortSignal) {
  if (action.kind === 'mechanics-example')
    return api.loadMechanicsExample(action.id, action.variant, signal);
  if (action.kind === 'mechanics') return api.applyMechanics(action.action, signal);
  return api.applyTeaching(action);
}
