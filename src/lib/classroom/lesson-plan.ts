import { parseLessonControl } from './lesson-controls';
import { validateTeachingPlan } from './plan-validate';
import type { TeachingContext, TeachingPlan } from './types';

export function parseLessonPlan(text: string, context: TeachingContext): TeachingPlan | undefined {
  const action = parseLessonControl(text);
  if (!action) return undefined;
  try {
    return validateTeachingPlan(
      { actions: [action], summary: text, clarification: null },
      context,
      { allowLocalActions: true },
    );
  } catch (error) {
    return {
      actions: [],
      summary: '',
      clarification:
        error instanceof Error ? error.message : 'Choose a short lesson in your free workspace.',
    };
  }
}
