import type { TeachingAction } from './lecture';

export type TeachingNarrationTarget = 'step' | 'answer' | 'mechanics' | 'tooth' | 'glossary';

export function teachingNarrationTarget(action: TeachingAction): TeachingNarrationTarget | null {
  if (action.kind === 'glossary' && action.id !== null) return 'glossary';
  if (action.kind === 'narrate') return action.target;
  if (action.kind === 'mechanics' && action.action.type === 'explain') return 'mechanics';
  if (action.kind === 'tooth-study' && action.action === 'explain') return 'tooth';
  return null;
}
