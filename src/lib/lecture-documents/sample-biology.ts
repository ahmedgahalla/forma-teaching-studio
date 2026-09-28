import { validateLectureDocument } from './documents';
import { preparedLectureScene } from './sample-scenes';
import type { LectureDocument } from './types';

export const BIOLOGY_LECTURE_ID = 'forma-pressure-tension-biology';
const sources = {
  human: 'Human tissue study: Otero et al. (2016). https://pubmed.ncbi.nlm.nih.gov/26823650/',
  resorption: 'Mouse experiment: Yang et al. (2018). https://pubmed.ncbi.nlm.nih.gov/29483595/',
  formation: 'Rat experiment: Mao et al. (2018). https://pubmed.ncbi.nlm.nih.gov/29224185/',
  limits: 'Finite-element study: Cattaneo et al. (2009). https://pubmed.ncbi.nlm.nih.gov/19419455/',
};

function scene() {
  const value = preparedLectureScene('movement-types', 'translation');
  value.setup.view = 'right';
  return value;
}

export function createBiologyLecture(): LectureDocument {
  return validateLectureDocument({
    version: 1,
    id: BIOLOGY_LECTURE_ID,
    title: 'Why teeth move: periodontal tissue response',
    updatedAt: '2026-09-28T00:00:00.000Z',
    steps: [
      {
        id: 'identify-the-support',
        title: 'Start with the supporting tissues',
        notes: [
          'Suggested pacing: about 40 seconds. Objective: connect tooth movement with periodontal ligament signaling, bone resorption and bone formation.',
          'Ask students to locate the root surface, periodontal ligament and bone in the two separate tissue diagrams. These enlarged local examples explain the relationship; they do not add bone or ligament geometry to the displayed tooth.',
          'Keep the model still. Say: “We can draw a movement path, but living tissue must respond for clinical movement to occur.” Choose Next to inspect a local compression example.',
        ].join('\n\n'),
        question: 'In the tissue diagrams, what lies between the root surface and the bone?',
        answer:
          'The periodontal ligament lies between root cementum and alveolar bone. Its cells and surrounding bone cells participate in the response to mechanical loading.',
        scene: scene(),
        biology: 'overview',
      },
      {
        id: 'compression-and-resorption',
        title: 'Compression: signaling and resorption',
        notes: [
          'Suggested pacing: about 50 seconds. Ask students to describe the local ligament space before revealing the answer. The separate vignette shows a narrowed space and an osteoclast on a bone surface.',
          'Explain that loading can change cellular signaling, including RANKL-related pathways involved in osteoclast formation and activity. Bone resorption is the process illustrated here.',
          'In a mouse experiment, deleting RANKL in periodontal ligament and bone-lining cells markedly reduced osteoclast formation and tooth movement. This supports a cellular mechanism; it does not quantify the response of the displayed tooth.',
          sources.resorption,
        ].join('\n\n'),
        question: 'Which cell activity is illustrated at the compressed-side bone surface?',
        answer:
          'Osteoclast-mediated bone resorption. The enlarged vignette illustrates a local process, not a computed pressure map for this model.',
        scene: scene(),
        biology: 'compression',
      },
      {
        id: 'tension-and-formation',
        title: 'Tension: supporting bone formation',
        notes: [
          'Suggested pacing: about 50 seconds. Ask students to compare this widened local ligament space with the previous vignette. Identify osteoblasts at the illustrated new-bone surface.',
          'Explain that tension-associated signaling can support bone formation. A rat tooth-movement experiment investigated this response and signaling involving GSK-3β and β-catenin.',
          'Keep the teaching point at the tissue level: formation and resorption are coordinated biological activities. The enlarged cells and new-bone band are explanatory drawings, not measured growth or a treatment clock.',
          sources.formation,
        ].join('\n\n'),
        question: 'Which cells are associated with the new bone shown here?',
        answer:
          'Osteoblasts are associated with bone formation. This tension vignette illustrates one local response; it does not predict where or how much bone this model would form.',
        scene: scene(),
        biology: 'tension',
      },
      {
        id: 'avoid-two-fixed-sides',
        title: 'A useful concept with an important limit',
        notes: [
          'Suggested pacing: about 50 seconds. Ask students whether these two vignettes should be painted as permanent halves of every root. Show them together for comparison.',
          'The examples simplify local compression-associated resorption and tension-associated formation. Actual loading varies with root and bone morphology, tissue properties, force systems and time.',
          'A finite-element study using human jaw segments did not find the simple, distinct symmetric regions assumed by classical diagrams. Human periodontal tissue research also found loading-related RANKL changes on both sampled sides.',
          sources.limits,
          sources.human,
        ].join('\n\n'),
        question: 'Can these two colors be read as an exact stress distribution around this root?',
        answer:
          'No. They are separate local examples. Real tissue responses vary around the root and over time; these illustrations are not a computed stress distribution.',
        scene: scene(),
        biology: 'overview',
      },
      {
        id: 'movement-versus-mechanism',
        title: 'Observe movement; distinguish the mechanism',
        notes: [
          'Suggested pacing: about 40 seconds. Ask what the animation alone can establish, then press Play. Follow the crown and root during the prepared translation.',
          'This playback shows position changing without an orientation change. It does not calculate ligament stresses, cell activity, bone remodeling or elapsed treatment time.',
          'Connect the two levels: geometry describes the visible movement; the previous vignettes explain biological concepts that this path does not simulate. Choose Next for the final check.',
        ].join('\n\n'),
        question: 'What can we conclude from the movement shown by this animation?',
        answer:
          'We can describe the prescribed translation. We cannot infer the clinical force, tissue response or treatment duration from its speed or endpoint.',
        scene: scene(),
        demo: { caseId: 'movement-types', variantId: 'translation' },
      },
      {
        id: 'biology-exit-question',
        title: 'Explain the story in one sentence',
        notes: [
          'Suggested pacing: about 35 seconds. Ask students to link loading, periodontal signaling and bone remodeling before revealing the answer.',
          'Invite one student to explain resorption and another to explain formation. Use the two local vignettes as a recall aid, while keeping their limits clear.',
          'Close with the distinction between a tissue-level explanation and a patient-specific prediction. Choose Explore this question for a model detour, then Return to lecture.',
        ].join('\n\n'),
        question: 'How do loading, the periodontal ligament and bone remodeling connect?',
        answer:
          'Mechanical loading changes the periodontal environment and cellular signaling. Coordinated resorption and formation remodel supporting bone; the response depends on local biology and mechanics.',
        scene: scene(),
        biology: 'overview',
      },
    ],
  });
}
