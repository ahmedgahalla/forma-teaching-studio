import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import type { DentalCase, DentalTooth } from './geometry';
import { findSurfaceIntersections, type SurfaceIntersection } from './analysis';
import { createTeachingCase, type TeachingSource } from './teaching-cases';
import { anatomicalFrame, type Transforms, type Vec3 } from './model';

export type DentalArrangementId =
  | 'dental-class-i'
  | 'dental-class-ii-division-1'
  | 'dental-class-ii-division-2'
  | 'dental-class-iii';
export type DentalArrangementDefinition = {
  id: DentalArrangementId;
  title: string;
  description: string;
  assumptions: string[];
  sources: TeachingSource[];
};
export type DentalArrangement = {
  model: DentalCase;
  transforms: Transforms;
  selectedIds: string[];
  baselineCrossings: { crowns: SurfaceIntersection[]; roots: SurfaceIntersection[] };
  auditNote: string;
};

const SOURCES: TeachingSource[] = [
  {
    title: 'American Academy of Implant Dentistry: Angle classification and its divisions',
    url: 'https://www.aaid.com/joi-glossary-of-terms',
  },
  {
    title:
      'American Academy of Pediatric Dentistry: separate dental, occlusal and facial assessment',
    url: 'https://www.aapd.org/media/Policies_Guidelines/BP_DevelopDentition.pdf',
  },
];
const ASSUMPTIONS = [
  'An authored permanent-dentition example with 28 synthetic teeth, not a patient diagnosis. Dental Angle class does not establish a skeletal class or facial profile.',
  'First-molar sagittal guides use approximate surface samples of the upper mesiobuccal cusp and lower buccal groove. These are not clinician-marked landmarks or validated three-dimensional occlusal contacts.',
  'The 3 mm Class II/III guide offsets and incisor inclinations are display choices, not diagnostic thresholds. Gingiva follows each dental arch; no jaw, growth or tissue response is inferred.',
  'The initial crown and root surface crossings are reported. The audit does not establish tissue clearance, penetration depth, contained overlaps or a safe path between arrangements.',
];

export const DENTAL_ARRANGEMENTS: DentalArrangementDefinition[] = [
  {
    id: 'dental-class-i',
    title: 'Dental Class I',
    description:
      'The upper first-molar mesiobuccal cusp and lower buccal-groove guides align front to back. Class I can coexist with crowding or other malocclusion; this example keeps an orderly arch.',
    assumptions: [...ASSUMPTIONS],
    sources: [...SOURCES],
  },
  {
    id: 'dental-class-ii-division-1',
    title: 'Dental Class II · division 1',
    description:
      'The lower first molars are relatively distal, with labially inclined upper incisors and increased incisal projection in this example.',
    assumptions: [...ASSUMPTIONS],
    sources: [...SOURCES],
  },
  {
    id: 'dental-class-ii-division-2',
    title: 'Dental Class II · division 2',
    description:
      'The same distal lower-molar relationship is paired with palatally inclined upper central incisors. This example also shows more prominent lateral incisors and increased vertical incisor overlap.',
    assumptions: [
      ...ASSUMPTIONS,
      'Lateral-incisor prominence and vertical overlap illustrate this arrangement; their degree is not universal to every division 2 presentation.',
    ],
    sources: [...SOURCES],
  },
  {
    id: 'dental-class-iii',
    title: 'Dental Class III',
    description:
      'The lower first molars are relatively mesial. This example also displays reverse anterior projection without creating a prognathic skeletal model.',
    assumptions: [
      ...ASSUMPTIONS,
      'Reverse anterior projection is included for visual comparison; molar class alone does not specify every incisor relationship.',
    ],
    sources: [...SOURCES],
  },
];

/** Approximate occlusal surface guide in the tooth's original local case frame. */
function surfaceGuide(tooth: DentalTooth, mesialFraction: number, buccalFraction: number): Vector3 {
  const frame = anatomicalFrame(tooth),
    axes = [frame.mesial, frame.buccal, frame.occlusal].map(axis => new Vector3(...axis));
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity],
    point = new Vector3();
  const positions = tooth.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    axes.forEach((axis, j) => {
      const value = point.dot(axis);
      min[j] = Math.min(min[j], value);
      max[j] = Math.max(max[j], value);
    });
  }
  const origin = axes[0]
    .clone()
    .multiplyScalar((min[0] + max[0]) / 2 + ((max[0] - min[0]) / 2) * mesialFraction)
    .addScaledVector(axes[1], (min[1] + max[1]) / 2 + ((max[1] - min[1]) / 2) * buccalFraction)
    .addScaledVector(axes[2], max[2] + 5);
  const material = new MeshBasicMaterial({ side: DoubleSide });
  try {
    const hit = new Raycaster(origin, axes[2].clone().negate()).intersectObject(
      new Mesh(tooth.geometry, material),
    )[0];
    if (!hit) throw new Error(`Could not locate the synthetic molar guide on tooth ${tooth.id}.`);
    return hit.point.add(new Vector3(...tooth.position));
  } finally {
    material.dispose();
  }
}

/** Call with the original complete synthetic model, before teaching-case registration. */
export function createDentalArrangement(base: DentalCase, id: string): DentalArrangement {
  const definition = DENTAL_ARRANGEMENTS.find(item => item.id === id);
  if (!definition) throw new Error('Choose a supported dental Class I, II or III arrangement.');
  // Reuse the audited vertical registration without changing any crown/root buffers.
  const model = createTeachingCase(base, 'reference-occlusion').model;
  const lookup = new Map(model.teeth.map(tooth => [tooth.id, tooth]));
  const discrepancy =
    [
      ['16', '46'],
      ['26', '36'],
    ].reduce(
      (sum, [upper, lower]) =>
        sum +
        surfaceGuide(lookup.get(upper)!, 0.42, 0.43).z -
        surfaceGuide(lookup.get(lower)!, 0, 0.43).z,
      0,
    ) / 2;
  const target = id === 'dental-class-i' ? 0 : id === 'dental-class-iii' ? -3 : 3;
  const upperShift = (target - discrepancy) / 2,
    lowerShift = -upperShift;
  const transforms: Transforms = Object.fromEntries(
    model.teeth.map(tooth => [
      tooth.id,
      {
        translation: [0, 0, Number(tooth.id[0]) < 3 ? upperShift : lowerShift] as Vec3,
        rotation: [0, 0, 0] as Vec3,
      },
    ]),
  );
  for (const gum of model.gums)
    if (gum.arch) gum.position[2] += gum.arch === 'upper' ? upperShift : lowerShift;
  if (id === 'dental-class-ii-division-1')
    for (const tooth of ['11', '12', '21', '22']) transforms[tooth].rotation[0] = -13;
  if (id === 'dental-class-ii-division-2') {
    for (const tooth of ['11', '21']) {
      transforms[tooth].rotation[0] = 18;
      transforms[tooth].translation[2] -= 1.2;
      transforms[tooth].translation[1] -= 0.8;
    }
    for (const tooth of ['12', '22']) {
      transforms[tooth].rotation[0] = -9;
      transforms[tooth].translation[2] += 0.35;
    }
    for (const tooth of ['31', '32', '41', '42']) transforms[tooth].translation[1] += 0.2;
  }
  model.name = `${definition.title} · synthetic teaching arrangement`;
  return {
    model,
    transforms,
    selectedIds: ['16', '46', '11', '41'],
    baselineCrossings: {
      crowns: findSurfaceIntersections(model, transforms),
      roots: findSurfaceIntersections(
        {
          ...model,
          teeth: model.teeth.map(tooth => ({ ...tooth, geometry: tooth.rootGeometry! })),
        },
        transforms,
      ),
    },
    auditNote:
      'Static triangle-surface audit of this supplied model and these poses. Crown and root crossing pairs are separate; gum, bone, enclosed volumes and paths are not assessed. Source-linked draft awaiting educator review.',
  };
}
