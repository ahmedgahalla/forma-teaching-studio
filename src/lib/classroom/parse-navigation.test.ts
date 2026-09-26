import { describe, expect, it } from 'vitest';
import { parseTeachingPlan, type TeachingContext } from '../classroom';
import { parseNavigation } from './parse-navigation';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: 1,
  selected: '11',
  selectedIds: ['11'],
  availableIds: ['11', '21'],
  synthetic: true,
  revision: 1,
  view: 'front',
  arch: 'both',
  speed: 1,
  stage: 3,
  stages: 10,
};
const contexts = [
  { label: 'prepared case', state: { ...context, caseId: 'crowding' }, kind: 'stage' },
  { label: 'short lesson', state: { ...context, lessonActive: true }, kind: 'lesson-step' },
  {
    label: 'workflow with lesson flag',
    state: {
      ...context,
      mode: 'workflow' as const,
      workflowId: 'fixed-braces',
      lessonActive: true,
    },
    kind: 'workflow',
  },
];

describe.each(contexts)('contextual navigation: $label', ({ state, kind }) => {
  it.each(['next', 'next step', 'go on', 'continue', 'go to the next step'])(
    'uses the existing next action for %s',
    text => {
      expect(parseTeachingPlan(text, state).actions).toEqual([{ kind, action: 'next' }]);
    },
  );
  it.each(['back', 'previous', 'go back', 'previous step'])(
    'uses the existing previous action for %s',
    text => {
      expect(parseTeachingPlan(text, state).actions).toEqual([{ kind, action: 'previous' }]);
    },
  );
});

it('resolves each navigation clause against the newly advanced context', () => {
  expect(parseTeachingPlan('start braces workflow then continue', context).actions).toEqual([
    { kind: 'workflow', action: 'start', id: 'fixed-braces' },
    { kind: 'workflow', action: 'next' },
  ]);
  expect(parseTeachingPlan('next and previous', context).actions).toEqual([
    { kind: 'stage', action: 'next' },
    { kind: 'stage', action: 'previous' },
  ]);
});

it('retains existing stage bounds and explicit lesson navigation', () => {
  expect(parseTeachingPlan('next', { ...context, stage: 10 })).toMatchObject({
    actions: [],
    clarification: expect.stringMatching(/outside/),
  });
  expect(parseTeachingPlan('next lesson step', { ...context, lessonActive: true }).actions).toEqual(
    [{ kind: 'lesson-step', action: 'next' }],
  );
  expect(parseNavigation('do not continue', context)).toBeUndefined();
  expect(parseNavigation('next stage', context)).toBeUndefined();
});

it.each([
  { state: { ...context, stage: 0 }, text: 'previous step' },
  { state: { ...context, stage: 9 }, text: 'next and continue' },
  {
    state: { ...context, mode: 'workflow' as const, workflowId: 'anatomy', stepIndex: 3 },
    text: 'next',
  },
  {
    state: { ...context, mode: 'workflow' as const, workflowId: 'anatomy', stepIndex: 0 },
    text: 'go back',
  },
])(
  'clarifies out-of-range navigation locally without partial actions: $text',
  ({ state, text }) => {
    const before = structuredClone(state);
    expect(parseTeachingPlan(text, state)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/outside/),
    });
    expect(state).toEqual(before);
  },
);
