import type { LectureStep } from '@/lib/lecture-documents';
import type { DentalCase } from '@/lib/geometry';
import type { Transforms } from '@/lib/model';
import { createMechanicsExperiment, validateMechanicsConfiguration } from '@/lib/mechanics/state';

/** Carry only explicitly authored inputs into a fresh experiment at the physical displayed pose. */
export function lectureExploration(
  step: LectureStep | undefined,
  model: DentalCase,
  actual: Transforms,
  shown: Transforms,
) {
  if (!step?.scene.mechanics || step.demo || step.motion)
    return { transforms: structuredClone(shown), mechanics: null };
  const transforms = structuredClone(actual);
  const mechanics = createMechanicsExperiment(model, transforms);
  mechanics.config = structuredClone(step.scene.mechanics.config);
  validateMechanicsConfiguration(mechanics);
  return { transforms, mechanics };
}
