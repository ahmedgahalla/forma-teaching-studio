import { describe, expect, it, vi } from 'vitest';
import { parseTeachingPlan } from './plan-build';
import { validateAction } from './validate-action';
import { parseLocalVoicePlan } from '../teaching-runtime-local';
import { DEMO_IDS, type TeachingContext } from './types';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: 0,
  selected: '11',
  selectedIds: ['11'],
  availableIds: DEMO_IDS,
  synthetic: true,
  revision: 1,
  view: 'front',
  arch: 'both',
  speed: 1,
  presentation: { documentId: 'sample', index: 0, count: 4, mode: 'teach', exploring: false },
};
describe('bounded lecture display commands', () => {
  it.each([
    ['compare translation', { action: 'compare', target: 'translation' }],
    ['compare tipping', { action: 'compare', target: 'tip' }],
    ['compare start', { action: 'compare', target: 'start' }],
    ['close comparison', { action: 'close-comparison' }],
    ['show biology', { action: 'biology', view: 'overview' }],
    ['show compression', { action: 'biology', view: 'compression' }],
    ['show tension', { action: 'biology', view: 'tension' }],
    ['hide biology', { action: 'hide-biology' }],
    ['focus teaching tooth', { action: 'focus-tooth' }],
    ['show surrounding teeth', { action: 'show-context' }],
    ['Starting arrangement', { action: 'compare', target: 'start' }],
    ['Translation example', { action: 'compare', target: 'translation' }],
    ['Tipping example', { action: 'compare', target: 'tip' }],
    ['Explain tissue response', { action: 'biology', view: 'overview' }],
    ['Both', { action: 'biology', view: 'overview' }],
    ['Compression', { action: 'biology', view: 'compression' }],
    ['Tension', { action: 'biology', view: 'tension' }],
    ['Close biology', { action: 'hide-biology' }],
    ['Focus teaching teeth', { action: 'focus-tooth' }],
    ['Show full model', { action: 'show-context' }],
    ['Fit model', { action: 'fit-view' }],
    ['fit view', { action: 'fit-view' }],
  ])('matches click actions for typed and recognized speech: %s', (text, properties) => {
    const actions = [{ kind: 'presentation', ...properties }];
    expect(parseTeachingPlan(text as string, context).actions).toEqual(actions);
    expect(parseLocalVoicePlan(text as string, context, vi.fn())?.actions).toEqual(actions);
  });
  it.each([
    { action: 'compare', target: 'clinical' },
    { action: 'biology', view: 'stress' },
    { action: 'biology', view: 'compression', tooth: '11' },
    { action: 'focus-tooth', strength: 10 },
    { action: 'fit-view', tooth: '11' },
  ])('rejects unsupported targets and extra fields', properties => {
    expect(() => validateAction({ kind: 'presentation', ...properties }, context)).toThrow();
  });
  it('rejects compound scene mutations and comparison during question exploration', () => {
    expect(
      parseTeachingPlan('show biology then move tooth 11 buccally 1 mm', context).clarification,
    ).toMatch(/separate request/);
    expect(
      parseTeachingPlan('compare tipping', {
        ...context,
        presentation: { ...context.presentation!, exploring: true },
      }).clarification,
    ).toMatch(/Return to the lecture/);
  });
});
