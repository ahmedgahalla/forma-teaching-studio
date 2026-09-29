import { describe, expect, it, vi } from 'vitest';
import { parseTeachingPlan } from './plan-build';
import { validateTeachingPlan } from './plan-validate';
import { teachingActionMode } from './context';
import { DEMO_IDS, type TeachingContext } from './types';
import { parseLocalVoicePlan, preserveLocalPlan } from '../teaching-runtime-local';
import { FEATURED_LECTURE_ID, SAMPLE_LECTURE_ID } from '../lecture-documents/constants';
import { isPresentationDisplay, type PresentationAction } from './presentation';

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
};
const active: TeachingContext = {
  ...context,
  presentation: {
    documentId: SAMPLE_LECTURE_ID,
    index: 2,
    count: 4,
    mode: 'teach',
    exploring: false,
  },
};
const opening: PresentationAction = {
  kind: 'presentation',
  action: 'open',
  id: FEATURED_LECTURE_ID,
};
const fit: PresentationAction = { kind: 'presentation', action: 'fit-view' };
const validate = (action: PresentationAction, state = context) =>
  validateTeachingPlan({ actions: [action], summary: 'Control', clarification: null }, state, {
    allowLocalActions: true,
  });

describe('ready-made lecture entry and workspace controls', () => {
  it.each(['Lecture', 'open lecture', 'open sample lecture', 'start sample lecture'])(
    'matches the Lecture button for text and local voice: %s',
    text => {
      const plan = parseTeachingPlan(text, context),
        preflight = vi.fn();
      const expected = {
        ...opening,
        id: text.includes('sample') ? SAMPLE_LECTURE_ID : FEATURED_LECTURE_ID,
      };
      expect(plan.actions).toEqual(validate(expected).actions);
      expect(parseLocalVoicePlan(text, context, preflight)?.actions).toEqual([expected]);
      expect(preflight).toHaveBeenCalledWith([expected]);
      expect(preserveLocalPlan(plan)).toBe(true);
    },
  );

  it.each(['Explore', 'return to explore'])('matches the active Explore button: %s', text => {
    const action: PresentationAction = { kind: 'presentation', action: 'exit' };
    for (const exploring of [false, true]) {
      const state = { ...active, presentation: { ...active.presentation!, exploring } };
      expect(parseTeachingPlan(text, state).actions).toEqual(validate(action, state).actions);
      expect(parseLocalVoicePlan(text, state, vi.fn())?.actions).toEqual([action]);
      expect(preserveLocalPlan(parseTeachingPlan(text, state))).toBe(true);
    }
    expect(parseLocalVoicePlan(text, context, vi.fn())).toBeUndefined();
  });

  it.each([
    'lecture and front view',
    'front view then open lecture',
    'open sample lecture; show roots',
    'start sample lecture then next step',
  ])('clarifies compound entry locally before a lecture exists: %s', text => {
    const plan = parseTeachingPlan(text, context),
      preflight = vi.fn();
    expect(plan.actions).toEqual([]);
    expect(plan.clarification).toMatch(/separate request/);
    expect(preserveLocalPlan(plan)).toBe(true);
    expect(parseLocalVoicePlan(text, context, preflight)).toBeUndefined();
    expect(preflight).not.toHaveBeenCalled();
  });

  it('routes prepared cases and workflows into the same case presentation adapter', () => {
    for (const state of [
      { ...context, caseId: 'crowding', caseExploring: false },
      { ...context, mode: 'workflow' as const, workflowId: 'fixed-braces' },
    ]) {
      const plan = parseTeachingPlan('open lecture', state);
      expect(plan.actions).toEqual([opening]);
      expect(teachingActionMode(plan.actions[0], state.mode)).toBe('case');
    }
  });

  it('protects previews at entry and exit while accepting an already open sample unchanged', () => {
    expect(parseTeachingPlan('Lecture', { ...context, tryPreview: true }).clarification).toMatch(
      /Apply or discard/,
    );
    expect(parseTeachingPlan('Explore', { ...active, tryPreview: true }).clarification).toMatch(
      /Apply or discard/,
    );
    const state = {
      ...active,
      tryPreview: true,
      presentation: { ...active.presentation!, exploring: true },
    };
    const original = structuredClone(state);
    expect(parseTeachingPlan('Lecture', state).actions).toEqual([
      { ...opening, id: SAMPLE_LECTURE_ID },
    ]);
    expect(state).toEqual(original);
  });

  it('keeps Fit as a bounded display action requiring a lecture', () => {
    expect(isPresentationDisplay(fit)).toBe(true);
    expect(() => validate(fit)).toThrow(/Open a lecture/);
    for (const text of ['fit model', 'fit view']) {
      const state = {
        ...active,
        tryPreview: true,
        presentation: { ...active.presentation!, exploring: true },
      };
      const plan = parseTeachingPlan(text, state);
      expect(plan.actions).toEqual([fit]);
      expect(preserveLocalPlan(plan)).toBe(true);
    }
    expect(() =>
      validateTeachingPlan({ actions: [fit], summary: 'Fit', clarification: null }, active),
    ).toThrow(/local commands only/);
  });

  it.each(['start lecture', 'enter lecture mode', 'lecture mode on'])(
    'preserves the separate legacy Present control: %s',
    text => {
      expect(parseTeachingPlan(text, context).actions).toEqual([
        { kind: 'lecture', enabled: true },
      ]);
    },
  );
});
