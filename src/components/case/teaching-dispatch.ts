import type { CaseRefs, CaseStudioApi } from './api';
import { applyCaseLoadKinds } from './teaching-load-kinds';
import type { TeachingAction } from '@/lib/lecture';
import { DEFAULT_ATTACHMENT, errorText } from './constants';
import { DEFAULT_APPLIANCE_DISPLAY, validateApplianceDisplay } from '@/lib/appliance-display';
import { toothArch } from '@/lib/appliances';
import { parseTeachingCommand } from '@/lib/lecture';

export function createTeachingDispatch(api: CaseStudioApi, refs: CaseRefs) {
  const applyTeaching = (action: TeachingAction): boolean => {
    try {
      {
        const handled = applyCaseLoadKinds(api, refs, action);
        if (handled !== null) return handled;
      }
      if (action.kind === 'question') {
        if (!api.scenario) throw new Error('Choose a prepared teaching case first.');
        api.setScenario({ ...api.scenario, answerVisible: action.visible });
        return true;
      }
      if (action.kind === 'workspace') {
        if (action.action !== 'restore' || !refs.returnWorkspace.current)
          throw new Error('There is no saved workspace to restore.');
        api.restoreClassroom(refs.returnWorkspace.current);
        api.note('Your original workspace, model and edits are restored.');
        return true;
      }
      if (action.kind === 'appliance-display') {
        api.setApplianceDisplay(
          validateApplianceDisplay({
            preset: action.preset,
            progress: action.progress ?? 0,
            palate: action.palate ?? false,
          }),
        );
        api.setBraces(action.preset !== 'none');
        api.note('Appliance display updated. Tooth positions are unchanged.');
        return true;
      }
      if (action.kind === 'try') return api.applyTry(action.action);
      if (action.kind === 'try-display') {
        if (action.target === 'traces') api.setTraces(action.visible);
        else api.setCurveVisible(action.visible);
        return true;
      }
      if (action.kind === 'try-playback') {
        const backwards = action.direction === 'reverse';
        api.setReverse(backwards);
        api.setStage(backwards ? api.stages : 0);
        api.setPlaying(true);
        return true;
      }
      if (action.kind === 'workflow') return action.action === 'exit';
      if (action.kind === 'progress') {
        api.setStage(action.value * api.stages);
        api.setPlaying(false);
        return true;
      }
      if (action.kind === 'speed') {
        api.setPlaybackSpeed(action.value);
        return true;
      }
      if (action.kind === 'anatomy') {
        if (!api.model.demo)
          throw new Error('Generated anatomy is available only on the synthetic teaching model.');
        api.setAnatomy(
          action.action === 'opacity'
            ? { ...api.anatomy, bone: true, opacity: action.value }
            : {
                ...api.anatomy,
                [action.action]: action.visible,
                ...(action.action === 'cutaway' && action.visible
                  ? { bone: true, ligament: true }
                  : {}),
              },
        );
        if (action.action === 'cutaway' && action.visible) {
          api.setRoots(true);
          api.setGums(true);
        }
        return true;
      }
      if (action.kind === 'return-lesson') {
        const saved = refs.lessonSnapshots.current[Math.max(0, api.lessonStep)];
        if (!saved) throw new Error('Start a lesson first.');
        api.restoreSnapshot(saved);
        return true;
      }
      if (action.kind === 'dental') return api.apply(action.command);
      if (action.kind === 'lesson-step') return api.advanceLesson(action.action);
      if (action.kind === 'attachment')
        return api.editAttachments(
          action.action === 'remove'
            ? null
            : { ...DEFAULT_ATTACHMENT, shape: action.shape || 'rectangle' },
          action.teeth,
        );
      if (action.kind === 'select') {
        api.setSelectedIds(action.teeth);
        api.setSelected(action.teeth[0]);
      }
      if (action.kind === 'view') api.setCamera(action.view);
      if (action.kind === 'arch') {
        api.setArch(action.arch);
        if (action.arch === 'both' && api.view === 'occlusal') api.setCamera('perspective');
      }
      if (action.kind === 'toggle') {
        if (
          action.target === 'roots' &&
          action.visible &&
          !api.model.teeth.some(t => t.rootGeometry)
        )
          throw new Error('This case has no root geometry.');
        if (action.target === 'braces' && action.visible)
          api.setApplianceDisplay({ ...DEFAULT_APPLIANCE_DISPLAY });
        ({
          braces: api.setBraces,
          roots: api.setRoots,
          gums: api.setGums,
          labels: api.setLabels,
          grid: api.setGrid,
          attachments: api.setAttachments,
        })[action.target](action.visible);
      }
      if (action.kind === 'comparison') {
        api.setPlaying(false);
        api.setComparisonName(action.mode === 'overlay' ? 'original' : null);
        api.setSandbox({ ...api.sandbox, comparisonName: null });
        if (action.mode === 'before') {
          api.setStage(0);
          api.setGhost(false);
        } else if (action.mode === 'after') {
          api.setStage(api.stages);
          api.setGhost(false);
        } else {
          api.setGhost(action.mode === 'overlay');
          if (action.mode === 'overlay' && !api.scenario) api.setStage(api.stages);
        }
      }
      if (action.kind === 'stage') {
        const n =
          action.action === 'exact'
            ? action.stage
            : Math.round(api.stage) + (action.action === 'next' ? 1 : -1);
        if (n < 0 || n > api.stages) throw new Error(`Choose a stage from 0 to ${api.stages}.`);
        api.setStage(n);
        api.setPlaying(false);
      }
      if (action.kind === 'stop') api.setPlaying(false);
      if (action.kind === 'focus') {
        api.setSelectedIds([action.tooth]);
        api.setSelected(action.tooth);
        api.setMeasureTo('');
        if (api.arch !== 'both') api.setArch(toothArch(action.tooth));
        setTimeout(() => refs.viewer.current?.focus(), 0);
      }
      if (action.kind === 'lecture') api.setLecture(action.enabled);
      api.setTool('orbit');
      api.setDragPreview(null);
      api.note(
        action.kind === 'select'
          ? `Selected ${action.teeth.join(', ')}.`
          : action.kind === 'toggle'
            ? `${action.target} ${action.visible ? 'shown' : 'hidden'}.`
            : action.kind === 'view'
              ? `${action.view} view.`
              : action.kind === 'comparison'
                ? `${action.mode === 'before' ? (api.demonstration ? 'Edit start' : 'Original') : action.mode === 'after' ? 'Endpoint' : 'Overlay'} view.`
                : 'Teaching view updated.',
      );
      return true;
    } catch (e) {
      api.note(errorText(e), true);
      return false;
    }
  };
  const runTeaching = (text: string): boolean => {
    try {
      return applyTeaching(parseTeachingCommand(text, api.selected, api.ids, api.selectedIds));
    } catch (e) {
      api.note(errorText(e), true);
      return false;
    }
  };

  return { applyTeaching, runTeaching };
}
