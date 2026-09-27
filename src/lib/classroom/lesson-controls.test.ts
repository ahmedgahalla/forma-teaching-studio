import { describe, expect, it } from 'vitest';
import { LESSONS } from '../lessons';
import { parseTeachingPlan, validateTeachingPlan, type TeachingContext } from '../classroom';
import { advance } from './advance';
import { parseLessonCommand, validateLessonAction } from './lesson-controls';
import { DEMO_IDS } from './types';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: 0,
  selected: '11',
  selectedIds: ['11'],
  availableIds: DEMO_IDS,
  synthetic: true,
  revision: 0,
  view: 'perspective',
  arch: 'both',
  speed: 1,
  lessonActive: false,
  tryMode: true,
  canStepStages: false,
};
const tour = LESSONS.find(lesson => lesson.id === 'tooth-anatomy-tour')!;

describe('authored tooth anatomy tour', () => {
  it.each(['start the tooth anatomy tour', 'start the tooth tour', 'open tooth anatomy tour'])(
    'starts locally from the default free workspace: %s',
    text => {
      expect(parseTeachingPlan(text, context).actions).toEqual([
        { kind: 'lesson', action: 'start', id: tour.id },
      ]);
    },
  );

  it('parses and validates every authored step sequentially from the free workspace', () => {
    expect(tour.steps).toHaveLength(10);
    const next = structuredClone(context);
    for (const step of tour.steps) {
      const plan = parseTeachingPlan(step.command, next);
      expect(plan.clarification).toBeNull();
      expect(plan.actions).toHaveLength(1);
      expect(validateTeachingPlan(plan, next, { allowLocalActions: true })).toEqual(plan);
      expect(
        parseLessonCommand(
          step.command,
          next.selected,
          next.availableIds,
          next.selectedIds,
          next.toothStudy,
        ),
      ).toEqual(plan.actions[0]);
      expect(step.caption.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
      advance(next, plan.actions[0], { arch: false, view: false, selection: false });
    }
    expect(next.toothStudy).toBeUndefined();
  });

  it.each(['end the tooth tour', 'close lesson', 'finish the tooth anatomy tour'])(
    'parses an explicit exit: %s',
    text => {
      expect(parseTeachingPlan(text, { ...context, lessonActive: true }).actions).toEqual([
        { kind: 'lesson', action: 'close' },
      ]);
    },
  );

  it.each([
    { ...context, synthetic: false },
    { ...context, tryPreview: true },
    { ...context, availableIds: ['11'] },
    { ...context, caseId: 'crowding' },
  ])('clarifies unavailable tour contexts locally', scene => {
    expect(parseTeachingPlan('start the tooth tour', scene)).toMatchObject({
      actions: [],
      clarification: expect.any(String),
    });
  });

  it('strictly rejects unknown lesson ids and unexpected fields', () => {
    for (const action of [
      { kind: 'lesson', action: 'start', id: 'invented' },
      { kind: 'lesson', action: 'start', id: tour.id, narration: 'invented' },
      { kind: 'lesson', action: 'close', id: tour.id },
      { kind: 'lesson', action: 'skip' },
    ])
      expect(() => validateLessonAction(action)).toThrow();
    expect(() =>
      validateTeachingPlan(
        {
          actions: [{ kind: 'lesson', action: 'start', id: tour.id }],
          summary: '',
          clarification: null,
        },
        context,
      ),
    ).toThrow();
  });
});
