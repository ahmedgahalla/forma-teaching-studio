import { describe, expect, it, vi } from 'vitest';
import { createLectureSample } from '@/lib/lecture-documents';
import { sceneAnalysisContext } from '@/lib/scene-analysis';
import type { CaseRefs, CaseStudioApi } from '../case/api';
import type { TeachingAdapter } from '../teaching/TeachingController';
import { lectureAnalysisContext } from './lecture-analysis';
import { createLectureSessionActions, EMPTY_LECTURE_SESSION, type LectureSession } from './session';

function fixture(index = 0) {
  const document = createLectureSample();
  const context = sceneAnalysisContext({
    synthetic: true,
    ids: ['11', '21'],
    selectedIds: ['11'],
    transforms: { '11': { translation: [0, 0, 1.2], rotation: [0, 0, 7] } },
    arch: 'upper',
    roots: true,
    gums: false,
    bone: false,
    lesson: { title: 'Old prepared case', explanation: 'OLD_PREPARED_ANSWER' },
  });
  const session: LectureSession = {
    ...EMPTY_LECTURE_SESSION,
    screen: 'lecture',
    documentId: document.id,
    index,
  };
  return { document, context, session };
}

describe('lecture scene explanation facts', () => {
  it.each([0, 3])(
    'supplies the static lecture step %s instead of unrelated case content',
    index => {
      const { document, context, session } = fixture(index);
      const facts = lectureAnalysisContext(context, document, session);
      expect(facts.lesson?.title).toBe(document.title);
      expect(facts.lesson?.explanation).toContain(document.steps[index].title);
      expect(facts.lesson?.explanation).toContain(document.steps[index].question);
      expect(facts.lesson?.explanation).toContain('static authored pose');
      expect(JSON.stringify(facts)).not.toContain('OLD_PREPARED_ANSWER');
      expect(context.lesson?.title).toBe('Old prepared case');
    },
  );

  it('omits hidden answers and all private notes, even with notes visible', () => {
    const { document, context, session } = fixture();
    document.steps[0].answer = 'PRIVATE_UNREVEALED_ANSWER';
    document.steps[0].notes = 'PRIVATE_PRESENTER_NOTES';
    const facts = lectureAnalysisContext(context, document, { ...session, notesVisible: true });
    expect(facts.lesson?.explanation).toContain('answer is hidden');
    expect(JSON.stringify(facts)).not.toMatch(/PRIVATE_|OLD_PREPARED/);
    const revealed = lectureAnalysisContext(context, document, { ...session, answerVisible: true });
    expect(revealed.lesson?.explanation).toContain(
      'Revealed lecture answer: PRIVATE_UNREVEALED_ANSWER',
    );
    expect(JSON.stringify(revealed)).not.toContain('PRIVATE_PRESENTER_NOTES');
    expect(revealed.lesson?.explanation).not.toContain('answer is hidden');
  });

  it.each([
    ['start', 'shared authored starting position'],
    ['translation', 'authored translation endpoint'],
    ['tip', 'authored tipping endpoint'],
    ['finish', 'authored finished arrangement'],
  ] as const)(
    'describes the displayed %s comparison separately from the current step',
    (comparison, label) => {
      const { document, context, session } = fixture(1);
      const facts = lectureAnalysisContext(context, document, { ...session, comparison });
      expect(facts.lesson?.explanation).toContain(`displayed model shows the ${label}`);
      expect(facts.lesson?.explanation).toContain(document.steps[1].title);
      expect(facts.lesson?.explanation).toContain(document.steps[1].question);
      expect(facts.lesson?.explanation).toContain('question and answer belong to the lecture step');
      expect(facts.lesson?.explanation).not.toContain(
        'This step has an authored movement demonstration',
      );
    },
  );

  it('preserves all geometry and calculation facts without inferring a playback position', () => {
    const { document, context, session } = fixture(1);
    context.result = {
      maxDisplacementMm: 0.012,
      maxRotationDeg: 0.23,
      assumptions: ['Initial elastic response.'],
      warnings: ['No remodeling calculated.'],
    };
    const facts = lectureAnalysisContext(context, document, session);
    expect({ ...facts, lesson: null }).toEqual({ ...context, lesson: null });
    expect(facts.result).toBe(context.result);
    expect(facts.teeth).toBe(context.teeth);
    expect(facts.lesson?.explanation).toContain('does not specify playback progress');
  });

  it('describes a cumulative motion step as authored movement while keeping its answer hidden', () => {
    const { document, context, session } = fixture();
    document.steps[0].motion = { from: {} };
    const facts = lectureAnalysisContext(context, document, session);
    expect(facts.lesson?.explanation).toContain('authored movement demonstration');
    expect(facts.lesson?.explanation).not.toContain('static authored pose');
    expect(facts.lesson?.explanation).not.toContain(document.steps[0].answer);
  });

  it('leaves Explore and absent-lecture context unchanged', () => {
    const { document, context, session } = fixture();
    expect(lectureAnalysisContext(context, document, { ...session, exploring: true })).toBe(
      context,
    );
    expect(lectureAnalysisContext(context, undefined, session)).toBe(context);
    expect(lectureAnalysisContext(context, document, EMPTY_LECTURE_SESSION)).toBe(context);
  });

  it('keeps every fixed sample step within the existing backend lesson contract', () => {
    const { document, context, session } = fixture();
    for (const [index] of document.steps.entries()) {
      for (const comparison of [null, 'start', 'translation', 'tip'] as const) {
        const lesson = lectureAnalysisContext(context, document, {
          ...session,
          index,
          comparison,
          answerVisible: true,
        }).lesson!;
        expect(lesson.title.length).toBeGreaterThan(0);
        expect(lesson.title.length).toBeLessThanOrEqual(160);
        expect(lesson.explanation.length).toBeLessThanOrEqual(4000);
      }
    }
  });
});

it('uses the current session reveal state in the real adapter decorator', () => {
  const { document, context, session: initialSession } = fixture(1);
  let session = initialSession;
  const api = { sandbox: { pending: null }, note: vi.fn() } as unknown as CaseStudioApi;
  const base = { analysisContext: () => context } as TeachingAdapter;
  const actions = () =>
    createLectureSessionActions(
      api,
      {} as CaseRefs,
      session,
      next => {
        session = next;
      },
      () => document,
      document,
      { current: null },
      { current: null },
      { current: null },
    );
  const read = () => actions().decorate(base).analysisContext!();
  expect(read().lesson?.explanation).not.toContain(document.steps[1].answer);
  actions().apply({ kind: 'presentation', action: 'reveal' });
  expect(read().lesson?.explanation).toContain(document.steps[1].answer);
  actions().apply({ kind: 'presentation', action: 'hide-answer' });
  expect(read().lesson?.explanation).not.toContain(document.steps[1].answer);
  session = { ...session, exploring: true };
  expect(read()).toBe(context);
  expect(actions().decorate({} as TeachingAdapter).analysisContext).toBeUndefined();
});
