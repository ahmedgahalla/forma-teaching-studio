/**
 * The surface CaseStudio hands to its extracted view components. State comes
 * from the feature hooks wholesale; refs, derived values and handlers are
 * listed explicitly. Components receive it as the `api` prop and should read
 * only what they render — narrowing a component to its own props type is the
 * follow-up once the split has settled.
 */
import type { RefObject } from 'react';
import type {
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
} from './state';
import type { useTeaching } from '../TeachingController';
import type { ViewerCamera, ViewerHandle, ViewName } from '../Viewer';
import type { TryPanelProps } from '../TryPanel';
import type { DentalCase } from '@/lib/geometry';
import type { CaseSession } from '@/lib/planning';
import type { anatomicalFrame, Pose, Transforms, Vec3 } from '@/lib/model';
import type { archSpans } from '@/lib/analysis';
import type { AttachmentSpec } from '@/lib/attachments';
import type { Command } from '@/lib/commands';
import type { LESSONS, TeachingAction } from '@/lib/lecture';
import type { getTeachingCase } from '@/lib/teaching-cases';
import type { casePathAudit } from '@/lib/case-path-audit';
import type { DENTAL_ARRANGEMENTS } from '@/lib/dental-arrangements';
import type { TryAction, TryState } from '@/lib/try-mode';
import type { MechanicsAction, MechanicsExperiment } from '@/lib/mechanics';
import type { PointedReference } from '@/lib/mechanics-commands';
import type { WorkflowTransfer } from '@/lib/workflow-transfer';
import type { ClassroomSnapshot, LessonSnapshot } from './types';

type StateBundle = ReturnType<typeof useMechanicsState> &
  ReturnType<typeof useCaseScenario> &
  ReturnType<typeof useLayoutState> &
  ReturnType<typeof useModelState> &
  ReturnType<typeof useDisplayState> &
  ReturnType<typeof useSelectionState> &
  ReturnType<typeof useStagePlayback> &
  ReturnType<typeof useMovementInputs> &
  ReturnType<typeof useCommandState> &
  ReturnType<typeof useCaseFiles> &
  ReturnType<typeof useMeasureState> &
  ReturnType<typeof useServiceDraft> &
  ReturnType<typeof useAttachmentState> &
  ReturnType<typeof useManipulationTool> &
  ReturnType<typeof useLessonState> &
  ReturnType<typeof useCalibrationInputs>;

export interface CaseStudioApi extends StateBundle {
  teaching: ReturnType<typeof useTeaching>;
  active: boolean;

  // refs
  viewer: RefObject<ViewerHandle | null>;
  caseInput: RefObject<HTMLInputElement | null>;
  commandInput: RefObject<HTMLInputElement | null>;
  pendingCamera: RefObject<ViewerCamera | null>;
  pendingView: RefObject<ViewName | null>;
  contactTimer: RefObject<ReturnType<typeof setTimeout> | null>;
  importAbort: RefObject<AbortController | null>;
  lessonSnapshots: RefObject<LessonSnapshot[]>;

  // derived values
  prepared: boolean;
  canRestoreWorkspace: boolean;
  caseDefinition: ReturnType<typeof getTeachingCase> | null;
  caseVariant: NonNullable<ReturnType<typeof getTeachingCase>>['variants'][number] | undefined;
  pathAudit: ReturnType<typeof casePathAudit> | null;
  caseStart: Transforms | undefined;
  dentalArrangement: (typeof DENTAL_ARRANGEMENTS)[number] | undefined;
  apiUrl: string;
  aiEnabled: boolean;
  tooth: DentalCase['teeth'][number];
  pose: Pose;
  ids: string[];
  calibrated: boolean;
  toothMoved: (id: string) => boolean;
  moved: number;
  tryActive: boolean;
  tryState: TryState;
  demonstration: TryState['pending'];
  curveArch: 'upper' | 'lower';
  geometricShown: Transforms;
  emptyExperiment: MechanicsExperiment | null;
  activeExperiment: MechanicsExperiment | null;
  actualShown: Transforms;
  shown: Transforms;
  physicalPoint: (PointedReference & { worldPoint?: Vec3 }) | null;
  mechanicsGhost: Transforms | undefined;
  curve: Vec3[] | undefined;
  currentLesson: (typeof LESSONS)[number] | undefined;
  spans: ReturnType<typeof archSpans>;
  actualCalibration: ReturnType<typeof anatomicalFrame> | null;
  tryPanelProps: TryPanelProps;

  // handlers
  note: (text: string, error?: boolean) => void;
  session: () => CaseSession;
  selectTooth: (id: string, additive?: boolean) => void;
  selectGroup: (scope: string) => void;
  save: () => void;
  applyTry: (action: TryAction) => boolean;
  sendTry: (action: TryAction, summary?: string) => void;
  toggleApplianceVisibility: () => void;
  apply: (c: Command) => boolean;
  load: (next: DentalCase, transforms?: Transforms, saved?: CaseSession) => void;
  importFiles: () => Promise<void>;
  importCase: (file?: File) => Promise<void>;
  setCamera: (next: ViewName) => void;
  addCheckpoint: () => void;
  scanContacts: () => void;
  openCalibration: () => void;
  csv: () => void;
  editAttachments: (spec: AttachmentSpec | null, targets?: string[]) => boolean;
  poseCommit: (id: string, next: Pose) => void;
  snapshot: () => LessonSnapshot;
  restoreSnapshot: (saved: LessonSnapshot) => void;
  advanceLesson: (action: 'next' | 'previous' | 'restart') => boolean;
  applyTeaching: (action: TeachingAction) => boolean;
  runTeaching: (text: string) => boolean;
  captureClassroom: () => ClassroomSnapshot;
  restoreClassroom: (saved: ClassroomSnapshot) => void;
  importWorkflowSetup: (setup: WorkflowTransfer, originSnapshot: unknown) => void;
  applyMechanics: (action: MechanicsAction, signal?: AbortSignal) => Promise<boolean>;
  sendMechanics: (actions: MechanicsAction[], summary: string) => void;
  chooseTool: (next: 'orbit' | 'translate' | 'rotate') => void;
  exportShown: () => void;
  exportSequence: () => Promise<void>;
  setAiEnabled: (enabled: boolean) => void;
  sceneInteraction: (event: { target: EventTarget }) => void;
  // analysis-tab derivations that stay host-computed for now
  pointDistance: number | null;
  distanceTo: number | null;
  highlightedContacts: string[];
  latestEdit: NonNullable<TryState['pending']>['edit'] | undefined;
  numericEdit: { amount: number; unit: 'mm' | '°' } | null;
  collision: NonNullable<TryState['pending']>['collision'] | undefined;
}
