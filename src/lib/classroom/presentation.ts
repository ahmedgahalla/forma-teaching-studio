import type { TeachingAction } from './actions';
import { fields, oneOf, type TeachingContext, type TeachingPlan } from './types';
import { validateTeachingPlan } from './plan-validate';
import { FEATURED_LECTURE_ID, SAMPLE_LECTURE_ID } from '../lecture-documents/constants';

const controls = [
  'rehearse',
  'teach',
  'next',
  'previous',
  'restart',
  'explore',
  'return',
  'exit',
  'reveal',
  'hide-answer',
  'notes',
  'hide-notes',
  'focus-tooth',
  'show-context',
  'hide-biology',
  'close-comparison',
  'fit-view',
] as const;
export const COMPARISON_TARGETS = ['start', 'translation', 'tip', 'finish'] as const;
export type LectureComparison = (typeof COMPARISON_TARGETS)[number];
export type PresentationAction =
  | { kind: 'presentation'; action: 'open'; id: string }
  | { kind: 'presentation'; action: 'go'; index: number }
  | { kind: 'presentation'; action: 'compare'; target: LectureComparison }
  | { kind: 'presentation'; action: 'biology'; view: 'overview' | 'compression' | 'tension' }
  | { kind: 'presentation'; action: (typeof controls)[number] };
export type PresentationContext = {
  documentId: string;
  index: number;
  count: number;
  mode: 'rehearse' | 'teach';
  exploring: boolean;
};

export function validatePresentationAction(action: Record<string, unknown>): PresentationAction {
  if (action.action === 'compare') {
    fields(action, ['kind', 'action', 'target']);
    return {
      kind: 'presentation',
      action: 'compare',
      target: oneOf(action.target, COMPARISON_TARGETS),
    };
  }
  if (action.action === 'biology') {
    fields(action, ['kind', 'action', 'view']);
    return {
      kind: 'presentation',
      action: 'biology',
      view: oneOf(action.view, ['overview', 'compression', 'tension']),
    };
  }
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

export function isPresentationDisplay(action: PresentationAction) {
  return [
    'reveal',
    'hide-answer',
    'notes',
    'hide-notes',
    'biology',
    'hide-biology',
    'focus-tooth',
    'show-context',
    'fit-view',
  ].includes(action.action);
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
  if (action.action === 'open' && current?.documentId === action.id) return true;
  const display = isPresentationDisplay(action);
  if (context.tryPreview && !display)
    throw new Error('Apply or discard the preview before changing lecture steps or experiences.');
  if (current?.exploring && !display && !['return', 'exit'].includes(action.action))
    throw new Error('Return to the lecture before changing its steps or presentation mode.');
  if (action.action === 'open' || action.action === 'exit') {
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
  else if (action.action === 'rehearse' || action.action === 'teach') next.mode = action.action;
  else if (action.action === 'restart') next.index = 0;
  else if (action.action === 'go') next.index = action.index;
  else if (action.action === 'next') next.index++;
  else if (action.action === 'previous') next.index--;
  if (next.index < 0 || next.index >= next.count)
    throw new Error(`Choose a step from 1 to ${next.count} in this lecture.`);
  context.presentation = next;
  return true;
}

export function parseLectureOpening(
  source: string,
  currentId?: string,
): PresentationAction | undefined {
  if (/^(?:lecture|open lecture)$/.test(source))
    return { kind: 'presentation', action: 'open', id: currentId ?? FEATURED_LECTURE_ID };
  if (/^(?:open sample lecture|start sample lecture)$/.test(source))
    return { kind: 'presentation', action: 'open', id: SAMPLE_LECTURE_ID };
}

function command(source: string, currentId?: string): PresentationAction | undefined {
  const opening = parseLectureOpening(source, currentId);
  if (opening) return opening;
  const labels: Record<string, string> = {
    'starting arrangement': 'compare start',
    'translation example': 'compare translation',
    'tipping example': 'compare tipping',
    'finished arrangement': 'compare finish',
    'explain tissue response': 'show biology',
    both: 'show biology',
    compression: 'show compression',
    tension: 'show tension',
    'close biology': 'hide biology',
    'focus teaching teeth': 'focus teaching tooth',
    'show full model': 'show surrounding teeth',
  };
  source = labels[source] ?? source;
  const comparison = /^compare (start|translation|tipping|finish)$/.exec(source);
  if (comparison)
    return {
      kind: 'presentation',
      action: 'compare',
      target:
        comparison[1] === 'tipping' ? 'tip' : (comparison[1] as 'start' | 'translation' | 'finish'),
    };
  const biology = /^show (biology|compression|tension)$/.exec(source);
  if (biology)
    return {
      kind: 'presentation',
      action: 'biology',
      view: biology[1] === 'biology' ? 'overview' : (biology[1] as 'compression' | 'tension'),
    };
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
    'explore this question': 'explore',
    'reveal answer': 'reveal',
    'show answer': 'reveal',
    'hide answer': 'hide-answer',
    'show notes': 'notes',
    'show presenter notes': 'notes',
    'hide notes': 'hide-notes',
    'hide presenter notes': 'hide-notes',
    'focus teaching tooth': 'focus-tooth',
    'show surrounding teeth': 'show-context',
    'hide biology': 'hide-biology',
    'close comparison': 'close-comparison',
    'restart lecture': 'restart',
    'teach lecture': 'teach',
    'rehearse lecture': 'rehearse',
    teach: 'teach',
    present: 'teach',
    'review notes': 'rehearse',
    rehearse: 'rehearse',
    'exit lecture': 'exit',
    'end lecture': 'exit',
    'exit lecture mode': 'exit',
    explore: 'exit',
    'return to explore': 'exit',
    'fit model': 'fit-view',
    'fit view': 'fit-view',
  };
  const action = aliases[source.replace(/\bthe (?=lecture|lesson|answer|notes)\b/g, '')];
  return action ? validatePresentationAction({ kind: 'presentation', action }) : undefined;
}

/** Active lecture controls and retired editing requests stay local. */
export function parsePresentationPlan(
  source: string,
  context: TeachingContext,
): TeachingPlan | undefined {
  try {
    const parts = source.split(/\s+(?:and then|and|then)\s+|[;,]\s*|\.\s+/);
    if (parts.some(part => /^prepare (?:the )?lecture$/.test(part)))
      throw new Error('Lecture editing is unavailable. Use Review notes or Present.');
    const control = (part: string) => command(part, context.presentation?.documentId);
    const action = control(source);
    const opensLecture = parts.some(part => control(part)?.action === 'open');
    if (!context.presentation && !opensLecture) return;
    if (!action) {
      if (parts.some(part => control(part)))
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
