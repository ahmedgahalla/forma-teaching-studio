import type { Transforms, Vec3 } from '../model';

export type WireMaterial = 'stainless-steel' | 'beta-titanium';
export type WireSection = { shape: 'round'; diameterMm: number } | { shape: 'rectangle'; widthMm: number; heightMm: number };
export type MechanicsEndpoint = { kind: 'tooth'; tooth: string; local: Vec3 } | { kind: 'tad'; id: string };
export type ForceLaw = { kind: 'constant'; forceN: number } | { kind: 'spring'; stiffnessNPerMm: number; restLengthMm: number };
export type SupportPreset = 'standard' | 'soft' | 'firm';
export type MechanicsAction =
  | { type: 'brackets'; teeth: string[]; installed: boolean }
  | { type: 'bracket-position'; tooth: string; local: Vec3 }
  | { type: 'wire'; id: string; teeth: string[]; material: WireMaterial; section: WireSection; expansionMm?: number; torqueDeg?: number }
  | { type: 'wire-material'; id: string; material: WireMaterial }
  | { type: 'wire-section'; id: string; section: WireSection }
  | { type: 'wire-activation'; id: string; expansionMm: number; torqueDeg?: number }
  | { type: 'tad'; id: string; position: Vec3 }
  | { type: 'elastic'; id: string; from: MechanicsEndpoint; to: MechanicsEndpoint; law: ForceLaw }
  | { type: 'expander'; id: string; left: string[]; right: string[]; activationMm: number; stiffnessNPerMm: number; palateStiffnessNPerMm?: number }
  | { type: 'remove'; kind: 'wire' | 'tad' | 'elastic' | 'expander'; id: string }
  | { type: 'support'; preset: SupportPreset }
  | { type: 'anchor'; teeth: string[]; fixed: boolean }
  | { type: 'save-stage'; label: string }
  | { type: 'stage'; index: number }
  | { type: 'compare-without-tad'; id: string }
  | { type: 'solve' | 'explain' | 'apply' | 'discard' };

/** All positions are millimetres in the fixed case frame; no meshes cross the worker boundary. */
export type MechanicsTooth = {
  id: string; position: Vec3; rotation: Vec3; buccal: Vec3; occlusal: Vec3;
  /** Slot centre in tooth-local mm, not the authored bracket body/base origin. */
  bracketLocal: Vec3; supportLocal: Vec3; rootLengthMm: number;
};
export type MechanicsWire = { id: string; teeth: string[]; material: WireMaterial; section: WireSection; expansionMm: number; torqueDeg: number };
export type MechanicsTad = { id: string; position: Vec3 };
export type MechanicsElastic = { id: string; from: MechanicsEndpoint; to: MechanicsEndpoint; law: ForceLaw };
export type MechanicsExpander = { id: string; left: string[]; right: string[]; activationMm: number; stiffnessNPerMm: number; palateStiffnessNPerMm?: number };
export type MechanicsConfig = {
  /** Installed wire-slot centres in tooth-local mm. */
  brackets: Record<string, Vec3>; wires: MechanicsWire[]; tads: MechanicsTad[]; elastics: MechanicsElastic[];
  expanders: MechanicsExpander[]; support: SupportPreset; fixedTeeth: string[];
};
export type MechanicsStage = { label: string; config: MechanicsConfig };
export type MechanicsExperiment = {
  version: 1; revision: number; reference: { teeth: MechanicsTooth[]; transforms: Transforms };
  config: MechanicsConfig; stages: MechanicsStage[]; stageIndex: number;
  result: MechanicsResult | null; applied: MechanicsResult | null; comparison: MechanicsResult | null;
};
export type ToothMechanicsResult = {
  id: string; displacementMm: Vec3; rotationRad: Vec3; forceN: Vec3; momentNmm: Vec3;
  supportReactionN: Vec3; supportReactionNmm: Vec3; fixed: boolean;
};
export type MechanicsLine = { id: string; from: Vec3; to: Vec3; forceN: number; direction: Vec3 };
export type MechanicsResult = {
  revision: number; transforms: Transforms; teeth: ToothMechanicsResult[];
  wires: { id: string; points: Vec3[]; maxStrain: number }[];
  elastics: MechanicsLine[]; expanders: (MechanicsLine & { dentalOpeningMm: number; skeletalOpeningMm: number; applianceDeflectionMm: number })[];
  tads: { id: string; position: Vec3; reactionN: Vec3 }[];
  diagnostics: { iterations: number; residual: number; maxDisplacementMm: number; maxRotationDeg: number; assumptions: string[]; warnings: string[] };
};
export type MechanicsWorkerRequest = { requestId: number; experiment: MechanicsExperiment };
export type MechanicsWorkerResponse = { requestId: number; result: MechanicsResult } | { requestId: number; error: string };
