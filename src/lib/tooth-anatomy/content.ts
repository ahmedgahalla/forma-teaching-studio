/**
 * Tooth-study teaching content, authored per tooth class and arch (content as
 * data, AGENTS.md). Left and right teeth mirror each other; the API in
 * ./index.ts derives side, name and surface wording from the FDI number.
 *
 * Teaching draft — pending educator review · synthetic model. Textbook-level,
 * conservative descriptions only: no clinical advice, no force values, and root
 * counts describe Forma's synthetic teaching model (they match its metadata).
 */
export type ToothClass =
  | 'central-incisor'
  | 'lateral-incisor'
  | 'canine'
  | 'first-premolar'
  | 'second-premolar'
  | 'first-molar'
  | 'second-molar';
export type DentalArch = 'upper' | 'lower';

export type ToothClassContent = {
  /** Root names as modelled in Forma's synthetic teaching model. */
  roots: readonly string[];
  cusps: string;
  features: readonly string[];
  orthodontics: string;
  /** Two to four spoken sentences; the API prefixes the tooth name and FDI number. */
  explanation: string;
};

/** FDI tooth digit 1–7 → class. */
export const TOOTH_CLASSES: readonly ToothClass[] = [
  'central-incisor',
  'lateral-incisor',
  'canine',
  'first-premolar',
  'second-premolar',
  'first-molar',
  'second-molar',
];

export const TOOTH_CLASS_NAMES: Record<ToothClass, string> = {
  'central-incisor': 'central incisor',
  'lateral-incisor': 'lateral incisor',
  canine: 'canine',
  'first-premolar': 'first premolar',
  'second-premolar': 'second premolar',
  'first-molar': 'first molar',
  'second-molar': 'second molar',
};

const SINGLE = ['Single root'] as const;

export const TOOTH_CONTENT: Record<DentalArch, Record<ToothClass, ToothClassContent>> = {
  upper: {
    'central-incisor': {
      roots: SINGLE,
      cusps: 'No cusps: a straight incisal edge; newly erupted incisors may show three mamelons.',
      features: [
        'Widest crown of the anterior teeth',
        'Sharper mesial incisal angle than distal',
        'Palatal cingulum, marginal ridges and lingual fossa',
      ],
      orthodontics:
        'Its position and inclination are key references for overjet, overbite and smile display.',
      explanation:
        'The maxillary central incisor is the widest anterior tooth and has a single conical root. Its palatal surface shows a cingulum, marginal ridges and a lingual fossa. Its position and inclination are central references for overjet, overbite and smile display.',
    },
    'lateral-incisor': {
      roots: SINGLE,
      cusps: 'No cusps: an incisal edge with more rounded incisal angles than the central.',
      features: [
        'Smaller and narrower than the central incisor',
        'Crown form varies; small peg-shaped forms occur',
        'A lingual pit may be present near the cingulum',
      ],
      orthodontics:
        'Small or absent lateral incisors are a frequent topic in anterior space discussions.',
      explanation:
        'The maxillary lateral incisor is smaller than the central incisor and has a single root. Its incisal angles are more rounded, and its crown form varies more, including small peg-shaped forms. Small or absent lateral incisors are a frequent topic in anterior space discussions.',
    },
    canine: {
      roots: SINGLE,
      cusps: 'One pointed cusp; the mesial cusp ridge is shorter than the distal cusp ridge.',
      features: [
        'Long single root; upper canines typically have the longest roots',
        'Prominent labial ridge and cingulum',
        'Sits at the corner of the dental arch',
      ],
      orthodontics:
        'Its long root and corner position matter for canine guidance and canine relationship descriptions.',
      explanation:
        'The maxillary canine typically has the longest root in the dentition; this synthetic tooth has one root. Its crown has one pointed cusp with a shorter mesial and a longer distal cusp ridge. Its corner position makes it a useful landmark for discussing canine guidance and occlusal relationships.',
    },
    'first-premolar': {
      roots: ['Buccal', 'Palatal'],
      cusps: 'Two cusps: the buccal cusp is longer and larger than the palatal cusp.',
      features: [
        'Two roots in this model, buccal and palatal; human root forms vary',
        'Mesial concavity on the crown and root',
        'Crown outline resembles the canine from the buccal side',
      ],
      orthodontics:
        'First premolars are often named in the premolar extraction patterns described in orthodontic texts.',
      explanation:
        'The maxillary first premolar is shown here with a buccal and a palatal root; human root forms vary. It has two cusps, and the buccal cusp is longer and larger than the palatal cusp. First premolars are often named in the premolar extraction patterns described in orthodontic texts.',
    },
    'second-premolar': {
      roots: SINGLE,
      cusps: 'Two cusps of nearly equal size, buccal and palatal.',
      features: [
        'Usually a single root',
        'More symmetrical, rounder crown than the first premolar',
        'Shorter central groove with more supplemental grooves',
      ],
      orthodontics:
        'It links the premolar segment to the first molar; second premolars can be congenitally absent.',
      explanation:
        'The maxillary second premolar usually has a single root. Its buccal and palatal cusps are closer in size than in the first premolar, so the crown looks more symmetrical. It links the premolar segment to the first molar in the posterior arch.',
    },
    'first-molar': {
      roots: ['Mesiobuccal', 'Distobuccal', 'Palatal'],
      cusps:
        'Four main cusps: mesiobuccal, distobuccal, mesiopalatal (largest) and distopalatal; a cusp of Carabelli may sit on the mesiopalatal cusp.',
      features: [
        'Three roots: two buccal and one palatal',
        'Oblique ridge across the occlusal surface',
        'Largest crown in the maxillary arch',
      ],
      orthodontics:
        "Its mesiobuccal cusp relative to the lower first molar's buccal groove is the basis of Angle's classification; molars are common anchorage units.",
      explanation:
        "The maxillary first molar has three roots: two buccal roots and a palatal root. Its crown has four main cusps, and the mesiopalatal cusp is the largest. Its mesiobuccal cusp, relative to the lower first molar's buccal groove, is the basis of Angle's molar classification, and molars often serve as anchorage in orthodontic mechanics.",
    },
    'second-molar': {
      roots: ['Mesiobuccal', 'Distobuccal', 'Palatal'],
      cusps: 'Four cusps with a smaller distopalatal cusp; a cusp of Carabelli is uncommon.',
      features: [
        'Three roots, usually closer together than the first molar',
        'Smaller crown than the first molar',
        'Broad occlusal surface for grinding',
      ],
      orthodontics:
        'Together with the first molar it forms the posterior anchorage unit discussed in orthodontic mechanics.',
      explanation:
        'The maxillary second molar has three roots, two buccal and one palatal, usually closer together than in the first molar. Its crown is smaller, with a reduced distopalatal cusp. Together with the first molar it forms the posterior anchorage unit discussed in orthodontic mechanics.',
    },
  },
  lower: {
    'central-incisor': {
      roots: SINGLE,
      cusps: 'No cusps: a straight incisal edge with nearly equal incisal angles.',
      features: [
        'Smallest tooth in the permanent dentition',
        'Narrow, symmetrical crown',
        'Single root flattened mesiodistally',
      ],
      orthodontics:
        'Lower incisor inclination is a common cephalometric reference in orthodontic teaching.',
      explanation:
        'The mandibular central incisor is the smallest tooth in the permanent dentition, with a narrow, symmetrical crown. It has a single root that is flattened from mesial to distal. Lower incisor inclination is a common cephalometric reference in orthodontic teaching.',
    },
    'lateral-incisor': {
      roots: SINGLE,
      cusps: 'No cusps: an incisal edge with a more rounded distal incisal angle.',
      features: [
        'Slightly wider than the lower central incisor',
        'Incisal edge appears slightly twisted distolingually',
        'Single root flattened mesiodistally',
      ],
      orthodontics:
        'Lower incisor alignment is a frequent teaching example for arch-length discussions.',
      explanation:
        'The mandibular lateral incisor is slightly wider than the central incisor and has a single root. Its distal incisal angle is more rounded, and the incisal edge appears slightly twisted toward the lingual. Lower incisor alignment is a frequent teaching example for arch-length discussions.',
    },
    canine: {
      roots: SINGLE,
      cusps: 'One cusp, less pointed than the upper canine.',
      features: [
        'Long single root (a second root is an uncommon textbook variant)',
        'Narrower crown and smoother lingual surface than the upper canine',
        'Less prominent cingulum',
      ],
      orthodontics:
        'Canine relationships and lower intercanine width are common references in occlusion and arch-form teaching.',
      explanation:
        'The mandibular canine has a long single root and one cusp that is less pointed than the upper canine. Its crown is narrower and its lingual surface smoother. Canine relationships and lower intercanine width are common references in occlusion and arch-form teaching.',
    },
    'first-premolar': {
      roots: SINGLE,
      cusps: 'A large buccal cusp and a much smaller lingual cusp.',
      features: [
        'Single root',
        'Crown resembles the canine from the buccal side',
        'Mesiolingual groove is common',
      ],
      orthodontics:
        'Like its upper counterpart, it is often named in premolar extraction patterns described in orthodontic texts.',
      explanation:
        'The mandibular first premolar has a single root. Its large buccal cusp dominates, and the lingual cusp is much smaller, so the crown resembles the canine from the buccal side. Like its upper counterpart, it is often named in premolar extraction patterns described in orthodontic texts.',
    },
    'second-premolar': {
      roots: SINGLE,
      cusps:
        'Commonly three cusps (one buccal, two lingual) with a Y-shaped groove pattern; a two-cusp form also occurs.',
      features: [
        'Single root',
        'Larger lingual cusps than the first premolar',
        'Rounder occlusal outline',
      ],
      orthodontics:
        'Among the teeth most often congenitally absent after third molars, which matters in space discussions.',
      explanation:
        'The mandibular second premolar has a single root. It commonly has three cusps, one buccal and two lingual, with a Y-shaped groove pattern. It is among the teeth most often congenitally absent after third molars.',
    },
    'first-molar': {
      roots: ['Mesial', 'Distal'],
      cusps:
        'Five cusps: mesiobuccal, distobuccal, distal, mesiolingual and distolingual, with buccal grooves between the buccal cusps.',
      features: [
        'Two roots, mesial and distal',
        'Largest crown in the mandibular arch',
        'A small distal cusp beyond the two main buccal cusps',
      ],
      orthodontics:
        "Its buccal groove is the reference for the upper first molar's mesiobuccal cusp in Angle's classification.",
      explanation:
        "The mandibular first molar has two roots, mesial and distal, and five cusps. It is often the first permanent tooth to erupt, around age six. Its buccal groove is the reference for the upper first molar's mesiobuccal cusp in Angle's classification.",
    },
    'second-molar': {
      roots: ['Mesial', 'Distal'],
      cusps: 'Four cusps with a cross-shaped groove pattern.',
      features: [
        'Two roots, mesial and distal, closer together than the first molar',
        'Smaller crown than the first molar',
        'Broad occlusal surface for grinding',
      ],
      orthodontics:
        'Together with the first molar it contributes to posterior anchorage in orthodontic mechanics.',
      explanation:
        'The mandibular second molar has two roots, mesial and distal, usually closer together than in the first molar. Its crown has four cusps with a cross-shaped groove pattern. Together with the first molar it contributes to posterior anchorage in orthodontic mechanics.',
    },
  },
};
