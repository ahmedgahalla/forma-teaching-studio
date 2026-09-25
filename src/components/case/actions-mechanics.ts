import type { CaseRefs, CaseStudioApi } from './api';
import type { MechanicsAction } from '@/lib/mechanics';
import { assertTryRestoreUnlocked } from '@/lib/try-mode';
import { findSurfaceIntersections } from '@/lib/analysis';
import { attachMechanicsResult, experimentWithoutTad, transitionMechanics } from '@/lib/mechanics';
import { reduceMechanicsFocus } from '@/lib/mechanics-commands';
import { calculateMechanics } from '@/lib/mechanics-client';
import { interpolateTransforms } from '@/lib/planning';
import {
  hasMechanicsMovement,
  mechanicsResponseCaption,
  recommendedMechanicsMagnification,
} from '@/lib/mechanics-presentation';
import { flushSync } from 'react-dom';

export function createMechanicsActions(api: CaseStudioApi, _refs: CaseRefs) {
  const applyMechanics = async (
    action: MechanicsAction,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    if (!api.activeExperiment)
      throw new Error('Mechanical experiments require the synthetic teaching model.');
    if (api.prepared)
      throw new Error('Choose Explore this arrangement before building an experiment.');
    let experiment = transitionMechanics(api.activeExperiment, action);
    api.setPlaying(false);
    api.setTool('orbit');
    api.setDragPreview(null);
    const publishExperiment = () => {
      if (action.type === 'brackets' || action.type === 'wire') {
        api.setSelectedIds(action.teeth);
        api.setSelected(action.teeth[0]);
      }
      api.setMechanics(experiment);
      api.setMechanicsFocus(reduceMechanicsFocus(api.mechanicsFocus, action));
      api.setPanel('braces');
      api.setApplianceDisplay({ preset: 'none', progress: 0, palate: false });
      api.setBraces(true);
      api.setAttachments(false);
    };
    if (action.type === 'solve' || action.type === 'compare-without-tad') {
      const alternate = action.type === 'compare-without-tad';
      if (alternate && !api.activeExperiment.result)
        throw new Error('Calculate the original setup before comparing its anchorage.');
      const source = alternate ? experimentWithoutTad(experiment, action.id) : experiment;
      const input = source;
      api.note(
        alternate
          ? 'Calculating the alternative from the same unloaded reference…'
          : 'Calculating the initial elastic response…',
      );
      const result = await calculateMechanics(input, signal);
      if (signal?.aborted) throw new DOMException('Calculation cancelled.', 'AbortError');
      const before = new Set(
        findSurfaceIntersections(api.model, experiment.reference.transforms).map(
          pair => `${pair.a}/${pair.b}`,
        ),
      );
      for (let sample = 1; sample <= 6; sample++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (signal?.aborted) throw new DOMException('Calculation cancelled.', 'AbortError');
        const intersections = findSurfaceIntersections(
          api.model,
          interpolateTransforms(experiment.reference.transforms, result.transforms, sample / 6),
        );
        const crossing = intersections.find(pair => !before.has(`${pair.a}/${pair.b}`));
        if (crossing)
          throw new Error(
            `Calculated path crosses crown surfaces ${crossing.a} and ${crossing.b}. Reduce activation or change the starting arrangement.`,
          );
      }
      if (before.size)
        result.diagnostics.warnings.push(
          `${before.size} crown-surface intersections already exist at the starting arrangement. No additional crossings were found in six sampled response frames.`,
        );
      if (!alternate) assertTryRestoreUnlocked(api.tryState, result.transforms);
      const displayScale = recommendedMechanicsMagnification(result.diagnostics);
      const responseMoves = hasMechanicsMovement(result.diagnostics);
      flushSync(() => {
        experiment = attachMechanicsResult(experiment, result, alternate);
        if (!alternate) {
          experiment = { ...experiment, applied: result };
          api.dispatch({
            type: 'commit',
            value: result.transforms,
            label: 'Initial elastic response · fixed unloaded reference',
          });
          api.setSandbox({
            ...api.sandbox,
            current: result.transforms,
            pending: null,
            lastEdit: null,
          });
          api.setMagnification(displayScale);
          api.setGhost(true);
          api.setComparisonName(null);
          api.setTraces(true);
          api.setStage(0);
          api.setReverse(false);
          api.setResponseRevealed(!api.predictResponse);
          api.setPlaying(!api.predictResponse && responseMoves);
        } else {
          api.setStage(api.stages);
          api.setResponseRevealed(true);
        }
        api.note(
          alternate
            ? 'Alternative shown as a ghost. Both calculations use the same unloaded reference.'
            : api.predictResponse
              ? 'Response calculated and hidden. Ask students which teeth will move, then Reveal.'
              : `${mechanicsResponseCaption(result.diagnostics, displayScale)}. Ghost outlines show the unloaded reference; no biological timeline.`,
        );
        publishExperiment();
      });
      return true;
    } else if (action.type === 'apply') {
      const result = experiment.applied!;
      assertTryRestoreUnlocked(api.tryState, result.transforms);
      experiment = { ...experiment, result };
      api.dispatch({
        type: 'commit',
        value: result.transforms,
        label: 'Apply the calculated initial response',
      });
      api.setSandbox({ ...api.sandbox, current: result.transforms, pending: null, lastEdit: null });
      api.setStage(0);
      api.setReverse(false);
      api.setResponseRevealed(true);
      api.setPlaying(true);
    } else if (action.type !== 'save-stage' && action.type !== 'explain') {
      assertTryRestoreUnlocked(api.tryState, experiment.reference.transforms);
      experiment = { ...experiment, applied: null };
      api.dispatch({
        type: 'load',
        value: experiment.reference.transforms,
        past: api.plan.past,
        future: api.plan.future,
      });
      api.setSandbox({
        ...api.sandbox,
        current: experiment.reference.transforms,
        pending: null,
        lastEdit: null,
      });
      api.setStage(api.stages);
      api.note(
        action.type === 'discard'
          ? 'Unloaded reference shown. Appliance configuration retained.'
          : 'Appliance setup updated. No tooth response until a supported activation is calculated.',
      );
    }
    publishExperiment();
    return true;
  };
  const sendMechanics = (actions: MechanicsAction[], summary: string) => {
    void api.teaching.execute(
      actions.map(action => ({ kind: 'mechanics', action })),
      summary,
    );
  };

  return { applyMechanics, sendMechanics };
}
