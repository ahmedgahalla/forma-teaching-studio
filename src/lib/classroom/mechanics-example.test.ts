import { describe, expect, it, vi } from 'vitest';
import { parseTeachingPlan } from './plan-build';
import { validateAction } from './validate-action';
import { validateTeachingPlan } from './plan-validate';
import { interpreterTeachingContext } from './context';
import { DEMO_IDS, type TeachingContext } from './types';
import { MECHANICS_EXAMPLES } from '../mechanics-examples/catalog';
import { parseLocalVoicePlan, preserveLocalPlan } from '../teaching-runtime-local';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: 0,
  selected: '11',
  selectedIds: ['11'],
  availableIds: DEMO_IDS,
  synthetic: true,
  revision: 0,
  arch: 'both',
  view: 'front',
  speed: 1,
};
const action = { kind: 'mechanics-example' as const, id: 'crown-pull' as const, variant: 'buccal' };
const plan = { actions: [action], summary: 'Example', clarification: null };

describe('local mechanics example command contract', () => {
  it('keeps previous anchorage names equivalent to the visible TAD example', () => {
    const earlier = parseTeachingPlan(
      'show mechanics example reciprocal and fixed anchorage ideal fixed anchor',
      context,
    );
    const current = parseTeachingPlan(
      'show mechanics example tooth anchorage vs TAD TAD and elastic',
      context,
    );
    expect(current.clarification).toBeNull();
    expect(current.actions).toEqual([
      { kind: 'mechanics-example', id: 'anchorage', variant: 'fixed' },
    ]);
    expect(earlier.actions).toEqual(current.actions);
  });

  it('accepts the spoken counter couple without punctuation', () => {
    expect(
      parseTeachingPlan(
        'show mechanics example pull with a counter couple half counter couple',
        context,
      ).actions,
    ).toEqual([{ kind: 'mechanics-example', id: 'counter-couple', variant: 'half' }]);
  });
  it.each(
    MECHANICS_EXAMPLES.flatMap(example =>
      example.variants.map(variant => ({
        id: example.id,
        variant: variant.id,
        command: `Show mechanics example ${example.title} ${variant.label}`,
      })),
    ),
  )(
    'matches visible choice, typed command and local voice: $command',
    ({ id, variant, command }) => {
      const preflight = vi.fn();
      const typed = parseTeachingPlan(command, context);
      expect(typed.clarification).toBeNull();
      expect(typed.actions).toEqual([{ kind: 'mechanics-example', id, variant }]);
      expect(parseLocalVoicePlan(command, context, preflight)).toEqual(typed);
      expect(preflight).toHaveBeenCalledWith(typed.actions);
      expect(preserveLocalPlan(typed)).toBe(true);
    },
  );
  it.each([
    'show mechanics example crown pull and hide roots',
    'show roots then show mechanics example crown pull',
    'show mechanics example unknown',
    'do not show mechanics example crown pull',
  ])('keeps unsupported or combined requests local and nonexecuting: %s', command => {
    const parsed = parseTeachingPlan(command, context);
    expect(parsed.actions).toEqual([]);
    expect(parsed.clarification).toBeTruthy();
    expect(preserveLocalPlan(parsed)).toBe(true);
  });
  it.each([
    { synthetic: false },
    { mode: 'workflow' as const, workflowId: 'fixed-braces' },
    { tryPreview: true },
    { lockedIds: ['11'] },
    { lessonActive: true },
    {
      presentation: {
        documentId: 'sample',
        index: 0,
        count: 2,
        mode: 'teach' as const,
        exploring: false,
      },
    },
  ])('rejects unavailable contexts before movement: %j', change => {
    expect(
      parseTeachingPlan('show mechanics example crown pull', { ...context, ...change }).actions,
    ).toEqual([]);
  });
  it('allows an explicit lecture exploration and rejects imported appliance data from AI', () => {
    const exploring = {
      ...context,
      presentation: {
        documentId: 'sample',
        index: 0,
        count: 2,
        mode: 'teach' as const,
        exploring: true,
      },
    };
    expect(validateTeachingPlan(plan, exploring, { allowLocalActions: true }).actions).toEqual([
      action,
    ]);
    expect(() => validateTeachingPlan(plan, context)).toThrow(/local commands/);
    expect(() =>
      validateTeachingPlan(plan, context, { sourceText: 'show mechanics example crown pull' }),
    ).toThrow(/local commands/);
    expect(
      interpreterTeachingContext({ ...context, lastActions: [action] }).lastActions,
    ).toBeUndefined();
  });
  it.each([
    { ...action, id: 'unknown' },
    { ...action, variant: 'unknown' },
    { ...action, forceN: 100 },
    { ...action, variant: undefined },
  ])('strictly rejects noncatalog data: %j', value =>
    expect(() => validateAction(value, context)).toThrow(),
  );
  it('requires a complete request and the authored target IDs', () => {
    expect(() =>
      validateTeachingPlan({ ...plan, actions: [action, { kind: 'stop' }] }, context, {
        allowLocalActions: true,
      }),
    ).toThrow(/separate/);
    expect(
      parseTeachingPlan('show mechanics example reciprocal and fixed anchorage', {
        ...context,
        availableIds: ['11'],
      }).clarification,
    ).toMatch(/needs teeth/);
  });
});
