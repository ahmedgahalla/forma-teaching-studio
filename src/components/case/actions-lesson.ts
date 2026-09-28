import type { CaseRefs, CaseStudioApi } from './api';
import type { LessonSnapshot } from './types';
import { assertTryRestoreUnlocked } from '@/lib/try-mode';
import { parseLessonCommand } from '@/lib/classroom/lesson-controls';
import { returnTourToMouth } from './lesson-controls';

export function createLessonActions(api: CaseStudioApi, refs: CaseRefs) {
  const snapshot = (): LessonSnapshot => ({
    jawOpen: api.jawOpen,
    transforms: api.plan.current,
    model: api.model,
    selected: api.selected,
    selectedIds: api.selectedIds,
    arch: api.arch,
    view: api.view,
    ghost: api.ghost,
    roots: api.roots,
    braces: api.braces,
    attachments: api.attachments,
    gums: api.gums,
    labels: api.labels,
    grid: api.grid,
    stage: api.stage,
    stages: api.stages,
    opening: api.opening,
    toothStudy: api.toothStudy,
    isolated: api.isolated,
    anatomy: { ...api.anatomy },
    camera: refs.viewer.current?.getCamera() ?? null,
  });
  const restoreSnapshot = (s: LessonSnapshot) => {
    assertTryRestoreUnlocked(api.tryState, s.transforms);
    api.setSandbox({ ...api.sandbox, pending: null, lastEdit: null });
    api.dispatch({ type: 'commit', value: s.transforms, label: 'Restore lecture step' });
    api.setModel(s.model);
    api.setSelected(s.selected);
    api.setSelectedIds(s.selectedIds);
    api.setArch(s.arch);
    api.setView(s.view);
    api.setGhost(s.ghost);
    api.setRoots(s.roots);
    api.setBraces(s.braces);
    api.setAttachments(s.attachments);
    api.setGums(s.gums);
    api.setLabels(s.labels);
    api.setGrid(s.grid);
    api.setStage(s.stage);
    api.setStages(s.stages);
    api.setOpening(s.opening);
    api.setJawOpen(s.model.asset === 'claude-atlas-v1' && (s.jawOpen ?? false));
    api.setToothStudy(s.toothStudy ?? null);
    api.setIsolated(s.isolated ?? false);
    if (s.anatomy) api.setAnatomy(s.anatomy);
    api.setPlaying(false);
    api.setDragPreview(null);
    api.setTool('orbit');
    refs.pendingCamera.current = s.camera ?? null;
    refs.pendingView.current = s.camera ? null : s.view;
  };
  const advanceLesson = (action: 'next' | 'previous' | 'restart'): boolean => {
    if (!api.currentLesson) {
      api.setModal('lessons');
      api.note('Choose a teaching demonstration first.');
      return false;
    }
    if (action === 'restart' || action === 'previous') {
      const index = action === 'restart' ? 0 : api.lessonStep,
        saved = refs.lessonSnapshots.current[index];
      if (saved) restoreSnapshot(saved);
      api.setLessonStep(action === 'restart' ? -1 : Math.max(-1, api.lessonStep - 1));
      api.note(
        action === 'restart'
          ? 'Lesson returned to its starting setup.'
          : 'Previous lesson setup restored.',
      );
      return true;
    }
    const index = api.lessonStep + 1,
      next = api.currentLesson.steps[index];
    if (!next) {
      api.note('Demonstration complete. Restart it or choose another lesson.');
      return false;
    }
    const before = snapshot();
    const parsed = parseLessonCommand(
      next.command,
      api.selected,
      api.ids,
      api.selectedIds,
      api.toothStudy ?? undefined,
    );
    if (
      api.currentLesson.id === 'tooth-anatomy-tour' &&
      parsed.kind === 'tooth-study' &&
      parsed.action === 'close'
    )
      returnTourToMouth(api, refs);
    else if (!api.applyTeaching(parsed)) return false;
    refs.lessonSnapshots.current[index] = before;
    api.setLessonStep(index);
    return true;
  };

  return { snapshot, restoreSnapshot, advanceLesson };
}
