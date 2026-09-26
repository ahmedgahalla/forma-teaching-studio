'use client';
/**
 * CaseStudio's state, grouped into feature hooks. Each hook owns one concern's
 * useState/useRef cluster and returns named fields; CaseStudio destructures
 * them so downstream code reads exactly as before the Phase 2.2 split.
 */
import { useReducer, useState } from 'react';
import { createDemo, type DentalCase } from '@/lib/geometry';
import { historyReducer } from '@/lib/planning';
import type { Checkpoint } from '@/lib/planning';
import { createTryState, type TryState } from '@/lib/try-mode';
import { DEFAULT_ANATOMY, type AnatomyViewState } from '@/lib/teaching-anatomy';
import { DEFAULT_APPLIANCE_DISPLAY, type ApplianceDisplay } from '@/lib/appliance-display';
import type { MechanicsExperiment } from '@/lib/mechanics';
import type { MechanicsFocus, PointedReference } from '@/lib/mechanics-commands';
import type { SurfaceIntersection } from '@/lib/analysis';
import type { Landmark } from '@/lib/appliances';
import type { Axis, MovementDirection, Transforms } from '@/lib/model';
import type { AttachmentSpec } from '@/lib/attachments';
import { DEFAULT_WIRE_PRESET, type WirePreset } from '../mechanics/MechanicsPanel';
import type { MobileStudioPanel } from './StudioExperience';
import type { ArchView, ViewName } from '../viewer/Viewer';
import { DEFAULT_ATTACHMENT } from './constants';
import type { PreparedScenario, WorkflowOriginState } from './types';

export type CaseModal =
  | 'import'
  | 'settings'
  | 'guide'
  | 'calibrate'
  | 'demo'
  | 'lessons'
  | 'workflows'
  | 'arrangement'
  | null;

export function useMechanicsState() {
  const [pointed, setPointed] = useState<PointedReference | null>(null);
  const [mechanics, setMechanics] = useState<MechanicsExperiment | null>(null);
  const [wirePreset, setWirePreset] = useState<WirePreset>(DEFAULT_WIRE_PRESET);
  const [magnification, setMagnification] = useState(10);
  const [predictResponse, setPredictResponse] = useState(false);
  const [responseRevealed, setResponseRevealed] = useState(true);
  const [forceVectors, setForceVectors] = useState(true);
  const [mechanicsFocus, setMechanicsFocus] = useState<MechanicsFocus>({});
  return {
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
  };
}

export function useCaseScenario() {
  const [scenario, setScenario] = useState<PreparedScenario | null>(null);
  return { scenario, setScenario };
}

/** The model, its committed movement history, and the Try sandbox around them. */
export function useModelState() {
  const [anatomy, setAnatomy] = useState<AnatomyViewState>({ ...DEFAULT_ANATOMY });
  const [model, setModel] = useState<DentalCase>(() => createDemo());
  const [plan, dispatch] = useReducer(historyReducer, { current: {}, past: [], future: [] });
  const [sandbox, setSandbox] = useState<TryState>(() => createTryState());
  const [applianceDisplay, setApplianceDisplay] = useState<ApplianceDisplay>({
    ...DEFAULT_APPLIANCE_DISPLAY,
  });
  const [workflowOrigin, setWorkflowOrigin] = useState<WorkflowOriginState>(null);
  return {
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
  };
}

export function useDisplayState() {
  const [comparisonName, setComparisonName] = useState<string | null>(null);
  const [traces, setTraces] = useState(false);
  const [curveVisible, setCurveVisible] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [arch, setArch] = useState<ArchView>('both');
  const [ghost, setGhost] = useState(false);
  const [gums, setGums] = useState(true);
  const [labels, setLabels] = useState(false);
  const [grid, setGrid] = useState(false);
  const [braces, setBraces] = useState(false);
  const [roots, setRoots] = useState(false);
  const [bracketStyle, setBracketStyle] = useState<'metal' | 'ceramic'>('metal');
  const [ligatureColor, setLigatureColor] = useState('#299f9b');
  const [opening, setOpening] = useState(0);
  const [view, setView] = useState<ViewName>('perspective');
  return {
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
  };
}

export function useSelectionState() {
  const [selectedIds, setSelectedIds] = useState<string[]>(['11']);
  const [selected, setSelected] = useState('11');
  const [multi, setMulti] = useState(false);
  return { selectedIds, setSelectedIds, selected, setSelected, multi, setMulti };
}

export function useStagePlayback() {
  const [stages, setStages] = useState(10);
  const [stage, setStage] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkpointName, setCheckpointName] = useState('');
  return {
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
  };
}

export function useMovementInputs() {
  const [direction, setDirection] = useState<MovementDirection>('buccal');
  const [distance, setDistance] = useState('0.25');
  const [degrees, setDegrees] = useState('3');
  const [rotationMode, setRotationMode] = useState<'tip' | 'torque' | 'rotate' | 'world'>('tip');
  const [axis, setAxis] = useState<Axis>('y');
  return {
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
  };
}

export function useCommandState() {
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState('Select teeth, then explore a movement or command.');
  const [statusError, setStatusError] = useState(false);
  return { command, setCommand, status, setStatus, statusError, setStatusError };
}

export function useLayoutState() {
  const [mobilePanel, setMobilePanel] = useState<MobileStudioPanel>('model');
  const [toolsOpen, setToolsOpen] = useState(true);
  const [modal, setModal] = useState<CaseModal>(null);
  const [panel, setPanel] = useState<'move' | 'braces' | 'analysis' | 'history'>('move');
  const [lecture, setLecture] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1);
  const [isolated, setIsolated] = useState(false);
  const [pointer, setPointer] = useState(false);
  return {
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
  };
}

/** File import state; aborting an in-flight case import on unmount lives here. */
export function useCaseFiles() {
  const [files, setFiles] = useState<File[]>([]);
  const [scale, setScale] = useState('1');
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState('');
  return { files, setFiles, scale, setScale, busy, setBusy, importError, setImportError };
}

export function useMeasureState() {
  const [measureTo, setMeasureTo] = useState('');
  const [measureMode, setMeasureMode] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [contacts, setContacts] = useState<SurfaceIntersection[] | null>(null);
  const [checking, setChecking] = useState(false);
  return {
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
  };
}

export function useLessonState() {
  const [lessonId, setLessonId] = useState('');
  const [lessonStep, setLessonStep] = useState(-1);
  return { lessonId, setLessonId, lessonStep, setLessonStep };
}

export function useAttachmentState() {
  const [attachments, setAttachments] = useState(false);
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentSpec>(DEFAULT_ATTACHMENT);
  return { attachments, setAttachments, attachmentDraft, setAttachmentDraft };
}

export function useManipulationTool() {
  const [tool, setTool] = useState<'orbit' | 'translate' | 'rotate'>('orbit');
  const [dragPreview, setDragPreview] = useState<Transforms | null>(null);
  return { tool, setTool, dragPreview, setDragPreview };
}

export function useCalibrationInputs() {
  const [bAxis, setBAxis] = useState('+Z');
  const [mAxis, setMAxis] = useState('+X');
  const [oAxis, setOAxis] = useState('-Y');
  return { bAxis, setBAxis, mAxis, setMAxis, oAxis, setOAxis };
}

export function useServiceDraft() {
  const [apiDraft, setApiDraft] = useState('http://127.0.0.1:8000');
  return { apiDraft, setApiDraft };
}
