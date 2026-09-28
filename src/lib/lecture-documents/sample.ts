import { getTeachingCase, sampleCaseDemonstration } from '../teaching-cases';
import { validateLectureDocument } from './documents';
import type { LectureDocument, LectureScene } from './types';
import { SAMPLE_LECTURE_ID } from './constants';

export { SAMPLE_LECTURE_ID } from './constants';

/** Fixed authored content; opening it never incorporates the current workspace or saved edits. */
export function createLectureSample(): LectureDocument {
  const definition = getTeachingCase('movement-types');
  const translation = definition.variants.find(item => item.id === 'translation')!;
  const tipping = definition.variants.find(item => item.id === 'tip')!;
  const scene = (variantId: 'translation' | 'tip', progress = 0): LectureScene => ({
    source: { kind: 'case', id: definition.id },
    transforms: sampleCaseDemonstration(definition.id, variantId, progress),
    setup: {
      camera: null,
      selectedIds: [...definition.selectedIds],
      arch: definition.arch,
      view: definition.view,
      gums: false,
      labels: false,
      grid: false,
      stage: progress === 0 ? 0 : 10,
      opening: 0,
      anatomy: { bone: false, ligament: false, cutaway: false, opacity: 0.35 },
      magnification: 1,
      forceVectors: false,
      wirePreset: { material: 'stainless-steel', section: { shape: 'round', diameterMm: 0.35 } },
      mechanicsResponse: false,
      responseRevealed: false,
      predictResponse: false,
      playbackSpeed: 1,
      reverse: false,
    },
    roots: true,
    braces: false,
    attachments: false,
    bracketStyle: 'metal',
    ligatureColor: '#3298bb',
    applianceDisplay: structuredClone(translation.appliance),
    isolated: false,
  });
  const prediction = scene('translation');
  prediction.setup.stage = 10;
  return validateLectureDocument({
    version: 1,
    id: SAMPLE_LECTURE_ID,
    title: 'Translation vs tipping: follow the crown and root',
    updatedAt: '2026-09-27T00:00:00.000Z',
    steps: [
      {
        id: 'predict-the-movement',
        title: 'Predict: position or orientation?',
        notes: [
          'Suggested pacing: about 35 seconds. Keep the model still and ask the question before revealing the answer.',
          definition.description,
          'Point out the selected upper incisor and its visible root. Ask students to choose a point on the crown and a point on the root to follow. Take two predictions, then explain that the next two demonstrations begin from the same prepared position.',
          definition.assumptions[1],
          'Choose Next to test the first prediction.',
        ].join('\n\n'),
        question:
          'How could you distinguish translation from tipping by watching the crown and root?',
        answer:
          'Translation shifts every point by the same vector without changing orientation. Tipping changes orientation about a pivot, so crown and root points follow different arcs.',
        scene: prediction,
      },
      {
        id: 'demonstrate-translation',
        title: 'Translation: the same displacement',
        notes: [
          'Suggested pacing: about 60 seconds. Ask the question while the demonstration is at its starting frame. Collect an answer before pressing Play.',
          translation.description,
          'Pause partway through. Ask students to keep following their two chosen points and describe whether the tooth has changed orientation. Continue to the endpoint, then reveal the answer.',
          translation.answer,
          'If the class needs another look, scrub back to the start and play again. Choose Next to compare a different geometric path from the same starting position.',
        ].join('\n\n'),
        question: translation.question,
        answer: translation.answer,
        scene: scene('translation'),
        demo: { caseId: definition.id, variantId: translation.id },
      },
      {
        id: 'demonstrate-tipping',
        title: 'Tipping: a change in orientation',
        notes: [
          'Suggested pacing: about 65 seconds. Let students inspect the restored starting position before asking the question. Keep the root visible and invite them to predict its path.',
          tipping.description,
          'Press Play and pause partway through. Ask what changed compared with translation: the orientation and the paths of the two selected points. Continue to the endpoint, then reveal the answer.',
          tipping.answer,
          'The pivot here is the displayed crown centre; this is an authored geometric illustration. Choose Next to summarise the comparison with the tipping endpoint held still.',
        ].join('\n\n'),
        question: tipping.question,
        answer: tipping.answer,
        scene: scene('tip'),
        demo: { caseId: definition.id, variantId: tipping.id },
      },
      {
        id: 'recap-and-discuss',
        title: 'Recap: describe what changed',
        notes: [
          'Suggested pacing: about 45 seconds. This is the held tipping endpoint, with no animation attached. Ask for a one-sentence comparison before revealing the answer.',
          'Invite one student to describe translation and another to describe tipping. Ask both to refer to the crown and root, rather than the crown alone.',
          'For a model question, choose Explore this question, inspect the model, then Return to lecture. To repeat the tipping demonstration, choose Previous; it returns to the prepared starting frame.',
          'Close with the distinction between the two displayed geometric paths. These examples do not calculate forces, biological response or treatment timing.',
        ].join('\n\n'),
        question: 'What distinguishes the two paths when you follow both crown and root?',
        answer:
          'In translation, every point receives the same displacement and orientation stays unchanged. In this tipping example, the tooth rotates about the displayed crown-centre pivot and crown and root points follow different arcs.',
        scene: scene('tip', 1),
      },
    ],
  });
}
