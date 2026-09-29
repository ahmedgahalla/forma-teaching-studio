import { parseTeachingPlan, type TeachingPlan, type TeachingContext } from './classroom';
import { normalizeSpeechCommand, type TeachingAction } from './lecture';
import { parseLectureOpening, validatePresentationAction } from './classroom/presentation';
export type TeachingSubmitOptions = {
  interpreter?: 'auto' | 'ai' | 'local';
  onLocalAccept?: () => void;
};

/** The active Lecture tab is a no-op, including playback and request history. */
export function isRedundantLectureOpen(
  request: string | TeachingAction[],
  context: TeachingContext,
) {
  if (!context.presentation || (typeof request === 'string' && request.length > 1500)) return false;
  try {
    const supplied =
      typeof request === 'string'
        ? parseLectureOpening(normalizeSpeechCommand(request), context.presentation.documentId)
        : request.length === 1
          ? request[0]
          : undefined;
    if (supplied?.kind !== 'presentation') return false;
    const action = validatePresentationAction(supplied);
    return action.action === 'open' && action.id === context.presentation.documentId;
  } catch {
    return false;
  }
}

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
      (plan.actions.some(action =>
        ['jaw', 'tooth-study', 'glossary', 'lesson', 'presentation', 'mechanics-example'].includes(
          action.kind,
        ),
      ) ||
        plan.actions.every(
          action =>
            ['stop', 'history', 'replay'].includes(action.kind) ||
            (action.kind === 'dental' && ['undo', 'redo', 'pause'].includes(action.command.type)),
        )))
  );
}
