import type { CaseRefs, CaseStudioApi } from './api';
import type { CaseSession } from '@/lib/planning';
import { errorText } from './constants';
import { serializeTrySession } from '@/lib/try-mode';
import { parseCommand } from '@/lib/commands';
import { saveCase } from '@/lib/geometry';

export function createWorkspaceActions(api: CaseStudioApi, refs: CaseRefs) {
  const note = (text: string, error = false) => {
    api.setStatus(text);
    api.setStatusError(error);
  };
  const session = (): CaseSession => ({
    ...(api.mechanics ? { mechanics: api.mechanics } : {}),
    lectureSetup: {
      camera: refs.viewer.current?.getCamera() || null,
      selectedIds: api.selectedIds,
      arch: api.arch,
      view: api.view,
      gums: api.gums,
      labels: api.labels,
      grid: api.grid,
      stage: api.stage,
      opening: api.opening,
      anatomy: api.anatomy,
      magnification: api.magnification,
      forceVectors: api.forceVectors,
      wirePreset: api.wirePreset,
      mechanicsResponse: !!api.mechanics?.result,
      responseRevealed: api.responseRevealed,
      predictResponse: api.predictResponse,
      playbackSpeed: api.playbackSpeed,
      reverse: api.reverse,
    },
    stages: api.stages,
    checkpoints: api.checkpoints,
    past: api.plan.past,
    future: api.plan.future,
    braces: api.braces,
    roots: api.roots,
    bracketStyle: api.bracketStyle,
    ligatureColor: api.ligatureColor,
    attachments: api.attachments,
    tryMode: serializeTrySession(api.tryState),
    applianceDisplay: api.applianceDisplay,
  });
  const selectTooth = (id: string, additive = false) => {
    api.teaching.referenceInteraction();
    let next = [id];
    if (additive || api.multi)
      next = api.selectedIds.includes(id)
        ? api.selectedIds.filter(v => v !== id)
        : [...api.selectedIds, id];
    if (!next.length) next = [id];
    api.setSelectedIds(next);
    api.setSelected(next.includes(id) ? id : next[0]);
    api.setMeasureTo('');
  };
  const selectGroup = (scope: string) => {
    api.teaching.referenceInteraction();
    try {
      const c = parseCommand(`move ${scope} 1 mm x`, api.selected, api.ids, api.selectedIds);
      if ('teeth' in c) {
        api.setSelectedIds(c.teeth);
        api.setSelected(c.teeth[0]);
      }
    } catch (e) {
      note(errorText(e), true);
    }
  };
  const save = () => {
    try {
      if (api.prepared)
        throw new Error('Choose Explore this arrangement before saving an editable case.');
      if (api.sandbox.pending)
        throw new Error('Apply or discard the preview before saving the case.');
      saveCase(api.model, api.plan.current, session());
      note(
        'Case download started with committed positions, saved arrangements, groups, locks, and checkpoints.',
      );
    } catch (e) {
      note(errorText(e), true);
    }
  };

  return { note, session, selectTooth, selectGroup, save };
}
