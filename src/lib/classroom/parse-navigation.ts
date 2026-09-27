import type { TeachingAction } from '../lecture';
import type { TeachingContext } from './types';
import { CommandValidationError } from '../commands';
import { adjacentToothView } from './parse-tooth-study';

export function isNavigationClause(text: string): boolean {
  return /^(?:next(?: step)?|go on|continue|go to the next step|back|previous(?: step)?|go back)$/.test(
    text,
  );
}

/** Shared by voice, typed requests and presenter keys through the local planner. */
export function parseNavigation(
  text: string,
  context: TeachingContext,
): TeachingAction | undefined {
  const next = /^(?:next(?: step)?|go on|continue|go to the next step)$/.test(text);
  const previous = /^(?:back|previous(?: step)?|go back)$/.test(text);
  if (!next && !previous) return undefined;
  const shortLesson = context.lessonActive && !context.caseId && !context.hasWorkflowOrigin;
  if (context.mode === 'case' && context.toothStudy && !shortLesson)
    return {
      kind: 'tooth-study',
      action: 'view',
      view: adjacentToothView(context.toothStudy.view, next ? 1 : -1),
    };
  const action = next ? 'next' : 'previous';
  if (context.mode === 'workflow') return { kind: 'workflow', action };
  const preparedCase = context.caseId && !context.caseExploring;
  if (!shortLesson && !preparedCase && context.canStepStages === false)
    throw new CommandValidationError(
      'Nothing to step through here. Open a prepared case or lesson, or say “Forma, show tooth 16”.',
    );
  return { kind: shortLesson ? 'lesson-step' : 'stage', action };
}
