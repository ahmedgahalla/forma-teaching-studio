import type { DentalCase } from '@/lib/geometry';
import type { Transforms } from '@/lib/model';
import type { AnatomyViewState } from '@/lib/teaching-anatomy';
import type { ApplianceDisplay } from '@/lib/appliance-display';
import type { TeachingCaseId } from '@/lib/teaching-cases';
import type { Plan, Checkpoint } from '@/lib/planning';
import type { TryState } from '@/lib/try-mode';
import type { MechanicsExperiment } from '@/lib/mechanics';
import type { MechanicsFocus, PointedReference } from '@/lib/mechanics-commands';
import type { WorkflowTransfer } from '@/lib/workflow-transfer';
import type { Landmark } from '@/lib/appliances';
import type { WirePreset } from '../mechanics/MechanicsPanel';
import type { ArchView, ViewName, ViewerCamera } from '../viewer/Viewer';

/** A workflow setup transferred into the case workspace, with the way back. */
export type WorkflowOriginState = { setup: WorkflowTransfer; snapshot: unknown } | null;

/** Display state captured before a lesson step so the step can be rewound. */
export type LessonSnapshot = {
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

/** An active prepared teaching case and, while exploring, the way back to it. */
export type PreparedScenario = {
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

/**
 * The complete case-workspace state captured for whole-request undo and
 * "restore my workspace". Restoring one of these is the inverse of capture.
 */
export type ClassroomSnapshot = {
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
  workflowOrigin: WorkflowOriginState;
  returnWorkspace: ClassroomSnapshot | null;
  sandbox: TryState;
  comparisonName: string | null;
  traces: boolean;
  curveVisible: boolean;
  reverse: boolean;
  lesson: LessonSnapshot;
  history: Plan;
  checkpoints: Checkpoint[];
  speed: 0.5 | 1 | 2;
  anatomy: AnatomyViewState;
  camera: ViewerCamera | null;
  lessonId: string;
  lessonStep: number;
  lessonSnapshots: LessonSnapshot[];
  bracketStyle: 'metal' | 'ceramic';
  ligatureColor: string;
  lecture: boolean;
  isolated: boolean;
  tool: 'orbit' | 'translate' | 'rotate';
  measureTo: string;
  measureMode: boolean;
  landmarks: Landmark[];
};
