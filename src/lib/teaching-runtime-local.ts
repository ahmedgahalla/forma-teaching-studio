import { parseTeachingPlan, type TeachingPlan, type TeachingContext } from './classroom';
import type { TeachingAction } from './lecture';
export type TeachingSubmitOptions = {
  interpreter?: 'auto' | 'ai' | 'local';
  onLocalAccept?: () => void;
};

/** Aliases are plausible classroom words, so even clarification is a silent rejection. */
export function parseLocalVoicePlan(
  text: string,
  context: TeachingContext,
  preflight: (actions: TeachingAction[]) => void,
) {
  try {
    const plan = parseTeachingPlan(text, context);
    if (plan.clarification || !plan.actions.length) return;
    preflight(plan.actions);
    return plan;
  } catch {
    return;
  }
}

/** Explicit clarifications and local controls stay local even under AI preference. */
export function preserveLocalPlan(plan: TeachingPlan) {
  return (
    !!plan.clarification ||
    (plan.actions.length > 0 &&
      (plan.actions.some(action => ['tooth-study', 'glossary', 'lesson'].includes(action.kind)) ||
        plan.actions.every(
          action =>
            ['stop', 'history', 'replay'].includes(action.kind) ||
            (action.kind === 'dental' && ['undo', 'redo', 'pause'].includes(action.command.type)),
        )))
  );
}
