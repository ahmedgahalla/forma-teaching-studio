import type { CaseRefs, CaseStudioApi } from './api';
import type { ClassroomSnapshot } from './types';
import type { WorkflowTransfer } from '@/lib/workflow-transfer';
import type { ViewerCamera } from '../Viewer';
import { DEFAULT_WIRE_PRESET } from '../MechanicsPanel';
import { createWorkflowTryState } from '@/lib/workflow-transfer';
import { mapWorkflowAppliance } from '@/lib/appliance-display';

export function createClassroomActions(api: CaseStudioApi, refs: CaseRefs) {
  const captureClassroom = (): ClassroomSnapshot => ({
    mechanics: api.mechanics,
    wirePreset: api.wirePreset,
    magnification: api.magnification,
    predictResponse: api.predictResponse,
    responseRevealed: api.responseRevealed,
    forceVectors: api.forceVectors,
    pointed: api.pointed,
    mechanicsFocus: api.mechanicsFocus,
    scenario: api.scenario,
    applianceDisplay: api.applianceDisplay,
    workflowOrigin: api.workflowOrigin,
    returnWorkspace: refs.returnWorkspace.current,
    sandbox: api.tryState,
    comparisonName: api.comparisonName,
    traces: api.traces,
    curveVisible: api.curveVisible,
    reverse: api.reverse,
    lesson: api.snapshot(),
    history: api.plan,
    checkpoints: api.checkpoints,
    speed: api.playbackSpeed,
    anatomy: api.anatomy,
    camera: refs.viewer.current?.getCamera() || null,
    lessonId: api.lessonId,
    lessonStep: api.lessonStep,
    lessonSnapshots: [...refs.lessonSnapshots.current],
    bracketStyle: api.bracketStyle,
    ligatureColor: api.ligatureColor,
    lecture: api.lecture,
    isolated: api.isolated,
    tool: api.tool,
    measureTo: api.measureTo,
    measureMode: api.measureMode,
    landmarks: api.landmarks,
  });
  const restoreClassroom = (saved: ClassroomSnapshot) => {
    api.setMechanics(saved.mechanics ?? null);
    api.setWirePreset(saved.wirePreset || DEFAULT_WIRE_PRESET);
    api.setMagnification(saved.magnification ?? 10);
    api.setPredictResponse(saved.predictResponse ?? false);
    api.setResponseRevealed(saved.responseRevealed ?? true);
    api.setForceVectors(saved.forceVectors ?? true);
    api.setPointed(saved.pointed ?? null);
    api.setMechanicsFocus(saved.mechanicsFocus ?? {});
    const s = saved.lesson;
    api.setScenario(saved.scenario);
    api.setApplianceDisplay(saved.applianceDisplay);
    api.setWorkflowOrigin(saved.workflowOrigin);
    refs.returnWorkspace.current = saved.returnWorkspace;
    api.setSandbox(saved.sandbox);
    api.setComparisonName(saved.comparisonName);
    api.setTraces(saved.traces);
    api.setCurveVisible(saved.curveVisible);
    api.setReverse(saved.reverse);
    api.setModel(s.model);
    api.dispatch({
      type: 'load',
      value: saved.history.current,
      past: saved.history.past,
      future: saved.history.future,
    });
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
    api.setCheckpoints(saved.checkpoints);
    api.setPlaybackSpeed(saved.speed);
    api.setAnatomy(saved.anatomy);
    api.setLessonId(saved.lessonId);
    api.setLessonStep(saved.lessonStep);
    refs.lessonSnapshots.current = [...saved.lessonSnapshots];
    api.setBracketStyle(saved.bracketStyle);
    api.setLigatureColor(saved.ligatureColor);
    api.setLecture(saved.lecture);
    api.setIsolated(saved.isolated ?? false);
    api.setPointer(false);
    api.setTool(saved.tool);
    api.setMeasureTo(saved.measureTo);
    api.setMeasureMode(saved.measureMode);
    api.setLandmarks(saved.landmarks);
    api.note('Classroom request restored.');
    api.setPlaying(false);
    api.setDragPreview(null);
    refs.pendingView.current = null;
    refs.pendingCamera.current = saved.camera;
  };
  const importWorkflowSetup = (setup: WorkflowTransfer, originSnapshot: unknown) => {
    if (api.sandbox.pending)
      throw new Error('Apply or discard the workspace preview before exploring a lesson setup.');
    const original = refs.returnWorkspace.current || captureClassroom();
    const next = createWorkflowTryState(setup),
      display = {
        ...mapWorkflowAppliance(setup.display.workflowOverlay, setup.display.braces),
        palate: false,
      };
    api.setMechanics(null);
    api.setPointed(null);
    api.setMechanicsFocus({});
    api.setScenario(null);
    refs.returnWorkspace.current = original;
    api.setWorkflowOrigin({ setup, snapshot: originSnapshot });
    api.setModel(setup.model);
    api.dispatch({ type: 'load', value: next.current });
    api.setSandbox(next);
    api.setApplianceDisplay(display);
    api.setSelectedIds(setup.selectedIds);
    api.setSelected(setup.selectedIds[0]);
    api.setArch(setup.display.arch);
    api.setView(setup.display.view);
    api.setRoots(setup.display.roots);
    api.setGums(setup.display.gums);
    api.setLabels(setup.display.labels);
    api.setGhost(setup.display.ghost);
    api.setBraces(display.preset !== 'none');
    api.setAttachments(setup.display.attachments);
    api.setAnatomy(setup.display.anatomy);
    api.setComparisonName(null);
    api.setTraces(false);
    api.setCurveVisible(false);
    api.setReverse(false);
    api.setStages(10);
    api.setStage(10);
    api.setPlaying(false);
    api.setCheckpoints([]);
    api.setOpening(0);
    api.setGrid(false);
    api.setLessonId('');
    api.setLessonStep(-1);
    refs.lessonSnapshots.current = [];
    api.setTool('orbit');
    api.setDragPreview(null);
    api.setMeasureMode(false);
    api.setMeasureTo('');
    api.setLandmarks([]);
    api.setContacts(null);
    api.setBracketStyle('metal');
    api.setLigatureColor('#3298bb');
    api.setPanel('move');
    api.setModal(null);
    api.setCommand('');
    refs.pendingCamera.current =
      (originSnapshot as { camera?: ViewerCamera | null }).camera || null;
    api.note(
      'This shown lesson setup is now a free experiment. Your previous workspace is preserved in this session.',
    );
  };

  return { captureClassroom, restoreClassroom, importWorkflowSetup };
}
