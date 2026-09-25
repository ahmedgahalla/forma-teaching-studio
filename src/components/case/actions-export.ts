import type { CaseRefs, CaseStudioApi } from './api';
import { errorText } from './constants';
import { exportStage, exportStageSequence } from '@/lib/stage-export';
import { interpolateTransforms, stageTransforms } from '@/lib/planning';
import { sampleCaseDemonstration } from '@/lib/teaching-cases';
import { previewPose } from '@/lib/try-mode';

export function createExportActions(api: CaseStudioApi, _refs: CaseRefs) {
  const chooseTool = (next: CaseStudioApi['tool']) => {
    if (next !== 'orbit' && api.mechanics?.result) {
      api.setMagnification(1);
      api.setStage(api.stages);
      api.setResponseRevealed(true);
      api.note('Tooth handles use actual scale at the calculated endpoint.');
    }
    if (api.prepared && next !== 'orbit') {
      api.note('Choose Explore this arrangement before using tooth handles.', true);
      return;
    }
    if (next !== 'orbit' && api.sandbox.pending) {
      api.note('Apply or discard the current preview before using handles.', true);
      return;
    }
    if (next !== 'orbit' && api.sandbox.lockedIds.includes(api.selected)) {
      api.note(`Tooth ${api.selected} is locked. Unlock it before editing.`, true);
      return;
    }
    api.setTool(next);
    if (!api.prepared) api.setStage(api.stages);
    api.setPlaying(false);
    api.setMeasureMode(false);
    if (next !== 'orbit' && api.selectedIds.length !== 1) {
      api.setSelectedIds([api.selected]);
      api.note(`Handles act on tooth ${api.selected}. Use numeric controls for group movements.`);
    }
  };
  const exportShown = () => {
    try {
      if (api.sandbox.pending)
        throw new Error('Apply or discard the pending preview before exporting a stage.');
      const index = Math.round(api.stage);
      exportStage(
        api.model,
        api.mechanics?.result
          ? interpolateTransforms(
              api.mechanics.reference.transforms,
              api.mechanics.result.transforms,
              index / api.stages,
            )
          : api.prepared && api.scenario
            ? sampleCaseDemonstration(
                api.scenario.caseId,
                api.scenario.variantId,
                index / api.stages,
              )
            : api.demonstration
              ? previewPose(api.demonstration, index / api.stages)
              : stageTransforms(
                  api.plan.current,
                  api.checkpoints,
                  index,
                  api.stages,
                  api.sandbox.original,
                ),
        index,
        api.attachments,
      );
      api.note(
        `Stage ${index} STL download started. Includes crowns, gingiva, and ${api.attachments ? 'placed attachments' : 'no attachments'}.`,
      );
    } catch (e) {
      api.note(errorText(e), true);
    }
  };
  const exportSequence = async () => {
    if (api.prepared) {
      api.note(
        'Export individual shown stages, or Explore this arrangement to export your free-edit sequence.',
        true,
      );
      return;
    }
    if (api.sandbox.pending) {
      api.note('Apply or discard the pending preview before exporting.', true);
      return;
    }
    api.setBusy(true);
    try {
      await exportStageSequence(
        api.model,
        api.plan.current,
        api.checkpoints,
        api.stages,
        api.attachments,
        api.mechanics?.result ? null : api.demonstration,
        api.mechanics?.result
          ? {
              from: api.mechanics.reference.transforms,
              to: api.mechanics.result.transforms,
              assumptions: api.mechanics.result.diagnostics.assumptions,
            }
          : undefined,
        api.sandbox.original,
      );
      api.note(
        'Stage sequence download started with a manifest. These are teaching models, not manufactured aligners.',
      );
    } catch (e) {
      api.note(errorText(e), true);
    } finally {
      api.setBusy(false);
    }
  };

  return { chooseTool, exportShown, exportSequence };
}
