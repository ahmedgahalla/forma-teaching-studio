import type { LectureComparison } from '@/lib/classroom/presentation';

export const LECTURE_COMPARISON_LABELS = {
  start: 'Starting arrangement',
  translation: 'Translation example',
  tip: 'Tipping example',
} as const;

export function lectureStepTitle(title: string, comparison?: LectureComparison | null) {
  return comparison ? `Comparison · ${LECTURE_COMPARISON_LABELS[comparison]}` : title;
}
