import type { TeachingAction } from '../lecture';
import type { TeachingContext } from './types';

/** Shared by voice, typed requests and presenter keys through the local planner. */
export function parseNavigation(
  text: string,
  context: TeachingContext,
): TeachingAction | undefined {
  const next = /^(?:next(?: step)?|go on|continue|go to the next step)$/.test(text);
  const previous = /^(?:back|previous(?: step)?|go back)$/.test(text);
  if (!next && !previous) return undefined;
  const action = next ? 'next' : 'previous';
  if (context.mode === 'workflow') return { kind: 'workflow', action };
  return { kind: context.lessonActive ? 'lesson-step' : 'stage', action };
}
