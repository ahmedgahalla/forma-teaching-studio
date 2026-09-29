import type { TeachingAction } from '@/lib/lecture';
import type { LectureStep } from '@/lib/lecture-documents';
import type { LectureComparison } from '@/lib/classroom/presentation';
import { hasMechanicsActivation } from '@/lib/mechanics/bracket-wire';

/** Only authored, activated inputs can be calculated without leaving the walkthrough. */
export function canRunLectureMechanics(
  step: LectureStep | undefined,
  comparison: LectureComparison | null,
) {
  const experiment = step?.scene.mechanics;
  return !!(
    !comparison &&
    experiment &&
    hasMechanicsActivation(experiment.config, experiment.reference.teeth)
  );
}

export function isLectureCalculation(
  actions: TeachingAction[],
  step: LectureStep | undefined,
  comparison: LectureComparison | null,
) {
  return (
    actions.length === 1 &&
    actions[0].kind === 'mechanics' &&
    actions[0].action.type === 'solve' &&
    canRunLectureMechanics(step, comparison)
  );
}
