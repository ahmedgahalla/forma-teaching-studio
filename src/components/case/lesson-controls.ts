import { LESSONS } from '@/lib/lessons';
import { parseLessonCommand, type LessonAction } from '@/lib/classroom/lesson-controls';
import type { CaseRefs, CaseStudioApi } from './api';
import type { ClassroomSnapshot } from './types';
import { applyToothStudy, assertStudyTooth } from './tooth-study';

export function preflightLessonControl(
  api: CaseStudioApi,
  action: LessonAction,
  from?: ClassroomSnapshot,
) {
  if ((from ? from.scenario : api.scenario) || (from ? from.workflowOrigin : api.workflowOrigin))
    throw new Error('Restore your free workspace before changing short lessons.');
  if ((from?.sandbox ?? api.sandbox).pending || api.busy)
    throw new Error('Apply or discard the preview and finish importing before changing lessons.');
  if (action.action === 'start') {
    if (!LESSONS.some(lesson => lesson.id === action.id))
      throw new Error('Choose an available short lesson.');
    if (action.id === 'tooth-anatomy-tour')
      for (const id of ['11', '13', '14', '16', '46'])
        assertStudyTooth(from?.lesson.model ?? api.model, id);
  }
}

/** Tour exits always reveal the whole mouth, including when started from an isolated view. */
export function returnTourToMouth(api: CaseStudioApi, refs: CaseRefs) {
  applyToothStudy(api, refs, { kind: 'tooth-study', action: 'close' });
  api.setIsolated(false);
  api.setArch('both');
  api.setView('perspective');
  refs.pendingCamera.current = null;
  refs.pendingView.current = 'perspective';
}

export function applyLessonControl(
  api: CaseStudioApi,
  refs: CaseRefs,
  action: LessonAction,
): boolean {
  preflightLessonControl(api, action);
  api.setGlossaryId(null);
  if (action.action === 'close') {
    if (api.lessonId === 'tooth-anatomy-tour') returnTourToMouth(api, refs);
    api.setLessonId('');
    api.setLessonStep(-1);
    refs.lessonSnapshots.current = [];
    api.setSandbox({ ...api.sandbox, active: true, pending: null, lastEdit: null });
    api.setPlaying(false);
    api.note('Lesson closed. Your free workspace is ready.');
    return true;
  }
  const lesson = LESSONS.find(item => item.id === action.id)!;
  if (api.lessonId === 'tooth-anatomy-tour' && lesson.id !== api.lessonId)
    returnTourToMouth(api, refs);
  const first = lesson.id === 'tooth-anatomy-tour';
  const before = api.snapshot();
  if (
    first &&
    !api.applyTeaching(
      parseLessonCommand(
        lesson.steps[0].command,
        api.selected,
        api.ids,
        api.selectedIds,
        api.toothStudy ?? undefined,
      ),
    )
  )
    return false;
  api.setSandbox({ ...api.sandbox, pending: null, lastEdit: null });
  api.setLessonId(lesson.id);
  api.setLessonStep(first ? 0 : -1);
  refs.lessonSnapshots.current = first ? [before] : [];
  api.setLecture(true);
  api.setModal(null);
  api.setPlaying(false);
  api.note(
    first
      ? 'Tooth anatomy tour started. Say “next” or “explain this step”.'
      : 'Lesson ready. Say “next step” to begin.',
  );
  return true;
}
