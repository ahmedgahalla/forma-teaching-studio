import type { LectureStep } from '@/lib/lecture-documents';
import type { LectureComparison } from '@/lib/classroom/presentation';
import { hasMechanicsActivation } from '@/lib/mechanics/bracket-wire';

type Props = {
  step: LectureStep;
  comparison: LectureComparison | null;
  last: boolean;
  hasResponse: boolean;
};

export function LectureStepGuide({ step, comparison, last, hasResponse }: Props) {
  const mechanics = step.scene.mechanics;
  const experiment =
    mechanics && hasMechanicsActivation(mechanics.config, mechanics.reference.teeth);
  const instruction = comparison
    ? 'Comparison view. Close comparison to resume this step.'
    : experiment
      ? hasResponse
        ? 'Press Play below the model to replay the response.'
        : 'Calculate response below the model.'
      : step.motion || step.demo
        ? 'Press Play below the model to see the change.'
        : last
          ? 'Walkthrough complete. You can return to any step.'
          : null;
  return instruction ? <p className="lecture-step-guide">{instruction}</p> : null;
}
