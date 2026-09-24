import type { DentalCase } from './geometry';
import { anatomicalFrame, type Pose, type Transforms, type Vec3 } from './model';
import { interpolateTransforms } from './planning';
import type { ApplianceDisplay } from './appliance-display';

export type TeachingCaseId = 'reference-occlusion' | 'movement-types' | 'crowding' | 'midline-diastema' | 'increased-overjet' | 'anterior-crossbite' | 'deepbite' | 'openbite' | 'posterior-crossbite' | 'anchorage-space-closure' | 'occlusal-finishing' | 'removable-retention';
export type TeachingSource = { title: string; url: string };
export type CaseDemonstration = {
  id: string; title: string; description: string; question: string; answer: string; aliases?: string[];
  assumptions: string[]; sources: TeachingSource[]; appliance: ApplianceDisplay;
  removableRetainer?: true;
  keyframes: { progress: number; label: string }[];
};
export type TeachingCaseDefinition = {
  id: TeachingCaseId; title: string; category: string; description: string; learningGoal: string; aliases?: string[];
  view: 'front' | 'right' | 'occlusal' | 'perspective'; arch: 'upper' | 'lower' | 'both';
  selectedIds: string[]; assumptions: string[]; sources: TeachingSource[]; variants: CaseDemonstration[];
};
export type PreparedTeachingCase = { model: DentalCase; transforms: Transforms; selectedIds: string[]; definition: TeachingCaseDefinition };

/** Shared metadata registration, applied once to original demo tooth AND gum origins. */
export const CASE_REFERENCE_SHIFT = 1.5;
export const CASE_REFERENCE_OFFSETS: Readonly<Record<'upper' | 'lower', readonly [number, number, number]>> = Object.freeze({ upper: Object.freeze([0, -CASE_REFERENCE_SHIFT, 0] as const), lower: Object.freeze([0, CASE_REFERENCE_SHIFT, 0] as const) });

const GLOSSARY = { title: 'American Association of Orthodontists: orthodontic terminology', url: 'https://aaoinfo.org/resources/glossary-of-orthodontic-terms/' };
const CROSSBITE = { title: 'American Association of Orthodontists: anterior and posterior crossbite', url: 'https://aaoinfo.org/whats-trending/what-is-a-crossbite/' };
const FINISHING = { title: 'American Board of Orthodontics: cast and radiograph evaluation', url: 'https://www.americanboardortho.com/media/vildsvsv/grading-system-casts-radiographs.pdf' };
const INTRUSION = { title: 'Clinical trial: dental changes with a maxillary intrusion arch', url: 'https://pubmed.ncbi.nlm.nih.gov/33378499/' };
const BITE_PLANE = { title: 'Randomized trial: bite-plane effects in growing deep-bite patients', url: 'https://pubmed.ncbi.nlm.nih.gov/39195127/' };
const ANCHORAGE = { title: 'Randomized trial: retraction and molar anchorage changes', url: 'https://pubmed.ncbi.nlm.nih.gov/36919990/' };
const RETENTION = { title: 'British Orthodontic Society: removable and bonded retainers', url: 'https://archive.bos.org.uk/BOS-Homepage/Orthodontics-for-Children-Teens/Treatment-brace-types/Retainers' };
const LIMITS = [
  'An authored adult-tooth geometry example, not a patient diagnosis or calculated treatment plan.',
  'Crown and root meshes move together about crown-centred pivots. Bone response, force, jaw growth and biological timing are not simulated.',
  'The reference arch registration is illustrative; cusp contacts, paths and endpoints are not validated clinical occlusion or collision-free treatment.',
];
const ALL = [1, 2, 3, 4].flatMap(q => Array.from({ length: 7 }, (_, i) => `${q}${i + 1}`));
const UI = ['11', '12', '21', '22'], LI = ['31', '32', '41', '42'];
const UA = ['11', '12', '13', '21', '22', '23'];
const UPPER = ALL.filter(id => /^[12]/.test(id));
const UP = ['14', '15', '16', '17', '24', '25', '26', '27'];
const LP = ['34', '35', '36', '37', '44', '45', '46', '47'];
const NONE: ApplianceDisplay = { preset: 'none', progress: 0, palate: false };
const BRACES: ApplianceDisplay = { preset: 'braces', progress: 0, palate: false };
const pose = (translation: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0]): Pose => ({ translation: [...translation], rotation: [...rotation] });
const translate = (ids: readonly string[], delta: Vec3): Transforms => Object.fromEntries(ids.map(id => [id, pose(delta)]));
type Frame = { progress: number; label: string; transforms: Transforms };
type Variant = Omit<CaseDemonstration, 'keyframes'> & { frames: Frame[] };
type Recipe = Omit<TeachingCaseDefinition, 'variants'> & { initial: Transforms; omitted?: string[]; demonstrations: Variant[] };
const frame = (progress: number, label: string, transforms: Transforms): Frame => ({ progress, label, transforms });
const variant = (id: string, title: string, description: string, question: string, answer: string, frames: Frame[], options: Partial<Pick<Variant, 'assumptions' | 'sources' | 'appliance' | 'removableRetainer'>> = {}): Variant => ({ id, title, description, question, answer, frames, assumptions: [], sources: [], appliance: BRACES, ...options });

const movementStart = { '11': pose([0, 0, 1.2]) };
const crowded: Transforms = {
  '11': pose([.8, 0, 1.2], [0, -14, 0]), '12': pose([.6, 0, -1.4], [0, 18, 0]),
  '21': pose([-.8, 0, -1], [0, 12, 0]), '22': pose([-.6, 0, 1.3], [0, -16, 0]),
  '31': pose([.4, 0, -.7], [0, 9, 0]), '41': pose([-.4, 0, .6], [0, -8, 0]),
};
const crowdedPositions = Object.fromEntries(Object.entries(crowded).map(([id, value]) => [id, pose([0, 0, 0], value.rotation)]));
const spaced: Transforms = Object.fromEntries(UPPER.map(id => [id, pose([id[0] === '1' ? -1.2 : 1.2, 0, 0])]));
const overjet = translate(UA, [0, 0, 3.2]);
const anteriorCrossbite = { '11': pose([0, 0, -3.5]) };
const deep = { ...translate(UI, [0, -2.2, 0]), ...translate(LI, [0, .8, 0]) };
const open = { ...translate(UI, [0, 1.6, 0]), ...translate(LI, [0, -1.6, 0]), ...translate(['13', '23'], [0, .7, 0]), ...translate(['33', '43'], [0, -.7, 0]) };
const posteriorCrossbite = Object.fromEntries(['24', '25', '26', '27'].map(id => [id, pose([-3.2, 0, 0], [0, 0, -7])]));
const extraction = translate(UA, [0, 0, 4]);
const finishing: Transforms = { '22': pose([0, .4, 0], [0, 8, 0]), '32': pose([.3, 0, 0], [0, -7, 0]), '16': pose([0, .7, 0], [0, 0, 6]), '46': pose([0, -.5, 0], [-5, 0, 0]) };

const RECIPES: Recipe[] = [
  {
    id: 'reference-occlusion', title: 'Reference occlusal relationships', category: 'Foundations', view: 'front', arch: 'both', selectedIds: ['11', '41'], initial: {},
    description: 'A complete 28-tooth reference arrangement for comparing front-to-back, vertical and transverse relationships.',
    learningGoal: 'Distinguish a useful geometric reference from a clinically verified ideal bite.', sources: [GLOSSARY, FINISHING],
    assumptions: ['Upper and lower model origins are brought 1.5 mm toward the occlusal plane; this is display registration, not bite-record reconstruction.'],
    demonstrations: [variant('inspect-reference', 'Inspect the reference', 'Hold the arrangement still while examining opposing crowns from several views.', 'Does an orderly-looking model establish ideal occlusal contacts?', 'No. Contact quality, function and root relationships require assessment beyond this authored geometry.', [frame(0, 'Reference arrangement', {}), frame(1, 'Reference held for inspection', {})], { appliance: NONE })],
  },
  {
    id: 'movement-types', title: 'Translation, tip, torque and rotation', category: 'Foundations', view: 'perspective', arch: 'upper', selectedIds: ['11'], initial: movementStart,
    description: 'A slightly labial upper incisor makes displacement and changes in orientation easy to compare.', learningGoal: 'Compare four distinct geometric changes from the same prepared starting position.', sources: [GLOSSARY],
    assumptions: ['The incisor is isolated by display displacement. Angular examples use fixed case axes: Z for mesiodistal inclination, X for buccolingual inclination, and Y for axial rotation. These approximate the near-central-incisor directions, not a calibrated force system.'],
    demonstrations: [
      variant('translation', 'Bodily translation', 'Move the whole incisor 2 mm forward without changing its orientation.', 'Does the root move by the same vector as the crown?', 'Yes: a pure translation adds the same displacement to every point.', [frame(0, 'Prepared incisor', movementStart), frame(1, 'Same orientation, shifted position', { '11': pose([0, 0, 3.2]) })], { appliance: NONE }),
      variant('tip', 'Mesiodistal crown inclination', 'Rotate the crown and root about the displayed crown-centre Z axis.', 'Is this the same path as translation?', 'No. Points rotate around a pivot; root and crown points follow different arcs.', [frame(0, 'Prepared incisor', movementStart), frame(1, '15° case-Z inclination', { '11': pose([0, 0, 1.2], [0, 0, 15]) })], { appliance: NONE }),
      variant('torque', 'Buccolingual inclination', 'Inspect an X-axis inclination change from the side with the root visible.', 'Does the display predict root torque from an archwire?', 'No. It shows a prescribed orientation change around a geometric pivot, without calculating a wire moment or periodontal response.', [frame(0, 'Prepared incisor', movementStart), frame(1, '12° case-X inclination', { '11': pose([0, 0, 1.2], [12, 0, 0]) })], { appliance: NONE }),
      variant('axial-rotation', 'Axial rotation', 'Turn the incisor around the vertical case axis while its centre remains fixed.', 'What changes if the centre stays in place?', 'The crown and root orientation changes; the centre translation does not.', [frame(0, 'Prepared incisor', movementStart), frame(1, '18° case-Y rotation', { '11': pose([0, 0, 1.2], [0, 18, 0]) })], { appliance: NONE }),
    ],
  },
  {
    id: 'crowding', title: 'Anterior crowding', category: 'Alignment and space', view: 'occlusal', arch: 'both', selectedIds: [...UI, '31', '41'], initial: crowded,
    description: 'Several incisors start displaced and rotated, producing an irregular anterior arrangement.', learningGoal: 'Separate positional alignment from rotation and discuss where space would come from.', sources: [GLOSSARY, FINISHING],
    assumptions: ['Space availability, extraction decisions and interproximal reduction are not calculated. The authored path is an alignment comparison, not a selected clinical strategy.'],
    demonstrations: [variant('position-then-rotation', 'Position, then rotation', 'First reduce the authored centre displacements, then resolve the rotations.', 'Does straightening the rendered crowns explain the source of space?', 'No. The screen supplies an endpoint; clinical space analysis and tissue limits remain separate questions.', [frame(0, 'Crowded start', crowded), frame(.45, 'Centres aligned; rotations remain', crowdedPositions), frame(1, 'Reference alignment', {})])],
  },
  {
    id: 'midline-diastema', title: 'Midline diastema', category: 'Alignment and space', view: 'front', arch: 'upper', selectedIds: ['11', '21'], initial: spaced,
    description: 'Two upper half-arches are separated laterally to create a visible central gap without compressing neighbouring crowns.', learningGoal: 'Compare symmetric and asymmetric use of space without confusing space closure with midline control.', sources: [GLOSSARY],
    assumptions: ['The half-arch offsets deliberately change dental width; the asymmetric endpoint also shifts the whole upper dental arch. These are geometric comparisons, not a prescribed space-closure mechanism.', 'Spacing causes, tooth-size relationships, frenal anatomy and long-term stability are not diagnosed.'],
    demonstrations: [
      variant('symmetric-closure', 'Symmetric closure', 'Bring the two sides back toward the displayed midline.', 'What remains centred when both sides contribute?', 'The authored central-incisor midpoint returns to the reference midline.', [frame(0, 'Spaced upper anterior segment', spaced), frame(1, 'Reference anterior spacing', {})]),
      variant('offset-closure', 'Closure with a shifted midpoint', 'Close the central space while leaving the upper dental arch 1.2 mm to one side.', 'Can a space close while the dental midline is still displaced?', 'Yes. A closed central space and a centred dental midline are separate geometric observations.', [frame(0, 'Same spaced start', spaced), frame(1, 'Closed centrally, arch offset', translate(UPPER, [1.2, 0, 0]))]),
    ],
  },
  {
    id: 'increased-overjet', title: 'Increased overjet', category: 'Sagittal relationships', view: 'right', arch: 'both', selectedIds: [...UA], initial: overjet,
    description: 'The upper anterior segment is placed forward of its reference position to increase horizontal separation.', learningGoal: 'Distinguish dental retraction from an inclination change and from skeletal correction.', sources: [GLOSSARY],
    assumptions: ['Jaw position is fixed. Neither variant models mandibular advancement, facial growth, anchorage design or root control.'],
    demonstrations: [
      variant('segment-retraction', 'Anterior translation', 'Translate the six upper anterior teeth toward their reference positions while keeping their orientation.', 'Did either jaw move?', 'No. Only the specified teeth translated relative to the registered model.', [frame(0, 'Forward anterior segment', overjet), frame(1, 'Reduced dental projection', translate(UA, [0, 0, .4]))]),
      variant('inclination-comparison', 'Incisor inclination comparison', 'Change incisor inclination while retaining much of the forward centre displacement.', 'Can incisal projection change without an equal change at the root?', 'Yes. Rotation changes root and crown locations differently; this example is not a prediction of clinical torque control.', [frame(0, 'Same forward start', overjet), frame(1, 'Inclined incisors, forward centres remain', { ...overjet, ...Object.fromEntries(UI.map(id => [id, pose([0, 0, 2.6], [14, 0, 0])])) })]),
    ],
  },
  {
    id: 'anterior-crossbite', title: 'Dental anterior crossbite', category: 'Sagittal relationships', view: 'right', arch: 'both', selectedIds: ['11', '41'], initial: anteriorCrossbite,
    description: 'One upper central incisor begins palatal to its opposing anterior reference relationship.', learningGoal: 'Inspect a local dental discrepancy separately from a whole-jaw discrepancy.', sources: [CROSSBITE],
    assumptions: ['The path adds temporary vertical clearance and a small medial waypoint around the neighbouring crown. These are authored display offsets, not a bite-opening appliance, a clinical intrusion instruction or a certified collision-free route. No functional mandibular shift is simulated.'],
    demonstrations: [variant('local-repositioning', 'Local tooth repositioning', 'Use visible clearance waypoints, move the incisor labially, then settle it at the reference position.', 'Does correcting one displayed tooth establish the cause of the crossbite?', 'No. The model only isolates the dental relationship; jaw relationships and functional shifts are not assessed.', [frame(0, 'Palatal incisor', anteriorCrossbite), frame(.25, 'Illustrative clearance waypoint', { '11': pose([.4, 1.4, -3.5]) }), frame(.5, 'Medial display clearance', { '11': pose([.4, 1.4, -1.75]) }), frame(.75, 'Labial position at clearance height', { '11': pose([0, 1.4, 0]) }), frame(1, 'Reference tooth position', {})])],
  },
  {
    id: 'deepbite', title: 'Deep bite · anterior intrusion', category: 'Vertical relationships', view: 'front', arch: 'both', selectedIds: [...UI, ...LI], initial: deep,
    description: 'Additional anterior vertical overlap is authored while the posterior reference positions stay unchanged.', learningGoal: 'Compare incisor intrusion with a posterior-extrusion mechanism without treating their outcomes as interchangeable.', sources: [GLOSSARY, INTRUSION, BITE_PLANE],
    assumptions: ['Clinical intrusion-arch and bite-plane studies report multiple dental effects. These isolated paths omit appliance side effects and do not reproduce the populations or protocols of those studies.'],
    demonstrations: [
      variant('anterior-intrusion', 'Upper-incisor intrusion', 'Move the upper incisors rootward and reduce their added overlap; hold the lower teeth still.', 'Which arch contributes to this overlap reduction?', 'Only the four upper incisors move in this isolated illustration.', [frame(0, 'Added anterior overlap', deep), frame(1, 'Upper incisors returned rootward', translate(LI, [0, .8, 0]))], { sources: [INTRUSION] }),
      variant('posterior-extrusion', 'Posterior extrusion concept', 'Move posterior teeth toward the opposing arch while keeping anterior tooth poses unchanged.', 'Why does anterior overlap remain in this fixed-jaw display?', 'Posterior extrusion can be part of bite-opening mechanics, but its relationship to mandibular rotation is not simulated here. This is a movement comparison, not an equivalent corrected endpoint.', [frame(0, 'Same deep-bite start', deep), frame(1, 'Posterior displacement only', { ...deep, ...translate(UP, [0, -.6, 0]), ...translate(LP, [0, .6, 0]) })], { sources: [BITE_PLANE], assumptions: ['Posterior contact crossings may appear because both jaw frames are fixed. Do not read this endpoint as a feasible bite.'] }),
    ],
  },
  {
    id: 'openbite', title: 'Dental anterior open bite', category: 'Vertical relationships', view: 'front', arch: 'both', selectedIds: [...UI, ...LI], initial: open,
    description: 'Upper and lower anterior teeth are separated vertically while the posterior reference arrangement is maintained.', learningGoal: 'Recognize anterior separation and demonstrate a dental-only reduction in that gap.', sources: [GLOSSARY],
    assumptions: ['Habits, tongue function, skeletal vertical proportions and their management are not inferred. The example does not select anterior extrusion as treatment.'],
    demonstrations: [variant('anterior-extrusion', 'Reduce anterior separation', 'Move the anterior teeth toward the occlusal plane without changing the posterior teeth.', 'Is reduction of the displayed gap the same as correction of its cause?', 'No. This path changes a geometric relationship and says nothing about diagnosis, stability or supporting tissues.', [frame(0, 'Anterior vertical separation', open), frame(1, 'Reference vertical relationship', {})])],
  },
  {
    id: 'posterior-crossbite', title: 'Dental posterior crossbite', category: 'Transverse relationships', view: 'front', arch: 'both', selectedIds: ['24', '25', '26', '27'], initial: posteriorCrossbite,
    description: 'The upper left posterior crowns begin inward and inclined relative to the opposing arch.', learningGoal: 'Observe unilateral dental width and inclination changes without claiming palatal suture expansion.', sources: [CROSSBITE],
    assumptions: ['The maxilla and palate do not widen. The combined tooth displacement and inclination are authored separately from skeletal expansion.'],
    demonstrations: [variant('dental-uprighting', 'Dental repositioning and uprighting', 'Reduce the inward displacement first, then return posterior inclinations toward the reference.', 'Does a wider crown display prove that the maxilla widened?', 'No. Tooth position and inclination can change while the skeletal frame remains unchanged.', [frame(0, 'Inward posterior segment', posteriorCrossbite), frame(.6, 'Centres returned; inclination remains', Object.fromEntries(['24', '25', '26', '27'].map(id => [id, pose([0, 0, 0], [0, 0, -7])]))), frame(1, 'Reference posterior relationship', {})])],
  },
  {
    id: 'anchorage-space-closure', title: 'Anchorage and space use', category: 'Alignment and space', view: 'occlusal', arch: 'upper', selectedIds: [...UA], initial: extraction, omitted: ['14', '24'],
    description: 'Upper first premolars are absent and the anterior segment is forward, creating a schematic extraction-space comparison.', learningGoal: 'Compare anterior movement with posterior movement during partial space closure.', sources: [ANCHORAGE],
    assumptions: ['The missing premolars are a prepared example, not an extraction recommendation. Gingiva is retained as a schematic surface, not a healed socket reconstruction.', 'Movement allocations are chosen illustration values, not anchorage ratios, force equilibrium or complete space closure.'],
    demonstrations: [
      variant('posterior-held', 'Posterior reference held', 'Retract the anterior segment while posterior reference teeth remain fixed.', 'Does keeping posterior meshes still prove absolute clinical anchorage?', 'No. The fixed posterior poses are an authored boundary condition, not a force-system result.', [frame(0, 'Prepared spaces and forward segment', extraction), frame(1, 'Anterior contribution only', {})], { sources: [ANCHORAGE] }),
      variant('shared-space-use', 'Both segments contribute', 'Use less anterior retraction and add mesial posterior displacement to illustrate another allocation of space.', 'Where was the space used in this comparison?', 'Both anterior and posterior tooth positions changed. The allocation was chosen explicitly; it was not calculated from an appliance.', [frame(0, 'Same prepared spaces', extraction), frame(1, 'Anterior and posterior contribution', { ...translate(UA, [0, 0, 2]), ...translate(['15', '16', '17', '25', '26', '27'], [0, 0, 2]) })], { sources: [ANCHORAGE] }),
    ],
  },
  {
    id: 'occlusal-finishing', title: 'Occlusal finishing observations', category: 'Finishing and retention', view: 'perspective', arch: 'both', selectedIds: ['22', '32', '16', '46'], initial: finishing,
    description: 'Small anterior rotations and posterior height/inclination offsets invite a systematic finishing discussion.', learningGoal: 'Inspect alignment, vertical relationships and inclination separately instead of judging only the frontal smile.', sources: [FINISHING],
    assumptions: ['The board evaluation source identifies several distinct assessment domains. This app neither computes a board score nor verifies cusp contacts, root parallelism or functional finishing.'],
    demonstrations: [variant('staged-refinement', 'Alignment, height, then inclination', 'Remove the small anterior discrepancies, then inspect posterior height and orientation.', 'Can a pleasing anterior view establish that finishing is complete?', 'No. Posterior contacts, marginal relationships, inclination and other domains require their own assessment.', [frame(0, 'Small residual discrepancies', finishing), frame(.35, 'Anterior alignment adjusted', { '16': finishing['16'], '46': finishing['46'] }), frame(.7, 'Heights adjusted; inclination remains', { '16': pose([0, 0, 0], [0, 0, 6]), '46': pose([0, 0, 0], [-5, 0, 0]) }), frame(1, 'Reference poses held for review', {})], { sources: [FINISHING] })],
  },
  {
    id: 'removable-retention', title: 'Removable retention', category: 'Finishing and retention', view: 'perspective', arch: 'both', selectedIds: [...UI, ...LI], initial: {},
    description: 'Hold the prepared arrangement while discussing a removable retainer as a passive maintenance appliance.', learningGoal: 'Separate maintaining an arrangement from actively correcting tooth positions.', sources: [RETENTION],
    assumptions: ['Removable retention is requested as its own display flag; it must not be shown using the fixed lingual-wire preset.', 'No wear schedule, predicted relapse, material fit, insertion force or manufacturing geometry is supplied.'],
    demonstrations: [variant('passive-hold', 'Passive holding', 'The teeth stay still throughout the demonstration; retention does not automatically align them.', 'Does a passive retainer create a new tooth arrangement in this scene?', 'No. It illustrates maintenance of the prepared positions. Clinical device choice and follow-up are separate decisions.', [frame(0, 'Prepared arrangement', {}), frame(1, 'The same arrangement held', {})], { appliance: NONE, removableRetainer: true, sources: [RETENTION] })],
  },
];

const ALIASES: Record<TeachingCaseId, string[]> = {
  'reference-occlusion': ['reference', 'reference occlusion'], 'movement-types': ['movement types', 'tooth movements'],
  crowding: ['crowding', 'crowded teeth'], 'midline-diastema': ['diastema', 'midline gap'],
  'increased-overjet': ['overjet', 'increased overjet'], 'anterior-crossbite': ['anterior crossbite', 'front crossbite'],
  deepbite: ['deep bite', 'deepbite'], openbite: ['open bite', 'openbite'], 'posterior-crossbite': ['posterior crossbite'],
  'anchorage-space-closure': ['anchorage', 'space closure'], 'occlusal-finishing': ['finishing', 'occlusal finishing'],
  'removable-retention': ['retention', 'removable retention'],
};

/** UI metadata contains no hidden treatment engine or editable-case input. */
export const TEACHING_CASES: readonly TeachingCaseDefinition[] = RECIPES.map(({ initial: _initial, omitted: _omitted, demonstrations, ...definition }) => ({
  ...definition, aliases: ALIASES[definition.id], assumptions: [...LIMITS, ...definition.assumptions],
  variants: demonstrations.map(({ frames, ...item }) => ({ ...item, aliases: [...new Set([item.id.replaceAll('-', ' '), item.title.toLowerCase()])], keyframes: frames.map(({ progress, label }) => ({ progress, label })), sources: item.sources.length ? item.sources : definition.sources })),
}));

export function getTeachingCase(id: string): TeachingCaseDefinition {
  const definition = TEACHING_CASES.find(item => item.id === id);
  if (!definition) throw new Error('Choose a supported prepared teaching case.');
  return structuredClone(definition);
}

/** Metadata is copied; immutable crown/root/gum geometry remains owned by the supplied base. */
export function createTeachingCase(base: DentalCase, id: string): PreparedTeachingCase {
  const definition = getTeachingCase(id), recipe = RECIPES.find(item => item.id === id)!;
  const ids = new Set(base.teeth.map(tooth => tooth.id));
  if (!base.demo || base.teeth.length !== 28 || ids.size !== 28 || ALL.some(tooth => !ids.has(tooth))) throw new Error('Prepared cases require the complete synthetic adult 28-tooth reference model.');
  for (const tooth of base.teeth) {
    if (!Array.isArray(tooth.position) || tooth.position.length !== 3 || !tooth.position.every(Number.isFinite) || !tooth.geometry?.isBufferGeometry || !tooth.rootGeometry?.isBufferGeometry) throw new Error('The synthetic reference has invalid tooth geometry or origins.');
    anatomicalFrame(tooth);
  }
  const position = (value: Vec3, arch: 'upper' | 'lower'): Vec3 => value.map((n, i) => n + CASE_REFERENCE_OFFSETS[arch][i]) as Vec3;
  const model: DentalCase = {
    name: definition.title, demo: true,
    teeth: base.teeth.filter(tooth => !recipe.omitted?.includes(tooth.id)).map(tooth => {
      const { geometry, rootGeometry, ...metadata } = tooth;
      return { ...structuredClone(metadata), position: position(tooth.position, /^[12]/.test(tooth.id) ? 'upper' : 'lower'), geometry, rootGeometry };
    }),
    gums: base.gums.map(gum => {
      if (!gum.arch || !Array.isArray(gum.position) || gum.position.length !== 3 || !gum.position.every(Number.isFinite) || !gum.geometry?.isBufferGeometry) throw new Error('Synthetic gums need valid origins and upper/lower arch metadata.');
      return { ...gum, position: position(gum.position, gum.arch) };
    }),
  };
  return { model, transforms: structuredClone(recipe.initial), selectedIds: [...definition.selectedIds], definition };
}

/**
 * Full poses relative to createTeachingCase's registered model, not deltas to add to an edited case.
 * Every call starts from the authored baseline. Rotation interpolation uses quaternion slerp.
 */
export function sampleCaseDemonstration(caseId: string, variantId: string, progress: number): Transforms {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new Error('Case demonstration progress must be between 0 and 1.');
  const recipe = RECIPES.find(item => item.id === caseId), demonstration = recipe?.demonstrations.find(item => item.id === variantId);
  if (!recipe || !demonstration) throw new Error('Choose a supported case demonstration.');
  const frames = demonstration.frames;
  if (progress === 1) return structuredClone(frames[frames.length - 1].transforms);
  const index = frames.findIndex((item, i) => i < frames.length - 1 && progress >= item.progress && progress < frames[i + 1].progress);
  const from = frames[index], to = frames[index + 1];
  return structuredClone(interpolateTransforms(from.transforms, to.transforms, (progress - from.progress) / (to.progress - from.progress)));
}
