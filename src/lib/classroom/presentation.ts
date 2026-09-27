import type { TeachingAction } from './actions';
import { fields, oneOf, type TeachingContext, type TeachingPlan } from './types';
import { validateTeachingPlan } from './plan-validate';

const controls = [
  'prepare',
  'rehearse',
  'teach',
  'next',
  'previous',
  'restart',
  'explore',
  'return',
  'exit',
  'library',
  'reveal',
  'hide-answer',
  'notes',
  'hide-notes',
] as const;
export type PresentationAction =
  | { kind: 'presentation'; action: 'open'; id: string }
  | { kind: 'presentation'; action: 'go'; index: number }
  | { kind: 'presentation'; action: (typeof controls)[number] };
export type PresentationContext = {
  documentId: string;
  index: number;
  count: number;
  mode: 'prepare' | 'rehearse' | 'teach';
  exploring: boolean;
};

export function validatePresentationAction(action: Record<string, unknown>): PresentationAction {
  if (action.action === 'open') {
    fields(action, ['kind', 'action', 'id']);
    if (typeof action.id !== 'string' || !action.id.trim() || action.id.length > 100)
      throw new Error('Choose a lecture with an ID of 1 to 100 characters.');
    return { kind: 'presentation', action: 'open', id: action.id };
  }
  if (action.action === 'go') {
    fields(action, ['kind', 'action', 'index']);
    if (
      typeof action.index !== 'number' ||
      !Number.isInteger(action.index) ||
      action.index < 0 ||
      action.index > 99
    )
      throw new Error('Choose a lecture step from 1 to 100.');
    return { kind: 'presentation', action: 'go', index: action.index };
  }
  fields(action, ['kind', 'action']);
  return { kind: 'presentation', action: oneOf(action.action, controls) };
}

/** Only advance preflight metadata; document lookup and scene restoration belong to the adapter. */
export function advancePresentation(context: TeachingContext, action: TeachingAction): boolean {
  if (action.kind !== 'presentation') {
    if (
      context.presentation &&
      (action.kind === 'anatomy-lesson' ||
        (action.kind === 'workflow' && action.action === 'start') ||
        (action.kind === 'workspace' && action.action === 'lesson'))
    )
      throw new Error('Return to Explore before opening a built-in workflow.');
    return false;
  }
  const current = context.presentation;
  const display = ['reveal', 'hide-answer', 'notes', 'hide-notes'].includes(action.action);
  if (context.tryPreview && !display)
    throw new Error('Apply or discard the preview before changing lecture steps or experiences.');
  if (current?.exploring && !display && !['return', 'exit', 'library'].includes(action.action))
    throw new Error('Return to the lecture before changing its steps or presentation mode.');
  if (action.action === 'open' || action.action === 'library' || action.action === 'exit') {
    context.mode = 'case';
    context.playing = false;
    delete context.presentation;
    return true;
  }
  if (!current) throw new Error('Open a lecture before using its controls.');
  context.mode = 'case';
  context.playing = false;
  const next = { ...current };
  if (action.action === 'return') {
    if (!current.exploring) throw new Error('You are already in the lecture.');
    next.exploring = false;
  } else if (action.action === 'explore') next.exploring = true;
  else if (action.action === 'prepare' || action.action === 'rehearse' || action.action === 'teach')
    next.mode = action.action;
  else if (action.action === 'restart') next.index = 0;
  else if (action.action === 'go') next.index = action.index;
  else if (action.action === 'next') next.index++;
  else if (action.action === 'previous') next.index--;
  if (next.index < 0 || next.index >= next.count)
    throw new Error(`Choose a step from 1 to ${next.count} in this lecture.`);
  context.presentation = next;
  return true;
}

function command(source: string): PresentationAction | undefined {
  if (/^next(?: (?:lecture )?step)?$/.test(source)) return { kind: 'presentation', action: 'next' };
  if (/^(?:previous|back)(?: (?:lecture )?step)?$/.test(source))
    return { kind: 'presentation', action: 'previous' };
  const go = /^go to (?:lecture )?step(?: (.*))?$/.exec(source);
  if (go) return { kind: 'presentation', action: 'go', index: Number(go[1]) - 1 };
  const aliases: Record<string, PresentationAction['action']> = {
    'return to lecture': 'return',
    'return to lesson': 'return',
    'explore this step': 'explore',
    'explore this arrangement': 'explore',
    'explore a question': 'explore',
    'reveal answer': 'reveal',
    'show answer': 'reveal',
    'hide answer': 'hide-answer',
    'show notes': 'notes',
    'hide notes': 'hide-notes',
    'restart lecture': 'restart',
    'teach lecture': 'teach',
    'rehearse lecture': 'rehearse',
    'prepare lecture': 'prepare',
    'exit lecture': 'exit',
  };
  const action = aliases[source.replace(/\bthe (?=lecture|lesson|answer|notes)\b/g, '')];
  return action ? validatePresentationAction({ kind: 'presentation', action }) : undefined;
}

/** Complete local requests take precedence over legacy lessons only while a lecture is active. */
export function parsePresentationPlan(
  source: string,
  context: TeachingContext,
): TeachingPlan | undefined {
  if (!context.presentation) return;
  try {
    const action = command(source);
    if (!action) {
      if (source.split(/\s+(?:and then|and|then)\s+|[;,]\s*|\.\s+/).some(part => command(part)))
        throw new Error('Use one lecture control as a separate request, then change the scene.');
      return;
    }
    return validateTeachingPlan(
      { actions: [action], summary: source, clarification: null },
      context,
      { allowLocalActions: true },
    );
  } catch (error) {
    return {
      actions: [],
      summary: '',
      clarification:
        error instanceof Error ? error.message : 'Choose an available lecture control.',
    };
  }
}
