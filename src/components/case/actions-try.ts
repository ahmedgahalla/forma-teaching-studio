import type { CaseRefs, CaseStudioApi } from './api';
import type { TryAction } from '@/lib/try-mode';
import type { Command } from '@/lib/commands';
import { commandLabel, errorText } from './constants';
import { DEFAULT_APPLIANCE_DISPLAY } from '@/lib/appliance-display';
import { toothArch } from '@/lib/appliances';
import { assertTryUnlocked, transitionTryMode } from '@/lib/try-mode';
import { createMechanicsExperiment } from '@/lib/mechanics';
import { applyDentalCommand } from '@/lib/model';

export function createTryActions(api: CaseStudioApi, _refs: CaseRefs) {
  const applyTry = (action: TryAction): boolean => {
    if (api.prepared && action.type === 'enter')
      return api.applyTeaching({ kind: 'case', action: 'explore' });
    if (api.prepared) throw new Error('Choose Explore this arrangement before making a free edit.');
    const next = transitionTryMode(api.model, api.tryState, action);
    if (next.current !== api.tryState.current)
      api.dispatch({
        type: 'commit',
        value: next.current,
        label: next.lastEdit?.label || 'Try Mode arrangement',
      });
    if (api.mechanics && action.type === 'apply') {
      const reference = createMechanicsExperiment(api.model, next.current);
      api.setMechanics({
        ...reference,
        config: api.mechanics.config,
        stages: api.mechanics.stages,
        revision: api.mechanics.revision + 1,
      });
    }
    api.setSandbox(next);
    api.setDragPreview(null);
    api.setTool('orbit');
    api.setPlaying(false);
    api.setReverse(false);
    if (next.pending && next.pending !== api.sandbox.pending) {
      api.setMobilePanel('model');
      api.setStage(0);
      api.setSelectedIds(next.pending.affectedIds);
      api.setSelected(next.pending.affectedIds[0] || api.selected);
      api.note(
        `${next.pending.label}. Cyan is the candidate; review the path report before applying.`,
      );
    }
    if (action.type === 'apply') {
      api.setMechanicsFocus({ ...api.mechanicsFocus, lastParameter: undefined });
      api.setStage(0);
      api.setPlaying(true);
      api.note(
        'Applied one geometric edit. Playing its checked path; one Undo restores the request.',
      );
    }
    if (action.type === 'cancel') {
      api.setStage(api.stages);
      api.note('Preview discarded. Committed positions are unchanged.');
    }
    if (action.type === 'set-arch') {
      api.setCurveVisible(true);
      api.setArch(action.arch);
    }
    if (action.type === 'lock')
      api.note(`${action.locked ? 'Locked' : 'Unlocked'} teeth ${action.teeth.join(', ')}.`);
    if (action.type === 'save-snapshot')
      api.note(
        `Saved arrangement “${action.name}” locally in this case. Save case to keep it after closing.`,
      );
    if (action.type === 'enter') api.setLessonId('');
    if (action.type === 'compare-snapshot' || action.type === 'delete-snapshot') {
      api.setComparisonName(next.comparisonName);
      api.setGhost(false);
    }
    return true;
  };
  const sendTry = (action: TryAction, summary = 'Update Try Mode') => {
    void api.teaching.execute([{ kind: 'try', action }], summary);
  };
  const toggleApplianceVisibility = () => {
    if (
      api.mechanics ||
      (api.caseVariant?.removableRetainer && api.applianceDisplay.preset === 'none')
    ) {
      api.setBraces(!api.braces);
      return;
    }
    if (api.applianceDisplay.preset === 'none') {
      api.setApplianceDisplay({ ...DEFAULT_APPLIANCE_DISPLAY });
      api.setBraces(true);
    } else api.setBraces(!api.braces);
  };
  const apply = (c: Command): boolean => {
    try {
      api.setDragPreview(null);
      if (
        ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(c.type)
      ) {
        if (api.prepared) throw new Error('Choose Explore this arrangement before moving teeth.');
        const targets = 'teeth' in c ? c.teeth : 'tooth' in c ? [c.tooth] : api.selectedIds;
        assertTryUnlocked(api.tryState, targets);
        if (api.tryActive)
          return applyTry({
            type: 'preview',
            edit: {
              type: 'dental',
              command: c as Extract<
                Command,
                {
                  type: 'move' | 'move_group' | 'rotate' | 'rotate_group' | 'orthodontic' | 'reset';
                }
              >,
            },
          });
        const next = applyDentalCommand(api.plan.current, api.model.teeth, c);
        api.setSandbox({ ...api.sandbox, pending: null, lastEdit: null });
        api.dispatch({ type: 'commit', value: next, label: commandLabel(c) });
        api.setSelectedIds(targets);
        api.setSelected(targets[0]);
        const arches = new Set(targets.map(toothArch));
        if (arches.size > 1) api.setArch('both');
        else if (api.arch !== 'both') api.setArch(toothArch(targets[0]));
        api.setPlaying(false);
        api.setStage(api.stages);
        api.note(commandLabel(c));
      } else if (c.type === 'ghost') {
        api.setGhost(c.visible);
        api.note(commandLabel(c));
      } else if (c.type === 'appliance') {
        if (c.visible) api.setApplianceDisplay({ ...DEFAULT_APPLIANCE_DISPLAY });
        api.setBraces(c.visible);
        api.note(commandLabel(c));
      } else if (c.type === 'stages') {
        api.setStages(c.count);
        api.setStage(c.count);
        api.setPlaying(false);
        api.note(
          `Created ${c.count} geometric stages through ${api.checkpoints.length} saved checkpoints. No treatment duration is implied.`,
        );
      } else if (c.type === 'play') {
        api.setReverse(false);
        api.setStage(0);
        api.setPlaying(true);
        api.note(
          api.demonstration
            ? 'Playing the geometric edit from its saved starting arrangement.'
            : 'Playing the geometric path through your saved checkpoints.',
        );
      } else if (c.type === 'undo' || c.type === 'redo') {
        api.dispatch({ type: c.type });
        api.setSandbox({ ...api.sandbox, pending: null, lastEdit: null });
        api.setPlaying(false);
        api.setStage(api.stages);
        api.note(
          c.type === 'undo'
            ? 'Last operation undone for all affected teeth.'
            : 'Operation restored.',
        );
      }
      return true;
    } catch (e) {
      api.note(errorText(e), true);
      return false;
    }
  };

  return { applyTry, sendTry, toggleApplianceVisibility, apply };
}
