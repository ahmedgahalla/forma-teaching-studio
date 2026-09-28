import type { DentalCase } from '../geometry';
import type { TeachingAction } from './actions';
import { boolean, fields, type TeachingContext, type TeachingPlan } from './types';
import { validateTeachingPlan } from './plan-validate';

export const JAW_UNAVAILABLE = 'Jaw opening is available on the Atlas mouth in Explore or Lecture.';
export function supportsJawOpening(model?: Pick<DentalCase, 'asset'>) {
  return model?.asset === 'claude-atlas-v1';
}
export function validateJawAction(value: Record<string, unknown>, context: TeachingContext) {
  fields(value, ['kind', 'open']);
  if (context.mode !== 'case' || !context.jawAvailable || context.toothStudy)
    throw new Error(JAW_UNAVAILABLE);
  return { kind: 'jaw', open: boolean(value.open) } as const;
}
export function advanceJaw(context: TeachingContext, action: TeachingAction) {
  if (action.kind !== 'jaw') return false;
  context.jawOpen = validateJawAction(action, context).open;
  return true;
}

/** Mouth aliases use the same bounded display action for typing and speech. */
export function parseJawPlan(source: string, context: TeachingContext): TeachingPlan | undefined {
  if (!/\b(?:open|close|shut) (?:the )?(?:jaw|mouth)\b/.test(source)) return;
  try {
    const match = source.match(/^(open|close|shut) (?:the )?(?:jaw|mouth)$/);
    if (!match) throw new Error('Open or close the jaw as a separate display request.');
    const open = match[1] === 'open';
    return validateTeachingPlan(
      {
        actions: [{ kind: 'jaw', open }],
        summary: open ? 'Open jaw' : 'Close jaw',
        clarification: null,
      },
      context,
      { allowLocalActions: true },
    );
  } catch (error) {
    return {
      actions: [],
      summary: '',
      clarification: error instanceof Error ? error.message : JAW_UNAVAILABLE,
    };
  }
}
