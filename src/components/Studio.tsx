'use client';
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Vector3 } from 'three';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Box,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  Focus,
  History,
  Layers3,
  Maximize,
  MousePointer2,
  Move3D,
  Plus,
  Presentation,
  Redo2,
  Rotate3D,
  RotateCcw,
  Ruler,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import ModelBootstrap from './ModelBootstrap';
import { getTeachingAssetCase } from '@/lib/anatomy-assets';
import { casePathAudit } from '@/lib/case-path-audit';
import { createDentalArrangement, DENTAL_ARRANGEMENTS } from '@/lib/dental-arrangements';
import {
  createTeachingCase,
  getTeachingCase,
  sampleCaseDemonstration,
  TEACHING_CASES,
  type TeachingCaseId,
} from '@/lib/teaching-cases';
import {
  TeachingCaseLibrary,
  CaseScenarioPanel,
  MobileStudioDock,
  MobilePanelHeading,
  type MobileStudioPanel,
  type CaseDiagramKind,
} from './StudioExperience';
import Viewer, {
  type ArchView,
  type ViewerCamera,
  type ViewerHandle,
  type ViewName,
} from './Viewer';
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
  type Axis,
  type MovementDirection,
  type Pose,
  type Transforms,
  type Vec3,
} from '@/lib/model';
import { parseCommand, type Command } from '@/lib/commands';
import {
  historyReducer,
  interpolateTransforms,
  stageTransforms,
  type CaseSession,
  type Checkpoint,
} from '@/lib/planning';
import {
  archSpans,
  centreDistance,
  findSurfaceIntersections,
  movementRows,
  toothMatrix,
  type SurfaceIntersection,
} from '@/lib/analysis';
import { orderedArchIds, toothArch, type Landmark } from '@/lib/appliances';
import {
  createAttachmentGeometry,
  validateAttachment,
  type AttachmentSpec,
} from '@/lib/attachments';
import { LESSONS, parseTeachingCommand, type TeachingAction } from '@/lib/lecture';
import { exportStage, exportStageSequence } from '@/lib/stage-export';
import {
  TeachingProvider,
  TeachingCommandBar,
  useTeaching,
  useTeachingAdapter,
} from './TeachingController';
import AnatomyPanel from './AnatomyPanel';
import { DEFAULT_ANATOMY, type AnatomyViewState } from '@/lib/teaching-anatomy';
import WorkflowStudio, { WorkflowLibrary } from './WorkflowStudio';
import AppliancePalette from './AppliancePalette';
import {
  DEFAULT_APPLIANCE_DISPLAY,
  applianceView,
  mapWorkflowAppliance,
  validateApplianceDisplay,
  type ApplianceDisplay,
} from '@/lib/appliance-display';
import { createWorkflowTryState, type WorkflowTransfer } from '@/lib/workflow-transfer';
import './combined-workspace.css';
import TryPanel, { type TryPanelProps } from './TryPanel';
import { PreviewDecisionBar } from './PreviewDecisionBar';
import { StudioThemeToggle } from './StudioTheme';
import { LectureConsole } from './LectureConsole';
import { LecturePointer, LectureViewTools } from './LectureViewTools';
import {
  createMechanicsExperiment,
  transitionMechanics,
  attachMechanicsResult,
  experimentWithoutTad,
  type MechanicsExperiment,
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
import StageBar from './StageBar';
import MechanicsPanel, {
  DEFAULT_WIRE_PRESET,
  wireSizeLabel,
  type WirePreset,
} from './MechanicsPanel';
import './mechanics.css';
import './classroom-workspace.css';
import {
  mechanicsCommandContext,
  reduceMechanicsFocus,
  type MechanicsFocus,
  type PointedReference,
} from '@/lib/mechanics-commands';
import {
  createTryState,
  transitionTryMode,
  previewPose,
  assertTryUnlocked,
  assertTryRestoreUnlocked,
  archCurvePoints,
  serializeTrySession,
  type TryAction,
  type TryState,
} from '@/lib/try-mode';

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={onClose}
      onClick={e => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={`toggle-row ${value ? 'on' : ''}`}
      role="switch"
      aria-checked={value}
      onClick={onChange}
    >
      <span>{label}</span>
      <span className="switch">
        <span />
      </span>
    </button>
  );
}
const directions: { id: MovementDirection; label: string; detail: string }[] = [
  { id: 'buccal', label: 'Buccal', detail: 'Labial / outward' },
  { id: 'lingual', label: 'Lingual', detail: 'Palatal / inward' },
  { id: 'mesial', label: 'Mesial', detail: 'Toward midline' },
  { id: 'distal', label: 'Distal', detail: 'Away from midline' },
  { id: 'intrude', label: 'Intrude', detail: 'Toward root' },
  { id: 'extrude', label: 'Extrude', detail: 'Toward occlusal' },
];
const axisVectors: Record<string, Vec3> = {
  '+X': [1, 0, 0],
  '-X': [-1, 0, 0],
  '+Y': [0, 1, 0],
  '-Y': [0, -1, 0],
  '+Z': [0, 0, 1],
  '-Z': [0, 0, -1],
};
const pretty = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
const DEFAULT_ATTACHMENT: AttachmentSpec = {
  shape: 'rectangle',
  width: 2.5,
  height: 3.5,
  depth: 1,
  offsetMesial: 0,
  offsetOcclusal: 0,
  rotation: 0,
};
type LessonSnapshot = {
  transforms: Transforms;
  model: DentalCase;
  selected: string;
  selectedIds: string[];
  arch: ArchView;
  view: ViewName;
  ghost: boolean;
  roots: boolean;
  braces: boolean;
  attachments: boolean;
  gums: boolean;
  labels: boolean;
  grid: boolean;
  stage: number;
  stages: number;
  opening: number;
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'The operation could not be completed.';
const EXAMPLES = [
  'select upper front six, install brackets on them, then put a wire through these brackets',
  'activate that wire by 0.5 mm, then show what happens',
  'use 0.018 inch wire instead',
  'explain that movement',
  'save experiment stage as setup one',
  'load dental class II division 1',
  'load crowding',
  'play case',
  'pause case',
  'explore this arrangement',
  'return to prepared case',
  'load deep bite',
  'choose posterior extrusion',
  'load anchorage',
  'select upper front six',
  'move the selected segment posteriorly 1 mm',
  'apply preview',
  'make the last movement smaller',
  'discard preview',
  'lock upper molars',
  'show roots',
  'show displacement traces',
  'play in reverse',
  'pause halfway',
  'show after',
  'save arrangement as example one',
  'compare with original',
  'undo the last two changes',
  'start braces workflow',
  'start palatal expansion workflow',
  'start archwire expansion workflow',
  'start anatomy lesson',
  'try this setup',
  'place palatal expander',
  'return to source lesson',
  'restore my workspace',
  'return to try mode',
];
function commandLabel(c: Command) {
  const targets =
    'teeth' in c
      ? c.teeth.length > 6
        ? `${c.teeth.length} teeth`
        : c.teeth.join(', ')
      : 'tooth' in c
        ? c.tooth
        : '';
  if (c.type === 'move' || c.type === 'move_group')
    return `${targets} · ${c.direction} ${pretty(c.amount)} mm`;
  if (c.type === 'rotate' || c.type === 'rotate_group')
    return `${targets} · World ${c.axis.toUpperCase()} ${pretty(c.amount)}°`;
  if (c.type === 'orthodontic')
    return `${targets} · ${c.movement === 'rotate' ? 'Axial rotation' : c.movement} ${pretty(c.amount)}°`;
  if (c.type === 'reset') return `${targets} · Reset to original`;
  if (c.type === 'ghost') return `${c.visible ? 'Show' : 'Hide'} original positions`;
  if (c.type === 'appliance') return `${c.visible ? 'Show' : 'Hide'} brackets and archwires`;
  if (c.type === 'stages') return `Create ${c.count} display stages`;
  return c.type;
}

type PreparedScenario = {
  caseId: TeachingCaseId;
  variantId: string;
  model: DentalCase;
  returnProgress: number;
  exploring: boolean;
  answerVisible: boolean;
  returnDisplay?: {
    lesson: LessonSnapshot;
    anatomy: AnatomyViewState;
    appliance: ApplianceDisplay;
    bracketStyle: 'metal' | 'ceramic';
    ligatureColor: string;
    camera: ViewerCamera | null;
  };
};
const CASE_DIAGRAMS: Record<TeachingCaseId, CaseDiagramKind> = {
  'reference-occlusion': 'anatomy',
  'movement-types': 'translation',
  crowding: 'crowding',
  'midline-diastema': 'spacing',
  'increased-overjet': 'overjet',
  'anterior-crossbite': 'crossbite',
  deepbite: 'overbite',
  openbite: 'open-bite',
  'posterior-crossbite': 'crossbite',
  'anchorage-space-closure': 'braces',
  'occlusal-finishing': 'rotation',
  'removable-retention': 'retention',
};
const CASE_CARDS = TEACHING_CASES.map(item => ({
  ...item,
  diagram: CASE_DIAGRAMS[item.id],
  variantCount: item.variants.length,
  concepts: [item.learningGoal],
}));

function CaseStudio({ active }: { active: boolean }) {
  const teaching = useTeaching();
  const [pointed, setPointed] = useState<PointedReference | null>(null);
  const [mechanics, setMechanics] = useState<MechanicsExperiment | null>(null);
  const [wirePreset, setWirePreset] = useState<WirePreset>(DEFAULT_WIRE_PRESET);
  const [magnification, setMagnification] = useState(10),
    [predictResponse, setPredictResponse] = useState(false),
    [responseRevealed, setResponseRevealed] = useState(true),
    [forceVectors, setForceVectors] = useState(true);
  const [mechanicsFocus, setMechanicsFocus] = useState<MechanicsFocus>({});
  const [scenario, setScenario] = useState<PreparedScenario | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobileStudioPanel>('model');
  const [toolsOpen, setToolsOpen] = useState(true);
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
  const [anatomy, setAnatomy] = useState<AnatomyViewState>({ ...DEFAULT_ANATOMY });
  const [model, setModel] = useState<DentalCase>(() => createDemo());
  const dentalArrangement = DENTAL_ARRANGEMENTS.find(
    item => model.name === `${item.title} · synthetic teaching arrangement`,
  );
  const [plan, dispatch] = useReducer(historyReducer, { current: {}, past: [], future: [] });
  const [sandbox, setSandbox] = useState<TryState>(() => createTryState());
  const [applianceDisplay, setApplianceDisplay] = useState<ApplianceDisplay>({
    ...DEFAULT_APPLIANCE_DISPLAY,
  });
  const [workflowOrigin, setWorkflowOrigin] = useState<{
    setup: WorkflowTransfer;
    snapshot: unknown;
  } | null>(null);
  const returnWorkspace = useRef<ClassroomSnapshot | null>(null);
  const [comparisonName, setComparisonName] = useState<string | null>(null),
    [traces, setTraces] = useState(false),
    [curveVisible, setCurveVisible] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(['11']),
    [selected, setSelected] = useState('11'),
    [multi, setMulti] = useState(false);
  const [arch, setArch] = useState<ArchView>('both'),
    [ghost, setGhost] = useState(false),
    [gums, setGums] = useState(true),
    [labels, setLabels] = useState(false),
    [grid, setGrid] = useState(false);
  const [braces, setBraces] = useState(false),
    [roots, setRoots] = useState(false),
    [bracketStyle, setBracketStyle] = useState<'metal' | 'ceramic'>('metal'),
    [ligatureColor, setLigatureColor] = useState('#299f9b'),
    [opening, setOpening] = useState(0);
  const [stages, setStages] = useState(10),
    [stage, setStage] = useState(10),
    [playing, setPlaying] = useState(false),
    [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]),
    [checkpointName, setCheckpointName] = useState('');
  const [direction, setDirection] = useState<MovementDirection>('buccal'),
    [distance, setDistance] = useState('0.25'),
    [degrees, setDegrees] = useState('3'),
    [rotationMode, setRotationMode] = useState<'tip' | 'torque' | 'rotate' | 'world'>('tip'),
    [axis, setAxis] = useState<Axis>('y');
  const [command, setCommand] = useState(''),
    [status, setStatus] = useState('Select teeth, then explore a movement or command.'),
    [statusError, setStatusError] = useState(false);
  const [modal, setModal] = useState<
      | 'import'
      | 'settings'
      | 'guide'
      | 'calibrate'
      | 'demo'
      | 'lessons'
      | 'workflows'
      | 'arrangement'
      | null
    >(null),
    [panel, setPanel] = useState<'move' | 'braces' | 'analysis' | 'history'>('move');
  const [files, setFiles] = useState<File[]>([]),
    [scale, setScale] = useState('1'),
    [busy, setBusy] = useState(false),
    [importError, setImportError] = useState('');
  const [view, setView] = useState<ViewName>('perspective'),
    [measureTo, setMeasureTo] = useState(''),
    [measureMode, setMeasureMode] = useState(false),
    [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [contacts, setContacts] = useState<SurfaceIntersection[] | null>(null),
    [checking, setChecking] = useState(false);
  const contactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importAbort = useRef<AbortController | null>(null);
  useEffect(() => () => importAbort.current?.abort(), []);
  const [apiDraft, setApiDraft] = useState('http://127.0.0.1:8000');
  const apiUrl = teaching.config.url,
    aiEnabled = teaching.config.enabled;
  const setAiEnabled = (enabled: boolean) => teaching.setConfig({ ...teaching.config, enabled });
  const [isolated, setIsolated] = useState(false),
    [pointer, setPointer] = useState(false);
  const [lecture, setLecture] = useState(false),
    [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1);
  const [attachments, setAttachments] = useState(false),
    [attachmentDraft, setAttachmentDraft] = useState<AttachmentSpec>(DEFAULT_ATTACHMENT);
  const [tool, setTool] = useState<'orbit' | 'translate' | 'rotate'>('orbit'),
    [dragPreview, setDragPreview] = useState<Transforms | null>(null);
  const [lessonId, setLessonId] = useState(''),
    [lessonStep, setLessonStep] = useState(-1);
  const lessonSnapshots = useRef<LessonSnapshot[]>([]);
  const [bAxis, setBAxis] = useState('+Z'),
    [mAxis, setMAxis] = useState('+X'),
    [oAxis, setOAxis] = useState('-Y');
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
    setAttachmentDraft(tooth.attachment || DEFAULT_ATTACHMENT);
  }, [tooth]);
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
  }, [playing, stages, playbackSpeed, reverse, mechanics?.result]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
    if (playing && (reverse ? stage <= 0 : stage >= stages)) setPlaying(false);
  }, [playing, stage, stages, reverse]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
      setPlaying(false);
      setModal(null);
      setDragPreview(null);
    }
  }, [active]);
  type ClassroomSnapshot = {
    mechanics: MechanicsExperiment | null;
    wirePreset: WirePreset;
    magnification: number;
    predictResponse: boolean;
    responseRevealed: boolean;
    forceVectors: boolean;
    pointed: PointedReference | null;
    mechanicsFocus: MechanicsFocus;
    scenario: PreparedScenario | null;
    applianceDisplay: ApplianceDisplay;
    workflowOrigin: typeof workflowOrigin;
    returnWorkspace: ClassroomSnapshot | null;
    sandbox: TryState;
    comparisonName: string | null;
    traces: boolean;
    curveVisible: boolean;
    reverse: boolean;
    lesson: LessonSnapshot;
    history: typeof plan;
    checkpoints: Checkpoint[];
    speed: 0.5 | 1 | 2;
    anatomy: AnatomyViewState;
    camera: ViewerCamera | null;
    lessonId: string;
    lessonStep: number;
    lessonSnapshots: LessonSnapshot[];
    bracketStyle: typeof bracketStyle;
    ligatureColor: string;
    lecture: boolean;
    isolated: boolean;
    tool: typeof tool;
    measureTo: string;
    measureMode: boolean;
    landmarks: Landmark[];
  };
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
      <header className="topbar">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- TODO(phase-3): intentional full reload of the static export */}
        <a className="brand" href="/" aria-label="Forma home">
          <span className="brand-icon">
            <Layers3 size={22} />
          </span>
          forma
          <span className="brand-divider" />
          <span className="brand-sub">TEACHING STUDIO</span>
        </a>
        <div className="top-center">
          <span className="studio-live-dot" />
          Interactive classroom
        </div>
        <div className="header-actions">
          <StudioThemeToggle />
          <button
            className="button light small workflows-button"
            aria-label="Teaching library"
            onClick={() => setModal('workflows')}
          >
            <Layers3 size={16} />
            <span>Teaching library</span>
          </button>
          <button
            className={`button small presentation-button ${lecture ? 'active' : ''}`}
            aria-pressed={lecture}
            aria-label={lecture ? 'Exit lecture mode' : 'Enter lecture mode'}
            onClick={() => setLecture(!lecture)}
          >
            <Presentation size={16} />
            <span>{lecture ? 'Exit lecture' : 'Lecture mode'}</span>
          </button>
          <button
            className="text-button open-case-button"
            onClick={() => caseInput.current?.click()}
            disabled={busy}
          >
            <Upload size={16} />
            Open case
          </button>
          <button className="button dark small" aria-label="Save case" onClick={save}>
            <Download size={15} />
            <span>Save case</span>
          </button>
          <button
            className="avatar"
            onClick={() => {
              setApiDraft(apiUrl || 'http://127.0.0.1:8000');
              setModal('settings');
            }}
            aria-label="Open settings"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>
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
        <aside className="sidebar">
          <MobilePanelHeading
            title={mobilePanel === 'layers' ? 'Layers' : 'Selection'}
            onClose={() => setMobilePanel('model')}
          />
          <div className="case-heading">
            <div className="eyebrow">
              {prepared
                ? 'PREPARED TEACHING CASE'
                : tryActive
                  ? 'TRY MODE · FREE EXPLORATION'
                  : currentLesson
                    ? 'GUIDED TEACHING'
                    : 'CASE EDITOR'}
            </div>
            <h1>
              {caseDefinition?.title ||
                (model.name.includes('Dental Class')
                  ? model.name.split(' · synthetic')[0]
                  : model.demo
                    ? 'Complete dentition'
                    : model.name)}
            </h1>
            <div className="case-meta">
              {model.demo ? 'Illustrative anatomy' : 'Imported meshes'}
              <span>·</span>
              {model.teeth.length} teeth
            </div>
          </div>
          <button
            className="import-button"
            onClick={() => {
              setImportError('');
              setModal('import');
            }}
          >
            <Upload size={17} />
            Import STL models
            <Plus size={15} />
          </button>
          <div className="section-heading">
            TOOTH SELECTION<span className="count">{selectedIds.length}</span>
          </div>
          <div className="tooth-chart">
            {(['upper', 'lower'] as const).map(a => (
              <div className="chart-arch" key={a}>
                <div className="chart-title">
                  <span>{a === 'upper' ? 'Upper · maxillary' : 'Lower · mandibular'}</span>
                  <button onClick={() => selectGroup(`${a} teeth`)}>Select arch</button>
                </div>
                <div className="chart-teeth">
                  {orderedArchIds(ids, a).map(id => (
                    <button
                      key={id}
                      className={`${selectedIds.includes(id) ? 'selected' : ''} ${sandbox.lockedIds.includes(id) ? 'tooth-locked' : ''} ${toothMoved(id) ? 'moved' : ''}`}
                      title={
                        sandbox.lockedIds.includes(id) ? `Tooth ${id} · locked` : `Tooth ${id}`
                      }
                      aria-label={`Select tooth ${id}`}
                      aria-pressed={selectedIds.includes(id)}
                      onClick={e => selectTooth(id, e.shiftKey || e.ctrlKey || e.metaKey)}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Toggle label="Multi-select teeth" value={multi} onChange={() => setMulti(!multi)} />
          <div className="group-shortcuts">
            {[
              'all teeth',
              'upper anterior',
              'lower anterior',
              'upper posterior',
              'lower posterior',
              'molars',
            ].map(scope => (
              <button key={scope} onClick={() => selectGroup(scope)}>
                {scope}
              </button>
            ))}
          </div>
          <p className="selection-hint">
            Shift-click adds or removes a tooth. Every group edit is one undo step.
          </p>
          <div className="display-controls">
            <div className="section-heading">MODEL DISPLAY</div>
            <Toggle
              label="Appliance display"
              value={
                braces &&
                (!!mechanics ||
                  applianceDisplay.preset !== 'none' ||
                  !!caseVariant?.removableRetainer)
              }
              onChange={toggleApplianceVisibility}
            />
            <Toggle
              label="Aligner attachments"
              value={attachments}
              onChange={() => setAttachments(!attachments)}
            />
            <Toggle label="Gingiva" value={gums} onChange={() => setGums(!gums)} />
            <AnatomyPanel
              value={anatomy}
              available={model.demo}
              selected={selected}
              onChange={value => {
                teaching.interact();
                if (value.cutaway && !anatomy.cutaway) {
                  setRoots(true);
                  setGums(true);
                }
                setAnatomy(value);
              }}
            />
            <Toggle
              label="Schematic roots"
              value={roots}
              onChange={() => {
                if (!model.teeth.some(t => t.rootGeometry)) {
                  note(
                    'This case has no root geometry. Roots are not reconstructed from crowns.',
                    true,
                  );
                  return;
                }
                setRoots(!roots);
              }}
            />
            <Toggle label="Tooth numbers" value={labels} onChange={() => setLabels(!labels)} />
            <Toggle label="Reference grid" value={grid} onChange={() => setGrid(!grid)} />
            <Toggle
              label="Displacement traces"
              value={traces}
              onChange={() => setTraces(!traces)}
            />
            <Toggle
              label="Arch reference curve"
              value={curveVisible}
              onChange={() => setCurveVisible(!curveVisible)}
            />
          </div>
          <button className="lesson-launch" onClick={() => setModal('lessons')}>
            <BookOpen size={21} />
            <span>
              <strong>Teach it step by step</strong>
              <small>Guided movement demonstrations</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <div className="sidebar-bottom">
            <span className="local-badge">
              <Box size={14} />
              Local study · mm · FDI
            </span>
            <button className="text-button" onClick={() => setModal('guide')}>
              <CircleHelp size={16} />
              Movement & voice guide
              <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>

        <main className="main-workspace">
          <div className="workspace-scene">
            <div className="workspace-heading">
              <div>
                <div className="breadcrumbs">
                  {prepared
                    ? 'Case library'
                    : tryActive
                      ? 'Try Mode'
                      : currentLesson
                        ? 'Prepared lesson'
                        : 'Case editor'}{' '}
                  <ChevronRight size={12} />
                  <span>
                    {prepared ? (
                      caseDefinition?.category
                    ) : tryActive ? (
                      scenario ? (
                        'Case variation'
                      ) : (
                        'No lesson required'
                      )
                    ) : (
                      <button onClick={() => sendTry({ type: 'enter' }, 'Return to Try Mode')}>
                        Return to Try Mode
                      </button>
                    )}
                  </span>
                </div>
                <h2>
                  {prepared
                    ? caseDefinition?.title
                    : tryActive
                      ? dentalArrangement?.title || 'Your orthodontic sandbox'
                      : currentLesson
                        ? 'Explain one step at a time.'
                        : 'Explore the case geometry.'}
                </h2>
              </div>
              <div className="view-actions">
                {dentalArrangement && (
                  <button
                    className="icon-button"
                    aria-label="About this dental arrangement"
                    onClick={() => setModal('arrangement')}
                  >
                    <CircleHelp size={17} />
                  </button>
                )}
                <details className="presentation-view-menu">
                  <summary title="Model presentation tools">
                    <Focus size={16} />
                    View tools
                  </summary>
                  <LectureViewTools
                    isolated={isolated}
                    pointer={pointer}
                    onIsolate={() => setIsolated(!isolated)}
                    onPointer={() => setPointer(!pointer)}
                    onFocus={() => {
                      teaching.referenceInteraction();
                      viewer.current?.focus();
                    }}
                    onFit={() => {
                      teaching.referenceInteraction();
                      viewer.current?.fit();
                    }}
                  />
                </details>
                <button
                  className="icon-button"
                  title="Export 3D image"
                  aria-label="Export 3D image"
                  onClick={() => viewer.current?.snapshot()}
                >
                  <Camera size={18} />
                </button>
                <button
                  className="icon-button"
                  title="Fit model"
                  aria-label="Fit model"
                  onClick={() => viewer.current?.fit()}
                >
                  <Maximize size={18} />
                </button>
              </div>
            </div>
            <div className="arch-toolbar">
              <div className="segmented">
                {(['both', 'upper', 'lower'] as ArchView[]).map(a => (
                  <button
                    key={a}
                    className={arch === a ? 'active' : ''}
                    onClick={() => {
                      setArch(a);
                      if (a === 'both' && view === 'occlusal') setCamera('perspective');
                    }}
                    aria-pressed={arch === a}
                  >
                    {a === 'both' ? (
                      <>
                        <span className="arch-button-full">Both arches</span>
                        <span className="arch-button-short">Both</span>
                      </>
                    ) : (
                      `${a[0].toUpperCase()}${a.slice(1)}`
                    )}
                  </button>
                ))}
              </div>
              <div className="comparison-strip">
                <button
                  className={stage === 0 ? 'active' : ''}
                  onClick={() =>
                    void teaching.execute(
                      [{ kind: 'comparison', mode: 'before' }],
                      'Show the edit start',
                    )
                  }
                >
                  Before
                </button>
                <button
                  className={stage === stages && !ghost ? 'active' : ''}
                  onClick={() =>
                    void teaching.execute(
                      [{ kind: 'comparison', mode: 'after' }],
                      'Show the endpoint',
                    )
                  }
                >
                  After
                </button>
                <button
                  className={ghost ? 'active' : ''}
                  aria-pressed={ghost}
                  disabled={!!sandbox.pending}
                  onClick={() =>
                    void teaching.execute(
                      [{ kind: 'comparison', mode: ghost ? 'off' : 'overlay' }],
                      ghost ? 'Hide original overlay' : 'Compare with the original',
                    )
                  }
                >
                  <Eye size={13} />
                  Overlay
                </button>
              </div>
              <button
                className={`measure-tool ${measureMode ? 'active' : ''}`}
                onClick={() => {
                  setMeasureMode(!measureMode);
                  setTool('orbit');
                  setToolsOpen(true);
                  setPanel('analysis');
                  setMobilePanel('tools');
                }}
                aria-pressed={measureMode}
              >
                <Ruler size={14} />
                Measure
              </button>
            </div>
            {scenario && caseDefinition && caseVariant && (
              <div className="case-lesson-summary">
                <span>
                  <strong>{caseVariant.title}</strong> ·{' '}
                  {scenario.exploring ? 'Free variation' : 'Prepared illustration'}
                </span>
                <button onClick={() => setLecture(!lecture)}>
                  {lecture ? 'Editing workspace' : 'Professor controls'}
                </button>
                {/* eslint-disable-next-line react-hooks/refs -- TODO(phase-2): move this ref access out of render */}
                {returnWorkspace.current && (
                  <button
                    onClick={() =>
                      void teaching.execute(
                        [{ kind: 'workspace', action: 'restore' }],
                        'Restore my workspace',
                      )
                    }
                  >
                    Restore workspace
                  </button>
                )}
              </div>
            )}
            {prepared && pathAudit && pathAudit.pairs.length > 0 && (
              <details className="case-path-note">
                <summary>
                  {pathAudit.pairs.length} known surface-crossing pairs in {pathAudit.samples}{' '}
                  sampled frames · involved teeth marked amber
                </summary>
                <p>
                  {pathAudit.pairs.map(pair => `${pair.a}–${pair.b} (${pair.tissue})`).join(', ')}.
                  Highlighting covers the sampled sequence, not only the current stage.
                </p>
                <p>{pathAudit.limitation}</p>
              </details>
            )}
            {workflowOrigin && (
              <section
                className="workspace-origin"
                aria-label="Source lesson and preserved workspace"
              >
                <div>
                  <span className="eyebrow">FREE EXPLORATION FROM A LESSON</span>
                  <strong>{workflowOrigin.setup.source.stepTitle}</strong>
                  <span>
                    {workflowOrigin.setup.source.title} ·{' '}
                    {Math.round(workflowOrigin.setup.source.progress * 100)}% shown
                  </span>
                </div>
                <div className="workspace-origin-actions">
                  <button
                    onClick={() =>
                      void teaching.execute(
                        [{ kind: 'workspace', action: 'lesson' }],
                        'Return to the source lesson',
                      )
                    }
                  >
                    Return to source lesson
                  </button>
                  <button
                    onClick={() =>
                      void teaching.execute(
                        [{ kind: 'workspace', action: 'restore' }],
                        'Restore my workspace',
                      )
                    }
                  >
                    Restore my workspace
                  </button>
                </div>
                <details>
                  <summary>Lesson explanation & question</summary>
                  <p>{workflowOrigin.setup.source.explanation}</p>
                  <p>
                    <strong>Ask the class:</strong> {workflowOrigin.setup.source.question}
                  </p>
                  <details>
                    <summary>Reveal answer</summary>
                    <p>{workflowOrigin.setup.source.answer}</p>
                  </details>
                  <div className="workspace-source-links">
                    {workflowOrigin.setup.source.sources.map(source => (
                      <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    ))}
                  </div>
                  <p>
                    The copied arrangement and hardware are editable. Authored arrows and the
                    conceptual palate split remain in the source lesson. Your previous workspace is
                    held only for this session; use Save case to keep an arrangement.
                  </p>
                </details>
              </section>
            )}
            {currentLesson && (
              <section className="lesson-ribbon" aria-label="Current lesson">
                <BookOpen size={21} />
                <div>
                  <strong>
                    {currentLesson.title}
                    <span>
                      {Math.max(0, lessonStep + 1)} / {currentLesson.steps.length}
                    </span>
                  </strong>
                  <p>
                    {lessonStep < 0
                      ? currentLesson.description
                      : currentLesson.steps[lessonStep].caption}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Previous lesson step"
                  disabled={lessonStep < 0}
                  onClick={() =>
                    void teaching.execute(
                      [{ kind: 'lesson-step', action: 'previous' }],
                      'Previous lesson step',
                    )
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="button primary small"
                  disabled={lessonStep >= currentLesson.steps.length - 1}
                  onClick={() =>
                    void teaching.execute(
                      [{ kind: 'lesson-step', action: 'next' }],
                      'Next lesson step',
                    )
                  }
                >
                  Next step
                  <ChevronRight size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Close lesson"
                  onClick={() => {
                    setLessonId('');
                    setLessonStep(-1);
                    setSandbox({ ...sandbox, active: true, pending: null, lastEdit: null });
                  }}
                >
                  <X size={16} />
                </button>
              </section>
            )}

            <div className="workspace-cameras" role="group" aria-label="Camera views">
              {(['perspective', 'front', 'occlusal', 'right', 'left'] as ViewName[]).map(v => (
                <button
                  key={v}
                  className={view === v ? 'active' : ''}
                  onClick={() => {
                    teaching.referenceInteraction();
                    setCamera(v);
                  }}
                  aria-pressed={view === v}
                >
                  {v === 'perspective' ? '3D view' : v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div className="lecture-stage">
              <section
                className="viewport"
                onPointerDownCapture={sceneInteraction}
                aria-label="3D workspace"
              >
                <Viewer
                  onReferenceInteraction={teaching.referenceInteraction}
                  mechanics={
                    sandbox.pending && mechanics ? { ...mechanics, result: null } : mechanics
                  }
                  mechanicsForces={forceVectors}
                  mechanicsRevealed={responseRevealed}
                  pointed={pointed}
                  pointing={teaching.capture.phase !== 'idle'}
                  onPoint={point => {
                    teaching.referenceInteraction();
                    if (point) {
                      const tooth = model.teeth.find(item => item.id === point.tooth)!;
                      setPointed(
                        point.surface === 'gingiva'
                          ? point
                          : {
                              ...point,
                              worldPoint: new Vector3(...point.localPoint)
                                .applyMatrix4(toothMatrix(tooth, actualShown))
                                .toArray() as Vec3,
                            },
                      );
                    } else setPointed(null);
                  }}
                  paused={!active}
                  isolateSelection={isolated}
                  anatomy={anatomy}
                  removableRetainer={
                    !!caseVariant?.removableRetainer && braces && applianceDisplay.preset === 'none'
                  }
                  workflow={braces ? applianceView(applianceDisplay) : undefined}
                  ref={viewer}
                  model={model}
                  transforms={dragPreview || shown}
                  selected={selected}
                  selectedIds={selectedIds}
                  onSelect={selectTooth}
                  ghost={ghost || !!sandbox.pending || comparisonName !== null || !!mechanicsGhost}
                  ghostTransforms={
                    mechanicsGhost ||
                    sandbox.pending?.to ||
                    (mechanics?.result && ghost && !comparisonName
                      ? mechanics.reference.transforms
                      : undefined) ||
                    (comparisonName === 'original' || (scenario && ghost)
                      ? caseStart || sandbox.original || {}
                      : sandbox.snapshots.find(item => item.name === comparisonName)?.transforms)
                  }
                  lockedIds={sandbox.lockedIds}
                  traceFrom={
                    traces
                      ? mechanics?.reference.transforms ||
                        demonstration?.from ||
                        caseStart ||
                        sandbox.original ||
                        {}
                      : undefined
                  }
                  archCurve={curve}
                  gums={gums}
                  labels={labels}
                  grid={grid}
                  arch={arch}
                  braces={braces && (!!mechanics || applianceDisplay.preset !== 'none')}
                  roots={roots}
                  bracketStyle={bracketStyle}
                  ligatureColor={ligatureColor}
                  opening={opening}
                  measureMode={measureMode}
                  landmarks={landmarks}
                  onLandmark={point => {
                    setLandmarks(previous =>
                      previous.length >= 2 ? [point] : [...previous, point],
                    );
                    note('Surface landmark captured.');
                  }}
                  intersections={highlightedContacts}
                  attachments={attachments}
                  tool={tool}
                  onPosePreview={(id, next) => {
                    teaching.interact();
                    if (!sandbox.lockedIds.includes(id))
                      setDragPreview({ ...plan.current, [id]: next });
                  }}
                  onPoseCommit={poseCommit}
                />
                {pointed && (
                  <div className="pointed-target-caption" role="status">
                    {pointed.surface === 'gingiva'
                      ? 'Gingiva near'
                      : pointed.surface === 'root'
                        ? 'Root'
                        : 'Target'}{' '}
                    · {pointed.tooth}
                    <span>
                      {teaching.capture.phase !== 'idle'
                        ? 'Keep speaking — this point is captured'
                        : 'Say “install brackets here”'}
                    </span>
                    <button
                      aria-label="Clear pointed target"
                      onClick={() => {
                        teaching.referenceInteraction();
                        setPointed(null);
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="viewport-top">
                  <span className="view-badge">
                    <span />
                    {sandbox.pending
                      ? 'UNAPPLIED PREVIEW'
                      : sandbox.unrestricted
                        ? 'UNRESTRICTED ILLUSTRATION'
                        : prepared
                          ? 'AUTHORED TEACHING EXAMPLE'
                          : model.demo
                            ? 'SYNTHETIC SANDBOX'
                            : 'IMPORTED CASE'}
                  </span>
                  <span className="unit-badge">mm · FDI numbering</span>
                </div>
                <div className="model-tools" aria-label="3D tools">
                  <button
                    aria-label="Orbit tool"
                    title="Orbit"
                    className={tool === 'orbit' ? 'active' : ''}
                    onClick={() => chooseTool('orbit')}
                  >
                    <MousePointer2 size={19} />
                  </button>
                  <button
                    aria-label="Move with handles"
                    title="Move with world-axis handles"
                    className={tool === 'translate' ? 'active' : ''}
                    onClick={() => chooseTool('translate')}
                  >
                    <Move3D size={19} />
                  </button>
                  <button
                    aria-label="Rotate with handles"
                    title="Rotate with world-axis handles"
                    className={tool === 'rotate' ? 'active' : ''}
                    onClick={() => chooseTool('rotate')}
                  >
                    <Rotate3D size={19} />
                  </button>
                  <span />
                  <button
                    aria-label="Focus selected teeth"
                    title="Focus selected teeth"
                    onClick={() => {
                      teaching.referenceInteraction();
                      viewer.current?.focus();
                    }}
                  >
                    <Focus size={19} />
                  </button>
                  <button
                    aria-label="Toggle tooth numbers"
                    title="Tooth numbers"
                    className={labels ? 'active' : ''}
                    onClick={() => setLabels(!labels)}
                  >
                    11
                  </button>
                </div>
                <div className="viewport-selection">
                  <MousePointer2 size={14} />
                  <span>
                    {selectedIds.length === 1 ? (
                      <>
                        Tooth <strong>{selected}</strong>
                      </>
                    ) : (
                      <strong>{selectedIds.length} teeth selected</strong>
                    )}
                  </span>
                  <span className="selection-line" />
                  <span>{selectedIds.length === 1 ? tooth.name : selectedIds.join(' · ')}</span>
                </div>
                <div className="orientation">
                  <span className="axis-y">Y</span>
                  <span className="axis-x">X</span>
                  <span className="axis-z">Z</span>
                  <i />
                </div>
                <div className="viewport-hint">
                  {measureMode
                    ? 'Pick two crown-surface points'
                    : 'Drag to orbit · Scroll to zoom · Shift-click to select'}
                </div>
                <LecturePointer enabled={pointer && active} onExit={() => setPointer(false)} />
                {pointer && (
                  <span className="lecture-pointer-notice">
                    Lecture pointer · Escape or Exit pointer to orbit
                  </span>
                )}
                {mechanics?.result && !sandbox.pending && (
                  <div className="mechanics-scale-badge">
                    {responseRevealed
                      ? mechanicsResponseCaption(mechanics.result.diagnostics, magnification)
                      : 'Predict first · calculated response hidden'}
                  </div>
                )}
                {mechanics?.result && !sandbox.pending && forceVectors && responseRevealed && (
                  <div className="mechanics-vector-legend">
                    <span>↗ Force direction</span>
                    <span>↻ Moment</span>
                    <small>Arrow size is schematic</small>
                  </div>
                )}
                {stage < stages && (
                  <div className="stage-preview-badge">
                    Stage {stage.toFixed(1)} / {stages}
                  </div>
                )}
                {opening > 0 && (
                  <div className="opening-badge">Display separation {opening} mm</div>
                )}
                {roots && <div className="roots-badge">Schematic roots · not reconstructed</div>}
              </section>
              {lecture && (
                <LectureConsole
                  compact={!caseVariant}
                  collapsible={!!caseVariant}
                  showPlayback={false}
                  title={caseVariant?.title || 'Explore and explain'}
                  objective={
                    caseDefinition?.learningGoal ||
                    'Select a group, preview a geometric change, and invite students to compare it with the starting arrangement.'
                  }
                  question={caseVariant?.question}
                  answer={caseVariant?.answer}
                  answerVisible={scenario?.answerVisible ?? false}
                  onToggleAnswer={() =>
                    void teaching.execute(
                      [{ kind: 'question', visible: !scenario?.answerVisible }],
                      'Toggle the prepared answer',
                    )
                  }
                  playing={playing}
                  progress={stage / stages}
                  speed={playbackSpeed}
                  canPlay={prepared || !!demonstration || moved > 0}
                  disabled={busy}
                  onPlayPause={() =>
                    void teaching.execute(
                      [
                        playing
                          ? { kind: 'stop' }
                          : prepared
                            ? { kind: 'case', action: 'play' }
                            : { kind: 'dental', command: { type: 'play' } },
                      ],
                      playing ? 'Pause demonstration' : 'Play demonstration',
                    )
                  }
                  onRestart={() =>
                    void teaching.execute(
                      [
                        { kind: 'progress', value: 0 },
                        ...(scenario ? [{ kind: 'question' as const, visible: false }] : []),
                      ],
                      'Return to the starting arrangement',
                    )
                  }
                  onHalf={() =>
                    void teaching.execute([{ kind: 'progress', value: 0.5 }], 'Pause at 50 percent')
                  }
                  onProgress={progress =>
                    void teaching.execute(
                      [{ kind: 'progress', value: progress }],
                      'Set demonstration progress',
                    )
                  }
                  onSpeed={value =>
                    void teaching.execute(
                      [{ kind: 'speed', value: value as 0.5 | 1 | 2 }],
                      'Set presentation speed',
                    )
                  }
                  variants={
                    prepared
                      ? caseDefinition?.variants.map(item => ({ id: item.id, label: item.title }))
                      : undefined
                  }
                  variantId={scenario?.variantId}
                  onVariant={id =>
                    void teaching.execute(
                      [{ kind: 'case', action: 'variant', id }],
                      'Compare an authored demonstration from its start',
                    )
                  }
                  explorationAction={
                    scenario
                      ? {
                          label: prepared ? 'Try this arrangement' : 'Return to prepared case',
                          onClick: () =>
                            void teaching.execute(
                              [{ kind: 'case', action: prepared ? 'explore' : 'return' }],
                              prepared
                                ? 'Explore the displayed arrangement'
                                : 'Return to the prepared case',
                            ),
                        }
                      : undefined
                  }
                  note={
                    scenario
                      ? undefined
                      : 'Geometric illustration · playback speed is presentation speed · no biological prediction'
                  }
                >
                  <div className="lecture-quick-layers">
                    <button
                      aria-pressed={roots}
                      onClick={() => void teaching.runControl(roots ? 'hide roots' : 'show roots')}
                    >
                      Roots
                    </button>
                    <button
                      aria-pressed={gums}
                      onClick={() => void teaching.runControl(gums ? 'hide gums' : 'show gums')}
                    >
                      Gingiva
                    </button>
                    <button
                      aria-pressed={labels}
                      onClick={() =>
                        void teaching.runControl(labels ? 'hide labels' : 'show labels')
                      }
                    >
                      Tooth numbers
                    </button>
                    <button
                      aria-pressed={ghost}
                      disabled={!!sandbox.pending}
                      onClick={() =>
                        void teaching.execute(
                          [{ kind: 'comparison', mode: ghost ? 'off' : 'overlay' }],
                          'Toggle original overlay',
                        )
                      }
                    >
                      Original overlay
                    </button>
                    {scenario && (
                      <button onClick={() => void teaching.runControl('explain this step')}>
                        Explain aloud
                      </button>
                    )}
                    {tryActive && demonstration && (
                      <button
                        onClick={() =>
                          void teaching.execute(
                            [{ kind: 'try-playback', direction: 'reverse' }],
                            'Reverse the geometric edit',
                          )
                        }
                      >
                        Reverse edit
                      </button>
                    )}
                  </div>
                </LectureConsole>
              )}
            </div>
            {(prepared ||
              !!demonstration ||
              moved > 0 ||
              !!sandbox.pending ||
              !!mechanics?.result) && (
              <StageBar
                label={
                  mechanics
                    ? mechanics.result
                      ? 'Calculated initial response'
                      : 'Appliance setup · calculate to see a response'
                    : prepared
                      ? 'Authored demonstration'
                      : sandbox.pending
                        ? 'Geometric preview'
                        : 'Geometric movement'
                }
                progress={stage / stages}
                stages={stages}
                playing={playing}
                speed={playbackSpeed}
                canPlay={
                  mechanics
                    ? !!mechanics.result && hasMechanicsMovement(mechanics.result.diagnostics)
                    : prepared || !!demonstration || moved > 0
                }
                onPlay={() =>
                  void teaching.execute(
                    [
                      playing
                        ? { kind: 'stop' }
                        : prepared
                          ? { kind: 'case', action: 'play' }
                          : { kind: 'dental', command: { type: 'play' } },
                    ],
                    playing ? 'Pause demonstration' : 'Play demonstration',
                  )
                }
                onProgress={value => {
                  teaching.interact();
                  setPlaying(false);
                  setStage(value * stages);
                }}
                onSpeed={value => setPlaybackSpeed(value as 0.5 | 1 | 2)}
                onStages={value => {
                  setStages(value);
                  setStage((stage / stages) * value);
                }}
                onReverse={() =>
                  void teaching.execute(
                    [{ kind: 'try-playback', direction: 'reverse' }],
                    'Play in reverse',
                  )
                }
                revealed={mechanics?.result ? responseRevealed : undefined}
                onReveal={() => {
                  setResponseRevealed(true);
                  setReverse(false);
                  setStage(0);
                  setPlaying(
                    !!mechanics?.result && hasMechanicsMovement(mechanics.result.diagnostics),
                  );
                }}
                onExplore={
                  prepared
                    ? () =>
                        void teaching.execute(
                          [{ kind: 'case', action: 'explore' }],
                          'Explore this arrangement',
                        )
                    : undefined
                }
              />
            )}
          </div>
          <div className="workspace-command-dock">
            {!prepared &&
              model.demo &&
              mechanics &&
              Object.keys(mechanics.config.brackets).length > 0 && (
                <div className="command-context-strip">
                  <button
                    onClick={() => {
                      setToolsOpen(true);
                      setPanel('braces');
                      setMobilePanel('tools');
                    }}
                  >
                    New wire preset ·{' '}
                    {wirePreset.material === 'stainless-steel' ? 'Steel' : 'Beta titanium'} ·{' '}
                    {wireSizeLabel(wirePreset.section)}
                  </button>
                  <span>
                    {mechanicsFocus.wireId
                      ? `Focus: ${mechanicsFocus.wireId}`
                      : 'Point → hold Space → speak'}
                  </span>
                </div>
              )}
            <TeachingCommandBar
              suggestions={
                sandbox.pending
                  ? ['apply preview', 'discard preview']
                  : prepared
                    ? [
                        'play demonstration',
                        'show roots',
                        'reveal answer',
                        'explore this arrangement',
                      ]
                    : mechanics?.result
                      ? [
                          'repeat that more slowly',
                          'show roots',
                          'show displacement traces',
                          'compare with original',
                        ]
                      : mechanics?.config.wires.length
                        ? [
                            'activate that wire by 0.5 mm',
                            'show what happens',
                            'show roots',
                            'undo that',
                          ]
                        : mechanics && Object.keys(mechanics.config.brackets).length
                          ? ['put a wire through these brackets', 'show roots', 'undo that']
                          : [
                              'select upper teeth',
                              'put brackets in top',
                              'show roots',
                              'compare with original',
                            ]
              }
              placeholder={
                prepared
                  ? 'Try “show roots, then reveal answer”'
                  : 'Try “select upper front six, then move them buccally 1 mm”'
              }
              value={command}
              onChange={setCommand}
              inputRef={commandInput}
            />
            {statusError && (
              <div className="case-action-status error" role="status">
                {status}
              </div>
            )}
          </div>
        </main>

        <aside className="inspector">
          <MobilePanelHeading title="Tools" onClose={() => setMobilePanel('model')} />
          <div className="inspector-heading">
            <span className="eyebrow">
              {selectedIds.length === 1 ? 'TOOTH INSPECTOR' : 'GROUP INSPECTOR'}
            </span>
            <div className="history-buttons">
              <button
                className="icon-button"
                onClick={() => void teaching.runControl('undo that')}
                aria-label="Undo"
                title="Ctrl / Cmd + Z"
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                onClick={() => void teaching.runControl('redo')}
                aria-label="Redo"
                title="Ctrl / Cmd + Shift + Z"
              >
                <Redo2 size={17} />
              </button>
            </div>
          </div>
          <div className="tooth-card">
            <div className="large-number">
              {selectedIds.length === 1 ? selected : selectedIds.length}
            </div>
            <div>
              <h3>{selectedIds.length === 1 ? tooth.name : 'Selected teeth'}</h3>
              <span>
                {selectedIds.length === 1
                  ? `${toothArch(selected)} arch · FDI ${selected}`
                  : selectedIds.join(' · ')}
              </span>
              <div className="selected-tag">
                {calibrated ? 'Reference axes set' : 'Calibration needed'}
              </div>
            </div>
          </div>
          <label className="mobile-tooth-selector">
            Selected tooth
            <select value={selected} onChange={e => selectTooth(e.target.value)}>
              {model.teeth.map(t => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mobile-groups">
            <button onClick={() => selectGroup('upper incisors')}>Upper incisors</button>
            <button onClick={() => selectGroup('lower incisors')}>Lower incisors</button>
            <button onClick={() => selectGroup('all teeth')}>All teeth</button>
          </div>
          <div className="inspector-tabs four-tabs">
            {(
              [
                { id: 'move', label: 'Move', icon: <Move3D size={14} /> },
                { id: 'braces', label: 'Appliances', icon: <SlidersHorizontal size={14} /> },
                { id: 'analysis', label: 'Measure', icon: <Ruler size={14} /> },
                { id: 'history', label: 'Stages', icon: <History size={14} /> },
              ] as const
            ).map(t => (
              <button
                key={t.id}
                className={panel === t.id ? 'active' : ''}
                onClick={() => setPanel(t.id)}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {panel === 'move' && scenario && caseDefinition && caseVariant && (
            <>
              <CaseScenarioPanel
                showPlayback={false}
                title={caseDefinition.title}
                description={caseDefinition.description}
                category={caseDefinition.category}
                observe={caseDefinition.learningGoal}
                question={caseVariant.question}
                answer={caseVariant.answer}
                answerVisible={scenario.answerVisible}
                onToggleAnswer={() =>
                  void teaching.execute(
                    [{ kind: 'question', visible: !scenario.answerVisible }],
                    scenario.answerVisible ? 'Hide answer' : 'Reveal answer',
                  )
                }
                variants={caseDefinition.variants.map(item => ({
                  id: item.id,
                  label: item.title,
                  description: item.description,
                }))}
                variantId={scenario.variantId}
                onVariantChange={id =>
                  void teaching.execute(
                    [{ kind: 'case', action: 'variant', id }],
                    'Choose case demonstration',
                  )
                }
                progress={scenario.exploring ? scenario.returnProgress : stage / stages}
                playing={playing}
                speed={playbackSpeed}
                compare={ghost}
                onProgressChange={value =>
                  void teaching.execute(
                    [{ kind: 'case', action: 'progress', value }],
                    'Set demonstration progress',
                  )
                }
                onSpeedChange={value =>
                  void teaching.execute([{ kind: 'speed', value }], 'Set playback speed')
                }
                onTogglePlaying={() =>
                  void teaching.execute(
                    [{ kind: 'case', action: playing ? 'pause' : 'play' }],
                    playing ? 'Pause case' : 'Play case',
                  )
                }
                onReset={() =>
                  void teaching.execute([{ kind: 'case', action: 'reset' }], 'Reset prepared case')
                }
                onCompare={() =>
                  void teaching.execute(
                    [{ kind: 'comparison', mode: ghost ? 'off' : 'overlay' }],
                    'Compare the case start',
                  )
                }
                onExplore={() =>
                  void teaching.execute(
                    [{ kind: 'case', action: 'explore' }],
                    'Explore this arrangement',
                  )
                }
                onReturn={() =>
                  void teaching.execute(
                    [{ kind: 'case', action: 'return' }],
                    'Return to prepared case',
                  )
                }
                edited={scenario.exploring}
                disabled={!!sandbox.pending || busy}
              />
              <details className="case-sources">
                <summary>Assumptions & reading · educator review pending</summary>
                <ul>
                  {[...caseDefinition.assumptions, ...caseVariant.assumptions].map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <div>
                  {caseVariant.sources.map(source => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  ))}
                </div>
              </details>
            </>
          )}
          {panel === 'move' && tryActive && (
            <>
              {!calibrated && (
                <div className="calibration-notice">
                  Imported teeth need reference directions for named movements. Case axes work
                  immediately.
                  <button disabled={!!sandbox.pending} onClick={openCalibration}>
                    Calibrate tooth {selected}
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              )}
              <TryPanel {...tryPanelProps} hidePreview={lecture} />
            </>
          )}
          {panel === 'move' && !tryActive && !prepared && (
            <div className="inspector-content">
              <div className="control-heading">
                <Move3D size={16} />
                <h3>Translate {selectedIds.length > 1 ? 'selection' : 'tooth'}</h3>
                <span>mm / tooth</span>
              </div>
              {!calibrated && (
                <div className="calibration-notice">
                  Use world axes until reference directions are set.
                  <button onClick={openCalibration}>
                    Calibrate tooth {selected}
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              )}
              <div className="direction-grid">
                {directions.map(d => (
                  <button
                    key={d.id}
                    className={direction === d.id ? 'active' : ''}
                    onClick={() => setDirection(d.id)}
                    disabled={!calibrated}
                  >
                    <strong>{d.label}</strong>
                    <span>{d.detail}</span>
                  </button>
                ))}
              </div>
              <div className="world-axes">
                <span>World axis</span>
                {(['x', 'y', 'z'] as const).map(a => (
                  <button
                    className={direction === a ? 'active' : ''}
                    onClick={() => setDirection(a)}
                    key={a}
                  >
                    {a.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="amount-row">
                <label className="number-field">
                  <input
                    aria-label="Movement distance"
                    type="number"
                    value={distance}
                    step="0.05"
                    min="-10"
                    max="10"
                    onChange={e => setDistance(e.target.value)}
                  />
                  <span>mm</span>
                </label>
                <button
                  className="button primary"
                  onClick={() =>
                    apply({
                      type: 'move_group',
                      teeth: selectedIds,
                      direction,
                      amount: Number(distance),
                    })
                  }
                >
                  Move <ArrowRight size={15} />
                </button>
              </div>
              <div className="presets">
                {['0.1', '0.25', '0.5', '1'].map(n => (
                  <button
                    key={n}
                    className={distance === n ? 'active' : ''}
                    onClick={() => setDistance(n)}
                  >
                    {n} mm
                  </button>
                ))}
              </div>
              <div className="divider" />
              <div className="control-heading">
                <Rotate3D size={16} />
                <h3>Angular movement</h3>
                <span>degrees</span>
              </div>
              <div className="rotation-modes">
                {(
                  [
                    { id: 'tip', label: 'Tip' },
                    { id: 'torque', label: 'Torque' },
                    { id: 'rotate', label: 'Axial' },
                    { id: 'world', label: 'World' },
                  ] as const
                ).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setRotationMode(m.id)}
                    disabled={m.id !== 'world' && !calibrated}
                    className={rotationMode === m.id ? 'active' : ''}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="rotation-explanation">
                {rotationMode === 'tip'
                  ? 'About each tooth’s buccolingual axis.'
                  : rotationMode === 'torque'
                    ? 'About each tooth’s mesiodistal axis.'
                    : rotationMode === 'rotate'
                      ? 'About each tooth’s occlusal / long axis.'
                      : 'About a fixed axis of the case.'}
              </p>
              {rotationMode === 'world' && (
                <div className="rotation-axis">
                  <span>World axis</span>
                  <div>
                    {(['x', 'y', 'z'] as const).map(a => (
                      <button
                        key={a}
                        onClick={() => setAxis(a)}
                        className={axis === a ? 'active' : ''}
                      >
                        {a.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="amount-row">
                <label className="number-field">
                  <input
                    aria-label="Rotation angle"
                    type="number"
                    value={degrees}
                    min="-180"
                    max="180"
                    step="1"
                    onChange={e => setDegrees(e.target.value)}
                  />
                  <span>°</span>
                </label>
                <button
                  className="button light"
                  onClick={() =>
                    apply(
                      rotationMode === 'world'
                        ? {
                            type: 'rotate_group',
                            teeth: selectedIds,
                            axis,
                            amount: Number(degrees),
                          }
                        : {
                            type: 'orthodontic',
                            teeth: selectedIds,
                            movement: rotationMode,
                            amount: Number(degrees),
                          },
                    )
                  }
                >
                  Apply <RotateCcw size={15} />
                </button>
              </div>
              <p className="field-hint">
                Right-hand sign · fixed reference axes · crown-centre pivot. No force or
                root-control prediction.
              </p>
              <div className="divider" />
              <div className="control-heading">
                <Focus size={16} />
                <h3>Tooth {selected} · final change</h3>
                <button
                  className="reset-link"
                  onClick={() => apply({ type: 'reset', teeth: selectedIds })}
                >
                  Reset {selectedIds.length > 1 ? 'group' : ''}
                </button>
              </div>
              <div className="position-values">
                {['X', 'Y', 'Z'].map((a, i) => (
                  <div key={a}>
                    <span>{a}</span>
                    <strong>{pretty(pose.translation[i])}</strong>
                    <small>mm</small>
                  </div>
                ))}
              </div>
              <div className="rotation-values">
                Euler XYZ<span>{pose.rotation.map(n => `${n.toFixed(1)}°`).join(' / ')}</span>
              </div>
              <button className="axis-details" onClick={openCalibration}>
                {actualCalibration
                  ? 'Inspect / adjust reference directions'
                  : 'Set anatomical reference directions'}
                <ChevronRight size={13} />
              </button>
            </div>
          )}

          {panel === 'braces' && (
            <div className="braces-panel">
              {activeExperiment && !prepared && (
                <MechanicsPanel
                  experiment={activeExperiment}
                  selectedIds={selectedIds}
                  pointed={physicalPoint}
                  focus={mechanicsFocus}
                  preset={wirePreset}
                  onPreset={value => {
                    teaching.interact();
                    setWirePreset(value);
                  }}
                  onFocus={value => {
                    teaching.referenceInteraction();
                    setMechanicsFocus(value);
                  }}
                  onActions={sendMechanics}
                  busy={teaching.runtime.phase !== 'idle'}
                  magnification={magnification}
                  onMagnification={setMagnification}
                  onReplay={() =>
                    void teaching.execute(
                      [{ kind: 'dental', command: { type: 'play' } }],
                      'Replay the calculated response from the same unloaded reference',
                    )
                  }
                  onFrame={() => {
                    teaching.referenceInteraction();
                    viewer.current?.focus();
                  }}
                  predict={predictResponse}
                  onPredict={setPredictResponse}
                  revealed={responseRevealed}
                  onReveal={() => {
                    setResponseRevealed(true);
                    setReverse(false);
                    setStage(0);
                    setPlaying(
                      !!mechanics?.result && hasMechanicsMovement(mechanics.result.diagnostics),
                    );
                  }}
                  forces={forceVectors}
                  onForces={() => setForceVectors(!forceVectors)}
                  onExplain={() => void teaching.runControl('explain that movement')}
                />
              )}
              <details className="appearance-details">
                <summary>Authored appliance illustrations & appearance</summary>
                <AppliancePalette
                  value={applianceDisplay}
                  available={model.demo}
                  busy={teaching.runtime.phase !== 'idle'}
                  onChange={value =>
                    void teaching.execute(
                      [{ kind: 'appliance-display', ...value }],
                      'Change teaching appliance',
                    )
                  }
                />
                {anatomy.cutaway &&
                  ['expander-bands', 'palatal-expander', 'retainer'].includes(
                    applianceDisplay.preset,
                  ) && (
                    <p className="form-note">
                      Turn off the anatomy cutaway to see the complete appliance.
                    </p>
                  )}
                <div className="appliance-intro">
                  Show how appliances relate to the teeth. Select a tooth or group to add
                  attachments.
                </div>
                <div className="control-heading">
                  <SlidersHorizontal size={16} />
                  <h3>Fixed appliance</h3>
                </div>
                <Toggle
                  label="Show chosen appliance"
                  value={
                    braces &&
                    (!!mechanics ||
                      applianceDisplay.preset !== 'none' ||
                      !!caseVariant?.removableRetainer)
                  }
                  onChange={toggleApplianceVisibility}
                />
                <label className="form-label">
                  Bracket appearance
                  <select
                    value={bracketStyle}
                    onChange={e => setBracketStyle(e.target.value as 'metal' | 'ceramic')}
                  >
                    <option value="metal">Metal</option>
                    <option value="ceramic">Ceramic</option>
                  </select>
                </label>
                <label className="form-label">Ligature colour</label>
                <div className="colour-swatches">
                  {['#299f9b', '#889ba6', '#547aca', '#bd5b87', '#946fbe', '#e4d5ac'].map(c => (
                    <button
                      key={c}
                      aria-label={`Ligature colour ${c}`}
                      aria-pressed={ligatureColor === c}
                      className={ligatureColor === c ? 'active' : ''}
                      style={{ background: c }}
                      onClick={() => setLigatureColor(c)}
                    />
                  ))}
                </div>
                <div className="divider" />
                <div className="control-heading">
                  <Box size={16} />
                  <h3>Aligner attachments</h3>
                  <span>{model.teeth.filter(t => t.attachment).length} placed</span>
                </div>
                <Toggle
                  label="Show attachments"
                  value={attachments}
                  onChange={() => setAttachments(!attachments)}
                />
                <label className="form-label">
                  Attachment shape
                  <select
                    aria-label="Attachment shape"
                    value={attachmentDraft.shape}
                    onChange={e =>
                      setAttachmentDraft({
                        ...attachmentDraft,
                        shape: e.target.value as AttachmentSpec['shape'],
                      })
                    }
                  >
                    <option value="rectangle">Rectangular</option>
                    <option value="ellipsoid">Ellipsoid</option>
                    <option value="beveled">Beveled</option>
                  </select>
                </label>
                <div className="attachment-fields">
                  {(
                    [
                      { key: 'width', label: 'Width', unit: 'mm', min: 0.2, max: 6 },
                      { key: 'height', label: 'Height', unit: 'mm', min: 0.2, max: 6 },
                      { key: 'depth', label: 'Depth', unit: 'mm', min: 0.2, max: 6 },
                      { key: 'rotation', label: 'Rotation', unit: '°', min: -180, max: 180 },
                      { key: 'offsetMesial', label: 'Mesial offset', unit: 'mm', min: -5, max: 5 },
                      {
                        key: 'offsetOcclusal',
                        label: 'Occlusal offset',
                        unit: 'mm',
                        min: -5,
                        max: 5,
                      },
                    ] as const
                  ).map(f => (
                    <label key={f.key}>
                      {f.label}
                      <span>
                        <input
                          type="number"
                          aria-label={`Attachment ${f.label.toLowerCase()}`}
                          min={f.min}
                          max={f.max}
                          step={f.key === 'rotation' ? 1 : 0.1}
                          value={
                            Number.isFinite(attachmentDraft[f.key]) ? attachmentDraft[f.key] : ''
                          }
                          onChange={e =>
                            setAttachmentDraft({
                              ...attachmentDraft,
                              [f.key]: e.target.value === '' ? NaN : Number(e.target.value),
                            })
                          }
                        />
                        <small>{f.unit}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="attachment-actions">
                  <button
                    className="button primary"
                    disabled={!calibrated}
                    onClick={() => editAttachments(attachmentDraft)}
                  >
                    Apply to {selectedIds.length === 1 ? selected : `${selectedIds.length} teeth`}
                  </button>
                  <button
                    className="button light"
                    disabled={!model.teeth.some(t => selectedIds.includes(t.id) && t.attachment)}
                    onClick={() => editAttachments(null)}
                  >
                    Remove
                  </button>
                </div>
                <p className="field-hint">
                  Placed on the crown surface. Changes apply to the selection; Remove reverses an
                  appliance edit.
                </p>
                <div className="divider" />
                <Toggle label="Show gingiva" value={gums} onChange={() => setGums(!gums)} />
                <Toggle
                  label="Show schematic roots"
                  value={roots}
                  onChange={() => {
                    if (!model.teeth.some(t => t.rootGeometry)) {
                      note('No root geometry in this case.', true);
                      return;
                    }
                    setRoots(!roots);
                  }}
                />
                <label className="form-label">
                  Separate arches for inspection <span>{opening} mm</span>
                  <input
                    aria-label="Display arch separation"
                    type="range"
                    min="0"
                    max="25"
                    step="1"
                    value={opening}
                    onChange={e => setOpening(Number(e.target.value))}
                    style={{ '--progress': `${opening * 4}%` } as React.CSSProperties}
                  />
                </label>
                <p className="field-hint">
                  Display separation does not change saved tooth movements, exported geometry, or
                  measurements.
                </p>
                <div className="information-card">
                  <ShieldCheck size={18} />
                  <p>
                    These appearance presets are authored illustrations. The experiment controls
                    above separately calculate supported initial wire, elastic and expander
                    responses with declared virtual supports.
                  </p>
                </div>
                {!model.demo && (
                  <p className="field-hint">
                    Imported teeth need reference calibration. Bracket placement is an estimate on
                    the buccal surface.
                  </p>
                )}
              </details>
            </div>
          )}

          {panel === 'analysis' && (
            <div className="analysis-panel">
              <div className="control-heading">
                <Ruler size={16} />
                <h3>Surface landmarks</h3>
              </div>
              <button
                className={`button ${measureMode ? 'primary' : 'light'} full-button`}
                onClick={() => setMeasureMode(!measureMode)}
              >
                {measureMode ? 'Finish picking' : 'Pick two crown points'}
                <Ruler size={15} />
              </button>
              <div className="measure-result">
                <strong>
                  {pointDistance === null ? '—' : pointDistance.toFixed(2)}
                  <small> mm</small>
                </strong>
                <span>
                  {landmarks.length === 2
                    ? `${landmarks[0].tooth} → ${landmarks[1].tooth} · shown stage`
                    : `${landmarks.length}/2 points selected`}
                </span>
                {landmarks.length > 0 && (
                  <button onClick={() => setLandmarks([])}>Clear points</button>
                )}
              </div>
              <p className="field-hint">
                Straight 3D distance between your landmarks. Display arch separation is excluded.
              </p>
              <div className="divider" />
              <div className="control-heading">
                <Focus size={16} />
                <h3>Crown-centre spans</h3>
              </div>
              <div className="span-table">
                {spans.map(s => (
                  <div key={s.name}>
                    <span>
                      {s.name}
                      <small>
                        {s.initial!.toFixed(2)} → {s.final!.toFixed(2)} mm
                      </small>
                    </span>
                    <strong>
                      {pretty(s.final! - s.initial!)}
                      <small> mm</small>
                    </strong>
                  </div>
                ))}
              </div>
              <p className="field-hint">
                Crown-centre distances, not clinical cusp-tip arch widths.
              </p>
              <div className="measurement">
                <label htmlFor="measure-to">Tooth {selected} centre to</label>
                <select
                  id="measure-to"
                  value={measureTo}
                  onChange={e => setMeasureTo(e.target.value)}
                >
                  <option value="">Choose tooth</option>
                  {model.teeth
                    .filter(t => t.id !== selected)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        Tooth {t.id}
                      </option>
                    ))}
                </select>
                {distanceTo !== null && (
                  <span className="measurement-result">
                    {distanceTo.toFixed(2)} mm <small>At final positions</small>
                  </span>
                )}
              </div>
              <div className="divider" />
              <div className="control-heading">
                <Box size={16} />
                <h3>Surface intersections</h3>
              </div>
              <button
                className="button light full-button"
                onClick={scanContacts}
                disabled={checking || !!sandbox.pending}
              >
                {checking ? 'Checking triangle surfaces…' : 'Check final crown surfaces'}
              </button>
              {contacts !== null && (
                <div className="contact-results">
                  <strong>{contacts.length} intersecting pairs</strong>
                  {contacts.map(c => (
                    <button
                      key={`${c.a}-${c.b}`}
                      onClick={() => {
                        setSelectedIds([c.a, c.b]);
                        setSelected(c.a);
                        setArch(toothArch(c.a) === toothArch(c.b) ? toothArch(c.a) : 'both');
                      }}
                    >
                      {c.a} ↔ {c.b}
                    </button>
                  ))}
                </div>
              )}
              <p className="field-hint">
                Tests triangle-surface crossings at the final pose only. Does not measure clearance,
                containment, gums, roots, bone, or intermediate-stage intersections.
              </p>
              <button className="text-button" onClick={csv}>
                <Download size={15} />
                Export movement summary
              </button>
            </div>
          )}

          {panel === 'history' && (
            <div className="history-panel">
              <div className="stage-export-card">
                <span className="eyebrow">TEACHING MODEL EXPORTS</span>
                <h3>Take the sequence with you.</h3>
                <p>Export the nearest whole stage, or every stage with a movement manifest.</p>
                <button className="button light full-button" onClick={exportShown}>
                  <Download size={15} />
                  Export stage {Math.round(stage)} · STL
                </button>
                <button
                  className="button primary full-button"
                  disabled={busy}
                  onClick={exportSequence}
                >
                  <Layers3 size={15} />
                  {busy ? 'Preparing…' : `Export ${stages + 1} stages · ZIP`}
                </button>
                <p className="field-hint">
                  Crowns + gingiva{attachments ? ' + placed attachments' : ''}. Teaching geometry;
                  no aligner shells or manufacturing preparation.
                </p>
              </div>
              <div className="divider" />
              {!tryActive && !prepared && (
                <>
                  <div className="control-heading">
                    <Layers3 size={16} />
                    <h3>Planning checkpoints</h3>
                    <span>{checkpoints.length}/20</span>
                  </div>
                  <p>
                    Capture an intermediate setup. Playback follows the saved order, then reaches
                    your current final target.
                  </p>
                  <div className="checkpoint-input">
                    <input
                      aria-label="Checkpoint name"
                      placeholder="e.g. Alignment study"
                      maxLength={60}
                      value={checkpointName}
                      onChange={e => setCheckpointName(e.target.value)}
                    />
                    <button
                      className="icon-button"
                      onClick={addCheckpoint}
                      disabled={checkpoints.length >= 20}
                      aria-label="Capture checkpoint"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="checkpoint-list">
                    {checkpoints.map((c, i) => (
                      <div key={c.id}>
                        <span>{i + 1}</span>
                        <button
                          onClick={() => {
                            setPlaying(false);
                            setStage(((i + 1) / (checkpoints.length + 1)) * stages);
                          }}
                        >
                          {c.name}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Remove checkpoint ${c.name}`}
                          onClick={() => {
                            setCheckpoints(checkpoints.filter(p => p.id !== c.id));
                            setStage(stages);
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="divider" />
                </>
              )}
              <div className="control-heading">
                <History size={16} />
                <h3>Movement history</h3>
                <span>{plan.past.length}</span>
              </div>
              {!plan.past.length ? (
                <div className="empty-history">
                  <History size={24} />
                  <span>Your first movement will appear here.</span>
                </div>
              ) : (
                [...plan.past].reverse().map((entry, i) => (
                  <div className="history-entry" key={i}>
                    <span>{plan.past.length - i}</span>
                    <div>{entry.label}</div>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="inspector-bottom">
            <div>
              <span>Teeth adjusted</span>
              <strong>
                {moved}
                <small> / {model.teeth.length}</small>
              </strong>
            </div>
            <button className="button export-button" onClick={exportShown}>
              <ArrowDownToLine size={16} />
              Export stage {Math.round(stage)} STL
              <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>
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

      {modal === 'workflows' && (
        <Dialog title="Teaching library" onClose={() => setModal(null)}>
          <section className="dental-arrangement-library">
            <span className="eyebrow">START A FREE EXPERIMENT</span>
            <h3>Dental relationships</h3>
            <p>
              Prepared starting arrangements for free exploration. Dental and skeletal
              classification remain separate.
            </p>
            <div>
              {DENTAL_ARRANGEMENTS.map(item => (
                <button
                  disabled={!!sandbox.pending || busy}
                  key={item.id}
                  title={item.description}
                  onClick={() =>
                    void teaching.execute(
                      [{ kind: 'dental-arrangement', id: item.id }],
                      `Load ${item.title}`,
                    )
                  }
                >
                  {item.title}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </section>
          <TeachingCaseLibrary
            cases={CASE_CARDS}
            selectedId={scenario?.caseId}
            disabled={!!sandbox.pending || busy}
            onChoose={id => {
              setModal(null);
              void teaching.execute(
                [{ kind: 'case', action: 'load', id }],
                'Load prepared teaching case',
              );
            }}
          />
          <details className="appliance-workflow-library">
            <summary>Appliance workflows & anatomy classroom</summary>
            <WorkflowLibrary
              onChoose={id => {
                setModal(null);
                void teaching.runControl(
                  id === 'anatomy'
                    ? 'start anatomy lesson'
                    : `start ${id === 'fixed-braces' ? 'braces' : id.replace('-', ' ')} workflow`,
                );
              }}
            />
          </details>
          <div className="combined-library-link">
            <p>Prefer a short sequence of tooth edits on this case?</p>
            <button onClick={() => setModal('lessons')}>Short guided lessons</button>
          </div>
        </Dialog>
      )}
      {modal === 'lessons' && (
        <Dialog title="Ready for the next demonstration?" onClose={() => setModal(null)}>
          <p>
            Choose a short teaching sequence. Say “next step”, “previous step”, or “restart lesson”
            as you explain.
          </p>
          <div className="lesson-cards">
            {LESSONS.map((lesson, i) => (
              <button
                key={lesson.id}
                onClick={() => {
                  if (workflowOrigin || scenario) {
                    note('Restore your workspace before starting another short lesson.', true);
                    setModal(null);
                    return;
                  }
                  if (sandbox.pending) {
                    note('Apply or discard the preview before opening a lesson.', true);
                    setModal(null);
                    return;
                  }
                  setSandbox({ ...sandbox, pending: null, lastEdit: null });
                  setLessonId(lesson.id);
                  setLessonStep(-1);
                  lessonSnapshots.current = [];
                  setLecture(true);
                  setModal(null);
                  setPlaying(false);
                  note('Lesson ready. Say “next step” or press Next step to begin.');
                }}
              >
                <span className="lesson-number">0{i + 1}</span>
                <div>
                  <strong>{lesson.title}</strong>
                  <p>{lesson.description}</p>
                  <small>{lesson.steps.length} steps · voice controlled</small>
                </div>
                <ArrowUpRight size={19} />
              </button>
            ))}
          </div>
          <p className="form-note">
            The first step resets tooth movements. Save your case first if needed. Previous step
            restores the setup before that step. Demonstrations use illustrative geometry.
          </p>
        </Dialog>
      )}
      {modal === 'import' && (
        <Dialog title="Import segmented dental meshes" onClose={() => setModal(null)}>
          <p>
            Select already-segmented STL teeth using FDI names such as <code>11.stl</code>,{' '}
            <code>21.stl</code>, <code>31.stl</code>, and <code>41.stl</code>. Gums can be named{' '}
            <code>upper_gum.stl</code> and <code>lower_gum.stl</code>.
          </p>
          <label className="upload-zone">
            <Upload size={26} />
            <strong>{files.length ? `${files.length} files selected` : 'Choose STL files'}</strong>
            <span>Shared coordinates · 100 MB total</span>
            <input
              type="file"
              accept=".stl"
              multiple
              onChange={e => setFiles(Array.from(e.target.files || []))}
            />
          </label>
          {files.length > 0 && (
            <div className="file-chips">
              {files.map(f => (
                <span key={f.name}>{f.name}</span>
              ))}
            </div>
          )}
          <label className="form-label">
            Source units
            <select value={scale} onChange={e => setScale(e.target.value)}>
              <option value="1">Millimetres</option>
              <option value="10">Centimetres</option>
              <option value="1000">Metres</option>
              <option value="25.4">Inches</option>
            </select>
          </label>
          <p className="form-note">
            Replaces the current case. Save first if needed. All shared positions are preserved.
            Anatomical orientation, tooth segmentation, roots, and bite registration are not
            inferred.
          </p>
          {importError && (
            <p className="inline-error" role="alert">
              {importError}
            </p>
          )}
          <div className="dialog-actions">
            <button className="button light" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={!files.length || busy}
              onClick={importFiles}
            >
              {busy ? 'Importing…' : 'Import models'}
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'calibrate' && (
        <Dialog title={`Reference axes · tooth ${selected}`} onClose={() => setModal(null)}>
          <p>
            Named movements require the tooth’s original anatomical axes. The occlusal axis points
            from the root toward the biting surface; intrusion moves in the opposite direction.
          </p>
          {actualCalibration && (
            <div className="frame-readout">
              {Object.entries(actualCalibration).map(([key, vector]) => (
                <div key={key}>
                  <span>{key}</span>
                  <code>[{vector.map(n => n.toFixed(3)).join(', ')}]</code>
                </div>
              ))}
            </div>
          )}
          <p className="form-note">
            These selectors assign an axis-aligned frame for this tooth. They do not rotate the
            mesh. Use world movement for tilted imports until an appropriate frame is assigned.
            Existing transformations are kept.
          </p>
          <div className="calibration-fields">
            {[
              { label: 'Buccal', value: bAxis, set: setBAxis },
              { label: 'Mesial', value: mAxis, set: setMAxis },
              { label: 'Occlusal', value: oAxis, set: setOAxis },
            ].map(f => (
              <label className="form-label" key={f.label}>
                {f.label}
                <select value={f.value} onChange={e => f.set(e.target.value)}>
                  {Object.keys(axisVectors).map(a => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <button className="button light" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={new Set([bAxis[1], mAxis[1], oAxis[1]]).size !== 3}
              onClick={() => {
                setModel({
                  ...model,
                  teeth: model.teeth.map(t =>
                    t.id === selected
                      ? {
                          ...t,
                          calibrated: true,
                          buccal: axisVectors[bAxis],
                          mesial: axisVectors[mAxis],
                          occlusal: axisVectors[oAxis],
                          bracketPosition: undefined,
                        }
                      : t,
                  ),
                });
                setModal(null);
                note(
                  `Tooth ${selected} reference axes assigned. Bracket placement is estimated from the buccal surface.`,
                );
              }}
            >
              Assign axes
              <Check size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'settings' && (
        <Dialog title="Workspace settings" onClose={() => setModal(null)}>
          <div className="settings-file-actions">
            <button
              className="button light"
              onClick={() => {
                setModal(null);
                caseInput.current?.click();
              }}
            >
              <Upload size={15} />
              Open saved case
            </button>
            <button
              className="button light"
              onClick={() => {
                setImportError('');
                setModal('import');
              }}
            >
              Import STL models
            </button>
          </div>
          <h3>Command interpretation</h3>
          <p>
            Try Mode commands work locally in English without a key. The optional AI service
            interprets flexible wording. Every action is independently validated before the geometry
            engine runs.
          </p>
          <Toggle
            label="Use AI command service"
            value={aiEnabled}
            onChange={() => {
              if (!aiEnabled && !apiUrl) {
                note('Connect the service below first.', true);
                return;
              }
              setAiEnabled(!aiEnabled);
            }}
          />
          <label className="form-label">
            Service URL
            <input value={apiDraft} onChange={e => setApiDraft(e.target.value)} />
          </label>
          <button
            className="button light"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const url = new URL(apiDraft);
                if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
                  throw new Error('Use an http or https URL.');
                const base = url.href.replace(/\/$/, '');
                const response = await fetch(`${base}/health`, {
                  signal: AbortSignal.timeout(5000),
                });
                if (!response.ok) throw new Error('Service unavailable.');
                const result = await response.json();
                if (!result.ai_enabled)
                  throw new Error('Service is running but OPENAI_API_KEY is not configured.');
                teaching.setConfig({
                  url: base,
                  enabled: true,
                  provider: result.provider || 'Configured AI provider',
                });
                note(
                  'AI service connected. Clear validated classroom and geometric commands execute immediately; manual previews retain Apply and Cancel. Undo restores the whole request.',
                );
              } catch (e) {
                note(errorText(e), true);
              } finally {
                setBusy(false);
              }
            }}
          >
            Connect service
            <ArrowUpRight size={15} />
          </button>
          <p className="form-note">
            Command text and minimal scene references go to your configured AI provider. Meshes
            remain local. Voice uses the browser’s speech service. API keys belong only in the
            backend environment.
          </p>
          <p className={statusError ? 'inline-error' : 'form-note'}>{status}</p>
          <div className="divider" />
          <button className="text-button" onClick={() => setModal('demo')}>
            <RotateCcw size={16} />
            Reload synthetic study
          </button>
          <button className="text-button" onClick={() => setModal('guide')}>
            <CircleHelp size={16} />
            Movement guide and sources
          </button>
        </Dialog>
      )}
      {modal === 'arrangement' && dentalArrangement && (
        <Dialog title={dentalArrangement.title} onClose={() => setModal(null)}>
          <p>{dentalArrangement.description}</p>
          <ul className="arrangement-assumptions">
            {dentalArrangement.assumptions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="form-note">Source-linked draft · educator review pending.</p>
          <ul className="source-links">
            {dentalArrangement.sources.map(item => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
      {modal === 'demo' && (
        <Dialog title="Reload the synthetic study?" onClose={() => setModal(null)}>
          <p>
            This replaces the current case, movements, and checkpoints. Save your current case first
            to keep it.
          </p>
          <div className="dialog-actions">
            <button className="button light" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="button primary" onClick={() => load(createDemo())}>
              Reload study
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'guide' && (
        <Dialog title="Orthodontic movement guide" onClose={() => setModal(null)}>
          <p>
            Try Mode is a free teaching workspace. Clear validated spoken or typed instructions
            execute immediately; manual controls offer a preview with Apply or Discard. Per-tooth
            anatomical movements and rigid segment movements are different controls.
          </p>
          <div className="movement-guide-table">
            <div>
              <strong>Translation</strong>
              <span>
                Buccal/lingual, mesial/distal, and intrusion/extrusion. Intrusion follows the
                rootward direction; upper and lower signs differ.
              </span>
            </div>
            <div>
              <strong>Tip</strong>
              <span>Rotation about the buccolingual axis.</span>
            </div>
            <div>
              <strong>Torque</strong>
              <span>
                Rotation about the mesiodistal axis. This geometric preview does not predict
                isolated root movement.
              </span>
            </div>
            <div>
              <strong>Axial rotation</strong>
              <span>Rotation about the root-to-occlusal axis.</span>
            </div>
          </div>
          <p className="form-note">
            Positive angles use the right-hand rule about the stored positive axis. Rotations use
            fixed original reference axes and the crown’s bounding-box centre, not a physiological
            centre of resistance. “Expand” means buccal displacement per tooth, not a requested
            total arch-width increase. “Retract” means lingual displacement in this editor.
          </p>
          <h3>Voice in a lecture</h3>
          <p className="form-note">
            Hold Space outside an input, or hold the microphone button, and release to run your
            instruction. Try Mode commands run locally in English. The optional AI service
            translates flexible wording into the same bounded classroom, geometry and appliance
            actions. The application validates the complete request and calculates supported
            mechanics independently. Stop or Escape cancels pending work. “Undo that” restores the
            whole request. Explanations are spoken only when you ask.
          </p>
          <h3>Build an appliance experiment</h3>
          <p className="form-note">
            Point to a crown, root or gingiva while speaking. “Install brackets here” targets the
            associated tooth; a TAD uses the indicated point. A passive bracket and wire setup does
            not move teeth. Specify activation, tension or spring parameters, then say “show what
            happens”. Parameter replacements recalculate from the unchanged unloaded reference. Save
            named experiment stages to compare configurations.
          </p>
          <h3>Geometric objectives</h3>
          <p className="form-note">
            Gap closure requires two teeth and an explicit equal/first/second rule. Pair span
            changes the 3D distance between crown centres. The editable arch ellipse changes
            positions while preserving each tooth’s height and orientation. All calculate targets
            from the committed arrangement. Manual objectives show a preview; clear command requests
            apply only after validation.
          </p>
          <p className="form-note">
            Crown crossings are checked at bounded samples along the displayed path. Starting
            intersections are reported separately. Roots, bone, enclosed volumes, and crossings
            between samples are not assessed. Unrestricted illustration can bypass collision
            constraints, but never tooth locks.
          </p>
          <h3>Try a command</h3>
          <div className="example-commands">
            {EXAMPLES.map(s => (
              <button
                key={s}
                onClick={() => {
                  setCommand(s);
                  setModal(null);
                  setTimeout(() => commandInput.current?.focus(), 0);
                }}
              >
                <code>{s}</code>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <p className="form-note">
            Combine up to eight supported actions with “and” or “then”; an explicit list is written
            “teeth 11,12,21,22”. For a single “rotate it”, the legacy default is world Y. For a
            group “rotate teeth …”, the default is each tooth’s long axis. Use “around x/y/z” for
            world rotations.
          </p>
          <h3>What the display means</h3>
          <p className="form-note">
            Crowns and roots in the demo are synthetic Blender teaching meshes, with a built-in
            basic model as a loading fallback. Brackets and wires are schematic. The optional
            mechanics experiment calculates a reduced initial elastic response with declared virtual
            support, wire, elastic and expander assumptions. Hardware curves and force-arrow sizes
            remain schematic. No biological progression, patient-specific bone limits, clinical
            treatment feasibility or aligner production is computed. Numeric input limits are
            software limits, not safe clinical movement ranges.
          </p>
          <h3>Evidence and reading</h3>
          <ul className="source-links">
            <li>
              <a
                href="https://link.springer.com/article/10.1186/s40510-022-00402-x"
                target="_blank"
                rel="noreferrer"
              >
                Tip, torque and rotation: digital measurement study
              </a>
            </li>
            <li>
              <a
                href="https://aaoinfo.org/resources/glossary-of-orthodontic-terms/"
                target="_blank"
                rel="noreferrer"
              >
                American Association of Orthodontists glossary
              </a>
            </li>
            <li>
              <a
                href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9995625/"
                target="_blank"
                rel="noreferrer"
              >
                Centre of resistance: evidence and limitations
              </a>
            </li>
          </ul>
          <div className="shortcut-list">
            <span>
              Focus command bar<kbd>/</kbd>
            </span>
            <span>
              Undo<kbd>Ctrl / ⌘ + Z</kbd>
            </span>
            <span>
              Redo<kbd>Ctrl / ⌘ + Shift + Z</kbd>
            </span>
          </div>
        </Dialog>
      )}
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
