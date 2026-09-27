import type { TeachingAction } from '../lecture';
import { TEACHING_CASES } from '../teaching-cases';
import { DEMO_IDS, type TeachingContext } from './types';

/** Prepared-case branch of the private preflight simulation. */
export function advanceCase(
  context: TeachingContext,
  action: Extract<TeachingAction, { kind: 'case' }>,
) {
  if (action.action !== 'pause' && context.tryPreview)
    throw new Error('Apply or discard the preview before changing the prepared case.');
  if (action.action === 'load') {
    const definition = TEACHING_CASES.find(item => item.id === action.id);
    if (!definition) throw new Error('Choose a supported prepared teaching case.');
    context.mode = 'case';
    context.synthetic = true;
    context.availableIds = [...DEMO_IDS];
    delete context.toothStudy;
    context.workflowId = null;
    context.caseId = definition.id;
    context.caseVariantId = definition.variants[0].id;
    context.caseExploring = false;
    context.playing = false;
    return;
  }
  const definition =
    context.mode === 'case' && TEACHING_CASES.find(item => item.id === context.caseId);
  if (!definition) throw new Error('Load a prepared teaching case first.');
  if (action.action === 'variant' && !definition.variants.some(item => item.id === action.id))
    throw new Error(
      `Choose an authored variation: ${definition.variants.map(item => item.title).join('; ')}.`,
    );
  if (context.caseExploring && ['variant', 'play', 'reset', 'progress'].includes(action.action))
    throw new Error('Return to the prepared case before changing its variation or playback.');
  if (action.action === 'variant') {
    context.caseVariantId = action.id;
    context.playing = false;
  }
  if (action.action === 'play') context.playing = true;
  if (action.action === 'pause' || action.action === 'reset' || action.action === 'progress')
    context.playing = false;
  if (action.action === 'explore') {
    if (context.caseExploring)
      throw new Error('This arrangement is already open for free exploration.');
    context.caseExploring = true;
    context.playing = false;
  }
  if (action.action === 'return') {
    context.caseExploring = false;
    context.playing = false;
  }
}
