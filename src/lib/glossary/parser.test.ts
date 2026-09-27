import { describe, expect, it } from 'vitest';
import {
  parseTeachingPlan,
  validateTeachingPlan,
  interpreterTeachingContext,
  teachingActionMode,
  type TeachingContext,
} from '../classroom';
import { DEMO_IDS } from '../classroom/types';
import { GLOSSARY } from './index';
import { glossaryActions } from './plan';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: -1,
  selected: '11',
  selectedIds: ['11'],
  availableIds: [...DEMO_IDS],
  synthetic: true,
  revision: 0,
  view: 'perspective',
  arch: 'both',
  speed: 1,
};

describe('local authored glossary grammar', () => {
  it.each([
    'what is torque',
    "what's torque",
    'define torque',
    'explain torque',
    'tell me about torque',
    'show me torque',
  ])('resolves %s to the exact visual and definition', text => {
    expect(parseTeachingPlan(text, context)).toMatchObject({
      actions: glossaryActions('torque'),
      clarification: null,
    });
  });
  it('supports recognizer aliases and plurals', () => {
    expect(parseTeachingPlan('what is the cusp of karabelli?', context).actions).toEqual(
      glossaryActions('cusp-of-carabelli'),
    );
    expect(parseTeachingPlan('what are mamelons', context).actions).toEqual(
      glossaryActions('mamelons'),
    );
  });
  it('resolves every authored term through the classroom normalizer', () => {
    for (const entry of GLOSSARY)
      expect(parseTeachingPlan(`define ${entry.term}`, context).actions, entry.term).toEqual(
        glossaryActions(entry.id),
      );
  });
  it.each([
    'show roots',
    'show the upper arch',
    'explain this tooth',
    'what is this tooth',
    'explain this step',
    'explain this step then hide gums',
  ])('preserves existing command precedence for %s', text => {
    const plan = parseTeachingPlan(text, { ...context, lessonActive: true });
    expect(plan.clarification).toBeNull();
    expect(plan.actions.some(action => action.kind === 'glossary')).toBe(false);
  });
  it.each(['what is quantum enamel', 'define unknown', 'explain unknown', 'tell me about unknown'])(
    'clarifies %s locally',
    text => {
      expect(parseTeachingPlan(text, context)).toMatchObject({
        actions: [],
        clarification: expect.stringContaining('Try'),
      });
    },
  );
  it.each(['close the definition', 'hide that'])('closes by %s', text =>
    expect(parseTeachingPlan(text, context).actions).toEqual([{ kind: 'glossary', id: null }]),
  );
});

describe('strict glossary action and interpreter boundary', () => {
  const plan = (actions: unknown[]) => ({ actions, summary: 'Explanation', clarification: null });
  it.each([
    { kind: 'glossary' },
    { kind: 'glossary', id: 16 },
    { kind: 'glossary', id: 'unknown' },
    { kind: 'glossary', id: 'torque', text: 'invented' },
  ])('rejects malformed actions %j', action =>
    expect(() =>
      validateTeachingPlan(plan([action]), context, { allowLocalActions: true }),
    ).toThrow(),
  );
  it('rejects external glossary actions and permits both local shapes', () => {
    for (const id of ['torque', null]) {
      const action = { kind: 'glossary', id };
      expect(() => validateTeachingPlan(plan([action]), context)).toThrow(/local commands only/);
      expect(
        validateTeachingPlan(plan([action]), context, { allowLocalActions: true }).actions,
      ).toEqual([action]);
    }
  });
  it('strips state and mixed history without mutating the input', () => {
    const original = { ...context, glossaryId: 'torque', lastActions: glossaryActions('torque') };
    const wire = interpreterTeachingContext(original);
    expect(wire).not.toHaveProperty('glossaryId');
    expect(wire).not.toHaveProperty('lastActions');
    expect(original.glossaryId).toBe('torque');
    expect(teachingActionMode({ kind: 'glossary', id: 'torque' }, 'workflow')).toBe('case');
  });
  it('permits only exact authored sequences across the prepared case boundary', () => {
    const actions = glossaryActions('torque');
    expect(
      validateTeachingPlan(plan(actions), context, { allowLocalActions: true }).actions,
    ).toEqual(actions);
    expect(() =>
      validateTeachingPlan(
        plan([...actions.slice(0, -1), { kind: 'glossary', id: 'tipping' }]),
        context,
        { allowLocalActions: true },
      ),
    ).toThrow(/separate request/);
    expect(() => validateTeachingPlan(plan(actions), context)).toThrow(/local commands only/);
  });
});
