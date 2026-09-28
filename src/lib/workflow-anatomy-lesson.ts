import type { WorkflowStep } from './workflows';

export const anatomySteps: WorkflowStep[] = [
  {
    title: 'Explore the tooth and socket',
    action: 'Inspect the labelled cutaway',
    explanation:
      'This separate schematic model shows the tooth and its socket. Gingiva surrounds the neck; the periodontal ligament connects the root covering to supporting alveolar bone. The coloured ligament sleeve is enlarged for visibility.',
    observe:
      'Locate the crown, root, gingiva, ligament and supporting bone. Orbit to inspect the open section.',
    question: 'Is the coloured ligament sleeve drawn at its true thickness?',
    answer: 'No. It is deliberately exaggerated to make the relationship visible in a lecture.',
    phase: 'assessment',
    view: 'perspective',
    arch: 'upper',
    arrows: false,
    palate: false,
  },
  {
    title: 'Demonstrate translation',
    action: 'Move the whole tooth sideways without rotating it',
    explanation:
      'Translation gives each point the same displacement while maintaining orientation. The root and crown move together. The fixed socket and enlarged ligament are reference illustrations; they do not calculate living tissue response.',
    observe:
      'Watch the crown and root shift mesially across the front view by the same amount. Use the original overlay to compare their positions.',
    question: 'Does the root remain stationary during translation?',
    answer: 'No. In this geometric example the root and crown have the same displacement.',
    phase: 'movement',
    view: 'front',
    arch: 'upper',
    arrows: false,
    palate: false,
  },
  {
    title: 'Demonstrate tipping',
    action: 'Rotate the tooth about an illustrative pivot',
    explanation:
      'An angular change alters the tooth orientation, so its points have different displacements. This example rotates about the existing crown-centre geometric pivot, not a calculated centre of resistance.',
    observe:
      'Compare root and crown movement. Turn on the original overlay to make the angular difference visible.',
    question: 'Does the animation identify the clinical centre of resistance?',
    answer: 'No. The pivot is chosen to demonstrate geometry and does not solve a force system.',
    phase: 'movement',
    view: 'front',
    arch: 'upper',
    arrows: false,
    palate: false,
  },
  {
    title: 'Compare and discuss',
    action: 'Compare translation with tipping',
    explanation:
      'Translation preserves orientation; tipping changes it. Return to either movement step to replay it, or make a temporary variation with an explicit tooth movement. Return to the lesson restores its authored setup.',
    observe:
      'Use the Translation and Tipping buttons to compare the same tooth, then repeat more slowly.',
    question: 'Can visible crown displacement alone describe the entire movement?',
    answer:
      'No. Root displacement and orientation also matter, and a geometric model does not establish the biological response.',
    phase: 'retention',
    view: 'front',
    arch: 'upper',
    arrows: false,
    palate: false,
  },
];
export const anatomyDefinition = {
  id: 'anatomy',
  title: 'Inside a tooth: translation and tipping',
  learningGoal:
    'Identify the tissues around a tooth, then compare displacement with a change in orientation.',
  steps: anatomySteps,
  sources: [
    {
      title: 'NIDCR: tooth and supporting-tissue anatomy',
      url: 'https://www.nidcr.nih.gov/sites/default/files/2021-04/Open-Wide-and-Trek-Inside.pdf',
    },
  ],
};
