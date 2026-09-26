import type { CaseRefs, CaseStudioApi } from './api';
import type { TeachingAction } from '@/lib/lecture';
import { createDemo } from '@/lib/geometry';
import { createDentalArrangement } from '@/lib/dental-arrangements';
import { createTeachingCase, sampleCaseDemonstration } from '@/lib/teaching-cases';
import { createTryState } from '@/lib/try-mode';
import { DEFAULT_ANATOMY } from '@/lib/teaching-anatomy';

/**
 * The teaching-action kinds that load or steer a prepared arrangement
 * (dental-arrangement and the case family). Returns null when the action is
 * another kind; throws propagate to the dispatcher's shared catch.
 */
export function applyCaseLoadKinds(
  api: CaseStudioApi,
  refs: CaseRefs,
  action: TeachingAction,
): boolean | null {
  if (action.kind === 'dental-arrangement') {
    const next = createDentalArrangement(createDemo(), action.id);
    refs.returnWorkspace.current ||= api.captureClassroom();
    api.setScenario(null);
    api.setMechanics(null);
    api.setPointed(null);
    api.setMechanicsFocus({});
    api.setWorkflowOrigin(null);
    api.setModel(next.model);
    api.dispatch({ type: 'load', value: next.transforms });
    api.setSandbox(createTryState(next.transforms, next.transforms));
    api.setSelectedIds(next.selectedIds);
    api.setSelected(next.selectedIds[0]);
    api.setArch('both');
    api.setView('front');
    api.setApplianceDisplay({ preset: 'none', progress: 0, palate: false });
    api.setBraces(false);
    api.setAttachments(false);
    api.setRoots(false);
    api.setGums(true);
    api.setLabels(false);
    api.setAnatomy({ ...DEFAULT_ANATOMY });
    api.setOpening(0);
    api.setLessonId('');
    api.setLessonStep(-1);
    refs.lessonSnapshots.current = [];
    api.setCheckpoints([]);
    api.setStages(10);
    api.setStage(10);
    api.setPlaying(false);
    api.setReverse(false);
    api.setGhost(false);
    api.setComparisonName(null);
    api.setTraces(false);
    api.setCurveVisible(false);
    api.setTool('orbit');
    api.setDragPreview(null);
    api.setIsolated(false);
    api.setPointer(false);
    api.setLandmarks([]);
    api.setMeasureMode(false);
    api.setMeasureTo('');
    api.setPanel('move');
    api.setMobilePanel('model');
    api.setModal(null);
    refs.pendingCamera.current = null;
    refs.pendingView.current = 'front';
    api.note(
      `${next.model.name}. Dental arrangement only; skeletal class is separate. ${next.auditNote}`,
    );
    return true;
  }
  if (action.kind === 'case') {
    if (action.action === 'load') {
      const next = createTeachingCase(createDemo(), action.id),
        variant = next.definition.variants[0];
      refs.returnWorkspace.current ||= api.captureClassroom();
      api.setScenario({
        caseId: next.definition.id,
        variantId: variant.id,
        model: next.model,
        returnProgress: 0,
        exploring: false,
        answerVisible: false,
      });
      api.setMechanics(null);
      api.setPointed(null);
      api.setMechanicsFocus({});
      api.setWorkflowOrigin(null);
      api.setIsolated(false);
      api.setPointer(false);
      api.setModel(next.model);
      api.dispatch({ type: 'load', value: next.transforms });
      api.setSandbox({ ...createTryState(next.transforms), active: false });
      api.setSelectedIds(next.selectedIds);
      api.setSelected(next.selectedIds[0]);
      api.setView(next.definition.view);
      api.setArch(
        next.definition.view === 'occlusal' && next.definition.arch === 'both'
          ? 'upper'
          : next.definition.arch,
      );
      api.setApplianceDisplay(variant.appliance);
      api.setBraces(variant.appliance.preset !== 'none' || !!variant.removableRetainer);
      api.setRoots(next.definition.id === 'movement-types');
      api.setGums(true);
      api.setLabels(false);
      api.setAttachments(true);
      api.setAnatomy({ ...DEFAULT_ANATOMY });
      api.setLessonId('');
      api.setLessonStep(-1);
      refs.lessonSnapshots.current = [];
      api.setCheckpoints([]);
      api.setStages(10);
      api.setStage(0);
      api.setGhost(false);
      api.setComparisonName(null);
      api.setTraces(false);
      api.setCurveVisible(false);
      api.setOpening(0);
      api.setLandmarks([]);
      api.setMeasureMode(false);
      api.setMeasureTo('');
      api.setPanel('move');
      api.setMobilePanel('model');
      api.setModal(null);
      refs.pendingCamera.current = null;
      refs.pendingView.current = next.definition.view;
    } else {
      if (!api.scenario || !api.caseDefinition || !api.caseVariant)
        throw new Error('Choose a prepared case first.');
      if (action.action === 'explore') {
        const current = sampleCaseDemonstration(
          api.scenario.caseId,
          api.scenario.variantId,
          api.stage / api.stages,
        );
        api.setScenario({
          ...api.scenario,
          exploring: true,
          returnProgress: api.stage / api.stages,
          returnDisplay: {
            lesson: { ...api.snapshot(), transforms: current },
            anatomy: api.anatomy,
            appliance: api.applianceDisplay,
            bracketStyle: api.bracketStyle,
            ligatureColor: api.ligatureColor,
            camera: refs.viewer.current?.getCamera() || null,
          },
        });
        api.dispatch({ type: 'load', value: current });
        api.setSandbox({
          ...createTryState(current),
          snapshots: [{ name: 'Prepared case start', transforms: api.caseStart! }],
        });
        api.setStage(api.stages);
        api.setPanel('move');
        api.setMobilePanel('tools');
      } else if (
        action.action === 'return' ||
        action.action === 'variant' ||
        action.action === 'reset'
      ) {
        const variantId = action.action === 'variant' ? action.id : api.scenario.variantId;
        const variant = api.caseDefinition.variants.find(item => item.id === variantId);
        if (!variant) throw new Error('Choose an available case demonstration.');
        const progress = action.action === 'return' ? api.scenario.returnProgress : 0;
        const baseline = sampleCaseDemonstration(api.scenario.caseId, variantId, 0);
        api.setMechanics(null);
        api.setPointed(null);
        api.setMechanicsFocus({});
        api.setScenario({
          ...api.scenario,
          variantId,
          returnProgress: progress,
          returnDisplay: action.action === 'return' ? api.scenario.returnDisplay : undefined,
          exploring: false,
          answerVisible: false,
        });
        api.setModel(api.scenario.model);
        api.dispatch({ type: 'load', value: baseline });
        api.setSandbox({ ...createTryState(baseline), active: false });
        api.setApplianceDisplay(variant.appliance);
        api.setBraces(variant.appliance.preset !== 'none' || !!variant.removableRetainer);
        api.setAttachments(true);
        api.setStage(progress * api.stages);
        api.setCheckpoints([]);
        api.setComparisonName(null);
        api.setTraces(false);
        api.setCurveVisible(false);
        api.setLandmarks([]);
        api.setOpening(0);
        api.setSelectedIds(api.caseDefinition.selectedIds);
        api.setSelected(api.caseDefinition.selectedIds[0]);
        api.setMobilePanel('model');
        if (action.action === 'return' && api.scenario.returnDisplay) {
          const saved = api.scenario.returnDisplay,
            previous = saved.lesson;
          api.setModel(previous.model);
          api.setSelected(previous.selected);
          api.setSelectedIds(previous.selectedIds);
          api.setArch(previous.arch);
          api.setView(previous.view);
          api.setGhost(previous.ghost);
          api.setRoots(previous.roots);
          api.setBraces(previous.braces);
          api.setAttachments(previous.attachments);
          api.setGums(previous.gums);
          api.setLabels(previous.labels);
          api.setGrid(previous.grid);
          api.setStage(previous.stage);
          api.setStages(previous.stages);
          api.setOpening(previous.opening);
          api.setAnatomy(saved.anatomy);
          api.setApplianceDisplay(saved.appliance);
          api.setBracketStyle(saved.bracketStyle);
          api.setLigatureColor(saved.ligatureColor);
          refs.pendingView.current = null;
          refs.pendingCamera.current = saved.camera;
        }
      } else if (action.action === 'progress') api.setStage(action.value * api.stages);
      else if (action.action === 'play') {
        if (api.stage >= api.stages) api.setStage(0);
        api.setReverse(false);
        api.setPlaying(true);
        return true;
      } else if (action.action === 'pause') {
        api.setPlaying(false);
        return true;
      }
    }
    api.setTool('orbit');
    api.setDragPreview(null);
    api.setReverse(false);
    api.setPlaying(false);
    api.note(
      action.action === 'explore'
        ? 'Free exploration of the shown arrangement. Return to prepared case restores this stage.'
        : 'Prepared teaching example loaded. Ask students to predict, then play or compare an approach.',
    );
    return true;
  }
  return null;
}
