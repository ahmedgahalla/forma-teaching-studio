import { describe, expect, it, vi } from 'vitest';
import { parseTeachingPlan } from './plan-build';
import { validateTeachingPlan } from './plan-validate';
import { validateAction } from './validate-action';
import { interpreterTeachingContext } from './context';
import { DEMO_IDS, type TeachingContext } from './types';
import { parseLocalVoicePlan, preserveLocalPlan } from '../teaching-runtime-local';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: -1,
  selected: '11',
  selectedIds: ['11'],
  availableIds: DEMO_IDS,
  synthetic: true,
  revision: 0,
  view: 'front',
  arch: 'both',
  speed: 1,
  jawAvailable: true,
  jawOpen: false,
};
describe('local jaw display commands', () => {
  it.each([
    ['open jaw', true],
    ['close jaw', false],
    ['open the mouth', true],
    ['shut the mouth', false],
    ['Could you please open the jaw?', true],
  ] as const)('gives typing and speech the same bounded action: %s', (text, open) => {
    const plan = parseTeachingPlan(text, context);
    expect(plan.actions).toEqual([{ kind: 'jaw', open }]);
    expect(parseLocalVoicePlan(text, context, vi.fn())?.actions).toEqual(plan.actions);
    expect(preserveLocalPlan(plan)).toBe(true);
  });
  it.each([
    { jawAvailable: false },
    { mode: 'workflow' as const, workflowId: 'fixed-braces', stepIndex: 0 },
    { toothStudy: { tooth: '11', view: 'buccal' as const } },
  ])('refuses unsupported scenes without falling back to AI', change => {
    const plan = parseTeachingPlan('open jaw', { ...context, ...change });
    expect(plan.actions).toEqual([]);
    expect(plan.clarification).toMatch(/Atlas mouth/);
    expect(preserveLocalPlan(plan)).toBe(true);
  });
  it('permits the same reference-view command during a lecture', () => {
    const plan = parseTeachingPlan('open jaw', {
      ...context,
      presentation: { documentId: 'demo', index: 0, count: 4, mode: 'teach', exploring: false },
    });
    expect(plan.actions).toEqual([{ kind: 'jaw', open: true }]);
  });
  it.each(['open jaw then move tooth 11 1 mm x', 'do not open jaw', 'open jaw 30 degrees'])(
    'rejects additional or negated intent: %s',
    text => {
      expect(parseTeachingPlan(text, context).actions).toEqual([]);
      expect(parseTeachingPlan(text, context).clarification).toMatch(/separate display request/);
    },
  );
  it.each([
    { kind: 'jaw', open: 1 },
    { kind: 'jaw', open: true, degrees: 30 },
  ])('validates booleans and forbids arbitrary hinge angles', action => {
    expect(() => validateAction(action, context)).toThrow();
  });
  it('keeps the action and capability out of the external AI contract', () => {
    const plan = {
      actions: [{ kind: 'jaw', open: true }],
      summary: 'Open jaw',
      clarification: null,
    };
    expect(() => validateTeachingPlan(plan, context)).toThrow(/local commands only/);
    const wire = interpreterTeachingContext({
      ...context,
      lastActions: [{ kind: 'jaw', open: true }],
    });
    expect(wire).not.toHaveProperty('jawAvailable');
    expect(wire).not.toHaveProperty('jawOpen');
    expect(wire).not.toHaveProperty('lastActions');
  });
});
