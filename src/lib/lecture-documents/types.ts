import type { ApplianceDisplay } from '../appliance-display';
import type { AttachmentSpec } from '../attachments';
import type { MechanicsExperiment } from '../mechanics/types';
import type { Transforms } from '../model';
import type { LectureSetup } from '../planning';
import type { ToothStudyView } from '../tooth-study/types';

export type LectureSource = { kind: 'reference' } | { kind: 'case' | 'arrangement'; id: string };

/** A displayed pose, not an inferred movement path or a serialized Three.js model. */
export type LectureScene = {
  source: LectureSource;
  transforms: Transforms;
  setup: LectureSetup;
  roots: boolean;
  braces: boolean;
  attachments: boolean;
  bracketStyle: 'metal' | 'ceramic';
  ligatureColor: string;
  applianceDisplay: ApplianceDisplay;
  isolated: boolean;
  toothStudy?: { tooth: string; view: ToothStudyView };
  attachmentsByTooth?: Record<string, AttachmentSpec>;
  mechanics?: MechanicsExperiment;
};

export type LectureStep = {
  id: string;
  title: string;
  notes: string;
  question: string;
  answer: string;
  scene: LectureScene;
  demo?: { caseId: string; variantId: string };
};

export type LectureDocument = {
  version: 1;
  id: string;
  title: string;
  updatedAt: string;
  steps: LectureStep[];
};

export type LectureStorage = Pick<Storage, 'getItem' | 'setItem'>;
