import type { TeachingAction } from '../lecture';
import type { TeachingContext } from './types';

export function advanceTryDisplay(
  context: TeachingContext,
  action: Extract<TeachingAction, { kind: 'try-display' | 'try-playback' }>,
) {
  const caseTrace = action.kind === 'try-display' && action.target === 'traces';
  if (context.mode !== 'case' || (!context.tryMode && !caseTrace))
    throw new Error('Enter Try Mode in your case before using its display controls.');
  if (action.kind === 'try-playback') {
    context.playing = true;
    context.stage = action.direction === 'reverse' ? 0 : (context.stages ?? 10);
  }
}
