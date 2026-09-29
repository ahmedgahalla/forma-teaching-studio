import type { LectureStep } from '@/lib/lecture-documents';
import type { LectureComparison } from '@/lib/classroom/presentation';
import { hasMechanicsActivation } from '@/lib/mechanics/bracket-wire';

type Props = {
  step: LectureStep;
  mode: 'rehearse' | 'teach';
  comparison: LectureComparison | null;
  last: boolean;
};

export function LectureStepGuide({ step, mode, comparison, last }: Props) {
  const mechanics = step.scene.mechanics;
  const experiment =
    mechanics && hasMechanicsActivation(mechanics.config, mechanics.reference.teeth);
  const finish = `${step.answer ? 'Reveal answer after discussion. ' : ''}${last ? 'This is the final step.' : 'Then choose Next.'}`;
  const [heading, instruction] = comparison
    ? [
        'Comparison view',
        'Inspect this arrangement. Close comparison restores this step and its paused view.',
      ]
    : mode === 'rehearse'
      ? [
          'Review this step',
          'Read the notes below. Present resets this step to its prepared start and hides the notes and answer.',
        ]
      : experiment
        ? [
            'Interactive experiment',
            `Predict first. Choose Explore this question, open Commands and run “show what happens”. Return to lecture resumes this step. ${finish}`,
          ]
        : step.motion || step.demo
          ? [
              'Demonstration step',
              `Ask for a prediction, then press Play below the model. ${finish}`,
            ]
          : ['Inspection step', `Inspect this prepared view and discuss the question. ${finish}`];
  return (
    <section className="lecture-step-guide" aria-label="How to run this step">
      <strong>{heading}</strong>
      <p>{instruction}</p>
    </section>
  );
}
