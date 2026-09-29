import type { ClassroomSnapshot } from '../case/types';
import type { LectureDocument } from '@/lib/lecture-documents';
import { COMPARISON_TARGETS, type LectureComparison } from '@/lib/classroom/presentation';
import { sampleCaseDemonstration } from '@/lib/teaching-cases';
import { lectureStepSnapshot } from './scene-bridge';

export function availableLectureComparisons(document: LectureDocument): LectureComparison[] {
  const authored = document.steps.flatMap(step => (step.comparison ? [step.comparison] : []));
  if (authored.length) return ['start', 'finish'];
  return COMPARISON_TARGETS.filter(
    target =>
      target !== 'finish' &&
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
  const authored = document.steps.find(step => step.comparison === target);
  if (authored) {
    const { motion: _motion, demo: _demo, ...held } = authored;
    const jawOpen =
      document.steps.find(step => step.comparison === 'start')?.scene.setup.jawOpen ?? false;
    return lectureStepSnapshot(
      {
        ...held,
        scene: { ...held.scene, setup: { ...held.scene.setup, jawOpen } },
      },
      base,
      true,
    );
  }
  if (!availableLectureComparisons(document).includes(target))
    throw new Error('This lecture does not include that movement comparison.');
  const variantId = target === 'tip' ? 'tip' : 'translation';
  const step = document.steps.find(
    item => item.demo?.caseId === 'movement-types' && item.demo.variantId === variantId,
  );
  if (!step) throw new Error('This lecture does not include that movement comparison.');
  return lectureStepSnapshot(
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
      },
    },
    base,
    true,
  );
}
