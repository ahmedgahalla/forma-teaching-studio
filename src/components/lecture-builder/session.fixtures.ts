import { vi } from 'vitest';
import type { CaseStudioApi, CaseRefs } from '../case/api';
import type { ClassroomSnapshot } from '../case/types';
import type { TeachingAdapter } from '../teaching/TeachingController';
import { createLectureSample } from '@/lib/lecture-documents';
import { createTeachingRuntime } from '@/lib/teaching-runtime';
import { createLectureSessionActions, EMPTY_LECTURE_SESSION } from './session';
import { lectureStepSnapshot } from './scene-bridge';

export function lectureHarness() {
  const document = createLectureSample();
  let snapshot = lectureStepSnapshot(document.steps[0], {} as ClassroomSnapshot);
  let session = { ...EMPTY_LECTURE_SESSION };
  let playing = false,
    shown = snapshot.lesson.transforms;
  const original = { current: null as ClassroomSnapshot | null };
  const paused = { current: null as ClassroomSnapshot | null };
  const comparison = { current: null as ClassroomSnapshot | null };
  const refs = {
    pendingView: { current: null },
    viewer: { current: { fit: vi.fn() } },
  } as unknown as CaseRefs;
  const set = (key: keyof ClassroomSnapshot, value: unknown) => {
    snapshot = { ...snapshot, [key]: value };
  };
  const api = {
    get sandbox() {
      return snapshot.sandbox;
    },
    get actualShown() {
      return shown;
    },
    get shown() {
      return shown;
    },
    get stages() {
      return snapshot.lesson.stages;
    },
    captureClassroom: () => snapshot,
    restoreClassroom: (value: ClassroomSnapshot) => {
      snapshot = value;
      shown = value.lesson.transforms;
      playing = false;
    },
    setPlaying: (value: boolean) => {
      playing = value;
    },
    setLecture: (value: boolean) => set('lecture', value),
    setScenario: (value: unknown) => set('scenario', value),
    setMechanics: (value: unknown) => set('mechanics', value),
    setToothStudy: (value: unknown) => set('toothStudy', value),
    setGlossaryId: (value: unknown) => set('glossaryId', value),
    setLessonId: (value: unknown) => set('lessonId', value),
    setLessonStep: (value: unknown) => set('lessonStep', value),
    setStage: (stage: number) => set('lesson', { ...snapshot.lesson, stage }),
    setSandbox: (value: unknown) => set('sandbox', value),
    dispatch: (value: { value: ClassroomSnapshot['history']['current'] }) =>
      set('history', { current: value.value, past: [], future: [] }),
    setToolsOpen: vi.fn(),
    setMobilePanel: vi.fn(),
    setCommandsOpen: vi.fn(),
    note: vi.fn(),
  } as unknown as CaseStudioApi;
  const adapter = (): TeachingAdapter =>
    createLectureSessionActions(
      api,
      refs,
      session,
      value => {
        session = value;
      },
      id => (id === document.id ? document : undefined),
      session.documentId ? document : undefined,
      original,
      paused,
      comparison,
    ).decorate({
      context: () => ({
        mode: 'case',
        workflowId: null,
        stepIndex: -1,
        selected: snapshot.lesson.selected,
        selectedIds: snapshot.lesson.selectedIds,
        availableIds: snapshot.lesson.model.teeth.map(t => t.id),
        synthetic: true,
        view: snapshot.lesson.view,
        arch: snapshot.lesson.arch,
        speed: 1,
        playing,
        tryPreview: !!snapshot.sandbox.pending,
        caseId: snapshot.scenario?.caseId,
        caseVariantId: snapshot.scenario?.variantId,
        tryMode: snapshot.sandbox.active,
        canStepStages: !!snapshot.scenario,
      }),
      capture: () => snapshot,
      restore: value => api.restoreClassroom(value as ClassroomSnapshot),
      preflight: () => {},
      apply: action => {
        if (action.kind === 'toggle')
          set('lesson', { ...snapshot.lesson, [action.target]: action.visible });
        return true;
      },
      pause: () => {
        playing = false;
      },
      narration: () => '',
    });
  const interpret = vi.fn();
  const runtime = createTeachingRuntime({
    context: () => ({ ...adapter().context(), revision: 0 }),
    capture: () => adapter().capture(),
    restore: value => adapter().restore(value),
    preflight: (actions, from) => adapter().preflight(actions, from),
    apply: async action => {
      await adapter().apply(action);
    },
    pause: () => adapter().pause(),
    narration: target => adapter().narration(target),
    speak: async () => {},
    interpret,
    publish: () => {},
  });
  return {
    document,
    api,
    refs,
    adapter,
    runtime,
    interpret,
    original,
    paused,
    get session() {
      return session;
    },
    get snapshot() {
      return snapshot;
    },
    open: () =>
      runtime.submitActions(
        [{ kind: 'presentation', action: 'open', id: document.id }],
        'Open lecture',
      ),
    changeScene: (value: ClassroomSnapshot) => {
      snapshot = value;
      shown = value.lesson.transforms;
    },
  };
}
