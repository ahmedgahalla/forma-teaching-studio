'use client';
import { useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Vector3 } from 'three';
import {
  BookOpen,
  Box,
  CircleHelp,
  Layers3,
  MousePointer2,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import ModelBootstrap from './ModelBootstrap';
import { getTeachingAssetCase } from '@/lib/anatomy-assets';
import { casePathAudit } from '@/lib/case-path-audit';
import { createDentalArrangement, DENTAL_ARRANGEMENTS } from '@/lib/dental-arrangements';
import { createTeachingCase, getTeachingCase, sampleCaseDemonstration } from '@/lib/teaching-cases';
import { MobileStudioDock } from './StudioExperience';
import { type ViewerCamera, type ViewerHandle, type ViewName } from './Viewer';
import {
  createDemo,
  download,
  importSTLs,
  loadCase,
  saveCase,
  type DentalCase,
} from '@/lib/geometry';
import {
  anatomicalFrame,
  applyDentalCommand,
  emptyPose,
  isPose,
  type Pose,
  type Transforms,
  type Vec3,
} from '@/lib/model';
import { parseCommand, type Command } from '@/lib/commands';
import { interpolateTransforms, stageTransforms, type CaseSession } from '@/lib/planning';
import {
  archSpans,
  centreDistance,
  findSurfaceIntersections,
  movementRows,
  toothMatrix,
} from '@/lib/analysis';
import { toothArch } from '@/lib/appliances';
import {
  createAttachmentGeometry,
  validateAttachment,
  type AttachmentSpec,
} from '@/lib/attachments';
import { LESSONS, parseTeachingCommand, type TeachingAction } from '@/lib/lecture';
import { exportStage, exportStageSequence } from '@/lib/stage-export';
import { TeachingProvider, useTeaching, useTeachingAdapter } from './TeachingController';
import { DEFAULT_ANATOMY } from '@/lib/teaching-anatomy';
import WorkflowStudio from './WorkflowStudio';
import {
  DEFAULT_APPLIANCE_DISPLAY,
  mapWorkflowAppliance,
  validateApplianceDisplay,
} from '@/lib/appliance-display';
import { createWorkflowTryState, type WorkflowTransfer } from '@/lib/workflow-transfer';
import './combined-workspace.css';
import { type TryPanelProps } from './TryPanel';
import { PreviewDecisionBar } from './PreviewDecisionBar';
import {
  createMechanicsExperiment,
  transitionMechanics,
  attachMechanicsResult,
  experimentWithoutTad,
  type MechanicsAction,
} from '@/lib/mechanics';
import { calculateMechanics } from '@/lib/mechanics-client';
import {
  mechanicsDisplayPoses,
  explainMechanics,
  hasMechanicsMovement,
  mechanicsResponseCaption,
  recommendedMechanicsMagnification,
} from '@/lib/mechanics-presentation';
import { sceneAnalysisContext } from '@/lib/scene-analysis';
import { DEFAULT_WIRE_PRESET } from './MechanicsPanel';
import './mechanics.css';
import './classroom-workspace.css';
import { mechanicsCommandContext, reduceMechanicsFocus } from '@/lib/mechanics-commands';
import {
  createTryState,
  transitionTryMode,
  previewPose,
  assertTryUnlocked,
  assertTryRestoreUnlocked,
  archCurvePoints,
  serializeTrySession,
  type TryAction,
} from '@/lib/try-mode';

import { DEFAULT_ATTACHMENT, errorText, commandLabel } from './case/constants';
import type { ClassroomSnapshot, LessonSnapshot } from './case/types';
import type { CaseStudioApi } from './case/api';
import { CaseDialogs } from './case/CaseDialogs';
import { CaseMain } from './case/CaseMain';
import { CaseInspector } from './case/CaseInspector';
import { CaseSidebar } from './case/CaseSidebar';
import { CaseTopbar } from './case/CaseTopbar';
import {
  useAttachmentState,
  useCalibrationInputs,
  useCaseFiles,
  useCaseScenario,
  useCommandState,
  useDisplayState,
  useLayoutState,
  useLessonState,
  useManipulationTool,
  useMeasureState,
  useMechanicsState,
  useModelState,
  useMovementInputs,
  useSelectionState,
  useServiceDraft,
  useStagePlayback,
} from './case/state';

function CaseStudio({ active }: { active: boolean }) {
  const teaching = useTeaching();
  const {
    pointed,
    setPointed,
    mechanics,
    setMechanics,
    wirePreset,
    setWirePreset,
    magnification,
    setMagnification,
    predictResponse,
    setPredictResponse,
    responseRevealed,
    setResponseRevealed,
    forceVectors,
    setForceVectors,
    mechanicsFocus,
    setMechanicsFocus,
  } = useMechanicsState();
  const { scenario, setScenario } = useCaseScenario();
  const {
    mobilePanel,
    setMobilePanel,
    toolsOpen,
    setToolsOpen,
    modal,
    setModal,
    panel,
    setPanel,
    lecture,
    setLecture,
    playbackSpeed,
    setPlaybackSpeed,
    isolated,
    setIsolated,
    pointer,
    setPointer,
  } = useLayoutState();
  const {
    anatomy,
    setAnatomy,
    model,
    setModel,
    plan,
    dispatch,
    sandbox,
    setSandbox,
    applianceDisplay,
    setApplianceDisplay,
    workflowOrigin,
    setWorkflowOrigin,
  } = useModelState();
  const returnWorkspace = useRef<ClassroomSnapshot | null>(null);
  const {
    comparisonName,
    setComparisonName,
    traces,
    setTraces,
    curveVisible,
    setCurveVisible,
    reverse,
    setReverse,
    arch,
    setArch,
    ghost,
    setGhost,
    gums,
    setGums,
    labels,
    setLabels,
    grid,
    setGrid,
    braces,
    setBraces,
    roots,
    setRoots,
    bracketStyle,
    setBracketStyle,
    ligatureColor,
    setLigatureColor,
    opening,
    setOpening,
    view,
    setView,
  } = useDisplayState();
  const { selectedIds, setSelectedIds, selected, setSelected, multi, setMulti } =
    useSelectionState();
  const {
    stages,
    setStages,
    stage,
    setStage,
    playing,
    setPlaying,
    checkpoints,
    setCheckpoints,
    checkpointName,
    setCheckpointName,
  } = useStagePlayback();
  const {
    direction,
    setDirection,
    distance,
    setDistance,
    degrees,
    setDegrees,
    rotationMode,
    setRotationMode,
    axis,
    setAxis,
  } = useMovementInputs();
  const { command, setCommand, status, setStatus, statusError, setStatusError } = useCommandState();
  const { files, setFiles, scale, setScale, busy, setBusy, importError, setImportError } =
    useCaseFiles();
  const importAbort = useRef<AbortController | null>(null);
  useEffect(() => () => importAbort.current?.abort(), []);
  const {
    measureTo,
    setMeasureTo,
    measureMode,
    setMeasureMode,
    landmarks,
    setLandmarks,
    contacts,
    setContacts,
    checking,
    setChecking,
  } = useMeasureState();
  const contactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { apiDraft, setApiDraft } = useServiceDraft();
  const { attachments, setAttachments, attachmentDraft, setAttachmentDraft } = useAttachmentState();
  const { tool, setTool, dragPreview, setDragPreview } = useManipulationTool();
  const { lessonId, setLessonId, lessonStep, setLessonStep } = useLessonState();
  const lessonSnapshots = useRef<LessonSnapshot[]>([]);
  const { bAxis, setBAxis, mAxis, setMAxis, oAxis, setOAxis } = useCalibrationInputs();
  const prepared = !!scenario && !scenario.exploring;
  const caseDefinition = useMemo(
    () => (scenario ? getTeachingCase(scenario.caseId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
    [scenario?.caseId],
  );
  const caseVariant = caseDefinition?.variants.find(item => item.id === scenario?.variantId);
  const pathAudit = useMemo(
    () =>
      scenario && getTeachingAssetCase()
        ? casePathAudit(scenario.caseId, scenario.variantId)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
    [scenario?.caseId, scenario?.variantId],
  );
  const caseStart = useMemo(
    () => (scenario ? sampleCaseDemonstration(scenario.caseId, scenario.variantId, 0) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
    [scenario?.caseId, scenario?.variantId],
  );
  const dentalArrangement = DENTAL_ARRANGEMENTS.find(
    item => model.name === `${item.title} · synthetic teaching arrangement`,
  );
  const apiUrl = teaching.config.url,
    aiEnabled = teaching.config.enabled;
  const setAiEnabled = (enabled: boolean) => teaching.setConfig({ ...teaching.config, enabled });
  const pendingCamera = useRef<ViewerCamera | null>(null);
  const pendingView = useRef<ViewName | null>(null);
  const viewer = useRef<ViewerHandle>(null),
    caseInput = useRef<HTMLInputElement>(null),
    commandInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (pendingCamera.current) {
      viewer.current?.restoreCamera(pendingCamera.current);
      pendingCamera.current = null;
    } else if (pendingView.current) viewer.current?.setView(pendingView.current);
    pendingView.current = null;
  });
  const tooth = model.teeth.find(t => t.id === selected) || model.teeth[0],
    pose = plan.current[tooth.id] || emptyPose();
  const ids = model.teeth.map(t => t.id),
    calibrated = selectedIds.every(id => model.teeth.find(t => t.id === id)?.calibrated);
  const toothMoved = (id: string) => {
    const pose = plan.current[id] || emptyPose(),
      initial = sandbox.original?.[id] || emptyPose();
    return [...pose.translation, ...pose.rotation].some(
      (value, index) =>
        Math.abs(value - [...initial.translation, ...initial.rotation][index]) > 0.00001,
    );
  };
  const moved = model.teeth.filter(item => toothMoved(item.id)).length;
  const tryActive = sandbox.active && !lessonId && !prepared;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
  const tryState = useMemo(() => ({ ...sandbox, current: plan.current }), [sandbox, plan.current]);
  const demonstration = tryActive ? sandbox.pending || sandbox.lastEdit : null;
  const curveArch =
    arch === 'both'
      ? demonstration?.edit.type === 'fit-arch'
        ? demonstration.edit.arch
        : toothArch(selected)
      : arch;
  const geometricShown = useMemo(
    () =>
      prepared && scenario
        ? sampleCaseDemonstration(scenario.caseId, scenario.variantId, stage / stages)
        : demonstration
          ? previewPose(demonstration, stage / stages)
          : stageTransforms(plan.current, checkpoints, stage, stages, sandbox.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
    [
      prepared,
      scenario?.caseId,
      scenario?.variantId,
      demonstration,
      plan.current,
      checkpoints,
      stage,
      stages,
      sandbox.original,
    ],
  );
  const emptyExperiment = useMemo(
    () =>
      model.demo && model.teeth.every(item => item.calibrated)
        ? createMechanicsExperiment(model, plan.current)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
    [model, plan.current],
  );
  const activeExperiment = mechanics || emptyExperiment;
  const actualShown = useMemo(
    () =>
      mechanics?.result && !sandbox.pending
        ? interpolateTransforms(
            mechanics.reference.transforms,
            mechanics.result.transforms,
            responseRevealed ? stage / stages : 0,
          )
        : geometricShown,
    [mechanics, geometricShown, responseRevealed, stage, stages, sandbox.pending],
  );
  const shown = useMemo(
    () =>
      mechanics?.result && !sandbox.pending
        ? mechanicsDisplayPoses(
            mechanics.reference.transforms,
            mechanics.result.transforms,
            responseRevealed ? stage / stages : 0,
            magnification,
          )
        : geometricShown,
    [mechanics, geometricShown, responseRevealed, stage, stages, magnification, sandbox.pending],
  );
  const physicalPoint = useMemo(() => {
    if (!pointed) return null;
    if (pointed.surface === 'gingiva') return pointed;
    const tooth = model.teeth.find(item => item.id === pointed.tooth);
    return tooth
      ? {
          ...pointed,
          worldPoint: new Vector3(...pointed.localPoint)
            .applyMatrix4(toothMatrix(tooth, actualShown))
            .toArray() as Vec3,
        }
      : null;
  }, [pointed, model, actualShown]);
  const mechanicsGhost = useMemo(
    () =>
      mechanics?.comparison && responseRevealed
        ? mechanicsDisplayPoses(
            mechanics.reference.transforms,
            mechanics.comparison.transforms,
            stage / stages,
            magnification,
          )
        : undefined,
    [mechanics, responseRevealed, stage, stages, magnification],
  );
  const curve = useMemo(
    () =>
      curveVisible && tryActive
        ? archCurvePoints(model, tryState, curveArch).map(([x, y, z]): Vec3 => [
            x,
            y - (curveArch === 'lower' ? opening : 0),
            z,
          ])
        : undefined,
    [curveVisible, tryActive, model, tryState, curveArch, opening],
  );
  const currentLesson = LESSONS.find(l => l.id === lessonId);
  const spans = useMemo(
    () =>
      archSpans(model, prepared ? shown : plan.current, prepared ? caseStart : sandbox.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
    [model, prepared, shown, plan.current, caseStart, sandbox.original],
  );
  const note = (text: string, error = false) => {
    setStatus(text);
    setStatusError(error);
  };
  const session = (): CaseSession => ({
    ...(mechanics ? { mechanics } : {}),
    lectureSetup: {
      camera: viewer.current?.getCamera() || null,
      selectedIds,
      arch,
      view,
      gums,
      labels,
      grid,
      stage,
      opening,
      anatomy,
      magnification,
      forceVectors,
      wirePreset,
      mechanicsResponse: !!mechanics?.result,
      responseRevealed,
      predictResponse,
      playbackSpeed,
      reverse,
    },
    stages,
    checkpoints,
    past: plan.past,
    future: plan.future,
    braces,
    roots,
    bracketStyle,
    ligatureColor,
    attachments,
    tryMode: serializeTrySession(tryState),
    applianceDisplay,
  });
  const selectTooth = (id: string, additive = false) => {
    teaching.referenceInteraction();
    let next = [id];
    if (additive || multi)
      next = selectedIds.includes(id) ? selectedIds.filter(v => v !== id) : [...selectedIds, id];
    if (!next.length) next = [id];
    setSelectedIds(next);
    setSelected(next.includes(id) ? id : next[0]);
    setMeasureTo('');
  };
  const selectGroup = (scope: string) => {
    teaching.referenceInteraction();
    try {
      const c = parseCommand(`move ${scope} 1 mm x`, selected, ids, selectedIds);
      if ('teeth' in c) {
        setSelectedIds(c.teeth);
        setSelected(c.teeth[0]);
      }
    } catch (e) {
      note(errorText(e), true);
    }
  };
  const save = () => {
    try {
      if (prepared)
        throw new Error('Choose Explore this arrangement before saving an editable case.');
      if (sandbox.pending) throw new Error('Apply or discard the preview before saving the case.');
      saveCase(model, plan.current, session());
      note(
        'Case download started with committed positions, saved arrangements, groups, locks, and checkpoints.',
      );
    } catch (e) {
      note(errorText(e), true);
    }
  };
  useEffect(() => {
    setAttachmentDraft(tooth.attachment || DEFAULT_ATTACHMENT);
  }, [tooth, setAttachmentDraft]);
  useEffect(() => {
    if (!playing) return;
    const frames = mechanics?.result ? 200 : 125;
    const timer = window.setInterval(
      () =>
        setStage(s =>
          Math.max(
            0,
            Math.min(stages, s + (((reverse ? -1 : 1) * stages) / frames) * playbackSpeed),
          ),
        ),
      40,
    );
    return () => clearInterval(timer);
  }, [playing, stages, playbackSpeed, reverse, mechanics?.result, setStage]);
  useEffect(() => {
    if (playing && (reverse ? stage <= 0 : stage >= stages)) setPlaying(false);
  }, [playing, stage, stages, reverse, setPlaying]);
  useEffect(() => {
    setContacts(null);
    setChecking(false);
    return () => {
      if (contactTimer.current) clearTimeout(contactTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
  }, [model, plan.current]);
  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, dialog')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void teaching.runControl(e.shiftKey ? 'redo' : 'undo that');
      }
      if (e.key === 'Escape') setMobilePanel('model');
      if (e.key === '/') {
        e.preventDefault();
        commandInput.current?.focus();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
  }, [stages, active]);

  const applyTry = (action: TryAction): boolean => {
    if (prepared && action.type === 'enter')
      return applyTeaching({ kind: 'case', action: 'explore' });
    if (prepared) throw new Error('Choose Explore this arrangement before making a free edit.');
    const next = transitionTryMode(model, tryState, action);
    if (next.current !== tryState.current)
      dispatch({
        type: 'commit',
        value: next.current,
        label: next.lastEdit?.label || 'Try Mode arrangement',
      });
    if (mechanics && action.type === 'apply') {
      const reference = createMechanicsExperiment(model, next.current);
      setMechanics({
        ...reference,
        config: mechanics.config,
        stages: mechanics.stages,
        revision: mechanics.revision + 1,
      });
    }
    setSandbox(next);
    setDragPreview(null);
    setTool('orbit');
    setPlaying(false);
    setReverse(false);
    if (next.pending && next.pending !== sandbox.pending) {
      setMobilePanel('model');
      setStage(0);
      setSelectedIds(next.pending.affectedIds);
      setSelected(next.pending.affectedIds[0] || selected);
      note(`${next.pending.label}. Cyan is the candidate; review the path report before applying.`);
    }
    if (action.type === 'apply') {
      setMechanicsFocus({ ...mechanicsFocus, lastParameter: undefined });
      setStage(0);
      setPlaying(true);
      note('Applied one geometric edit. Playing its checked path; one Undo restores the request.');
    }
    if (action.type === 'cancel') {
      setStage(stages);
      note('Preview discarded. Committed positions are unchanged.');
    }
    if (action.type === 'set-arch') {
      setCurveVisible(true);
      setArch(action.arch);
    }
    if (action.type === 'lock')
      note(`${action.locked ? 'Locked' : 'Unlocked'} teeth ${action.teeth.join(', ')}.`);
    if (action.type === 'save-snapshot')
      note(
        `Saved arrangement “${action.name}” locally in this case. Save case to keep it after closing.`,
      );
    if (action.type === 'enter') setLessonId('');
    if (action.type === 'compare-snapshot' || action.type === 'delete-snapshot') {
      setComparisonName(next.comparisonName);
      setGhost(false);
    }
    return true;
  };
  const sendTry = (action: TryAction, summary = 'Update Try Mode') => {
    void teaching.execute([{ kind: 'try', action }], summary);
  };
  const toggleApplianceVisibility = () => {
    if (mechanics || (caseVariant?.removableRetainer && applianceDisplay.preset === 'none')) {
      setBraces(!braces);
      return;
    }
    if (applianceDisplay.preset === 'none') {
      setApplianceDisplay({ ...DEFAULT_APPLIANCE_DISPLAY });
      setBraces(true);
    } else setBraces(!braces);
  };
  const apply = (c: Command): boolean => {
    try {
      setDragPreview(null);
      if (
        ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(c.type)
      ) {
        if (prepared) throw new Error('Choose Explore this arrangement before moving teeth.');
        const targets = 'teeth' in c ? c.teeth : 'tooth' in c ? [c.tooth] : selectedIds;
        assertTryUnlocked(tryState, targets);
        if (tryActive)
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
        const next = applyDentalCommand(plan.current, model.teeth, c);
        setSandbox({ ...sandbox, pending: null, lastEdit: null });
        dispatch({ type: 'commit', value: next, label: commandLabel(c) });
        setSelectedIds(targets);
        setSelected(targets[0]);
        const arches = new Set(targets.map(toothArch));
        if (arches.size > 1) setArch('both');
        else if (arch !== 'both') setArch(toothArch(targets[0]));
        setPlaying(false);
        setStage(stages);
        note(commandLabel(c));
      } else if (c.type === 'ghost') {
        setGhost(c.visible);
        note(commandLabel(c));
      } else if (c.type === 'appliance') {
        if (c.visible) setApplianceDisplay({ ...DEFAULT_APPLIANCE_DISPLAY });
        setBraces(c.visible);
        note(commandLabel(c));
      } else if (c.type === 'stages') {
        setStages(c.count);
        setStage(c.count);
        setPlaying(false);
        note(
          `Created ${c.count} geometric stages through ${checkpoints.length} saved checkpoints. No treatment duration is implied.`,
        );
      } else if (c.type === 'play') {
        setReverse(false);
        setStage(0);
        setPlaying(true);
        note(
          demonstration
            ? 'Playing the geometric edit from its saved starting arrangement.'
            : 'Playing the geometric path through your saved checkpoints.',
        );
      } else if (c.type === 'undo' || c.type === 'redo') {
        dispatch({ type: c.type });
        setSandbox({ ...sandbox, pending: null, lastEdit: null });
        setPlaying(false);
        setStage(stages);
        note(
          c.type === 'undo'
            ? 'Last operation undone for all affected teeth.'
            : 'Operation restored.',
        );
      }
      return true;
    } catch (e) {
      note(errorText(e), true);
      return false;
    }
  };
  const load = (next: DentalCase, transforms: Transforms = {}, saved?: CaseSession) => {
    if (
      !next.demo &&
      saved?.applianceDisplay &&
      !['none', 'braces'].includes(saved.applianceDisplay.preset)
    )
      throw new Error(
        'Imported cases support ordinary braces only. Use a synthetic model for the teaching appliance presets.',
      );
    setMechanics(saved?.mechanics || null);
    setPointed(null);
    setMechanicsFocus({});
    setResponseRevealed(true);
    returnWorkspace.current = null;
    setWorkflowOrigin(null);
    setScenario(null);
    setApplianceDisplay(saved?.applianceDisplay || { ...DEFAULT_APPLIANCE_DISPLAY });
    setSandbox({ ...createTryState(transforms), ...saved?.tryMode });
    setComparisonName(saved?.tryMode?.comparisonName || null);
    setCurveVisible(false);
    setTraces(false);
    setReverse(false);
    setCommand('');
    setModel(next);
    dispatch({ type: 'load', value: transforms, past: saved?.past, future: saved?.future });
    teaching.cancel();
    teaching.resetHistory();
    setAnatomy({ ...DEFAULT_ANATOMY });
    setLessonId('');
    setLessonStep(-1);
    lessonSnapshots.current = [];
    setDragPreview(null);
    setTool('orbit');
    setAttachments(saved?.attachments ?? false);
    setSelected(next.teeth[0].id);
    setSelectedIds([next.teeth[0].id]);
    setMeasureTo('');
    setLandmarks([]);
    setMeasureMode(false);
    setContacts(null);
    setStages(saved?.stages || 10);
    setStage(saved?.stages || 10);
    setCheckpoints(saved?.checkpoints || []);
    setPlaying(false);
    setView('perspective');
    setArch('both');
    setOpening(0);
    setDirection(next.demo ? 'buccal' : 'x');
    setGhost(false);
    setRoots(saved?.roots || false);
    setBraces(saved?.braces ?? false);
    setBracketStyle(saved?.bracketStyle || 'metal');
    setLigatureColor(saved?.ligatureColor || '#299f9b');
    setModal(null);
    if (saved?.lectureSetup) {
      const setup = saved.lectureSetup;
      setSelectedIds(setup.selectedIds);
      setSelected(setup.selectedIds[0]);
      setArch(setup.arch);
      setView(setup.view);
      setGums(setup.gums);
      setLabels(setup.labels);
      setGrid(setup.grid);
      setStage(setup.stage);
      setOpening(setup.opening);
      setAnatomy(setup.anatomy);
      setMagnification(setup.magnification);
      setForceVectors(setup.forceVectors);
      setWirePreset(setup.wirePreset);
      setResponseRevealed(setup.responseRevealed ?? true);
      setPredictResponse(setup.predictResponse ?? false);
      setPlaybackSpeed(setup.playbackSpeed ?? 1);
      setReverse(setup.reverse ?? false);
      pendingCamera.current = setup.camera;
    }
    note(
      saved
        ? 'Case, movement history, and checkpoints restored.'
        : next.demo
          ? 'Synthetic orthodontic study loaded.'
          : 'Imported shared coordinates preserved. Calibrate anatomical axes before named movements or braces.',
    );
  };
  const importFiles = async () => {
    setBusy(true);
    setImportError('');
    try {
      load(await importSTLs(files, Number(scale)));
      setFiles([]);
    } catch (e) {
      setImportError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const importCase = async (file?: File) => {
    if (!file) return;
    teaching.cancel();
    importAbort.current?.abort();
    const controller = new AbortController();
    importAbort.current = controller;
    setBusy(true);
    try {
      const saved = await loadCase(file);
      if (saved.session?.mechanics && saved.session.lectureSetup?.mechanicsResponse) {
        note('Restoring the experiment by recalculating its saved configuration…');
        const result = await calculateMechanics(saved.session.mechanics, controller.signal);
        saved.session.mechanics = {
          ...attachMechanicsResult(saved.session.mechanics, result),
          applied: result,
        };
        assertTryRestoreUnlocked(
          { current: saved.transforms, lockedIds: saved.session.tryMode?.lockedIds || [] },
          result.transforms,
        );
        saved.transforms = result.transforms;
      }
      if (!controller.signal.aborted) load(saved.model, saved.transforms, saved.session);
    } catch (e) {
      if (!controller.signal.aborted) note(errorText(e), true);
    } finally {
      if (importAbort.current === controller) {
        importAbort.current = null;
        setBusy(false);
      }
      if (caseInput.current) caseInput.current.value = '';
    }
  };
  const setCamera = (next: ViewName) => {
    if (next === 'occlusal' && arch === 'both') setArch(toothArch(selected));
    setView(next);
    viewer.current?.setView(next);
  };
  const addCheckpoint = () => {
    if (prepared) {
      note('Explore the arrangement before saving free-edit checkpoints.', true);
      return;
    }
    if (checkpoints.length >= 20) {
      note('Use at most 20 checkpoints per case.', true);
      return;
    }
    const name = checkpointName.trim() || `Checkpoint ${checkpoints.length + 1}`;
    setCheckpoints([
      ...checkpoints,
      {
        id: crypto.randomUUID(),
        name: name.slice(0, 60),
        transforms: structuredClone(actualShown),
      },
    ]);
    setCheckpointName('');
    setStage(stages);
    setPlaying(false);
    note(`Captured the shown position as “${name}”. Subsequent movements update the final target.`);
  };
  const scanContacts = () => {
    if (sandbox.pending) {
      note(
        'Use the preview path report, or Apply or Discard before checking committed surfaces.',
        true,
      );
      return;
    }
    setChecking(true);
    setStage(stages);
    setPlaying(false);
    contactTimer.current = setTimeout(() => {
      try {
        const found = findSurfaceIntersections(
          model,
          prepared
            ? sampleCaseDemonstration(scenario!.caseId, scenario!.variantId, 1)
            : plan.current,
        );
        setContacts(found);
        note(
          `${found.length} crown-surface intersection pair${found.length === 1 ? '' : 's'} at the final pose. This checks surfaces, not biological clearance.`,
        );
      } catch (e) {
        note(errorText(e), true);
      } finally {
        setChecking(false);
      }
    }, 30);
  };
  const openCalibration = () => {
    setBAxis('+Z');
    setMAxis(['1', '4'].includes(selected[0]) ? '+X' : '-X');
    setOAxis(toothArch(selected) === 'upper' ? '-Y' : '+Y');
    setModal('calibrate');
  };
  const csv = () => {
    const rows = movementRows(
      model,
      prepared ? shown : plan.current,
      prepared ? caseStart : sandbox.original,
    );
    const lines = [
      'Tooth,Name,X_mm,Y_mm,Z_mm,Displacement_mm,Orientation_change_deg',
      ...rows.map(r =>
        [
          r.id,
          `"${r.name.replaceAll('"', '""')}"`,
          r.x.toFixed(4),
          r.y.toFixed(4),
          r.z.toFixed(4),
          r.displacement.toFixed(4),
          r.orientationChange.toFixed(4),
        ].join(','),
      ),
    ];
    download('forma-movement-summary.csv', lines.join('\n'), 'text/csv');
    note('Movement summary download started. Orientation is the net angle from the original pose.');
  };
  const editAttachments = (spec: AttachmentSpec | null, targets = selectedIds): boolean => {
    try {
      const value = spec ? validateAttachment(spec) : undefined;
      if (value)
        for (const id of targets) {
          const target = model.teeth.find(t => t.id === id);
          if (!target) throw new Error(`Tooth ${id} is not available.`);
          createAttachmentGeometry(target, value).dispose();
        }
      setModel({
        ...model,
        teeth: model.teeth.map(t => (targets.includes(t.id) ? { ...t, attachment: value } : t)),
      });
      if (value) {
        setAttachments(true);
        setBraces(false);
      }
      note(
        value
          ? `Attachment applied to ${targets.join(', ')}. Use Remove to reverse this appliance edit.`
          : `Attachments removed from ${targets.join(', ')}.`,
      );
      return true;
    } catch (e) {
      note(errorText(e), true);
      return false;
    }
  };
  const poseCommit = (id: string, next: Pose) => {
    if (prepared) {
      note('Choose Explore this arrangement before using tooth handles.', true);
      return;
    }
    setDragPreview(null);
    const original = plan.current[id] || emptyPose();
    if (
      !isPose(next) ||
      next.translation.some((v, i) => Math.abs(v - original.translation[i]) > 10)
    ) {
      note('Keep each handle move within 10 mm per axis. Use another move to continue.', true);
      return;
    }
    if (
      [...next.translation, ...next.rotation].every(
        (v, i) => Math.abs(v - [...original.translation, ...original.rotation][i]) < 1e-7,
      )
    )
      return;
    if (sandbox.lockedIds.includes(id)) {
      note(`Tooth ${id} is locked. Unlock it before editing.`, true);
      return;
    }
    if (tryActive) {
      sendTry(
        {
          type: 'preview',
          edit: { type: 'poses', poses: { [id]: next }, label: `Tooth ${id} · handle edit` },
        },
        'Preview handle edit',
      );
      return;
    }
    setSandbox({ ...sandbox, pending: null, lastEdit: null });
    dispatch({
      type: 'commit',
      value: { ...plan.current, [id]: next },
      label: `${id} · ${tool === 'rotate' ? 'Rotate' : 'Translate'} with handles`,
    });
    setStage(stages);
    setPlaying(false);
    note(`Tooth ${id} moved with world-axis handles. Undo restores this whole drag.`);
  };
  const snapshot = (): LessonSnapshot => ({
    transforms: plan.current,
    model,
    selected,
    selectedIds,
    arch,
    view,
    ghost,
    roots,
    braces,
    attachments,
    gums,
    labels,
    grid,
    stage,
    stages,
    opening,
  });
  const restoreSnapshot = (s: LessonSnapshot) => {
    assertTryRestoreUnlocked(tryState, s.transforms);
    setSandbox({ ...sandbox, pending: null, lastEdit: null });
    dispatch({ type: 'commit', value: s.transforms, label: 'Restore lecture step' });
    setModel(s.model);
    setSelected(s.selected);
    setSelectedIds(s.selectedIds);
    setArch(s.arch);
    setView(s.view);
    setGhost(s.ghost);
    setRoots(s.roots);
    setBraces(s.braces);
    setAttachments(s.attachments);
    setGums(s.gums);
    setLabels(s.labels);
    setGrid(s.grid);
    setStage(s.stage);
    setStages(s.stages);
    setOpening(s.opening);
    setPlaying(false);
    setDragPreview(null);
    setTool('orbit');
    setTimeout(() => viewer.current?.setView(s.view), 0);
  };
  const advanceLesson = (action: 'next' | 'previous' | 'restart'): boolean => {
    if (!currentLesson) {
      setModal('lessons');
      note('Choose a teaching demonstration first.');
      return false;
    }
    if (action === 'restart' || action === 'previous') {
      const index = action === 'restart' ? 0 : lessonStep,
        saved = lessonSnapshots.current[index];
      if (saved) restoreSnapshot(saved);
      setLessonStep(action === 'restart' ? -1 : Math.max(-1, lessonStep - 1));
      note(
        action === 'restart'
          ? 'Lesson returned to its starting setup.'
          : 'Previous lesson setup restored.',
      );
      return true;
    }
    const index = lessonStep + 1,
      next = currentLesson.steps[index];
    if (!next) {
      note('Demonstration complete. Restart it or choose another lesson.');
      return false;
    }
    const before = snapshot();
    if (!runTeaching(next.command)) return false;
    lessonSnapshots.current[index] = before;
    setLessonStep(index);
    return true;
  };
  const applyTeaching = (action: TeachingAction): boolean => {
    try {
      if (action.kind === 'dental-arrangement') {
        const next = createDentalArrangement(createDemo(), action.id);
        returnWorkspace.current ||= captureClassroom();
        setScenario(null);
        setMechanics(null);
        setPointed(null);
        setMechanicsFocus({});
        setWorkflowOrigin(null);
        setModel(next.model);
        dispatch({ type: 'load', value: next.transforms });
        setSandbox(createTryState(next.transforms, next.transforms));
        setSelectedIds(next.selectedIds);
        setSelected(next.selectedIds[0]);
        setArch('both');
        setView('front');
        setApplianceDisplay({ preset: 'none', progress: 0, palate: false });
        setBraces(false);
        setAttachments(false);
        setRoots(false);
        setGums(true);
        setLabels(false);
        setAnatomy({ ...DEFAULT_ANATOMY });
        setOpening(0);
        setLessonId('');
        setLessonStep(-1);
        lessonSnapshots.current = [];
        setCheckpoints([]);
        setStages(10);
        setStage(10);
        setPlaying(false);
        setReverse(false);
        setGhost(false);
        setComparisonName(null);
        setTraces(false);
        setCurveVisible(false);
        setTool('orbit');
        setDragPreview(null);
        setIsolated(false);
        setPointer(false);
        setLandmarks([]);
        setMeasureMode(false);
        setMeasureTo('');
        setPanel('move');
        setMobilePanel('model');
        setModal(null);
        pendingCamera.current = null;
        pendingView.current = 'front';
        note(
          `${next.model.name}. Dental arrangement only; skeletal class is separate. ${next.auditNote}`,
        );
        return true;
      }
      if (action.kind === 'case') {
        if (action.action === 'load') {
          const next = createTeachingCase(createDemo(), action.id),
            variant = next.definition.variants[0];
          returnWorkspace.current ||= captureClassroom();
          setScenario({
            caseId: next.definition.id,
            variantId: variant.id,
            model: next.model,
            returnProgress: 0,
            exploring: false,
            answerVisible: false,
          });
          setMechanics(null);
          setPointed(null);
          setMechanicsFocus({});
          setWorkflowOrigin(null);
          setIsolated(false);
          setPointer(false);
          setModel(next.model);
          dispatch({ type: 'load', value: next.transforms });
          setSandbox({ ...createTryState(next.transforms), active: false });
          setSelectedIds(next.selectedIds);
          setSelected(next.selectedIds[0]);
          setView(next.definition.view);
          setArch(
            next.definition.view === 'occlusal' && next.definition.arch === 'both'
              ? 'upper'
              : next.definition.arch,
          );
          setApplianceDisplay(variant.appliance);
          setBraces(variant.appliance.preset !== 'none' || !!variant.removableRetainer);
          setRoots(next.definition.id === 'movement-types');
          setGums(true);
          setLabels(false);
          setAttachments(true);
          setAnatomy({ ...DEFAULT_ANATOMY });
          setLessonId('');
          setLessonStep(-1);
          lessonSnapshots.current = [];
          setCheckpoints([]);
          setStages(10);
          setStage(0);
          setGhost(false);
          setComparisonName(null);
          setTraces(false);
          setCurveVisible(false);
          setOpening(0);
          setLandmarks([]);
          setMeasureMode(false);
          setMeasureTo('');
          setPanel('move');
          setMobilePanel('model');
          setModal(null);
          pendingCamera.current = null;
          pendingView.current = next.definition.view;
        } else {
          if (!scenario || !caseDefinition || !caseVariant)
            throw new Error('Choose a prepared case first.');
          if (action.action === 'explore') {
            const current = sampleCaseDemonstration(
              scenario.caseId,
              scenario.variantId,
              stage / stages,
            );
            setScenario({
              ...scenario,
              exploring: true,
              returnProgress: stage / stages,
              returnDisplay: {
                lesson: { ...snapshot(), transforms: current },
                anatomy,
                appliance: applianceDisplay,
                bracketStyle,
                ligatureColor,
                camera: viewer.current?.getCamera() || null,
              },
            });
            dispatch({ type: 'load', value: current });
            setSandbox({
              ...createTryState(current),
              snapshots: [{ name: 'Prepared case start', transforms: caseStart! }],
            });
            setStage(stages);
            setPanel('move');
            setMobilePanel('tools');
          } else if (
            action.action === 'return' ||
            action.action === 'variant' ||
            action.action === 'reset'
          ) {
            const variantId = action.action === 'variant' ? action.id : scenario.variantId;
            const variant = caseDefinition.variants.find(item => item.id === variantId);
            if (!variant) throw new Error('Choose an available case demonstration.');
            const progress = action.action === 'return' ? scenario.returnProgress : 0;
            const baseline = sampleCaseDemonstration(scenario.caseId, variantId, 0);
            setMechanics(null);
            setPointed(null);
            setMechanicsFocus({});
            setScenario({
              ...scenario,
              variantId,
              returnProgress: progress,
              returnDisplay: action.action === 'return' ? scenario.returnDisplay : undefined,
              exploring: false,
              answerVisible: false,
            });
            setModel(scenario.model);
            dispatch({ type: 'load', value: baseline });
            setSandbox({ ...createTryState(baseline), active: false });
            setApplianceDisplay(variant.appliance);
            setBraces(variant.appliance.preset !== 'none' || !!variant.removableRetainer);
            setAttachments(true);
            setStage(progress * stages);
            setCheckpoints([]);
            setComparisonName(null);
            setTraces(false);
            setCurveVisible(false);
            setLandmarks([]);
            setOpening(0);
            setSelectedIds(caseDefinition.selectedIds);
            setSelected(caseDefinition.selectedIds[0]);
            setMobilePanel('model');
            if (action.action === 'return' && scenario.returnDisplay) {
              const saved = scenario.returnDisplay,
                previous = saved.lesson;
              setModel(previous.model);
              setSelected(previous.selected);
              setSelectedIds(previous.selectedIds);
              setArch(previous.arch);
              setView(previous.view);
              setGhost(previous.ghost);
              setRoots(previous.roots);
              setBraces(previous.braces);
              setAttachments(previous.attachments);
              setGums(previous.gums);
              setLabels(previous.labels);
              setGrid(previous.grid);
              setStage(previous.stage);
              setStages(previous.stages);
              setOpening(previous.opening);
              setAnatomy(saved.anatomy);
              setApplianceDisplay(saved.appliance);
              setBracketStyle(saved.bracketStyle);
              setLigatureColor(saved.ligatureColor);
              pendingView.current = null;
              pendingCamera.current = saved.camera;
            }
          } else if (action.action === 'progress') setStage(action.value * stages);
          else if (action.action === 'play') {
            if (stage >= stages) setStage(0);
            setReverse(false);
            setPlaying(true);
            return true;
          } else if (action.action === 'pause') {
            setPlaying(false);
            return true;
          }
        }
        setTool('orbit');
        setDragPreview(null);
        setReverse(false);
        setPlaying(false);
        note(
          action.action === 'explore'
            ? 'Free exploration of the shown arrangement. Return to prepared case restores this stage.'
            : 'Prepared teaching example loaded. Ask students to predict, then play or compare an approach.',
        );
        return true;
      }
      if (action.kind === 'question') {
        if (!scenario) throw new Error('Choose a prepared teaching case first.');
        setScenario({ ...scenario, answerVisible: action.visible });
        return true;
      }
      if (action.kind === 'workspace') {
        if (action.action !== 'restore' || !returnWorkspace.current)
          throw new Error('There is no saved workspace to restore.');
        restoreClassroom(returnWorkspace.current);
        note('Your original workspace, model and edits are restored.');
        return true;
      }
      if (action.kind === 'appliance-display') {
        setApplianceDisplay(
          validateApplianceDisplay({
            preset: action.preset,
            progress: action.progress ?? 0,
            palate: action.palate ?? false,
          }),
        );
        setBraces(action.preset !== 'none');
        note('Appliance display updated. Tooth positions are unchanged.');
        return true;
      }
      if (action.kind === 'try') return applyTry(action.action);
      if (action.kind === 'try-display') {
        if (action.target === 'traces') setTraces(action.visible);
        else setCurveVisible(action.visible);
        return true;
      }
      if (action.kind === 'try-playback') {
        const backwards = action.direction === 'reverse';
        setReverse(backwards);
        setStage(backwards ? stages : 0);
        setPlaying(true);
        return true;
      }
      if (action.kind === 'workflow') return action.action === 'exit';
      if (action.kind === 'progress') {
        setStage(action.value * stages);
        setPlaying(false);
        return true;
      }
      if (action.kind === 'speed') {
        setPlaybackSpeed(action.value);
        return true;
      }
      if (action.kind === 'anatomy') {
        if (!model.demo)
          throw new Error('Generated anatomy is available only on the synthetic teaching model.');
        setAnatomy(
          action.action === 'opacity'
            ? { ...anatomy, bone: true, opacity: action.value }
            : {
                ...anatomy,
                [action.action]: action.visible,
                ...(action.action === 'cutaway' && action.visible
                  ? { bone: true, ligament: true }
                  : {}),
              },
        );
        if (action.action === 'cutaway' && action.visible) {
          setRoots(true);
          setGums(true);
        }
        return true;
      }
      if (action.kind === 'return-lesson') {
        const saved = lessonSnapshots.current[Math.max(0, lessonStep)];
        if (!saved) throw new Error('Start a lesson first.');
        restoreSnapshot(saved);
        return true;
      }
      if (action.kind === 'dental') return apply(action.command);
      if (action.kind === 'lesson-step') return advanceLesson(action.action);
      if (action.kind === 'attachment')
        return editAttachments(
          action.action === 'remove'
            ? null
            : { ...DEFAULT_ATTACHMENT, shape: action.shape || 'rectangle' },
          action.teeth,
        );
      if (action.kind === 'select') {
        setSelectedIds(action.teeth);
        setSelected(action.teeth[0]);
      }
      if (action.kind === 'view') setCamera(action.view);
      if (action.kind === 'arch') {
        setArch(action.arch);
        if (action.arch === 'both' && view === 'occlusal') setCamera('perspective');
      }
      if (action.kind === 'toggle') {
        if (action.target === 'roots' && action.visible && !model.teeth.some(t => t.rootGeometry))
          throw new Error('This case has no root geometry.');
        if (action.target === 'braces' && action.visible)
          setApplianceDisplay({ ...DEFAULT_APPLIANCE_DISPLAY });
        ({
          braces: setBraces,
          roots: setRoots,
          gums: setGums,
          labels: setLabels,
          grid: setGrid,
          attachments: setAttachments,
        })[action.target](action.visible);
      }
      if (action.kind === 'comparison') {
        setPlaying(false);
        setComparisonName(action.mode === 'overlay' ? 'original' : null);
        setSandbox({ ...sandbox, comparisonName: null });
        if (action.mode === 'before') {
          setStage(0);
          setGhost(false);
        } else if (action.mode === 'after') {
          setStage(stages);
          setGhost(false);
        } else {
          setGhost(action.mode === 'overlay');
          if (action.mode === 'overlay' && !scenario) setStage(stages);
        }
      }
      if (action.kind === 'stage') {
        const n =
          action.action === 'exact'
            ? action.stage
            : Math.round(stage) + (action.action === 'next' ? 1 : -1);
        if (n < 0 || n > stages) throw new Error(`Choose a stage from 0 to ${stages}.`);
        setStage(n);
        setPlaying(false);
      }
      if (action.kind === 'stop') setPlaying(false);
      if (action.kind === 'focus') {
        setSelectedIds([action.tooth]);
        setSelected(action.tooth);
        setMeasureTo('');
        if (arch !== 'both') setArch(toothArch(action.tooth));
        setTimeout(() => viewer.current?.focus(), 0);
      }
      if (action.kind === 'lecture') setLecture(action.enabled);
      setTool('orbit');
      setDragPreview(null);
      note(
        action.kind === 'select'
          ? `Selected ${action.teeth.join(', ')}.`
          : action.kind === 'toggle'
            ? `${action.target} ${action.visible ? 'shown' : 'hidden'}.`
            : action.kind === 'view'
              ? `${action.view} view.`
              : action.kind === 'comparison'
                ? `${action.mode === 'before' ? (demonstration ? 'Edit start' : 'Original') : action.mode === 'after' ? 'Endpoint' : 'Overlay'} view.`
                : 'Teaching view updated.',
      );
      return true;
    } catch (e) {
      note(errorText(e), true);
      return false;
    }
  };
  const runTeaching = (text: string): boolean => {
    try {
      return applyTeaching(parseTeachingCommand(text, selected, ids, selectedIds));
    } catch (e) {
      note(errorText(e), true);
      return false;
    }
  };
  useEffect(() => {
    if (!active) {
      setPlaying(false);
      setModal(null);
      setDragPreview(null);
    }
  }, [active, setPlaying, setModal, setDragPreview]);
  const captureClassroom = (): ClassroomSnapshot => ({
    mechanics,
    wirePreset,
    magnification,
    predictResponse,
    responseRevealed,
    forceVectors,
    pointed,
    mechanicsFocus,
    scenario,
    applianceDisplay,
    workflowOrigin,
    returnWorkspace: returnWorkspace.current,
    sandbox: tryState,
    comparisonName,
    traces,
    curveVisible,
    reverse,
    lesson: snapshot(),
    history: plan,
    checkpoints,
    speed: playbackSpeed,
    anatomy,
    camera: viewer.current?.getCamera() || null,
    lessonId,
    lessonStep,
    lessonSnapshots: [...lessonSnapshots.current],
    bracketStyle,
    ligatureColor,
    lecture,
    isolated,
    tool,
    measureTo,
    measureMode,
    landmarks,
  });
  const restoreClassroom = (saved: ClassroomSnapshot) => {
    setMechanics(saved.mechanics ?? null);
    setWirePreset(saved.wirePreset || DEFAULT_WIRE_PRESET);
    setMagnification(saved.magnification ?? 10);
    setPredictResponse(saved.predictResponse ?? false);
    setResponseRevealed(saved.responseRevealed ?? true);
    setForceVectors(saved.forceVectors ?? true);
    setPointed(saved.pointed ?? null);
    setMechanicsFocus(saved.mechanicsFocus ?? {});
    const s = saved.lesson;
    setScenario(saved.scenario);
    setApplianceDisplay(saved.applianceDisplay);
    setWorkflowOrigin(saved.workflowOrigin);
    returnWorkspace.current = saved.returnWorkspace;
    setSandbox(saved.sandbox);
    setComparisonName(saved.comparisonName);
    setTraces(saved.traces);
    setCurveVisible(saved.curveVisible);
    setReverse(saved.reverse);
    setModel(s.model);
    dispatch({
      type: 'load',
      value: saved.history.current,
      past: saved.history.past,
      future: saved.history.future,
    });
    setSelected(s.selected);
    setSelectedIds(s.selectedIds);
    setArch(s.arch);
    setView(s.view);
    setGhost(s.ghost);
    setRoots(s.roots);
    setBraces(s.braces);
    setAttachments(s.attachments);
    setGums(s.gums);
    setLabels(s.labels);
    setGrid(s.grid);
    setStage(s.stage);
    setStages(s.stages);
    setOpening(s.opening);
    setCheckpoints(saved.checkpoints);
    setPlaybackSpeed(saved.speed);
    setAnatomy(saved.anatomy);
    setLessonId(saved.lessonId);
    setLessonStep(saved.lessonStep);
    lessonSnapshots.current = [...saved.lessonSnapshots];
    setBracketStyle(saved.bracketStyle);
    setLigatureColor(saved.ligatureColor);
    setLecture(saved.lecture);
    setIsolated(saved.isolated ?? false);
    setPointer(false);
    setTool(saved.tool);
    setMeasureTo(saved.measureTo);
    setMeasureMode(saved.measureMode);
    setLandmarks(saved.landmarks);
    note('Classroom request restored.');
    setPlaying(false);
    setDragPreview(null);
    pendingView.current = null;
    pendingCamera.current = saved.camera;
  };
  const importWorkflowSetup = (setup: WorkflowTransfer, originSnapshot: unknown) => {
    if (sandbox.pending)
      throw new Error('Apply or discard the workspace preview before exploring a lesson setup.');
    const original = returnWorkspace.current || captureClassroom();
    const next = createWorkflowTryState(setup),
      display = {
        ...mapWorkflowAppliance(setup.display.workflowOverlay, setup.display.braces),
        palate: false,
      };
    setMechanics(null);
    setPointed(null);
    setMechanicsFocus({});
    setScenario(null);
    returnWorkspace.current = original;
    setWorkflowOrigin({ setup, snapshot: originSnapshot });
    setModel(setup.model);
    dispatch({ type: 'load', value: next.current });
    setSandbox(next);
    setApplianceDisplay(display);
    setSelectedIds(setup.selectedIds);
    setSelected(setup.selectedIds[0]);
    setArch(setup.display.arch);
    setView(setup.display.view);
    setRoots(setup.display.roots);
    setGums(setup.display.gums);
    setLabels(setup.display.labels);
    setGhost(setup.display.ghost);
    setBraces(display.preset !== 'none');
    setAttachments(setup.display.attachments);
    setAnatomy(setup.display.anatomy);
    setComparisonName(null);
    setTraces(false);
    setCurveVisible(false);
    setReverse(false);
    setStages(10);
    setStage(10);
    setPlaying(false);
    setCheckpoints([]);
    setOpening(0);
    setGrid(false);
    setLessonId('');
    setLessonStep(-1);
    lessonSnapshots.current = [];
    setTool('orbit');
    setDragPreview(null);
    setMeasureMode(false);
    setMeasureTo('');
    setLandmarks([]);
    setContacts(null);
    setBracketStyle('metal');
    setLigatureColor('#3298bb');
    setPanel('move');
    setModal(null);
    setCommand('');
    pendingCamera.current = (originSnapshot as { camera?: ViewerCamera | null }).camera || null;
    note(
      'This shown lesson setup is now a free experiment. Your previous workspace is preserved in this session.',
    );
  };

  const applyMechanics = async (
    action: MechanicsAction,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    if (!activeExperiment)
      throw new Error('Mechanical experiments require the synthetic teaching model.');
    if (prepared) throw new Error('Choose Explore this arrangement before building an experiment.');
    let experiment = transitionMechanics(activeExperiment, action);
    setPlaying(false);
    setTool('orbit');
    setDragPreview(null);
    const publishExperiment = () => {
      if (action.type === 'brackets' || action.type === 'wire') {
        setSelectedIds(action.teeth);
        setSelected(action.teeth[0]);
      }
      setMechanics(experiment);
      setMechanicsFocus(reduceMechanicsFocus(mechanicsFocus, action));
      setPanel('braces');
      setApplianceDisplay({ preset: 'none', progress: 0, palate: false });
      setBraces(true);
      setAttachments(false);
    };
    if (action.type === 'solve' || action.type === 'compare-without-tad') {
      const alternate = action.type === 'compare-without-tad';
      if (alternate && !activeExperiment.result)
        throw new Error('Calculate the original setup before comparing its anchorage.');
      const source = alternate ? experimentWithoutTad(experiment, action.id) : experiment;
      const input = source;
      note(
        alternate
          ? 'Calculating the alternative from the same unloaded reference…'
          : 'Calculating the initial elastic response…',
      );
      const result = await calculateMechanics(input, signal);
      if (signal?.aborted) throw new DOMException('Calculation cancelled.', 'AbortError');
      const before = new Set(
        findSurfaceIntersections(model, experiment.reference.transforms).map(
          pair => `${pair.a}/${pair.b}`,
        ),
      );
      for (let sample = 1; sample <= 6; sample++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (signal?.aborted) throw new DOMException('Calculation cancelled.', 'AbortError');
        const intersections = findSurfaceIntersections(
          model,
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
      if (!alternate) assertTryRestoreUnlocked(tryState, result.transforms);
      const displayScale = recommendedMechanicsMagnification(result.diagnostics);
      const responseMoves = hasMechanicsMovement(result.diagnostics);
      flushSync(() => {
        experiment = attachMechanicsResult(experiment, result, alternate);
        if (!alternate) {
          experiment = { ...experiment, applied: result };
          dispatch({
            type: 'commit',
            value: result.transforms,
            label: 'Initial elastic response · fixed unloaded reference',
          });
          setSandbox({ ...sandbox, current: result.transforms, pending: null, lastEdit: null });
          setMagnification(displayScale);
          setGhost(true);
          setComparisonName(null);
          setTraces(true);
          setStage(0);
          setReverse(false);
          setResponseRevealed(!predictResponse);
          setPlaying(!predictResponse && responseMoves);
        } else {
          setStage(stages);
          setResponseRevealed(true);
        }
        note(
          alternate
            ? 'Alternative shown as a ghost. Both calculations use the same unloaded reference.'
            : predictResponse
              ? 'Response calculated and hidden. Ask students which teeth will move, then Reveal.'
              : `${mechanicsResponseCaption(result.diagnostics, displayScale)}. Ghost outlines show the unloaded reference; no biological timeline.`,
        );
        publishExperiment();
      });
      return true;
    } else if (action.type === 'apply') {
      const result = experiment.applied!;
      assertTryRestoreUnlocked(tryState, result.transforms);
      experiment = { ...experiment, result };
      dispatch({
        type: 'commit',
        value: result.transforms,
        label: 'Apply the calculated initial response',
      });
      setSandbox({ ...sandbox, current: result.transforms, pending: null, lastEdit: null });
      setStage(0);
      setReverse(false);
      setResponseRevealed(true);
      setPlaying(true);
    } else if (action.type !== 'save-stage' && action.type !== 'explain') {
      assertTryRestoreUnlocked(tryState, experiment.reference.transforms);
      experiment = { ...experiment, applied: null };
      dispatch({
        type: 'load',
        value: experiment.reference.transforms,
        past: plan.past,
        future: plan.future,
      });
      setSandbox({
        ...sandbox,
        current: experiment.reference.transforms,
        pending: null,
        lastEdit: null,
      });
      setStage(stages);
      note(
        action.type === 'discard'
          ? 'Unloaded reference shown. Appliance configuration retained.'
          : 'Appliance setup updated. No tooth response until a supported activation is calculated.',
      );
    }
    publishExperiment();
    return true;
  };
  const sendMechanics = (actions: MechanicsAction[], summary: string) => {
    void teaching.execute(
      actions.map(action => ({ kind: 'mechanics', action })),
      summary,
    );
  };

  useTeachingAdapter('case', {
    analysisContext: () =>
      sceneAnalysisContext({
        synthetic: model.demo,
        ids,
        transforms: actualShown,
        selectedIds,
        arch,
        roots,
        gums,
        bone: anatomy.bone,
        lockedIds: sandbox.lockedIds,
        mechanics,
        revealResult: responseRevealed,
        lesson:
          caseDefinition && caseVariant
            ? {
                title: `${caseDefinition.title}: ${caseVariant.title}`,
                explanation: `${caseDefinition.learningGoal} ${caseVariant.description}${scenario?.answerVisible ? ` ${caseVariant.answer}` : ' The prepared student answer has not been revealed; do not reveal it.'}`,
              }
            : currentLesson
              ? {
                  title: currentLesson.title,
                  explanation:
                    currentLesson.steps[lessonStep]?.caption || currentLesson.description,
                }
              : null,
      }),
    context: () => ({
      mode: 'case',
      autoApply: true,
      ...(activeExperiment
        ? { mechanics: mechanicsCommandContext(activeExperiment, mechanicsFocus, wirePreset) }
        : {}),
      ...(physicalPoint ? { pointed: physicalPoint } : {}),
      workflowId: null,
      caseId: scenario?.caseId,
      caseVariantId: scenario?.variantId,
      caseExploring: scenario?.exploring,
      canRestoreWorkspace: !!returnWorkspace.current,
      hasWorkflowOrigin: !!workflowOrigin,
      tryMode: tryActive,
      lockedIds: sandbox.lockedIds,
      tryPreview: !!sandbox.pending,
      tryLastMovement: !!(sandbox.pending || sandbox.lastEdit),
      tryLastIds: (sandbox.pending || sandbox.lastEdit)?.affectedIds,
      savedArrangementNames: sandbox.snapshots.map(item => item.name),
      tryArchTargets: sandbox.archTargets,
      stepIndex: lessonStep,
      selected,
      selectedIds,
      availableIds: ids,
      synthetic: model.demo,
      view,
      arch,
      speed: playbackSpeed,
      stage,
      stages,
      playing,
      lessonActive: !!scenario || !!currentLesson || !!workflowOrigin,
      canReturnToLesson: !!scenario?.exploring || !!currentLesson || !!workflowOrigin,
      layers: {
        roots,
        gums,
        labels,
        braces,
        attachments,
        grid,
        bone: anatomy.bone,
        cutaway: anatomy.cutaway,
        ligament: anatomy.ligament,
      },
      boneOpacity: anatomy.opacity,
    }),
    capture: captureClassroom,
    restore: value => restoreClassroom(value as ClassroomSnapshot),
    importSetup: importWorkflowSetup,
    sourceLesson: from =>
      from ? (from as ClassroomSnapshot).workflowOrigin?.snapshot : workflowOrigin?.snapshot,
    settle: signal => viewer.current?.whenRendered(signal) ?? Promise.resolve(),
    apply: (action, signal) =>
      action.kind === 'mechanics' ? applyMechanics(action.action, signal) : applyTeaching(action),
    preflight: (actions, from) => {
      const saved = from as ClassroomSnapshot | undefined;
      let transforms = saved?.history.current || plan.current,
        previewStage = saved?.lesson.stage ?? stage,
        count = saved?.lesson.stages ?? stages,
        index = saved?.lessonStep ?? lessonStep;
      const source = saved?.lesson.model || model,
        teeth = source.teeth;
      let lesson = LESSONS.find(item => item.id === (saved?.lessonId ?? lessonId));
      let candidate = { ...(saved?.sandbox || sandbox), current: transforms };
      const requireEndpoint = () => {
        if (
          candidate.active &&
          !lesson &&
          !candidate.pending &&
          candidate.lastEdit &&
          previewStage !== count
        )
          throw new Error(
            'Choose “show after” before starting a new edit or saving an arrangement. The visible model is partway through the last edit.',
          );
      };
      let mechanicsCandidate = saved ? saved.mechanics : mechanics;
      let mechanicsHasResult = !!mechanicsCandidate?.result,
        plannedSolve = false;
      const sourceScenario = saved ? saved.scenario : scenario;
      const sourcePrepared = sourceScenario && !sourceScenario.exploring;
      for (const action of actions) {
        if (action.kind === 'dental-arrangement') {
          if (candidate.pending || busy)
            throw new Error(
              'Apply or discard the preview and finish the import before changing the starting arrangement.',
            );
          if (actions.length !== 1)
            throw new Error('Load the dental arrangement first, then give the next instruction.');
        }
        if (action.kind === 'mechanics') {
          if (sourcePrepared)
            throw new Error('Choose Explore this arrangement before building an experiment.');
          if (candidate.pending)
            throw new Error('Apply or discard the geometric preview before changing appliances.');
          const previous = mechanicsCandidate || createMechanicsExperiment(source, transforms);
          if (action.action.type === 'explain') {
            if (!mechanicsHasResult) throw new Error('Calculate an initial response first.');
          } else {
            mechanicsCandidate = transitionMechanics(previous, action.action);
            if (action.action.type === 'solve') {
              mechanicsHasResult = true;
              plannedSolve = true;
            } else if (action.action.type === 'compare-without-tad' && !mechanicsHasResult)
              throw new Error('Calculate the original setup before comparing its anchorage.');
            else if (mechanicsCandidate.revision !== previous.revision) {
              mechanicsHasResult = false;
              assertTryRestoreUnlocked(candidate, mechanicsCandidate.reference.transforms);
            }
          }
        }
        if (
          plannedSolve &&
          (action.kind === 'try' ||
            (action.kind === 'dental' &&
              ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
                action.command.type,
              )))
        )
          throw new Error(
            'Finish the mechanical calculation first, then give the geometric editing instruction. This keeps the complete request verifiable before movement.',
          );
        if (
          sourcePrepared &&
          ((action.kind === 'try' && action.action.type !== 'enter') ||
            (action.kind === 'dental' &&
              ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
                action.command.type,
              )))
        )
          throw new Error('Choose Explore this arrangement before editing the prepared model.');
        if (action.kind === 'case') {
          if (action.action !== 'pause' && (busy || candidate.pending))
            throw new Error(
              'Finish any import and Apply or Discard the preview before changing the case.',
            );
          if (action.action === 'load') getTeachingCase(action.id);
          else if (!sourceScenario) throw new Error('Choose a prepared case first.');
          else if (action.action === 'variant')
            sampleCaseDemonstration(sourceScenario.caseId, action.id, 0);
        }
        if (action.kind === 'progress') previewStage = action.value * count;
        if (action.kind === 'question' && !sourceScenario)
          throw new Error('Choose a prepared teaching case first.');
        if (action.kind === 'workspace') {
          if (candidate.pending || busy)
            throw new Error(
              'Apply or discard the current preview and finish any import before changing workspaces.',
            );
          if (
            action.action === 'restore' &&
            !(saved ? saved.returnWorkspace : returnWorkspace.current)
          )
            throw new Error('There is no saved workspace to restore.');
          if (action.action === 'lesson' && !(saved ? saved.workflowOrigin : workflowOrigin))
            throw new Error('There is no source lesson to return to.');
        }
        if (action.kind === 'appliance-display') {
          if (!source.demo && !['none', 'braces'].includes(action.preset))
            throw new Error('Use the synthetic model for these teaching appliances.');
          if (action.preset === 'braces' && teeth.some(tooth => !tooth.calibrated))
            throw new Error('Calibrate the imported tooth directions before placing braces.');
          validateApplianceDisplay({
            preset: action.preset,
            progress: action.progress ?? 0,
            palate: action.palate ?? false,
          });
        }
        if (action.kind === 'try') {
          if (
            ['preview', 'preview-original', 'preview-snapshot', 'save-snapshot'].includes(
              action.action.type,
            )
          )
            requireEndpoint();
          if (action.action.type === 'compare-snapshot' && candidate.pending)
            throw new Error('Apply or discard the preview before changing the comparison overlay.');
          candidate = transitionTryMode(source, candidate, action.action);
          transforms = candidate.current;
          if (action.action.type === 'apply' && mechanicsCandidate) {
            mechanicsCandidate = {
              ...createMechanicsExperiment(source, candidate.current),
              config: mechanicsCandidate.config,
              stages: mechanicsCandidate.stages,
              revision: mechanicsCandidate.revision + 1,
            };
            mechanicsHasResult = false;
          }
          if (action.action.type === 'enter') lesson = undefined;
          // The executor awaits playback after Apply, so subsequent edits start at its endpoint.
          if (action.action.type === 'apply' || action.action.type === 'cancel')
            previewStage = count;
          else if (candidate.pending) previewStage = 0;
        }
        if (action.kind === 'dental') {
          if (
            ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
              action.command.type,
            )
          ) {
            const command = action.command as Extract<
              Command,
              { type: 'move' | 'move_group' | 'rotate' | 'rotate_group' | 'orthodontic' | 'reset' }
            >;
            assertTryUnlocked(candidate, 'teeth' in command ? command.teeth : [command.tooth]);
            if (candidate.active && !lesson) {
              requireEndpoint();
              candidate = transitionTryMode(source, candidate, {
                type: 'preview',
                edit: { type: 'dental', command },
              });
              previewStage = 0;
            } else {
              transforms = applyDentalCommand(transforms, teeth, command);
              candidate = { ...candidate, current: transforms };
            }
          }
          if (action.command.type === 'stages') {
            count = action.command.count;
            previewStage = count;
          }
        }
        if (action.kind === 'stage') {
          previewStage =
            action.action === 'exact'
              ? action.stage
              : Math.round(previewStage) + (action.action === 'next' ? 1 : -1);
          if (previewStage < 0 || previewStage > count)
            throw new Error(`Choose a stage from 0 to ${count}.`);
        }
        if (action.kind === 'comparison') {
          if (candidate.pending && action.mode === 'overlay')
            throw new Error('Apply or discard the preview before changing the comparison overlay.');
          if (action.mode === 'before') previewStage = 0;
          else if (action.mode === 'after' || (action.mode === 'overlay' && !sourceScenario))
            previewStage = count;
        }
        if (
          action.kind === 'try-playback' ||
          (action.kind === 'dental' && action.command.type === 'play')
        )
          previewStage =
            action.kind === 'try-playback' && action.direction === 'reverse' ? 0 : count;
        if (
          action.kind === 'toggle' &&
          action.target === 'roots' &&
          action.visible &&
          !teeth.some(tooth => tooth.rootGeometry)
        )
          throw new Error('This case has no root geometry.');
        if (action.kind === 'anatomy' && !source.demo)
          throw new Error(
            'Generated supporting anatomy is available only in the synthetic classroom.',
          );
        if (
          action.kind === 'attachment' &&
          action.action === 'add' &&
          action.teeth.some(id => !teeth.find(tooth => tooth.id === id)?.calibrated)
        )
          throw new Error('Calibrate tooth directions before placing an attachment.');
        if (action.kind === 'lesson-step') {
          if (!lesson) throw new Error('Choose a prepared lesson first.');
          if (action.action === 'next') {
            index++;
            const next = lesson.steps[index];
            if (!next) throw new Error('This lesson is complete.');
            const parsed = parseTeachingCommand(
              next.command,
              saved?.lesson.selected || selected,
              teeth.map(tooth => tooth.id),
              saved?.lesson.selectedIds || selectedIds,
            );
            if (parsed.kind === 'dental') {
              const target = applyDentalCommand(transforms, teeth, parsed.command);
              assertTryRestoreUnlocked(candidate, target);
              transforms = target;
            }
          } else {
            const target = (saved?.lessonSnapshots || lessonSnapshots.current)[
              action.action === 'restart' ? 0 : index
            ];
            if (target) {
              assertTryRestoreUnlocked(candidate, target.transforms);
              transforms = target.transforms;
            }
            index = action.action === 'restart' ? -1 : Math.max(-1, index - 1);
          }
          candidate = { ...candidate, current: transforms, pending: null, lastEdit: null };
        }
        if (action.kind === 'return-lesson') {
          const target = (saved?.lessonSnapshots || lessonSnapshots.current)[Math.max(0, index)];
          if (!target)
            throw new Error('Advance the lesson before returning to its prepared setup.');
          assertTryRestoreUnlocked(candidate, target.transforms);
          transforms = target.transforms;
          candidate = { ...candidate, current: transforms, pending: null, lastEdit: null };
        }
      }
    },
    pause: () => {
      setPlaying(false);
      importAbort.current?.abort();
    },
    narration: target => {
      if (target === 'mechanics') {
        if (!mechanics) throw new Error('Calculate an initial response first.');
        return explainMechanics(mechanics);
      }
      if (caseDefinition && caseVariant)
        return target === 'answer'
          ? caseVariant.answer
          : `${caseVariant.description} ${caseDefinition.learningGoal} ${scenario?.exploring ? 'This arrangement is now a free experiment.' : ''}`;
      if (workflowOrigin)
        return target === 'answer'
          ? workflowOrigin.setup.source.answer
          : `Source lesson: ${workflowOrigin.setup.source.explanation} Your current edits are a free geometric variation, not the authored result.`;
      if (target === 'answer')
        return 'Use the lesson explanation to discuss the geometry with your class.';
      return (
        currentLesson?.steps[Math.max(0, lessonStep)]?.caption ||
        'Select a prepared lesson or open the anatomy classroom to hear its explanation.'
      );
    },
  });
  const chooseTool = (next: typeof tool) => {
    if (next !== 'orbit' && mechanics?.result) {
      setMagnification(1);
      setStage(stages);
      setResponseRevealed(true);
      note('Tooth handles use actual scale at the calculated endpoint.');
    }
    if (prepared && next !== 'orbit') {
      note('Choose Explore this arrangement before using tooth handles.', true);
      return;
    }
    if (next !== 'orbit' && sandbox.pending) {
      note('Apply or discard the current preview before using handles.', true);
      return;
    }
    if (next !== 'orbit' && sandbox.lockedIds.includes(selected)) {
      note(`Tooth ${selected} is locked. Unlock it before editing.`, true);
      return;
    }
    setTool(next);
    if (!prepared) setStage(stages);
    setPlaying(false);
    setMeasureMode(false);
    if (next !== 'orbit' && selectedIds.length !== 1) {
      setSelectedIds([selected]);
      note(`Handles act on tooth ${selected}. Use numeric controls for group movements.`);
    }
  };
  const exportShown = () => {
    try {
      if (sandbox.pending)
        throw new Error('Apply or discard the pending preview before exporting a stage.');
      const index = Math.round(stage);
      exportStage(
        model,
        mechanics?.result
          ? interpolateTransforms(
              mechanics.reference.transforms,
              mechanics.result.transforms,
              index / stages,
            )
          : prepared && scenario
            ? sampleCaseDemonstration(scenario.caseId, scenario.variantId, index / stages)
            : demonstration
              ? previewPose(demonstration, index / stages)
              : stageTransforms(plan.current, checkpoints, index, stages, sandbox.original),
        index,
        attachments,
      );
      note(
        `Stage ${index} STL download started. Includes crowns, gingiva, and ${attachments ? 'placed attachments' : 'no attachments'}.`,
      );
    } catch (e) {
      note(errorText(e), true);
    }
  };
  const exportSequence = async () => {
    if (prepared) {
      note(
        'Export individual shown stages, or Explore this arrangement to export your free-edit sequence.',
        true,
      );
      return;
    }
    if (sandbox.pending) {
      note('Apply or discard the pending preview before exporting.', true);
      return;
    }
    setBusy(true);
    try {
      await exportStageSequence(
        model,
        plan.current,
        checkpoints,
        stages,
        attachments,
        mechanics?.result ? null : demonstration,
        mechanics?.result
          ? {
              from: mechanics.reference.transforms,
              to: mechanics.result.transforms,
              assumptions: mechanics.result.diagnostics.assumptions,
            }
          : undefined,
        sandbox.original,
      );
      note(
        'Stage sequence download started with a manifest. These are teaching models, not manufactured aligners.',
      );
    } catch (e) {
      note(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };
  const pointDistance =
    landmarks.length === 2
      ? (() => {
          const points = landmarks.map(l => {
            const t = model.teeth.find(t => t.id === l.tooth)!;
            return new Vector3(...l.local).applyMatrix4(toothMatrix(t, actualShown));
          });
          return points[0].distanceTo(points[1]);
        })()
      : null;
  const distanceTo = measureTo
    ? centreDistance(model, prepared ? shown : plan.current, selected, measureTo)
    : null;
  const highlightedContacts =
    prepared && pathAudit
      ? [...new Set(pathAudit.pairs.flatMap(pair => [pair.a, pair.b]))]
      : stage === stages && contacts
        ? [...new Set(contacts.flatMap(c => [c.a, c.b]))]
        : [];
  const actualCalibration = tooth.calibrated ? anatomicalFrame(tooth) : null;
  const latestEdit = (sandbox.pending || sandbox.lastEdit)?.edit;
  const numericEdit =
    latestEdit?.type === 'dental' && 'amount' in latestEdit.command
      ? {
          amount: latestEdit.command.amount,
          unit: (latestEdit.command.type === 'move' || latestEdit.command.type === 'move_group'
            ? 'mm'
            : '°') as 'mm' | '°',
        }
      : latestEdit && 'amount' in latestEdit
        ? {
            amount: latestEdit.amount,
            unit: (latestEdit.type === 'segment-rotate' ? '°' : 'mm') as 'mm' | '°',
          }
        : null;
  const collision = sandbox.pending?.collision;
  const tryPanelProps: TryPanelProps = {
    selectedIds,
    lockedIds: sandbox.lockedIds,
    unrestricted: sandbox.unrestricted,
    archTargets: sandbox.archTargets,
    status,
    statusError,
    calibratedSynthetic: model.demo,
    busy: teaching.runtime.phase !== 'idle',
    atEndpoint: !demonstration || stage === stages || !!sandbox.pending,
    pending:
      sandbox.pending && collision
        ? {
            summary: sandbox.pending.label,
            collision: collision.crossings.length
              ? 'blocked'
              : collision.sampleLimitReached
                ? 'limited'
                : 'clear',
            checkedSteps: collision.samples,
            collisions: collision.crossings.length,
            canApply:
              !sandbox.pending.affectedIds.some(id => sandbox.lockedIds.includes(id)) &&
              (sandbox.unrestricted ||
                (!collision.crossings.length && !collision.sampleLimitReached)),
            detail: `${collision.baseline.length} intersecting pairs at the start; these are reported separately. ${collision.sampleLimitReached ? 'Sampling limit reached; reduce the movement or choose unrestricted illustration. ' : ''}${collision.approximation}`,
          }
        : null,
    onAction: action =>
      sendTry(
        action,
        action.type === 'preview'
          ? 'Review the geometric preview before applying'
          : 'Update Try Mode',
      ),
    onLock: (teeth, locked) =>
      sendTry({ type: 'lock', teeth, locked }, `${locked ? 'Lock' : 'Unlock'} ${teeth.join(', ')}`),
    onUnrestrictedChange: enabled =>
      sendTry(
        { type: 'unrestricted', enabled },
        enabled ? 'Unrestricted illustration enabled' : 'Crown collision constraints enabled',
      ),
    onApply: () => sendTry({ type: 'apply' }, 'Apply the preview'),
    onDiscard: () => sendTry({ type: 'cancel' }, 'Discard the preview'),
    lastEdit: numericEdit
      ? { summary: (sandbox.pending || sandbox.lastEdit)!.label, ...numericEdit }
      : null,
    onReplaceAmount: amount =>
      sendTry({ type: 'revise', amount }, 'Replace the last amount from its original start'),
    snapshots: sandbox.snapshots.map(item => ({ id: item.name, name: item.name })),
    comparingId: comparisonName,
    onSaveSnapshot: name => sendTry({ type: 'save-snapshot', name }, `Save arrangement: ${name}`),
    onCompareSnapshot: name =>
      name === 'original'
        ? void teaching.execute(
            [{ kind: 'comparison', mode: 'overlay' }],
            'Compare with the original arrangement',
          )
        : sendTry(
            { type: 'compare-snapshot', name },
            name ? `Compare with ${name}` : 'Hide saved comparison',
          ),
    onRestoreSnapshot: name =>
      sendTry({ type: 'preview-snapshot', name }, `Preview arrangement: ${name}`),
    groups: sandbox.groups,
    onSaveGroup: name =>
      sendTry({ type: 'save-group', name, teeth: selectedIds }, `Save group: ${name}`),
    onSelectGroup: name => {
      const group = sandbox.groups.find(item => item.name === name);
      if (group)
        void teaching.execute([{ kind: 'select', teeth: group.teeth }], `Select group: ${name}`);
    },
  };

  const sceneInteraction = (event: { target: EventTarget }) => {
    if (
      !(event.target as HTMLElement).closest(
        '.teaching-command-bar, .case-scenario-panel, .case-stage-toolbar, .mobile-studio-dock, .mobile-panel-heading, .studio-rail, .studio-theme-toggle, .preview-decision-bar, .lecture-console, .lecture-view-tools, .lecture-pointer, .viewport, .tooth-chart, .selection-groups, .mechanics-panel',
      )
    )
      teaching.interact();
  };
  // eslint-disable-next-line react-hooks/refs -- TODO(phase-2): mirror the saved-workspace marker into state
  const canRestoreWorkspace = !!returnWorkspace.current;
  const api: CaseStudioApi = {
    pointed,
    setPointed,
    mechanics,
    setMechanics,
    wirePreset,
    setWirePreset,
    magnification,
    setMagnification,
    predictResponse,
    setPredictResponse,
    responseRevealed,
    setResponseRevealed,
    forceVectors,
    setForceVectors,
    mechanicsFocus,
    setMechanicsFocus,
    scenario,
    setScenario,
    anatomy,
    setAnatomy,
    model,
    setModel,
    plan,
    dispatch,
    sandbox,
    setSandbox,
    applianceDisplay,
    setApplianceDisplay,
    workflowOrigin,
    setWorkflowOrigin,
    comparisonName,
    setComparisonName,
    traces,
    setTraces,
    curveVisible,
    setCurveVisible,
    reverse,
    setReverse,
    arch,
    setArch,
    ghost,
    setGhost,
    gums,
    setGums,
    labels,
    setLabels,
    grid,
    setGrid,
    braces,
    setBraces,
    roots,
    setRoots,
    bracketStyle,
    setBracketStyle,
    ligatureColor,
    setLigatureColor,
    opening,
    setOpening,
    view,
    setView,
    selectedIds,
    setSelectedIds,
    selected,
    setSelected,
    multi,
    setMulti,
    stages,
    setStages,
    stage,
    setStage,
    playing,
    setPlaying,
    checkpoints,
    setCheckpoints,
    checkpointName,
    setCheckpointName,
    direction,
    setDirection,
    distance,
    setDistance,
    degrees,
    setDegrees,
    rotationMode,
    setRotationMode,
    axis,
    setAxis,
    command,
    setCommand,
    status,
    setStatus,
    statusError,
    setStatusError,
    mobilePanel,
    setMobilePanel,
    toolsOpen,
    setToolsOpen,
    modal,
    setModal,
    panel,
    setPanel,
    lecture,
    setLecture,
    playbackSpeed,
    setPlaybackSpeed,
    isolated,
    setIsolated,
    pointer,
    setPointer,
    files,
    setFiles,
    scale,
    setScale,
    busy,
    setBusy,
    importError,
    setImportError,
    measureTo,
    setMeasureTo,
    measureMode,
    setMeasureMode,
    landmarks,
    setLandmarks,
    contacts,
    setContacts,
    checking,
    setChecking,
    lessonId,
    setLessonId,
    lessonStep,
    setLessonStep,
    attachments,
    setAttachments,
    attachmentDraft,
    setAttachmentDraft,
    tool,
    setTool,
    dragPreview,
    setDragPreview,
    bAxis,
    setBAxis,
    mAxis,
    setMAxis,
    oAxis,
    setOAxis,
    apiDraft,
    setApiDraft,
    teaching,
    active,
    viewer,
    caseInput,
    commandInput,
    pendingCamera,
    pendingView,
    contactTimer,
    importAbort,
    lessonSnapshots,
    prepared,
    caseDefinition,
    caseVariant,
    pathAudit,
    caseStart,
    dentalArrangement,
    apiUrl,
    aiEnabled,
    tooth,
    pose,
    ids,
    calibrated,
    toothMoved,
    moved,
    tryActive,
    tryState,
    demonstration,
    curveArch,
    geometricShown,
    emptyExperiment,
    activeExperiment,
    actualShown,
    shown,
    physicalPoint,
    mechanicsGhost,
    curve,
    currentLesson,
    spans,
    actualCalibration,
    tryPanelProps,
    canRestoreWorkspace,
    note,
    session,
    selectTooth,
    selectGroup,
    save,
    applyTry,
    sendTry,
    toggleApplianceVisibility,
    apply,
    load,
    importFiles,
    importCase,
    setCamera,
    addCheckpoint,
    scanContacts,
    openCalibration,
    csv,
    editAttachments,
    poseCommit,
    snapshot,
    restoreSnapshot,
    advanceLesson,
    applyTeaching,
    runTeaching,
    captureClassroom,
    restoreClassroom,
    importWorkflowSetup,
    applyMechanics,
    sendMechanics,
    chooseTool,
    exportShown,
    exportSequence,
    setAiEnabled,
    pointDistance,
    distanceTo,
    highlightedContacts,
    latestEdit,
    numericEdit,
    collision,
    sceneInteraction,
  };

  return (
    <div
      className={`app-shell braces-studio teaching-studio try-studio studio-experience ${lecture ? 'lecture-mode' : ''}`}
      data-mobile-panel={mobilePanel}
      data-tools-open={toolsOpen}
      data-preview={!!sandbox.pending}
      style={active ? undefined : { display: 'none' }}
      onPointerDownCapture={sceneInteraction}
      onClickCapture={sceneInteraction}
      onChangeCapture={sceneInteraction}
    >
      <CaseTopbar api={api} />
      {tryActive && (
        <PreviewDecisionBar
          pending={tryPanelProps.pending || null}
          affectedCount={sandbox.pending?.affectedIds.length}
          busy={tryPanelProps.busy}
          unrestricted={sandbox.unrestricted}
          onApply={tryPanelProps.onApply}
          onDiscard={tryPanelProps.onDiscard}
          onModify={() => {
            setLecture(false);
            setToolsOpen(true);
            setPanel('move');
            setMobilePanel('tools');
          }}
        />
      )}
      <input
        ref={caseInput}
        type="file"
        accept=".json"
        hidden
        onChange={e => importCase(e.target.files?.[0])}
      />
      <div className="workspace">
        <nav className="studio-rail" aria-label="Studio tools">
          <button
            title="Model"
            aria-pressed={mobilePanel === 'model'}
            onClick={() => setMobilePanel('model')}
          >
            <Box size={21} />
            <span>Model</span>
          </button>
          <button
            title="Tooth selection"
            aria-pressed={mobilePanel === 'selection'}
            onClick={() => setMobilePanel(mobilePanel === 'selection' ? 'model' : 'selection')}
          >
            <MousePointer2 size={21} />
            <span>Select</span>
          </button>
          <button
            title="Anatomy layers"
            aria-pressed={mobilePanel === 'layers'}
            onClick={() => setMobilePanel(mobilePanel === 'layers' ? 'model' : 'layers')}
          >
            <Layers3 size={21} />
            <span>Layers</span>
          </button>
          <button
            title="Toggle editing tools"
            aria-pressed={toolsOpen}
            onClick={() => {
              setToolsOpen(!toolsOpen);
              setMobilePanel('model');
            }}
          >
            <SlidersHorizontal size={21} />
            <span>Tools</span>
          </button>
          <span className="rail-divider" />
          <button title="Teaching library" onClick={() => setModal('workflows')}>
            <BookOpen size={21} />
            <span>Library</span>
          </button>
          <button title="Undo request" onClick={() => void teaching.runControl('undo that')}>
            <Undo2 size={21} />
            <span>Undo</span>
          </button>
          <button className="rail-help" title="Command guide" onClick={() => setModal('guide')}>
            <CircleHelp size={21} />
            <span>Guide</span>
          </button>
        </nav>
        <CaseSidebar api={api} />

        <CaseMain api={api} />

        <CaseInspector api={api} />
      </div>
      <MobileStudioDock
        activePanel={mobilePanel}
        onChange={setMobilePanel}
        onStop={teaching.cancel}
      />
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          {model.demo ? 'Synthetic study' : 'Local case'}
          <span className="footer-divider">/</span>
          {aiEnabled ? `${teaching.config.provider || 'AI'} interpretation` : 'Built-in commands'}
        </span>
        <span>Synthetic teaching model · stages, not treatment time</span>
        <button onClick={() => setModal('guide')}>
          Movement guide
          <CircleHelp size={12} />
        </button>
      </footer>

      <CaseDialogs api={api} />
    </div>
  );
}

function TeachingScenes() {
  const teaching = useTeaching();
  return (
    <>
      <CaseStudio active={teaching.mode === 'case'} />
      <WorkflowStudio active={teaching.mode === 'workflow'} />
    </>
  );
}
export default function Studio() {
  return (
    <ModelBootstrap>
      <TeachingProvider>
        <TeachingScenes />
      </TeachingProvider>
    </ModelBootstrap>
  );
}
