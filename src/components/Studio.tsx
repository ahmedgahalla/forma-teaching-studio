'use client';
/* eslint-disable react-hooks/refs -- CaseStudio wires handler factories with a
   ref container (CaseRefs); the factories only build event-time closures and no
   ref is read during render, but the rule's taint analysis marks the whole api
   bundle once refs pass through it. Scoped to this orchestrator file only. */
import { useEffect, useMemo, useRef } from 'react';
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
import { DENTAL_ARRANGEMENTS } from '@/lib/dental-arrangements';
import { getTeachingCase, sampleCaseDemonstration } from '@/lib/teaching-cases';
import { MobileStudioDock } from './StudioExperience';
import { type ViewerCamera, type ViewerHandle, type ViewName } from './Viewer';
import {} from '@/lib/geometry';
import { anatomicalFrame, emptyPose, type Vec3 } from '@/lib/model';
import { interpolateTransforms, stageTransforms } from '@/lib/planning';
import { archSpans, centreDistance, toothMatrix } from '@/lib/analysis';
import { toothArch } from '@/lib/appliances';
import {} from '@/lib/attachments';
import { LESSONS } from '@/lib/lecture';
import { TeachingProvider, useTeaching, useTeachingAdapter } from './TeachingController';
import WorkflowStudio from './WorkflowStudio';
import {} from '@/lib/appliance-display';
import './combined-workspace.css';
import { PreviewDecisionBar } from './PreviewDecisionBar';
import { createMechanicsExperiment } from '@/lib/mechanics';
import { mechanicsDisplayPoses, explainMechanics } from '@/lib/mechanics-presentation';
import { sceneAnalysisContext } from '@/lib/scene-analysis';
import './mechanics.css';
import './classroom-workspace.css';
import { mechanicsCommandContext } from '@/lib/mechanics-commands';
import { previewPose, archCurvePoints } from '@/lib/try-mode';

import { DEFAULT_ATTACHMENT } from './case/constants';
import type { ClassroomSnapshot, LessonSnapshot } from './case/types';
import type { CaseRefs, CaseStudioApi } from './case/api';
import { createWorkspaceActions } from './case/actions-workspace';
import { createTryActions } from './case/actions-try';
import { createIoActions } from './case/actions-io';
import { createEditActions } from './case/actions-edit';
import { createLessonActions } from './case/actions-lesson';
import { createTeachingDispatch } from './case/teaching-dispatch';
import { createClassroomActions } from './case/actions-classroom';
import { createMechanicsActions } from './case/actions-mechanics';
import { createExportActions } from './case/actions-export';
import { createCasePreflight } from './case/preflight';
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
  const scenarioCaseId = scenario?.caseId;
  const scenarioVariantId = scenario?.variantId;
  const current = plan.current;
  const caseDefinition = useMemo(
    () => (scenarioCaseId ? getTeachingCase(scenarioCaseId) : null),
    [scenarioCaseId],
  );
  const caseVariant = caseDefinition?.variants.find(item => item.id === scenario?.variantId);
  const pathAudit = useMemo(
    () =>
      scenarioCaseId && scenarioVariantId && getTeachingAssetCase()
        ? casePathAudit(scenarioCaseId, scenarioVariantId)
        : null,
    [scenarioCaseId, scenarioVariantId],
  );
  const caseStart = useMemo(
    () =>
      scenarioCaseId && scenarioVariantId
        ? sampleCaseDemonstration(scenarioCaseId, scenarioVariantId, 0)
        : undefined,
    [scenarioCaseId, scenarioVariantId],
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
  const tryState = useMemo(() => ({ ...sandbox, current }), [sandbox, current]);
  const demonstration = tryActive ? sandbox.pending || sandbox.lastEdit : null;
  const curveArch =
    arch === 'both'
      ? demonstration?.edit.type === 'fit-arch'
        ? demonstration.edit.arch
        : toothArch(selected)
      : arch;
  const geometricShown = useMemo(
    () =>
      prepared && scenarioCaseId && scenarioVariantId
        ? sampleCaseDemonstration(scenarioCaseId, scenarioVariantId, stage / stages)
        : demonstration
          ? previewPose(demonstration, stage / stages)
          : stageTransforms(current, checkpoints, stage, stages, sandbox.original),
    [
      prepared,
      scenarioCaseId,
      scenarioVariantId,
      demonstration,
      current,
      checkpoints,
      stage,
      stages,
      sandbox.original,
    ],
  );
  const emptyExperiment = useMemo(
    () =>
      model.demo && model.teeth.every(item => item.calibrated)
        ? createMechanicsExperiment(model, current)
        : null,
    [model, current],
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
    () => archSpans(model, prepared ? shown : current, prepared ? caseStart : sandbox.original),
    [model, prepared, shown, current, caseStart, sandbox.original],
  );
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
      // eslint-disable-next-line react-hooks/exhaustive-deps -- cancelling the latest scan timer is the point
      if (contactTimer.current) clearTimeout(contactTimer.current);
    };
  }, [model, current, setChecking, setContacts]);
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
  }, [active, teaching, setMobilePanel]);

  useEffect(() => {
    if (!active) {
      setPlaying(false);
      setModal(null);
      setDragPreview(null);
    }
  }, [active, setPlaying, setModal, setDragPreview]);
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

  const sceneInteraction = (event: { target: EventTarget }) => {
    if (
      !(event.target as HTMLElement).closest(
        '.teaching-command-bar, .case-scenario-panel, .case-stage-toolbar, .mobile-studio-dock, .mobile-panel-heading, .studio-rail, .studio-theme-toggle, .preview-decision-bar, .lecture-console, .lecture-view-tools, .lecture-pointer, .viewport, .tooth-chart, .selection-groups, .mechanics-panel',
      )
    )
      teaching.interact();
  };
  const canRestoreWorkspace = !!returnWorkspace.current;
  const api = {
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
    canRestoreWorkspace,
    setAiEnabled,
    pointDistance,
    distanceTo,
    highlightedContacts,
    latestEdit,
    numericEdit,
    collision,
    sceneInteraction,
  } as CaseStudioApi;

  const refs: CaseRefs = {
    viewer,
    caseInput,
    commandInput,
    pendingCamera,
    pendingView,
    contactTimer,
    importAbort,
    returnWorkspace,
    lessonSnapshots,
  };
  Object.assign(api, createWorkspaceActions(api, refs));
  Object.assign(api, createTryActions(api, refs));
  Object.assign(api, createIoActions(api, refs));
  Object.assign(api, createEditActions(api, refs));
  Object.assign(api, createLessonActions(api, refs));
  Object.assign(api, createTeachingDispatch(api, refs));
  Object.assign(api, createClassroomActions(api, refs));
  Object.assign(api, createMechanicsActions(api, refs));
  Object.assign(api, createExportActions(api, refs));
  api.tryPanelProps = {
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
      api.sendTry(
        action,
        action.type === 'preview'
          ? 'Review the geometric preview before applying'
          : 'Update Try Mode',
      ),
    onLock: (teeth, locked) =>
      api.sendTry(
        { type: 'lock', teeth, locked },
        `${locked ? 'Lock' : 'Unlock'} ${teeth.join(', ')}`,
      ),
    onUnrestrictedChange: enabled =>
      api.sendTry(
        { type: 'unrestricted', enabled },
        enabled ? 'Unrestricted illustration enabled' : 'Crown collision constraints enabled',
      ),
    onApply: () => api.sendTry({ type: 'apply' }, 'Apply the preview'),
    onDiscard: () => api.sendTry({ type: 'cancel' }, 'Discard the preview'),
    lastEdit: numericEdit
      ? { summary: (sandbox.pending || sandbox.lastEdit)!.label, ...numericEdit }
      : null,
    onReplaceAmount: amount =>
      api.sendTry({ type: 'revise', amount }, 'Replace the last amount from its original start'),
    snapshots: sandbox.snapshots.map(item => ({ id: item.name, name: item.name })),
    comparingId: comparisonName,
    onSaveSnapshot: name =>
      api.sendTry({ type: 'save-snapshot', name }, `Save arrangement: ${name}`),
    onCompareSnapshot: name =>
      name === 'original'
        ? void teaching.execute(
            [{ kind: 'comparison', mode: 'overlay' }],
            'Compare with the original arrangement',
          )
        : api.sendTry(
            { type: 'compare-snapshot', name },
            name ? `Compare with ${name}` : 'Hide saved comparison',
          ),
    onRestoreSnapshot: name =>
      api.sendTry({ type: 'preview-snapshot', name }, `Preview arrangement: ${name}`),
    groups: sandbox.groups,
    onSaveGroup: name =>
      api.sendTry({ type: 'save-group', name, teeth: selectedIds }, `Save group: ${name}`),
    onSelectGroup: name => {
      const group = sandbox.groups.find(item => item.name === name);
      if (group)
        void teaching.execute([{ kind: 'select', teeth: group.teeth }], `Select group: ${name}`);
    },
  };
  const casePreflight = createCasePreflight(api, refs);
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
    capture: api.captureClassroom,
    restore: value => api.restoreClassroom(value as ClassroomSnapshot),
    importSetup: api.importWorkflowSetup,
    sourceLesson: from =>
      from ? (from as ClassroomSnapshot).workflowOrigin?.snapshot : workflowOrigin?.snapshot,
    settle: signal => viewer.current?.whenRendered(signal) ?? Promise.resolve(),
    apply: (action, signal) =>
      action.kind === 'mechanics'
        ? api.applyMechanics(action.action, signal)
        : api.applyTeaching(action),
    preflight: casePreflight,
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
          pending={api.tryPanelProps.pending || null}
          affectedCount={sandbox.pending?.affectedIds.length}
          busy={api.tryPanelProps.busy}
          unrestricted={sandbox.unrestricted}
          onApply={api.tryPanelProps.onApply}
          onDiscard={api.tryPanelProps.onDiscard}
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
        onChange={e => api.importCase(e.target.files?.[0])}
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
