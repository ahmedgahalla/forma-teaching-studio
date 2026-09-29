import { describe, expect, it, vi } from 'vitest';
import { parseTeachingPlan } from './plan-build';
import { validateTeachingPlan } from './plan-validate';
import { validateAction } from './validate-action';
import { advance } from './advance';
import { interpreterTeachingContext, teachingActionMode } from './context';
import { DEMO_IDS, type TeachingContext } from './types';
import { parseLocalVoicePlan, preserveLocalPlan } from '../teaching-runtime-local';
import type { PresentationAction } from './presentation';

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
  presentation: { documentId: 'lecture-1', index: 1, count: 3, mode: 'teach', exploring: false },
};
const plan = (actions: unknown[]) => ({ actions, summary: 'Lecture control', clarification: null });
const local = (actions: unknown[], state = context) =>
  validateTeachingPlan(plan(actions), state, { allowLocalActions: true });
const control = (action: PresentationAction['action']) => ({ kind: 'presentation', action });
const withoutLecture = { ...context, presentation: undefined };

describe('presentation command parity and precedence', () => {
  it.each([
    ['next', 'next'],
    ['next step', 'next'],
    ['next lecture step', 'next'],
    ['previous step', 'previous'],
    ['back lecture step', 'previous'],
    ['explore this step', 'explore'],
    ['explore this arrangement', 'explore'],
    ['explore a question', 'explore'],
    ['Explore this question', 'explore'],
    ['reveal answer', 'reveal'],
    ['show the answer', 'reveal'],
    ['hide answer', 'hide-answer'],
    ['show notes', 'notes'],
    ['Show presenter notes', 'notes'],
    ['hide the notes', 'hide-notes'],
    ['Hide presenter notes', 'hide-notes'],
    ['restart lecture', 'restart'],
    ['teach lecture', 'teach'],
    ['rehearse lecture', 'rehearse'],
    ['Rehearse', 'rehearse'],
    ['Teach', 'teach'],
    ['Present', 'teach'],
    ['Review notes', 'rehearse'],
    ['exit lecture', 'exit'],
    ['end lecture', 'exit'],
    ['exit lecture mode', 'exit'],
  ] as const)('shares click, typed and recognized voice actions: %s', (text, action) => {
    const actions = [control(action)];
    const typed = parseTeachingPlan(text, context);
    expect(typed.actions).toEqual(local(actions).actions);
    const preflight = vi.fn();
    expect(parseLocalVoicePlan(text, context, preflight)?.actions).toEqual(actions);
    expect(preflight).toHaveBeenCalledWith(actions);
    expect(preserveLocalPlan(typed)).toBe(true);
  });

  it.each(['Explore this question', 'Rehearse', 'Teach', 'Review notes', 'Present'])(
    'does not activate a presentation from the standalone command without a lecture: %s',
    text => {
      const original = structuredClone(withoutLecture),
        preflight = vi.fn();
      expect(() => parseTeachingPlan(text, withoutLecture)).toThrow();
      expect(parseLocalVoicePlan(text, withoutLecture, preflight)).toBeUndefined();
      expect(preflight).not.toHaveBeenCalled();
      expect(withoutLecture).toEqual(original);
    },
  );

  it.each([
    'prepare lecture',
    'Prepare the lecture.',
    'prepare lecture then front view',
    'front view and prepare lecture',
  ])('rejects retired editing commands locally without changing the scene: %s', text => {
    for (const state of [context, withoutLecture]) {
      const original = structuredClone(state),
        preflight = vi.fn();
      const parsed = parseTeachingPlan(text, state);
      expect(parsed).toMatchObject({
        actions: [],
        clarification: expect.stringMatching(/Choose a walkthrough/),
      });
      expect(preserveLocalPlan(parsed)).toBe(true);
      expect(parseLocalVoicePlan(text, state, preflight)).toBeUndefined();
      expect(preflight).not.toHaveBeenCalled();
      expect(state).toEqual(original);
    }
  });

  it('uses one-based step numbers and wins over legacy lesson navigation', () => {
    const state = { ...context, lessonActive: true, caseId: 'crowding' };
    expect(parseTeachingPlan('Go to lecture step 3.', state).actions).toEqual([
      { kind: 'presentation', action: 'go', index: 2 },
    ]);
    expect(parseTeachingPlan('next step', state).actions).toEqual([control('next')]);
    expect(parseTeachingPlan('reveal answer', state).actions).toEqual([control('reveal')]);
  });

  it.each(['return to lecture', 'return to lesson'])('returns only from exploration: %s', text => {
    const exploring = { ...context, presentation: { ...context.presentation!, exploring: true } };
    expect(parseTeachingPlan(text, exploring).actions).toEqual([control('return')]);
    expect(parseTeachingPlan(text, context)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/already in the lecture/),
    });
  });

  it('preserves legacy workflow navigation and answer controls outside custom lectures', () => {
    const workflow: TeachingContext = {
      ...withoutLecture,
      mode: 'workflow',
      workflowId: 'fixed-braces',
      stepIndex: 1,
    };
    expect(parseTeachingPlan('next step', workflow).actions).toEqual([
      { kind: 'workflow', action: 'next' },
    ]);
    expect(parseTeachingPlan('reveal answer', workflow).actions).toEqual([
      { kind: 'question', visible: true },
    ]);
  });

  it.each(['end lecture', 'exit lecture mode'])(
    'preserves the independent presentation layout control outside a lecture: %s',
    text => {
      expect(parseTeachingPlan(text, withoutLecture).actions).toEqual([
        { kind: 'lecture', enabled: false },
      ]);
    },
  );

  it.each(['next step and front view', 'front view then next step', 'show notes; hide answer'])(
    'keeps mixed requests as local clarification: %s',
    text => {
      const parsed = parseTeachingPlan(text, context);
      expect(parsed).toMatchObject({
        actions: [],
        clarification: expect.stringMatching(/separate request/),
      });
      expect(preserveLocalPlan(parsed)).toBe(true);
    },
  );

  it.each(['start anatomy lesson', 'demonstrate fixed braces'])(
    'prevents a built-in workflow from replacing the active lecture: %s',
    text => {
      expect(parseTeachingPlan(text, context)).toMatchObject({
        actions: [],
        clarification: expect.stringMatching(/Return to Explore/),
      });
    },
  );

  it('prevents returning to a built-in workflow while a custom lecture owns the scene', () => {
    expect(() => local([{ kind: 'workspace', action: 'lesson' }])).toThrow(/Return to Explore/);
  });
});

describe('presentation action validation and preflight', () => {
  it.each(['prepare', 'library'])(
    'rejects retired %s actions from controls and AI plans',
    action => {
      const retired = { kind: 'presentation', action };
      expect(() => validateAction(retired, context)).toThrow(/Unsupported/);
      expect(() => local([retired])).toThrow(/Unsupported/);
      expect(() => validateTeachingPlan(plan([retired]), context)).toThrow(/Unsupported/);
    },
  );

  it.each([-1, 100, 1.5, NaN, Infinity, '1'])('rejects invalid step index %s', index => {
    expect(() => validateAction({ ...control('go'), index }, context)).toThrow(
      /step from 1 to 100/,
    );
  });

  it.each([
    { ...control('open'), id: '' },
    { ...control('open'), id: ' ' },
    { ...control('open'), id: 'a'.repeat(101) },
    { ...control('open'), id: 1 },
    { ...control('next'), index: 1 },
    { ...control('go'), index: 1, id: 'x' },
    { ...control('open'), id: 'x', index: 0 },
    control('unknown' as 'next'),
  ])('rejects malformed action %#', action => {
    expect(() => validateAction(action, context)).toThrow();
  });

  it.each(['go to step', 'go to step 0', 'go to step 4', 'go to step 1.5', 'go to step banana'])(
    'keeps invalid navigation local: %s',
    text => {
      const parsed = parseTeachingPlan(text, context);
      expect(parsed.actions).toEqual([]);
      expect(parsed.clarification).toMatch(/step/);
      expect(preserveLocalPlan(parsed)).toBe(true);
    },
  );

  it('checks the current lecture bounds without changing caller context', () => {
    const original = structuredClone(context);
    expect(local([control('next')]).actions).toEqual([control('next')]);
    expect(context).toEqual(original);
    const last = { ...context, presentation: { ...context.presentation!, index: 2 } };
    expect(() => local([control('next')], last)).toThrow(/step from 1 to 3/);
    const first = { ...context, presentation: { ...context.presentation!, index: 0 } };
    expect(() => local([control('previous')], first)).toThrow(/step from 1 to 3/);
  });

  it('requires an active lecture except for opening a document or returning to Explore', () => {
    for (const action of ['next', 'return', 'notes', 'rehearse', 'teach'] as const)
      expect(() => local([control(action)], withoutLecture)).toThrow(/Open a lecture/);
    for (const action of [control('exit'), { ...control('open'), id: 'lecture-1' }]) {
      expect(local([action], withoutLecture).actions).toEqual([action]);
      expect(teachingActionMode(action as PresentationAction, 'workflow')).toBe('case');
    }
  });

  it('requires preview decisions before transitions but allows answer and note display', () => {
    const preview = { ...context, tryPreview: true };
    for (const action of ['next', 'exit', 'rehearse', 'teach', 'explore'] as const)
      expect(() => local([control(action)], preview)).toThrow(/Apply or discard/);
    expect(() => local([{ ...control('open'), id: 'another' }], preview)).toThrow(
      /Apply or discard/,
    );
    for (const action of ['reveal', 'hide-answer', 'notes', 'hide-notes'] as const)
      expect(local([control(action)], preview).actions).toEqual([control(action)]);
  });

  it('preserves the return path while exploring and advances metadata only', () => {
    const exploring = { ...context, presentation: { ...context.presentation!, exploring: true } };
    for (const action of ['next', 'previous', 'restart', 'rehearse', 'teach'] as const)
      expect(() => local([control(action)], exploring)).toThrow(/Return to the lecture/);
    for (const action of ['return', 'exit'] as const)
      expect(local([control(action)], exploring).actions).toEqual([control(action)]);
    const state = structuredClone(exploring);
    const overrides = { arch: false, view: false, selection: false };
    advance(state, { kind: 'presentation', action: 'return' }, overrides);
    expect(state.presentation?.exploring).toBe(false);
    advance(state, { kind: 'presentation', action: 'next' }, overrides);
    expect(state.presentation?.index).toBe(2);
    advance(state, { kind: 'presentation', action: 'rehearse' }, overrides);
    expect(state.presentation?.mode).toBe('rehearse');
    advance(state, { kind: 'presentation', action: 'exit' }, overrides);
    expect(state.presentation).toBeUndefined();
    expect(state.mode).toBe('case');
    expect(exploring.presentation.exploring).toBe(true);
  });

  it('rejects mixed action plans regardless of ordering', () => {
    const next = control('next'),
      view = { kind: 'view', view: 'front' };
    for (const actions of [
      [next, view],
      [view, next],
      [next, next],
    ])
      expect(() => local(actions)).toThrow(/separate request/);
  });

  it('does not send local lecture context or actions to the AI interpreter', () => {
    for (const action of [control('next'), control('exit'), { ...control('open'), id: 'x' }])
      expect(() => validateTeachingPlan(plan([action]), context)).toThrow(/local commands only/);
    const wire = interpreterTeachingContext({
      ...context,
      lastActions: [{ kind: 'presentation', action: 'notes' }],
    });
    expect(wire).not.toHaveProperty('presentation');
    expect(wire).not.toHaveProperty('lastActions');
    expect(context.presentation?.documentId).toBe('lecture-1');
  });
});
