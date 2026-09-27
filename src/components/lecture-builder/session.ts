import type { ClassroomSnapshot } from '../case/types';
import type { CaseRefs, CaseStudioApi } from '../case/api';
import type { TeachingAdapter } from '../teaching/TeachingController';
import type { LectureDocument, LectureSource } from '@/lib/lecture-documents';
import type { DentalCase } from '@/lib/geometry';
import type { PresentationAction } from '@/lib/classroom/presentation';
import { createTryState } from '@/lib/try-mode';
import { lectureStepSnapshot } from './scene-bridge';

export type LectureSession = {
  screen: 'explore' | 'library' | 'lecture';
  documentId: string | null;
  index: number;
  mode: 'prepare' | 'rehearse' | 'teach';
  exploring: boolean;
  answerVisible: boolean;
  notesVisible: boolean;
};
export const EMPTY_LECTURE_SESSION: LectureSession = {
  screen: 'explore',
  documentId: null,
  index: 0,
  mode: 'prepare',
  exploring: false,
  answerVisible: false,
  notesVisible: false,
};
export type LectureReturn = { current: ClassroomSnapshot | null };
type PausedLecture = ClassroomSnapshot & {
  lectureDisplay: Pick<LectureSession, 'answerVisible' | 'notesVisible'>;
};
export type LectureSourceRef = { current: { model: DentalCase; source: LectureSource } | null };
type TeacherSnapshot = ClassroomSnapshot & {
  teacher?: {
    session: LectureSession;
    original: ClassroomSnapshot | null;
    paused: ClassroomSnapshot | null;
    source: LectureSourceRef['current'];
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
  source: LectureSourceRef,
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
    if (!step) throw new Error('Choose a saved lecture step.');
    const snapshot = lectureStepSnapshot(step, api.captureClassroom());
    source.current = { model: snapshot.lesson.model, source: step.scene.source };
    restore(snapshot);
    api.setLecture(next.mode !== 'prepare');
    setSession({
      ...next,
      screen: 'lecture',
      exploring: false,
      answerVisible: false,
      notesVisible: next.mode === 'rehearse',
    });
  };
  const preflight = (action: PresentationAction) => {
    const display = ['reveal', 'hide-answer', 'notes', 'hide-notes'].includes(action.action);
    if (!display && (api.sandbox.pending || api.dragPreview || api.busy))
      throw new Error(
        'Apply or discard the preview and finish loading before changing lecture steps.',
      );
    if (action.action === 'open') {
      if (!getDocument(action.id)?.steps.length) throw new Error('Choose a saved lecture.');
      return;
    }
    if (action.action === 'library' || action.action === 'exit') return;
    if (!document) throw new Error('Open a lecture first.');
    if (session.exploring && !display && !['return', 'exit', 'library'].includes(action.action))
      throw new Error('Return to the lecture before changing steps.');
    if (action.action === 'return' && !paused.current)
      throw new Error('There is no paused lecture to return to.');
    const index =
      action.action === 'go'
        ? action.index
        : session.index + (action.action === 'next' ? 1 : action.action === 'previous' ? -1 : 0);
    if (index < 0 || index >= document.steps.length)
      throw new Error('That step is outside this lecture.');
  };
  const apply = (action: PresentationAction) => {
    preflight(action);
    if (action.action === 'library' || action.action === 'exit') {
      if (original.current) restore(original.current);
      original.current = paused.current = null;
      source.current = null;
      setSession({
        ...EMPTY_LECTURE_SESSION,
        screen: action.action === 'library' ? 'library' : 'explore',
      });
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
      api.setLecture(session.mode !== 'prepare');
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
      const mode = ['prepare', 'rehearse', 'teach'].includes(action.action)
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
        source: source.current,
      },
    }),
    restore: value => {
      const saved = value as TeacherSnapshot;
      adapter.restore(saved);
      if (saved.teacher) {
        setSession(saved.teacher.session);
        original.current = saved.teacher.original;
        paused.current = saved.teacher.paused;
        source.current = saved.teacher.source;
      }
    },
    preflight: (actions, from) => {
      const presentation = actions.find(a => a.kind === 'presentation');
      if (presentation?.kind === 'presentation') {
        preflight(presentation);
        return;
      }
      if (
        document &&
        !session.exploring &&
        session.mode !== 'prepare' &&
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
            ].includes(a.kind) ||
            (a.kind === 'case' && !['play', 'pause', 'progress', 'reset'].includes(a.action)) ||
            (a.kind === 'dental' && !['play', 'pause', 'undo', 'redo'].includes(a.command.type)),
        )
      )
        throw new Error('Choose Explore a question before changing this lecture model.');
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
