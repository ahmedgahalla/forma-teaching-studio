import type { ClassroomSnapshot } from '../case/types';
import type { LectureDocument } from '@/lib/lecture-documents';
import { COMPARISON_TARGETS, type LectureComparison } from '@/lib/classroom/presentation';
import { sampleCaseDemonstration } from '@/lib/teaching-cases';
import { lectureStepSnapshot } from './scene-bridge';

export function availableLectureComparisons(document: LectureDocument): LectureComparison[] {
  return COMPARISON_TARGETS.filter(target =>
    document.steps.some(
      step =>
        step.demo?.caseId === 'movement-types' &&
        step.demo.variantId === (target === 'tip' ? 'tip' : 'translation'),
    ),
  );
}

/** Absolute authored endpoints, with the current camera held fixed across A/B changes. */
export function lectureComparisonSnapshot(
  document: LectureDocument,
  target: LectureComparison,
  base: ClassroomSnapshot,
): ClassroomSnapshot {
  const variantId = target === 'tip' ? 'tip' : 'translation';
  const step = document.steps.find(
    item => item.demo?.caseId === 'movement-types' && item.demo.variantId === variantId,
  );
  if (!step) throw new Error('This lecture does not include that movement comparison.');
  const snapshot = lectureStepSnapshot(
    {
      ...step,
      demo: undefined,
      scene: {
        ...step.scene,
        transforms: sampleCaseDemonstration(
          'movement-types',
          variantId,
          target === 'start' ? 0 : 1,
        ),
        setup: { ...step.scene.setup, camera: base.camera },
      },
    },
    base,
  );
  return { ...snapshot, camera: base.camera };
}
