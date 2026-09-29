'use client';
import { useRef, useState } from 'react';
import type { CaseRefs, CaseStudioApi } from '../case/api';
import type { ClassroomSnapshot } from '../case/types';
import type { LectureComparison, PresentationAction } from '@/lib/classroom/presentation';
import type { BiologyView } from '@/lib/teaching-biology';
import { createDemoLectures, DEMO_LECTURES } from '@/lib/lecture-documents';
import { FEATURED_LECTURE_ID } from '@/lib/lecture-documents/constants';
import { createLectureSessionActions, EMPTY_LECTURE_SESSION } from './session';

export function useTeacherLectures(api: CaseStudioApi, refs: CaseRefs) {
  const [documents] = useState(createDemoLectures);
  const [session, setSession] = useState(EMPTY_LECTURE_SESSION);
  const original = useRef<ClassroomSnapshot | null>(null),
    paused = useRef<ClassroomSnapshot | null>(null),
    comparison = useRef<ClassroomSnapshot | null>(null);
  const document = documents.find(item => item.id === session.documentId);
  /* eslint-disable react-hooks/refs -- factory only closes over return-point refs; reads occur in runtime callbacks, never during rendering */
  const actions = createLectureSessionActions(
    api,
    refs,
    session,
    setSession,
    id => documents.find(item => item.id === id),
    document,
    original,
    paused,
    comparison,
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
    catalog: DEMO_LECTURES,
    openLecture: (id: string) => send({ kind: 'presentation', action: 'open', id }),
    openSample: () => {
      if (!document) send({ kind: 'presentation', action: 'open', id: FEATURED_LECTURE_ID });
    },
    exit: () => send({ kind: 'presentation', action: 'exit' }),
    navigationProps: {
      mode: session.mode,
      index: session.index,
      count: document?.steps.length ?? 0,
      stepTitles: document?.steps.map(step => step.title) ?? [],
      exploring: session.exploring,
      onMode: (mode: 'rehearse' | 'teach') => send({ kind: 'presentation', action: mode }),
      onStep: (index: number) => send({ kind: 'presentation', action: 'go', index }),
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
          focus: session.focus,
          comparison: session.comparison,
          biology: session.biology,
          onFocus: () =>
            send({ kind: 'presentation', action: session.focus ? 'show-context' : 'focus-tooth' }),
          onCompare: (target: LectureComparison) =>
            send({ kind: 'presentation', action: 'compare', target }),
          onCloseComparison: () => send({ kind: 'presentation', action: 'close-comparison' }),
          onBiology: (view: BiologyView) => send({ kind: 'presentation', action: 'biology', view }),
          onHideBiology: () => send({ kind: 'presentation', action: 'hide-biology' }),
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
