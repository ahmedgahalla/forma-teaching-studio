import { validateLectureDocument } from './documents';
import { preparedLectureScene } from './sample-scenes';
import type { LectureDocument } from './types';

export const ANCHORAGE_LECTURE_ID = 'forma-space-and-anchorage';
const caseId = 'anchorage-space-closure';
const source =
  'Clinical context: Sardana et al. (2023), randomized clinical trial. https://pubmed.ncbi.nlm.nih.gov/36919990/';

function scene(variant: 'posterior-held' | 'shared-space-use', progress = 0) {
  const value = preparedLectureScene(caseId, variant, progress);
  value.setup.selectedIds = [
    '11',
    '12',
    '13',
    '21',
    '22',
    '23',
    '15',
    '16',
    '17',
    '25',
    '26',
    '27',
  ];
  value.roots = false;
  return value;
}

export function createAnchorageLecture(): LectureDocument {
  return validateLectureDocument({
    version: 1,
    id: ANCHORAGE_LECTURE_ID,
    title: 'Space closure: who moves, and who stays?',
    updatedAt: '2026-09-28T00:00:00.000Z',
    steps: [
      {
        id: 'locate-the-space',
        title: 'Read the starting arrangement',
        notes: [
          'Suggested pacing: about 40 seconds. Objective: distinguish anterior retraction from posterior contribution by following both segments.',
          'Ask students to identify the anterior segment, the posterior teeth and the two prepared premolar spaces. Invite two predictions before revealing the answer. The model is held still here.',
          'The absent first premolars are part of this prepared example, not an extraction recommendation. Both demonstrations start from this same arrangement.',
          'Say: “Watch the posterior teeth as carefully as the incisors.” Choose Next to test the first allocation.',
        ].join('\n\n'),
        question: 'If the visible space becomes smaller, which teeth might have contributed?',
        answer:
          'Anterior teeth can move back, posterior teeth can move forward, or both segments can contribute. A smaller gap alone does not tell us which teeth moved.',
        scene: scene('posterior-held'),
      },
      {
        id: 'hold-posterior-reference',
        title: 'First allocation: anterior movement',
        notes: [
          'Suggested pacing: about 55 seconds. Ask students to choose a posterior landmark, then press Play. Pause halfway and compare the incisors with that landmark.',
          'The anterior segment retracts while posterior tooth poses remain fixed. Continue to the endpoint and reveal the answer after students describe what changed.',
          'These fixed posterior poses were authored. They do not demonstrate how an appliance would obtain anchorage. The displayed braces do not determine this animation.',
          'Choose Next to restore the shared starting arrangement and test a second allocation.',
        ].join('\n\n'),
        question: 'Which segment uses the space in this first animation?',
        answer:
          'Only the anterior segment changes position. Posterior teeth remain at their authored reference poses; that is a display condition, not proof of absolute clinical anchorage.',
        scene: scene('posterior-held'),
        demo: { caseId, variantId: 'posterior-held' },
      },
      {
        id: 'share-the-space',
        title: 'Second allocation: both segments move',
        notes: [
          'Suggested pacing: about 55 seconds. Ask for a prediction before pressing Play. Follow a canine and a posterior tooth at the same time.',
          'Pause halfway. The anterior segment has less authored retraction and the posterior segment also changes position. Play to the endpoint, then reveal the answer.',
          'The movement amounts are chosen illustration values. Do not describe this as a measured anchorage ratio, force equilibrium or complete space closure.',
          'Choose Next to inspect the first endpoint again without replaying its animation.',
        ].join('\n\n'),
        question: 'What changed in the second allocation besides the incisors?',
        answer:
          'Posterior positions also changed. Both segments contribute in this authored comparison, so incisor movement alone is an incomplete description of space use.',
        scene: scene('shared-space-use'),
        demo: { caseId, variantId: 'shared-space-use' },
      },
      {
        id: 'inspect-first-endpoint',
        title: 'Compare: locate the posterior reference',
        notes: [
          'Suggested pacing: about 35 seconds. This is the held endpoint of the first allocation. Ask students to identify which positions must be checked to describe anchorage.',
          'Point to an incisor and a posterior tooth. Choose Next for the second endpoint. Use Previous and Next to alternate these two held arrangements from their prepared views.',
          'The purpose is a geometric comparison of both segments, not a diagnosis of anchorage loss in a patient.',
        ].join('\n\n'),
        question: 'What should be compared with the starting arrangement?',
        answer:
          'Compare anterior and posterior positions against a consistent reference. Checking only the remaining gap can miss posterior movement.',
        scene: scene('posterior-held', 1),
      },
      {
        id: 'inspect-second-endpoint',
        title: 'Compare: a different allocation',
        notes: [
          'Suggested pacing: about 40 seconds. The second endpoint is now held still. Ask a student to describe the difference from the previous step in one sentence.',
          'Use Previous and Next once more if needed. Then connect the comparison to anchorage as control of unwanted movement relative to the chosen treatment objective.',
          'A randomized clinical trial measured both anterior retraction and molar anchorage change. It provides clinical context for observing both segments; this animation does not reproduce its patients, mechanics or measurements.',
          source,
        ].join('\n\n'),
        question: 'Is every posterior movement automatically a failure?',
        answer:
          'No. Whether movement is wanted depends on the treatment objective and reference. Here, the two allocations are deliberately chosen examples for comparison.',
        scene: scene('shared-space-use', 1),
      },
      {
        id: 'anchorage-exit-question',
        title: 'Takeaway: account for both segments',
        notes: [
          'Suggested pacing: about 35 seconds. Ask for an exit answer before revealing it: name what moved, what stayed and what this screen cannot establish.',
          'Expected observations: the first path holds posterior positions; the second changes both segments. Both began from the same prepared arrangement.',
          'For a student question, choose Explore this question and then Return to lecture. Close by distinguishing a useful visual comparison from a patient-specific force system or treatment forecast.',
          source,
        ].join('\n\n'),
        question: 'What is missing if a report only says “the space closed”?',
        answer:
          'It omits how anterior and posterior teeth changed relative to a reference. A clinical explanation also needs the objective, appliance mechanics and biological context; the authored paths alone cannot supply those.',
        scene: scene('shared-space-use', 1),
      },
    ],
  });
}
