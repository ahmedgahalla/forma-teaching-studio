'use client';
import { applyCaseAction } from './case/apply-case-action';
/* eslint-disable react-hooks/refs -- CaseStudio wires handler factories with a
   ref container (CaseRefs); the factories only build event-time closures and no
   ref is read during render, but the rule's taint analysis marks the whole api
   bundle once refs pass through it. Scoped to this orchestrator file only. */
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import ModelBootstrap from './viewer/ModelBootstrap';
import { casePathAudit } from '@/lib/case-path-audit';
import { DENTAL_ARRANGEMENTS } from '@/lib/dental-arrangements';
import { getTeachingCase, sampleCaseDemonstration } from '@/lib/teaching-cases';
import { type ViewerCamera, type ViewerHandle, type ViewName } from './viewer/Viewer';
import {} from '@/lib/geometry';
import { anatomicalFrame, emptyPose, type Vec3 } from '@/lib/model';
import { useDisplayedMotion } from './case/useDisplayedMotion';
import { archSpans, centreDistance, toothMatrix } from '@/lib/analysis';
import { toothArch } from '@/lib/appliances';
import {} from '@/lib/attachments';
import { LESSONS } from '@/lib/lecture';
import { TeachingProvider, useTeaching, useTeachingAdapter } from './teaching/TeachingController';
import WorkflowStudio from './workflow/WorkflowStudio';
import {} from '@/lib/appliance-display';
import './shared/combined-workspace.css';
import { createMechanicsExperiment } from '@/lib/mechanics';
import { mechanicsDisplayPoses } from '@/lib/mechanics-presentation';
import { sceneAnalysisContext } from '@/lib/scene-analysis';
import './mechanics/mechanics.css';
import './case/classroom-workspace.css';
import { mechanicsCommandContext } from '@/lib/mechanics-commands';
import { archCurvePoints } from '@/lib/try-mode';

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
import { useExplanationState } from './case/explanation-state';
import { isWorkspaceInteraction } from './case/scene-interaction';
import { useWorkspaceKeys } from './case/useWorkspaceKeys';
import { caseNarration } from './case/narration';
import { createCasePreflight } from './case/preflight';
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

import { CaseShell } from './case/CaseShell';
import { useTeacherLectures } from './lecture-builder/useTeacherLectures';

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
    commandsOpen,
    setCommandsOpen,
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
  const explanations = useExplanationState(model);
  const { toothStudy } = explanations;
  const returnWorkspace = useRef<ClassroomSnapshot | null>(null);
  const display = useDisplayState();
  const {
    comparisonName,
    curveVisible,
    reverse,
    arch,
    gums,
    labels,
    grid,
    braces,
    roots,
    opening,
    view,
  } = display;
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
      scenarioCaseId && scenarioVariantId
        ? casePathAudit(scenarioCaseId, scenarioVariantId, model.asset)
        : null,
    [scenarioCaseId, scenarioVariantId, model.asset],
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
  const { geometricShown, actualShown, shown, displayedMotion } = useDisplayedMotion({
    caseId: prepared ? scenarioCaseId : null,
    variantId: scenarioVariantId,
    demonstration,
    current,
    checkpoints,
    original: sandbox.original,
    mechanics,
    pending: !!sandbox.pending,
    responseRevealed,
    magnification,
    stage,
    stages,
  });
  const emptyExperiment = useMemo(
    () =>
      model.demo && model.teeth.every(item => item.calibrated)
        ? createMechanicsExperiment(model, current)
        : null,
    [model, current],
  );
  const activeExperiment = mechanics || emptyExperiment;
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
  useWorkspaceKeys({
    active,
    runControl: teaching.runControl,
    setMobilePanel,
    setToolsOpen,
    setCommandsOpen,
    commandInput,
  });

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
    if (isWorkspaceInteraction(event.target)) teaching.interact();
  };
  const canRestoreWorkspace = !!returnWorkspace.current;
  const api = {
    ...explanations,
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
    ...display,
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
    commandsOpen,
    setCommandsOpen,
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
    displayedMotion,
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
  const teacher = useTeacherLectures(api, refs);
  const casePreflight = createCasePreflight(api, refs);
  useTeachingAdapter(
    'case',
    teacher.decorate({
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
        jawAvailable: model.asset === 'claude-atlas-v1',
        jawOpen: display.jawOpen,
        glossaryId: explanations.glossaryId,
        toothStudy: toothStudy ? { tooth: toothStudy.tooth, view: toothStudy.view } : undefined,
        canStepStages: !!(
          prepared ||
          demonstration ||
          checkpoints.length ||
          moved ||
          mechanics?.result
        ),
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
      apply: (action, signal) => applyCaseAction(api, action, signal),
      preflight: casePreflight,
      pause: () => {
        setPlaying(false);
        importAbort.current?.abort();
      },
      narration: target => caseNarration(api, target),
    }),
  );

  return <CaseShell api={api} teacher={teacher} />;
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
