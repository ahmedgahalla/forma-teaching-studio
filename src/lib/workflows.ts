import {
  addMovement,
  addOrthodonticRotation,
  anatomicalFrame,
  emptyPose,
  resolveMovement,
  type Tooth,
  type Transforms,
  type Vec3,
} from './model';
import { interpolateTransforms } from './planning';

export type WorkflowId = 'fixed-braces' | 'palatal-expansion' | 'archwire-expansion';
export type WorkflowPhase =
  'assessment' | 'brackets' | 'wire' | 'forces' | 'movement' | 'retention';
export type WorkflowStep = {
  title: string;
  action: string;
  explanation: string;
  observe: string;
  question: string;
  answer: string;
  phase: WorkflowPhase;
  view: 'front' | 'right' | 'occlusal' | 'perspective';
  arch: 'upper' | 'lower' | 'both';
  arrows: boolean;
  palate: boolean;
};
export type WorkflowDefinition = {
  id: WorkflowId;
  title: string;
  description: string;
  learningGoal: string;
  sources: { title: string; url: string }[];
  steps: WorkflowStep[];
  retentionStepIndex: number;
};
export type WorkflowFrame = {
  transforms: Transforms;
  appliance: 'braces' | 'palatal-expander' | 'archwire-expansion';
  phase: WorkflowPhase;
  progress: number;
  arrows: boolean;
  palate: boolean;
  selectedIds: string[];
};

const BRACES = {
  title: 'NHS: braces and fixed appliances',
  url: 'https://www.nhs.uk/tests-and-treatments/braces/',
};
const WIRES = {
  title: 'East Lancashire Hospitals: fixed braces',
  url: 'https://elht.nhs.uk/application/files/1615/2362/7703/Fixed_Braces.pdf',
};
const REMODELING = {
  title: 'Experimental evidence on periodontal cells and orthodontic remodeling',
  url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8376154/',
};
const RETENTION = {
  title: 'British Orthodontic Society: treatment and retention FAQs',
  url: 'https://bos.org.uk/patients/treatments/faqs/',
};
const EXPANDER = {
  title: 'North Cumbria NHS: rapid maxillary expansion',
  url: 'https://www.ncic.nhs.uk/patients-visitors/patient-information-leaflets/orthodontics-rapid-maxillary-expansion',
};
const EXPANSION_EFFECTS = {
  title: 'Human study of dentoalveolar tipping with palatal expanders',
  url: 'https://pubmed.ncbi.nlm.nih.gov/18276928/',
};
const MATURATION = {
  title: 'Midpalatal suture maturation assessment study',
  url: 'https://pubmed.ncbi.nlm.nih.gov/24182592/',
};
const ARCHWIRE = {
  title: 'Randomized trial of transverse changes with fixed brackets',
  url: 'https://pubmed.ncbi.nlm.nih.gov/23910199/',
};

/** Classroom storyboards, not a universal treatment sequence or a patient protocol. */
export const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'fixed-braces',
    title: 'Fixed braces: from assessment to retention',
    retentionStepIndex: 6,
    description:
      'Follow a synthetic crowded incisor setup through bracket placement, wire engagement, illustrated loading, alignment and passive retention.',
    learningGoal:
      'Follow how brackets, archwires and retention serve different purposes, and distinguish appliance mechanics from biological tooth movement.',
    sources: [BRACES, WIRES, REMODELING, RETENTION],
    steps: [
      {
        title: 'Assess the starting arrangement',
        action: 'Inspect the crowded incisors',
        phase: 'assessment',
        view: 'front',
        arch: 'both',
        arrows: false,
        palate: false,
        explanation:
          'The upper incisors begin in authored irregular positions. A real assessment also considers records, bite, periodontal health and root position; this synthetic model cannot establish those findings.',
        observe:
          'Compare the rotated incisors with the neighboring crowns before any appliance is added.',
        question: 'Does a crowded-looking model alone define a treatment plan?',
        answer:
          'No. This display illustrates geometry; diagnosis and planning require patient-specific assessment and records.',
      },
      {
        title: 'Bond the brackets',
        action: 'Add the fixed attachments',
        phase: 'brackets',
        view: 'perspective',
        arch: 'upper',
        arrows: false,
        palate: false,
        explanation:
          'Brackets provide attachment points on the crowns. Their placement helps determine how an engaged wire transfers loads. Showing brackets does not itself change tooth positions.',
        observe: 'The teeth remain in the same irregular setup while the bracket bodies appear.',
        question: 'Which component connects the wire to each crown?',
        answer:
          'The bracket provides the connection; its slot and the method of securing the wire participate in load transfer.',
      },
      {
        title: 'Engage an archwire',
        action: 'Connect the bracket slots',
        phase: 'wire',
        view: 'occlusal',
        arch: 'upper',
        arrows: false,
        palate: false,
        explanation:
          'An archwire is engaged and secured in the brackets. Flexible wires are commonly used during early alignment, with later choices adapted to the objectives. The displayed wire is schematic, without a stiffness model.',
        observe:
          'Trace the wire between bracket slots and distinguish it from the ligatures that hold it in place.',
        question: 'Do ligatures and the archwire have identical roles?',
        answer:
          'No. Ligatures secure the wire; the engaged wire participates in the force system. This scene does not calculate either component’s mechanics.',
      },
      {
        title: 'Explain the loading concept',
        action: 'Show directional arrows',
        phase: 'forces',
        view: 'front',
        arch: 'upper',
        arrows: true,
        palate: false,
        explanation:
          'Loads from the appliance are transmitted through the tooth and periodontal tissues. Biological remodeling contributes to clinical tooth movement. The arrows indicate a teaching direction, not measured forces or a force prescription.',
        observe:
          'The crowns remain stationary in this explanation step; arrows are annotations, not an instantaneous movement.',
        question: 'Does an arrow’s size represent a force value?',
        answer:
          'No. Arrow geometry is illustrative, and neither force magnitude nor tissue response is simulated.',
      },
      {
        title: 'Demonstrate alignment',
        action: 'Play the geometric movement',
        phase: 'movement',
        view: 'perspective',
        arch: 'upper',
        arrows: true,
        palate: false,
        explanation:
          'The authored incisor translations and rotations interpolate toward the aligned reference. Clinical alignment and finishing use selected mechanics and monitoring; this smooth path does not predict feasibility, duration or biological response.',
        observe:
          'Watch translation and rotation together, and follow each bracket as its crown moves.',
        question: 'Does this animation predict how quickly teeth would align?',
        answer:
          'No. Progress is a display fraction without a treatment time scale or a clinical rate of movement.',
      },
      {
        title: 'Review the endpoint',
        action: 'Inspect the aligned arrangement',
        phase: 'retention',
        view: 'front',
        arch: 'both',
        arrows: false,
        palate: false,
        explanation:
          'The endpoint invites a finishing discussion: alignment alone does not establish satisfactory occlusion, roots or tissue health. Actual appliance removal follows a clinician’s review of the treatment objectives.',
        observe:
          'Compare the upper incisor arrangement with the opposing arch; the scene now holds the final geometry.',
        question: 'Is an aligned crown display sufficient proof that treatment is finished?',
        answer:
          'No. Finishing considers additional clinical objectives and records that this teaching model does not assess.',
      },
      {
        title: 'Explain retention',
        action: 'Hold the demonstrated result',
        phase: 'retention',
        view: 'occlusal',
        arch: 'upper',
        arrows: false,
        palate: false,
        explanation:
          'Retention is a passive holding phase, distinct from active movement. Teeth can change after treatment, so retention and follow-up remain important. The schematic lingual wire is one illustrative example, not a prescribed retainer design or wear schedule.',
        observe:
          'Locate the schematic wire behind the incisors. The geometry stays still rather than continuing to align indefinitely.',
        question: 'Why does active alignment not remove the need for retention?',
        answer:
          'Tissue adaptation and later changes can alter tooth positions; retention helps maintain the achieved arrangement.',
      },
    ],
  },
  {
    id: 'palatal-expansion',
    title: 'Palatal expansion: device and widening concept',
    retentionStepIndex: 5,
    description:
      'Explore a tooth-borne palatal expander, its posterior anchors, schematic transverse loading and passive stabilization.',
    learningGoal:
      'Trace a tooth-borne expander from its anchors to its central mechanism. Distinguish the maxillary widening concept from dental tipping.',
    sources: [EXPANDER, EXPANSION_EFFECTS, MATURATION, RETENTION],
    steps: [
      {
        title: 'Assess transverse relationships',
        action: 'Inspect the narrowed upper arrangement',
        phase: 'assessment',
        view: 'occlusal',
        arch: 'upper',
        arrows: false,
        palate: true,
        explanation:
          'The synthetic upper teeth begin closer to the midline. Real assessment distinguishes dental position from skeletal relationships and considers maturation; crown width alone does not demonstrate a skeletal diagnosis.',
        observe: 'Identify the midline and compare the two sides of the upper arch.',
        question: 'Can this crown model determine whether a palatal suture will respond?',
        answer:
          'No. Suture maturation and patient characteristics are not established by these synthetic crowns or by a single age cutoff.',
      },
      {
        title: 'Place posterior anchors',
        action: 'Show the anchoring components',
        phase: 'brackets',
        view: 'occlusal',
        arch: 'upper',
        arrows: false,
        palate: true,
        explanation:
          'A tooth-borne expander can connect to posterior teeth through bands or other attachments. The anchoring arrangement transfers loads from the appliance; it is distinct from ordinary brackets along an archwire.',
        observe: 'Locate the posterior anchor regions on both sides.',
        question: 'Why are the posterior attachments shown before activation?',
        answer:
          'They provide the appliance’s connection to the teeth and help explain how loads are transmitted.',
      },
      {
        title: 'Fit the palatal framework',
        action: 'Connect the central expansion device',
        phase: 'wire',
        view: 'occlusal',
        arch: 'upper',
        arrows: false,
        palate: true,
        explanation:
          'A central screw and palatal framework connect the sides in this schematic tooth-borne device. Installing the appliance is a separate step from activation and does not instantly widen the model.',
        observe: 'Trace the framework from the central body to the posterior anchors.',
        question: 'Is this the same appliance as a wider archwire?',
        answer:
          'No. The palatal device has a transverse framework and expansion mechanism; an archwire links brackets along the dental arch.',
      },
      {
        title: 'Illustrate transverse loading',
        action: 'Activate the teaching arrows',
        phase: 'forces',
        view: 'occlusal',
        arch: 'upper',
        arrows: true,
        palate: true,
        explanation:
          'Outward arrows introduce the activation concept. Real activation is prescribed and monitored for the individual. No displayed screw motion, arrow or animation fraction specifies turns, force, frequency or duration.',
        observe:
          'The arrows oppose each other across the midline while the starting teeth remain stationary.',
        question: 'Can a viewer convert this control into an activation instruction?',
        answer:
          'No. The control only advances the classroom illustration and has no calibrated clinical relationship.',
      },
      {
        title: 'Show a widening concept',
        action: 'Play the idealized bilateral change',
        phase: 'movement',
        view: 'occlusal',
        arch: 'upper',
        arrows: true,
        palate: true,
        explanation:
          'The two sides shift horizontally to illustrate a maxillary widening concept. Actual expansion may include skeletal, alveolar and dental components with variable inclination and asymmetry. The split palate is a teaching symbol, not reconstructed bone or a predicted suture opening.',
        observe:
          'Compare the bilateral horizontal change with the dental inclination shown in the archwire workflow.',
        question: 'Does this symmetric animation describe every expansion outcome?',
        answer:
          'No. The symmetry and bodily shifts are authored teaching choices; real effects vary and can include dental tipping.',
      },
      {
        title: 'Stop active widening',
        action: 'Hold the expanded illustration',
        phase: 'retention',
        view: 'perspective',
        arch: 'upper',
        arrows: false,
        palate: true,
        explanation:
          'After active expansion, an expander may be left passive for stabilization. The teaching endpoint stops widening; it does not suggest that continued activation is desirable or that monitoring is complete.',
        observe: 'The device remains visible while the two sides stop separating.',
        question: 'Does an appliance still in place necessarily mean active expansion?',
        answer: 'No. An expander can remain in place passively during stabilization.',
      },
      {
        title: 'Discuss review and retention',
        action: 'Review what the model cannot decide',
        phase: 'retention',
        view: 'front',
        arch: 'both',
        arrows: false,
        palate: true,
        explanation:
          'Clinical review considers the bite, tooth inclination and supporting tissues. Subsequent alignment and retention depend on the individual objectives. This endpoint supplies neither an indication for treatment nor a retention schedule.',
        observe:
          'Use the opposing arch to discuss why transverse width is only one part of the overall assessment.',
        question: 'Does expansion automatically complete all orthodontic objectives?',
        answer:
          'No. Additional alignment, bite assessment, stabilization and follow-up may still be needed.',
      },
    ],
  },
  {
    id: 'archwire-expansion',
    title: 'Archwire expansion: dental changes',
    retentionStepIndex: 6,
    description:
      'Show how a selected archwire concept can change the dental arch through tooth displacement and inclination without depicting a split palate.',
    learningGoal:
      'Distinguish dentoalveolar changes from skeletal palatal expansion, and recognize that root position and supporting tissues constrain clinical decisions.',
    sources: [BRACES, WIRES, ARCHWIRE, REMODELING, RETENTION],
    steps: [
      {
        title: 'Inspect the dental arch',
        action: 'Compare crown position and inclination',
        phase: 'assessment',
        view: 'occlusal',
        arch: 'upper',
        arrows: false,
        palate: false,
        explanation:
          'The synthetic upper arch begins with lingually displaced teeth. A narrow crown arrangement can have dental and skeletal contributors; this workflow deliberately illustrates dental changes rather than diagnosing their cause.',
        observe: 'Identify posterior crown positions and the shape of the dental arch.',
        question: 'Does a narrow dental arch always require the same type of expansion?',
        answer:
          'No. Distinguishing the contributors is part of individual assessment, not something determined by this demonstration.',
      },
      {
        title: 'Attach the brackets',
        action: 'Provide connections to the crowns',
        phase: 'brackets',
        view: 'perspective',
        arch: 'upper',
        arrows: false,
        palate: false,
        explanation:
          'Brackets connect an archwire to the teeth. Their appearance or brand alone does not determine an expansion outcome; the selected mechanics and patient characteristics matter.',
        observe: 'There is no palatal screw or split framework in this scene.',
        question: 'Does a bracket label guarantee a particular transverse result?',
        answer:
          'No. A randomized comparison found no transverse advantage for one bracket system when comparable wire sequences were used.',
      },
      {
        title: 'Engage the arch form',
        action: 'Show the archwire connection',
        phase: 'wire',
        view: 'occlusal',
        arch: 'upper',
        arrows: false,
        palate: false,
        explanation:
          'A deliberately selected wire is engaged in the bracket slots. Its geometry and interaction with the teeth matter, but the displayed curve is not a mechanically calibrated wire or a prescription for a wider arch form.',
        observe: 'Follow the wire around the crowns rather than across a central palatal device.',
        question: 'What separates this scene from the palatal-expander workflow?',
        answer:
          'This scene concerns a bracket–archwire system and dental repositioning; it does not illustrate a palatal expansion mechanism.',
      },
      {
        title: 'Explain dental loading',
        action: 'Show buccal direction arrows',
        phase: 'forces',
        view: 'occlusal',
        arch: 'upper',
        arrows: true,
        palate: false,
        explanation:
          'Arrows point along the teeth’s buccal reference directions. In clinical movement, loads act through periodontal tissues and biological remodeling. These arrows have no force units and do not imply that supporting tissues can follow unlimited expansion.',
        observe:
          'The direction varies around the arch rather than being one uniform horizontal vector.',
        question: 'Why are all arrows not parallel?',
        answer: 'Each tooth has its own buccal direction in the curved dental arch.',
      },
      {
        title: 'Demonstrate dental expansion',
        action: 'Play displacement and crown inclination',
        phase: 'movement',
        view: 'perspective',
        arch: 'upper',
        arrows: true,
        palate: false,
        explanation:
          'The authored movement combines small buccal displacements with buccolingual crown inclination. The crown-centre pivot is geometric. There is no split palate, bone deformation or calculated root response.',
        observe:
          'Compare the inclined crowns with the horizontal bodily shifts in the palatal concept.',
        question: 'Does greater crown width prove skeletal widening?',
        answer:
          'No. Crown displacement and inclination can change a dental width measurement without demonstrating palatal suture widening.',
      },
      {
        title: 'Review the dental endpoint',
        action: 'Inspect inclination and bite context',
        phase: 'retention',
        view: 'front',
        arch: 'both',
        arrows: false,
        palate: false,
        explanation:
          'The demonstration now holds its final positions. Clinical review must consider roots, alveolar support and the bite; a wider crown display alone cannot establish a desirable or feasible result.',
        observe: 'Look beyond width and compare crown inclinations and the opposing arch.',
        question: 'Does this model show available alveolar bone around the roots?',
        answer:
          'No. The model has no patient-specific bone envelope and cannot establish biological movement limits.',
      },
      {
        title: 'Maintain the demonstrated position',
        action: 'Separate retention from active movement',
        phase: 'retention',
        view: 'occlusal',
        arch: 'upper',
        arrows: false,
        palate: false,
        explanation:
          'Retention aims to maintain the achieved tooth arrangement after active treatment. The held geometry explains that role without selecting a retainer or prescribing wear time.',
        observe: 'The teeth stop moving; there is no automatic ongoing widening during retention.',
        question: 'Is retention another phase of active expansion?',
        answer:
          'No. Its purpose is to maintain the achieved arrangement, with follow-up appropriate to the person.',
      },
    ],
  },
];

const INCISORS = ['11', '12', '21', '22'];
const UPPER = ['11', '12', '13', '14', '15', '16', '17', '21', '22', '23', '24', '25', '26', '27'];
const CROWDED: Record<string, { translation: Vec3; angle: number }> = {
  '11': { translation: [0.9, 0, 1.1], angle: -12 },
  '12': { translation: [1.2, 0, -1.3], angle: 16 },
  '21': { translation: [-0.9, 0, -0.9], angle: 10 },
  '22': { translation: [-1.2, 0, 1.4], angle: -15 },
};

/**
 * Direct, deterministic frames for a fresh synthetic demo supplied by the caller.
 * The constants below are visual choreography, not force, bone or treatment values.
 * No input geometry, poses or tooth metadata are changed, and lower teeth stay still.
 */
export function getWorkflowFrame(
  workflow: WorkflowDefinition | string,
  stepIndex: number,
  progress: number,
  teeth: readonly Tooth[],
): WorkflowFrame {
  const id = typeof workflow === 'string' ? workflow : workflow?.id;
  const definition = WORKFLOWS.find(item => item.id === id);
  if (!definition) throw new Error('Choose a supported teaching workflow.');
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= definition.steps.length)
    throw new Error('Choose a valid workflow step.');
  if (!Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new Error('Workflow progress must be between 0 and 1.');
  const available = new Map<string, Tooth>();
  for (const tooth of teeth) {
    if (
      !/^[1-4][1-8]$/.test(tooth.id) ||
      available.has(tooth.id) ||
      !Array.isArray(tooth.position) ||
      tooth.position.length !== 3 ||
      !tooth.position.every(Number.isFinite)
    )
      throw new Error('Invalid workflow tooth metadata.');
    available.set(tooth.id, tooth);
  }
  const required = definition.id === 'fixed-braces' ? INCISORS : UPPER;
  for (const toothId of required) {
    const tooth = available.get(toothId);
    if (!tooth) throw new Error(`The synthetic workflow requires tooth ${toothId}.`);
    anatomicalFrame(tooth);
  }
  const initial: Transforms = {},
    final: Transforms = {};
  if (definition.id === 'fixed-braces') {
    for (const toothId of INCISORS) {
      const tooth = available.get(toothId)!,
        authored = CROWDED[toothId];
      initial[toothId] = addOrthodonticRotation(
        addMovement(emptyPose(), authored.translation),
        tooth,
        'rotate',
        authored.angle,
      );
    }
  } else if (definition.id === 'palatal-expansion') {
    for (const toothId of UPPER) {
      const side = toothId[0] === '1' ? -1 : 1;
      initial[toothId] = addMovement(emptyPose(), [-side * 1.4, 0, 0]);
      final[toothId] = addMovement(emptyPose(), [side * 0.8, 0, 0]);
    }
  } else {
    for (const toothId of UPPER) {
      const tooth = available.get(toothId)!,
        posterior = Number(toothId[1]) >= 4;
      initial[toothId] = addMovement(
        emptyPose(),
        resolveMovement(tooth, 'lingual', posterior ? 0.7 : 0.25),
      );
      const moved = addMovement(
        emptyPose(),
        resolveMovement(tooth, 'buccal', posterior ? 0.55 : 0.2),
      );
      // Buccolingual inclination is about the mesiodistal axis, not the model's named mesiodistal "tip" operation.
      final[toothId] = addOrthodonticRotation(
        moved,
        tooth,
        'torque',
        (toothId[0] === '1' ? -1 : 1) * (posterior ? 4 : 2),
      );
    }
  }
  const step = definition.steps[stepIndex];
  const fraction = step.phase === 'movement' ? progress : step.phase === 'retention' ? 1 : 0;
  return {
    transforms: interpolateTransforms(initial, final, fraction),
    appliance:
      definition.id === 'fixed-braces'
        ? 'braces'
        : definition.id === 'palatal-expansion'
          ? 'palatal-expander'
          : 'archwire-expansion',
    phase: step.phase,
    progress: fraction,
    arrows: step.arrows,
    palate: step.palate,
    selectedIds:
      definition.id === 'fixed-braces'
        ? [...INCISORS]
        : definition.id === 'palatal-expansion'
          ? [...UPPER]
          : UPPER.filter(toothId => Number(toothId[1]) >= 4),
  };
}
