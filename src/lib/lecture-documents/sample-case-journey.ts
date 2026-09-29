import { FEATURED_LECTURE_ID } from './constants';
import { validateLectureDocument } from './documents';
import { caseJourneyScenes } from './sample-case-journey-scenes';
import { CASE_JOURNEY_SOURCES } from './sample-case-journey-sources';
import type { LectureDocument } from './types';

const source = (index: number) => {
  const item = CASE_JOURNEY_SOURCES[index];
  return `Source: ${item.title}. ${item.url}`;
};

/** One continuous synthetic case, with authored checkpoints and a separate wire experiment. */
export function createCaseJourneyLecture(): LectureDocument {
  const scenes = caseJourneyScenes();
  return validateLectureDocument({
    version: 1,
    id: FEATURED_LECTURE_ID,
    title: 'One case: expansion, alignment and retention',
    updatedAt: '2026-09-29T00:00:00.000Z',
    steps: [
      {
        id: 'assess-the-starting-bite',
        title: '1. Meet the case',
        notes: [
          'Suggested pacing: about 35 seconds.',
          'Synthetic teaching case; evidence-informed, with Professor Nael review pending.',
          'This story assumes a growing adolescent with a narrow upper transverse relationship and mild upper anterior irregularity. Growth suitability and healthy supporting tissues are assumptions for discussion, not findings established by this model.',
          'Use the open-jaw view to inspect each arch; this separated view does not demonstrate biting contacts. Rotate the model and compare the upper and lower posterior teeth. Ask students to identify the transverse relationship and the irregular anterior positions before revealing the answer. Keep this initial arrangement as the comparison baseline.',
          'Clinical assessment would establish the dental and skeletal contributions, growth, space, oral health and any functional displacement, using appropriate records. This lecture contains authored stages; its separate wire experiment shows only an initial elastic response.',
          source(0),
        ].join('\n\n'),
        question: 'What must we establish before choosing an appliance?',
        answer:
          'The source of the transverse discrepancy, available space, growth status, oral health and function. A digital view of tooth positions alone cannot establish these.',
        scene: scenes.assess,
        comparison: 'start',
      },
      {
        id: 'choose-the-sequence',
        title: '2. Agree the objectives',
        notes: [
          'Suggested pacing: about 20 seconds.',
          'Ask the class to separate the transverse objective from the alignment objective. This case illustrates expansion, reassessment, brackets and wire alignment, finishing, then retention.',
          'Discuss an alternative: a localized dental crossbite or different growth and periodontal findings may require a different approach. The sequence shown here belongs to the stated case assumptions.',
          'Ask students to predict what the first appliance should change. Choose Next to inspect its attachments.',
        ].join('\n\n'),
        question: 'Why address the transverse relationship before final alignment here?',
        answer:
          'The case assumes upper transverse deficiency. The plan first addresses that relationship, reassesses, then aligns and finishes the teeth.',
        scene: scenes.objectives,
      },
      {
        id: 'fit-the-bands',
        title: '3. Prepare the attachments',
        notes: [
          'Suggested pacing: about 20 seconds.',
          'Inspect the posterior bands from the side and occlusal views. The teeth remain in their starting positions while the appliance attachments appear.',
          'Ask students to distinguish attachment placement from activation. In a clinical fitting, seating, tissue clearance and hygiene access would need assessment.',
          'Choose Next to see how the expander connects to these attachments.',
        ].join('\n\n'),
        question: 'Has adding an attachment changed the transverse relationship?',
        answer:
          'No. An attachment connects an appliance to teeth; its placement alone is not the planned correction.',
        scene: scenes.bands,
      },
      {
        id: 'fit-the-expander',
        title: '4. Place the expander',
        notes: [
          'Suggested pacing: about 25 seconds.',
          'Inspect the expander in the upper occlusal view. Trace its relationship to the posterior attachments before discussing activation.',
          'Ask what should be checked after fitting. The general sequence includes fit, clinician-directed activation, progress checks and a stabilization stage. No activation schedule is prescribed in this lesson.',
          source(1),
        ].join('\n\n'),
        question: 'What is the difference between placement and activation?',
        answer:
          'Placement establishes the appliance connection. Activation changes its mechanical state; progress and tissue health then need monitoring.',
        scene: scenes.expander,
      },
      {
        id: 'illustrate-transverse-change',
        title: '5. Show the expansion stage',
        notes: [
          'Suggested pacing: about 35 seconds.',
          'Ask for a prediction, then press Play to move from the fitted-appliance pose to this authored transverse checkpoint. Pause to follow the posterior teeth, then continue to the endpoint.',
          'The wider dental arrangement illustrates a stage of the case. It does not demonstrate that a midpalatal suture opened. A clinical adolescent trial measured both transverse dental changes and buccal inclination after expansion.',
          'Follow the posterior crowns from the upper occlusal view. Do not read animation speed or displayed distance as an activation prescription.',
          source(2),
        ].join('\n\n'),
        question: 'Does a wider dental arch prove skeletal expansion?',
        answer:
          'No. Dental displacement and inclination are different from skeletal expansion. Tooth positions alone do not establish sutural change.',
        scene: scenes.expansion,
        motion: { from: structuredClone(scenes.expander.transforms) },
      },
      {
        id: 'hold-and-reassess',
        title: '6. Hold and reassess',
        notes: [
          'Suggested pacing: about 20 seconds.',
          'Hold the expansion checkpoint still with the appliance retained. Ask students what they would reassess before moving to alignment.',
          'Stabilization is a distinct stage. Review the transverse relationship, tissue health and readiness for the next appliance. A wider-looking model does not establish stability.',
          'Choose Next to begin the bracket portion of this illustrated sequence.',
        ].join('\n\n'),
        question: 'Why include a hold and reassessment stage?',
        answer:
          'To maintain the achieved relationship while the clinician reassesses progress and readiness for the next stage.',
        scene: scenes.reassess,
      },
      {
        id: 'place-the-brackets',
        title: '7. Place the brackets',
        notes: [
          'Suggested pacing: about 25 seconds.',
          'Inspect the brackets before adding the prepared wire. Select an anterior tooth and discuss its bracket position and orientation.',
          'The brackets are attachment points for the wire. Ask students how an altered attachment position could change its relationship to the wire, rather than treating a bracket as a decoration.',
          'Choose Next to establish a passive configuration before introducing activation.',
        ].join('\n\n'),
        question: 'Are visible brackets enough to demonstrate an active force system?',
        answer:
          'No. The wire and its engagement with the attachments matter. Brackets alone do not establish the intended corrective load.',
        scene: scenes.brackets,
      },
      {
        id: 'fit-a-passive-wire',
        title: '8. Establish a passive wire',
        notes: [
          'Suggested pacing: about 25 seconds.',
          'This prepared wire has zero width activation. Inspect it while the teeth remain at the same checkpoint. A visible wire is not proof of a nonzero modeled load.',
          'Ask students to predict what should happen when this prepared configuration is calculated. The next step changes the activation while keeping the case reference.',
          'Round wires are commonly used for early alignment and rectangular wires for later control. These broad roles are not a required wire prescription.',
          source(3),
        ].join('\n\n'),
        question: 'Why should this prepared passive configuration remain still?',
        answer:
          'It has no authored width activation. The wire is present, but this prepared input does not impose that displacement.',
        scene: scenes.passiveWire,
      },
      {
        id: 'test-wire-activation',
        title: '9. Test wire activation',
        notes: [
          'Suggested pacing: about 55 seconds.',
          'The prepared wire now has width activation. Ask for a prediction before revealing a calculated response. The scene supplies inputs; opening this step does not run a calculation.',
          'Choose Explore this question, then Show what happens. Inspect the calculated tooth response and force display, and compare with zero activation if useful. Choose Return to lecture to resume the prepared lecture.',
          'This is a bounded initial elastic experiment with virtual supports. Width activation here is a software comparison, not a clinical archwire prescription. It does not calculate biological remodeling or the later alignment checkpoint.',
        ].join('\n\n'),
        question: 'Will this calculation tell us the eventual treatment result?',
        answer:
          'No. It shows the initial elastic response to the prepared input under the model assumptions. The later case stages are separately authored.',
        scene: scenes.activeWire,
      },
      {
        id: 'review-alignment-progress',
        title: '10. Follow alignment progress',
        notes: [
          'Suggested pacing: about 30 seconds.',
          'Return to the case story. Press Play to move from the previous case pose to the authored alignment checkpoint, with braces visible.',
          'Follow the anterior irregularity and ask students to describe position and orientation separately. Pause or replay to compare the paths of the two lateral incisors.',
          'This animation is a prepared teaching transition, not accumulated output from the wire calculation. Discuss which observations would prompt reassessment before finishing.',
        ].join('\n\n'),
        question: 'What should we compare as alignment progresses?',
        answer:
          'Tooth position and orientation, available space and relationships to neighboring and opposing teeth. An aligned crown alone does not describe the whole tooth.',
        scene: scenes.alignment,
        motion: { from: structuredClone(scenes.activeWire.transforms) },
      },
      {
        id: 'refine-the-finish',
        title: '11. Refine the finish',
        notes: [
          'Suggested pacing: about 25 seconds.',
          'From the upper front view, press Play to complete the remaining authored lateral-incisor displacement and rotations. Keep attention on the two incisors while the braces remain visible.',
          'Ask students to distinguish the smaller final changes in position and orientation. Pause the motion and replay it if the small rotations are difficult to follow.',
          'This stage completes the remaining displacement and rotations. Choose Next to inspect the static review configuration and discuss completion criteria.',
        ].join('\n\n'),
        question: 'What changes in this last alignment transition?',
        answer:
          'The lateral incisors complete their remaining displacement and rotations toward the authored finishing endpoint. Position and orientation are distinct observations.',
        scene: scenes.finishing,
        motion: { from: structuredClone(scenes.alignment.transforms) },
      },
      {
        id: 'review-before-removal',
        title: '12. Review before removal',
        notes: [
          'Suggested pacing: about 40 seconds.',
          'Keep both arches still and inspect the prepared passive rectangular upper wire. Rotate the model and ask what else needs assessment before appliance removal.',
          'A rectangular wire does not guarantee an intended inclination: actual wire and slot geometry, clearance and stiffness influence torque expression. Discuss oral health, function and occlusal relationships as well as appearance.',
          'Choose Next only after the discussion, so appliance removal is a separate decision in the story.',
          source(4),
        ].join('\n\n'),
        question: 'Do straight-looking crowns and a rectangular wire establish a completed result?',
        answer:
          'No. Wire engagement and torque expression need assessment, alongside oral health, function and relationships within and between the arches.',
        scene: scenes.review,
      },
      {
        id: 'remove-and-compare',
        title: '13. Remove appliances and compare',
        notes: [
          'Suggested pacing: about 25 seconds.',
          'The active appliances are removed while the authored finishing pose is retained. Compare this endpoint with the original case arrangement.',
          'Ask students to name the changes in sequence: transverse relationship, alignment, then refinement. Revisit an earlier step if they need to inspect a particular appliance.',
          'This is the end of the active-appliance story, not the end of follow-up. Choose Next for retention.',
        ].join('\n\n'),
        question: 'Which separate objectives did the case illustrate?',
        answer:
          'An illustrated transverse change, anterior alignment and finishing, with reassessment between stages. These are authored teaching checkpoints.',
        scene: scenes.debond,
        comparison: 'finish',
      },
      {
        id: 'retain-and-monitor',
        title: '14. Retain and monitor',
        notes: [
          'Suggested pacing: about 25 seconds.',
          'Inspect the illustrative bonded lingual retainer from the upper occlusal view and ask why it appears after active appliances have been removed.',
          'Teeth can change position after active treatment. The illustrated bonded wire retains the anterior segment; maintaining posterior and transverse relationships requires a separately assessed retention plan. Retention and monitoring are individualized.',
          'End by asking students to explain one decision at each stage rather than simply naming the appliances. Return to the initial and final comparison for the closing discussion.',
          source(5),
          source(6),
        ].join('\n\n'),
        question: 'Why does the case continue after braces are removed?',
        answer:
          'Maintaining the result needs retention and monitoring because teeth can change position after active treatment.',
        scene: scenes.retention,
      },
    ],
  });
}
