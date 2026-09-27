import type { ClassroomSnapshot } from '../case/types';
import type { CaseRefs, CaseStudioApi } from '../case/api';
import type { TeachingAdapter } from '../teaching/TeachingController';
import type { LectureDocument } from '@/lib/lecture-documents';
import type { PresentationAction } from '@/lib/classroom/presentation';
import { createTryState } from '@/lib/try-mode';
import { lectureStepSnapshot } from './scene-bridge';

export type LectureSession = {
  screen: 'explore' | 'lecture';
  documentId: string | null;
  index: number;
  mode: 'rehearse' | 'teach';
  exploring: boolean;
  answerVisible: boolean;
  notesVisible: boolean;
};
export const EMPTY_LECTURE_SESSION: LectureSession = {
  screen: 'explore',
  documentId: null,
  index: 0,
  mode: 'teach',
  exploring: false,
  answerVisible: false,
  notesVisible: false,
};
export type LectureReturn = { current: ClassroomSnapshot | null };
type PausedLecture = ClassroomSnapshot & {
  lectureDisplay: Pick<LectureSession, 'answerVisible' | 'notesVisible'>;
};
type TeacherSnapshot = ClassroomSnapshot & {
  teacher?: {
    session: LectureSession;
    original: ClassroomSnapshot | null;
    paused: ClassroomSnapshot | null;
  };
};

export function createLectureSessionActions(
  api: CaseStudioApi,
  refs: CaseRefs,
  session: LectureSession,
  setSession: (session: LectureSession) => void,
  getDocument: (id: string) => LectureDocument | undefined,
  document: LectureDocument | undefined,
  original: LectureReturn,
  paused: LectureReturn,
) {
  const restore = (saved: ClassroomSnapshot) => {
    api.restoreClassroom(saved);
    if (!saved.camera) refs.pendingView.current = saved.lesson.view;
    api.setToolsOpen(false);
    api.setMobilePanel('model');
    api.setCommandsOpen(false);
  };
  const loadStep = (next: LectureSession) => {
    const doc = next.documentId ? getDocument(next.documentId) : undefined;
    const step = doc?.steps[next.index];
    if (!step) throw new Error('Choose an available lecture step.');
    const snapshot = lectureStepSnapshot(step, api.captureClassroom());
    restore(snapshot);
    api.setLecture(true);
    setSession({
      ...next,
      screen: 'lecture',
      exploring: false,
      answerVisible: false,
      notesVisible: next.mode === 'rehearse',
    });
  };
  const preflight = (
    action: PresentationAction,
    state = session,
    doc = document,
    returnPoint = paused.current,
  ) => {
    const display = ['reveal', 'hide-answer', 'notes', 'hide-notes'].includes(action.action);
    if (!display && (api.sandbox.pending || api.dragPreview || api.busy))
      throw new Error(
        'Apply or discard the preview and finish loading before changing lecture steps.',
      );
    if (action.action === 'open') {
      if (!getDocument(action.id)?.steps.length) throw new Error('Choose an available lecture.');
      return;
    }
    if (action.action === 'exit') return;
    if (!doc) throw new Error('Open a lecture first.');
    if (state.exploring && !display && !['return', 'exit'].includes(action.action))
      throw new Error('Return to the lecture before changing steps.');
    if (action.action === 'return' && !returnPoint)
      throw new Error('There is no paused lecture to return to.');
    const index =
      action.action === 'go'
        ? action.index
        : state.index + (action.action === 'next' ? 1 : action.action === 'previous' ? -1 : 0);
    if (index < 0 || index >= doc.steps.length)
      throw new Error('That step is outside this lecture.');
  };
  const apply = (action: PresentationAction) => {
    preflight(action);
    if (action.action === 'exit') {
      if (original.current) restore(original.current);
      original.current = paused.current = null;
      setSession({ ...EMPTY_LECTURE_SESSION });
    } else if (action.action === 'open') {
      original.current ||= api.captureClassroom();
      paused.current = null;
      loadStep({ ...EMPTY_LECTURE_SESSION, documentId: action.id });
    } else if (action.action === 'explore') {
      paused.current = {
        ...api.captureClassroom(),
        lectureDisplay: {
          answerVisible: session.answerVisible,
          notesVisible: session.notesVisible,
        },
      } as PausedLecture;
      const transforms = structuredClone(api.shown);
      api.setPlaying(false);
      api.setScenario(null);
      api.setMechanics(null);
      api.setToothStudy(null);
      api.setGlossaryId(null);
      api.setLessonId('');
      api.setLessonStep(-1);
      api.dispatch({ type: 'load', value: transforms });
      api.setSandbox(createTryState(transforms, transforms));
      api.setStage(api.stages);
      api.setLecture(false);
      api.setToolsOpen(false);
      api.setMobilePanel('model');
      setSession({ ...session, exploring: true });
    } else if (action.action === 'return') {
      const saved = paused.current as PausedLecture;
      restore(saved);
      api.setLecture(true);
      paused.current = null;
      setSession({ ...session, ...saved.lectureDisplay, exploring: false });
    } else if (['reveal', 'hide-answer', 'notes', 'hide-notes'].includes(action.action)) {
      setSession({
        ...session,
        ...(['reveal', 'hide-answer'].includes(action.action)
          ? { answerVisible: action.action === 'reveal' }
          : { notesVisible: action.action === 'notes' }),
      });
    } else {
      const mode = ['rehearse', 'teach'].includes(action.action)
        ? (action.action as LectureSession['mode'])
        : session.mode;
      const index =
        action.action === 'go'
          ? action.index
          : action.action === 'restart'
            ? 0
            : session.index +
              (action.action === 'next' ? 1 : action.action === 'previous' ? -1 : 0);
      loadStep({ ...session, mode, index });
    }
    api.note('Lecture ready.');
    return true;
  };
  const decorate = (adapter: TeachingAdapter): TeachingAdapter => ({
    ...adapter,
    context: () => ({
      ...adapter.context(),
      ...(document
        ? {
            presentation: {
              documentId: document.id,
              index: session.index,
              count: document.steps.length,
              mode: session.mode,
              exploring: session.exploring,
            },
          }
        : {}),
    }),
    capture: () => ({
      ...(adapter.capture() as ClassroomSnapshot),
      teacher: {
        session,
        original: original.current,
        paused: paused.current,
      },
    }),
    restore: value => {
      const saved = value as TeacherSnapshot;
      adapter.restore(saved);
      if (saved.teacher) {
        setSession(saved.teacher.session);
        original.current = saved.teacher.original;
        paused.current = saved.teacher.paused;
      }
    },
    preflight: (actions, from) => {
      const saved = (from as TeacherSnapshot | undefined)?.teacher;
      const state = saved?.session ?? session;
      const doc = saved ? getDocument(saved.session.documentId ?? '') : document;
      const presentation = actions.find(a => a.kind === 'presentation');
      if (presentation?.kind === 'presentation') {
        preflight(presentation, state, doc, saved ? saved.paused : paused.current);
        return;
      }
      if (
        doc &&
        !state.exploring &&
        actions.some(
          a =>
            [
              'try',
              'mechanics',
              'dental-arrangement',
              'lesson',
              'workspace',
              'workflow',
              'anatomy-lesson',
              'tooth-study',
              'attachment',
              'lecture',
            ].includes(a.kind) ||
            (a.kind === 'case' && !['play', 'pause', 'progress', 'reset'].includes(a.action)) ||
            (a.kind === 'dental' && !['play', 'pause', 'undo', 'redo'].includes(a.command.type)),
        )
      )
        throw new Error('Choose Explore this question before changing this lecture model.');
      adapter.preflight(actions, from);
    },
    apply: (action, signal) =>
      action.kind === 'presentation' ? apply(action) : adapter.apply(action, signal),
    narration: target =>
      document && !session.exploring
        ? target === 'answer'
          ? session.answerVisible
            ? document.steps[session.index].answer
            : 'The answer is hidden. Reveal it when students are ready.'
          : document.steps[session.index].notes || document.steps[session.index].title
        : adapter.narration(target),
  });
  return { decorate, apply, preflight, loadStep };
}
