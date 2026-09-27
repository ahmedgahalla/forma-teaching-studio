'use client';
import { useRef, useState } from 'react';
import type { CaseRefs, CaseStudioApi } from '../case/api';
import type { ClassroomSnapshot } from '../case/types';
import type { PresentationAction } from '@/lib/classroom/presentation';
import { createLectureSample } from '@/lib/lecture-documents';
import { createLectureSessionActions, EMPTY_LECTURE_SESSION } from './session';

export function useTeacherLectures(api: CaseStudioApi, refs: CaseRefs) {
  const [sample] = useState(createLectureSample);
  const [session, setSession] = useState(EMPTY_LECTURE_SESSION);
  const original = useRef<ClassroomSnapshot | null>(null),
    paused = useRef<ClassroomSnapshot | null>(null);
  const document = session.documentId === sample.id ? sample : undefined;
  /* eslint-disable react-hooks/refs -- factory only closes over return-point refs; reads occur in runtime callbacks, never during rendering */
  const actions = createLectureSessionActions(
    api,
    refs,
    session,
    setSession,
    id => (id === sample.id ? sample : undefined),
    document,
    original,
    paused,
  );
  /* eslint-enable react-hooks/refs */
  const send = (action: PresentationAction) => {
    void api.teaching.execute([action], 'Update lecture');
  };
  return {
    session,
    document,
    decorate: actions.decorate,
    active: session.screen === 'lecture',
    openSample: () => {
      if (!document) send({ kind: 'presentation', action: 'open', id: sample.id });
    },
    exit: () => send({ kind: 'presentation', action: 'exit' }),
    navigationProps: {
      mode: session.mode,
      index: session.index,
      count: document?.steps.length ?? 0,
      exploring: session.exploring,
      onMode: (mode: 'rehearse' | 'teach') => send({ kind: 'presentation', action: mode }),
      onPrevious: () => send({ kind: 'presentation', action: 'previous' }),
      onNext: () => send({ kind: 'presentation', action: 'next' }),
      onExplore: () => send({ kind: 'presentation', action: 'explore' }),
      onReturn: () => send({ kind: 'presentation', action: 'return' }),
    },
    panelProps: document
      ? {
          document,
          index: session.index,
          mode: session.mode,
          answerVisible: session.answerVisible,
          notesVisible: session.notesVisible,
          onReveal: () =>
            send({
              kind: 'presentation',
              action: session.answerVisible ? 'hide-answer' : 'reveal',
            }),
          onNotes: () =>
            send({ kind: 'presentation', action: session.notesVisible ? 'hide-notes' : 'notes' }),
        }
      : null,
  };
}
export type TeacherLectures = ReturnType<typeof useTeacherLectures>;
