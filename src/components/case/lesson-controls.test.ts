import { expect, it, vi } from 'vitest';
import { LESSONS } from '@/lib/lessons';
import { createTeachingRuntime } from '@/lib/teaching-runtime';
import { caseNarration } from './narration';
import { setupToothStudy } from './tooth-study.fixtures';

const tour = LESSONS.find(lesson => lesson.id === 'tooth-anatomy-tour')!;

function setup() {
  const fixture = setupToothStudy();
  const { api, host } = fixture;
  api.setModel({
    ...api.model,
    teeth: [
      ...api.model.teeth,
      ...['13', '14'].map(id => ({ ...api.model.teeth[0], id, name: id })),
    ],
  });
  Object.defineProperties(api, {
    ids: { get: () => api.model.teeth.map(tooth => tooth.id) },
    currentLesson: { get: () => LESSONS.find(lesson => lesson.id === api.lessonId) },
  });
  const initialContext = host.context;
  host.context = () => ({
    ...initialContext(),
    availableIds: api.ids,
    lessonActive: !!api.lessonId,
    canReturnToLesson: !!api.lessonId,
    tryMode: true,
    canStepStages: false,
  });
  host.narration = target => caseNarration(api, target);
  host.speak = vi.fn(async () => {});
  return { ...fixture, runtime: createTeachingRuntime(host) };
}

it('starts on 11, advances every authored side and tooth, then returns to the full mouth', async () => {
  const { api, host, runtime, refs } = setup();
  await runtime.submit('start the tooth anatomy tour', { interpreter: 'ai' });
  expect(api.lessonId).toBe(tour.id);
  expect(api.lessonStep).toBe(0);
  expect(api.toothStudy).toMatchObject({ tooth: '11', view: 'buccal' });
  for (let step = 0; step < tour.steps.length; step++) {
    if (step > 0) await runtime.submit('next');
    expect(api.lessonStep).toBe(step);
    await runtime.submit('explain this step');
    expect(host.speak).toHaveBeenLastCalledWith(tour.steps[step].caption, expect.any(AbortSignal));
  }
  expect(api.toothStudy).toBeNull();
  expect(api.isolated).toBe(false);
  expect(api.arch).toBe('both');
  expect(refs.pendingView.current).toBe('perspective');
  expect(host.interpret).not.toHaveBeenCalled();
  runtime.dispose();
});

it('restores isolated views on previous/restart and undoes the complete start request', async () => {
  const { api, runtime } = setup();
  const original = api.captureClassroom();
  await runtime.submit('start the tooth tour');
  await runtime.submit('undo that');
  expect(api.captureClassroom()).toEqual(original);
  await runtime.submit('redo that');
  await runtime.submit('next');
  expect(api.toothStudy).toMatchObject({ tooth: '11', view: 'lingual' });
  await runtime.submit('next');
  expect(api.toothStudy).toMatchObject({ tooth: '13', view: 'buccal' });
  await runtime.submit('previous');
  expect(api.lessonStep).toBe(1);
  expect(api.toothStudy).toMatchObject({ tooth: '11', view: 'lingual' });
  await runtime.submit('restart lesson');
  expect(api.lessonStep).toBe(-1);
  expect(api.toothStudy).toBeNull();
  await runtime.submit('next');
  expect(api.toothStudy).toMatchObject({ tooth: '11', view: 'buccal' });
  runtime.dispose();
});

it.each(['end the tooth tour', 'back to the full mouth'])(
  'ends the active tour through %s and supports whole-request undo',
  async text => {
    const { api, runtime } = setup();
    await runtime.submit('start the tooth tour');
    await runtime.submit('next');
    await runtime.submit(text);
    expect(api.lessonId).toBe('');
    expect(api.toothStudy).toBeNull();
    expect(api.isolated).toBe(false);
    expect(api.arch).toBe('both');
    await runtime.submit('undo that');
    expect(api.lessonId).toBe(tour.id);
    expect(api.toothStudy).toMatchObject({ tooth: '11', view: 'lingual' });
    runtime.dispose();
  },
);

it('rejects a missing-root model before starting the tour', async () => {
  const { api, runtime, host } = setup();
  api.setModel({
    ...api.model,
    teeth: api.model.teeth.map(tooth =>
      tooth.id === '14' ? { ...tooth, rootGeometry: undefined } : tooth,
    ),
  });
  const before = api.captureClassroom();
  await runtime.submit('start the tooth tour', { interpreter: 'ai' });
  expect(api.captureClassroom()).toEqual(before);
  expect(host.interpret).not.toHaveBeenCalled();
  runtime.dispose();
});

it('clears a glossary card on start and leaves tooth study when choosing a geometric lesson', async () => {
  const { api, runtime } = setup();
  api.setGlossaryId('torque');
  await runtime.submit('start the tooth tour');
  expect(api.glossaryId).toBeNull();
  await runtime.submitActions(
    [{ kind: 'lesson', action: 'start', id: 'translation-tip-torque' }],
    'Start geometric lesson',
  );
  expect(api.lessonId).toBe('translation-tip-torque');
  expect(api.lessonStep).toBe(-1);
  expect(api.toothStudy).toBeNull();
  expect(api.isolated).toBe(false);
  expect(api.arch).toBe('both');
  runtime.dispose();
});
