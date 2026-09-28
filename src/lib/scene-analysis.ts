import { emptyPose, type Transforms, type Vec3 } from './model';
import type {
  ForceLaw,
  MechanicsEndpoint,
  MechanicsExperiment,
  WireSection,
} from './mechanics/types';
import { SUPPORT_PRESETS } from './mechanics/presets';

export type SceneAnalysisContext = {
  synthetic: boolean;
  selectedIds: string[];
  visibleArch: 'upper' | 'lower' | 'both';
  teeth: { id: string; translationMm: Vec3; rotationDeg: Vec3; locked: boolean }[];
  layers: { roots: boolean; gingiva: boolean; bone: boolean };
  appliances: {
    support: {
      preset: keyof typeof SUPPORT_PRESETS;
      translationNPerMm: number;
      rotationNmmPerRad: number;
    } | null;
    fixedTeeth: string[];
    bracketTeeth: string[];
    bracketPlacements?: {
      tooth: string;
      slotLocal: Vec3;
      referenceSlotLocal: Vec3;
      angleDeg: number;
    }[];
    wires: {
      teeth: string[];
      material: 'stainless-steel' | 'beta-titanium';
      section: WireSection;
      expansionMm: number;
      torqueDeg: number;
    }[];
    tads: { id: string; position: Vec3 }[];
    elastics: { from: MechanicsEndpoint; to: MechanicsEndpoint; law: ForceLaw }[];
    expanders: {
      left: string[];
      right: string[];
      activationMm: number;
      stiffnessNPerMm: number;
      palateStiffnessNPerMm: number | null;
    }[];
    tadCount: number;
    elasticCount: number;
    expanderCount: number;
  };
  result: {
    maxDisplacementMm: number;
    maxRotationDeg: number;
    assumptions: string[];
    warnings: string[];
  } | null;
  lesson: { title: string; explanation: string } | null;
};
export type SceneAnalysis = {
  observations: string;
  explanation: string;
  limitations: string;
  studentQuestion: string;
  model: string;
};

/** Explicit fact projection: never serialize meshes, case names or patient metadata. */
export function sceneAnalysisContext(input: {
  synthetic: boolean;
  ids: string[];
  transforms: Transforms;
  selectedIds: string[];
  arch: SceneAnalysisContext['visibleArch'];
  roots: boolean;
  gums: boolean;
  bone: boolean;
  lockedIds?: string[];
  mechanics?: MechanicsExperiment | null;
  revealResult?: boolean;
  lesson?: SceneAnalysisContext['lesson'];
}): SceneAnalysisContext {
  const config = input.mechanics?.config,
    calculation = input.mechanics?.result,
    support = config ? SUPPORT_PRESETS[config.support] : null;
  const anchorIds = new Map(config?.tads.map((tad, i) => [tad.id, `tad-${i + 1}`]));
  const endpoint = (value: MechanicsEndpoint): MechanicsEndpoint =>
    value.kind === 'tooth'
      ? { kind: 'tooth', tooth: value.tooth, local: [...value.local] }
      : { kind: 'tad', id: anchorIds.get(value.id)! };
  const result =
    calculation &&
    input.synthetic &&
    input.revealResult !== false &&
    calculation.revision === input.mechanics?.revision
      ? calculation
      : null;
  return {
    synthetic: input.synthetic,
    selectedIds: [...input.selectedIds],
    visibleArch: input.arch,
    teeth: input.ids.map(id => {
      const pose = input.transforms[id] || emptyPose();
      return {
        id,
        translationMm: [...pose.translation],
        rotationDeg: [...pose.rotation],
        locked: input.lockedIds?.includes(id) ?? false,
      };
    }),
    layers: { roots: input.roots, gingiva: input.gums, bone: input.bone },
    appliances: {
      support:
        config && support
          ? {
              preset: config.support,
              translationNPerMm: support.translationNPerMm,
              rotationNmmPerRad: support.rotationNmmPerRad,
            }
          : null,
      fixedTeeth: [...(config?.fixedTeeth || [])],
      bracketTeeth: Object.keys(config?.brackets || {}),
      bracketPlacements: Object.entries(config?.brackets || {}).map(([tooth, local]) => ({
        tooth,
        slotLocal: [...local] as Vec3,
        referenceSlotLocal: [
          ...input.mechanics!.reference.teeth.find(item => item.id === tooth)!.bracketLocal,
        ] as Vec3,
        angleDeg: config?.bracketAngles?.[tooth] ?? 0,
      })),
      wires:
        config?.wires.map(wire => ({
          teeth: [...wire.teeth],
          material: wire.material,
          section:
            wire.section.shape === 'round'
              ? { shape: 'round', diameterMm: wire.section.diameterMm }
              : {
                  shape: 'rectangle',
                  widthMm: wire.section.widthMm,
                  heightMm: wire.section.heightMm,
                },
          expansionMm: wire.expansionMm,
          torqueDeg: wire.torqueDeg,
        })) || [],
      tads:
        config?.tads.map(tad => ({ id: anchorIds.get(tad.id)!, position: [...tad.position] })) ||
        [],
      elastics:
        config?.elastics.map(elastic => ({
          from: endpoint(elastic.from),
          to: endpoint(elastic.to),
          law:
            elastic.law.kind === 'constant'
              ? { kind: 'constant', forceN: elastic.law.forceN }
              : {
                  kind: 'spring',
                  stiffnessNPerMm: elastic.law.stiffnessNPerMm,
                  restLengthMm: elastic.law.restLengthMm,
                },
        })) || [],
      expanders:
        config?.expanders.map(expander => ({
          left: [...expander.left],
          right: [...expander.right],
          activationMm: expander.activationMm,
          stiffnessNPerMm: expander.stiffnessNPerMm,
          palateStiffnessNPerMm: expander.palateStiffnessNPerMm ?? null,
        })) || [],
      tadCount: config?.tads.length || 0,
      elasticCount: config?.elastics.length || 0,
      expanderCount: config?.expanders.length || 0,
    },
    result: result
      ? {
          maxDisplacementMm: result.diagnostics.maxDisplacementMm,
          maxRotationDeg: result.diagnostics.maxRotationDeg,
          assumptions: [...result.diagnostics.assumptions],
          warnings: [...result.diagnostics.warnings],
        }
      : null,
    lesson: input.lesson
      ? { title: input.lesson.title, explanation: input.lesson.explanation }
      : null,
  };
}

export function validateSceneAnalysis(value: unknown): SceneAnalysis {
  const names = ['observations', 'explanation', 'limitations', 'studentQuestion', 'model'] as const;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The AI explanation was incomplete. Try again.');
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).length !== names.length ||
    names.some(
      name =>
        typeof result[name] !== 'string' ||
        !(result[name] as string).trim() ||
        (result[name] as string).length > 5000,
    )
  )
    throw new Error('The AI explanation was incomplete. Try again.');
  return result as SceneAnalysis;
}
