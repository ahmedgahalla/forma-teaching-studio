import { expect, it } from 'vitest';
import { parseTeachingPlan, validateTeachingPlan, type TeachingContext } from '../classroom';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: 0,
  selected: '13',
  selectedIds: ['13'],
  availableIds: ['13'],
  synthetic: true,
  revision: 0,
  view: 'perspective',
  arch: 'both',
  speed: 1,
  tryMode: false,
};

it.each([{}, { caseId: 'crowding' }, { tryMode: true }, { synthetic: false }])(
  'allows displacement display in an ordinary, prepared, Try or imported case: %j',
  state => {
    for (const visible of [true, false]) {
      const current = { ...context, ...state };
      const plan = parseTeachingPlan(`${visible ? 'show' : 'hide'} displacement traces`, current);
      expect(plan.clarification).toBeNull();
      expect(plan.actions).toEqual([{ kind: 'try-display', target: 'traces', visible }]);
      expect(validateTeachingPlan(plan, current, { allowLocalActions: true }).actions).toEqual(
        plan.actions,
      );
      expect(() => validateTeachingPlan(plan, current)).toThrow(/local commands only/);
    }
  },
);

it('retains Try-only curve/playback controls and excludes the independent workflow viewer', () => {
  expect(parseTeachingPlan('show arch curve', context).clarification).toMatch(/Enter Try Mode/);
  expect(parseTeachingPlan('play in reverse', context).clarification).toMatch(/Enter Try Mode/);
  const workflow = { ...context, mode: 'workflow' as const, workflowId: 'fixed-braces' };
  expect(parseTeachingPlan('show displacement traces', workflow).actions).toEqual([]);
});
