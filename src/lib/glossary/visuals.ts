import type { TeachingAction } from '../lecture';
import type { TeachingCaseId } from '../teaching-cases';

/** Each authored example opens on its chosen variant, paused at the initial frame. */
export function caseVisual(id: TeachingCaseId, variant: string): TeachingAction[] {
  return [
    { kind: 'case', action: 'load', id },
    { kind: 'case', action: 'variant', id: variant },
    { kind: 'case', action: 'pause' },
    { kind: 'case', action: 'progress', value: 0 },
  ];
}
