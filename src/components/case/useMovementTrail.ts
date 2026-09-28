'use client';
import { useMemo } from 'react';
import { createMovementTrail } from '@/lib/movement-trails';
import type { CaseStudioApi } from './api';

export type MovementTrailInputs = Pick<
  CaseStudioApi,
  'model' | 'selected' | 'traces' | 'dragPreview' | 'toothStudy' | 'displayedMotion'
>;

/** Sample only when the source changes; camera, pause and scrub do not rebuild the path. */
export function useMovementTrail({
  model,
  selected,
  traces,
  dragPreview,
  toothStudy,
  displayedMotion,
}: MovementTrailInputs) {
  const blocked = !!dragPreview || !!toothStudy;
  return useMemo(() => {
    if (!traces || blocked || !displayedMotion.traceable) return null;
    const tooth = model.teeth.find(item => item.id === selected);
    return tooth
      ? createMovementTrail(tooth, displayedMotion.sample, displayedMotion.breaks)
      : null;
  }, [model, selected, traces, blocked, displayedMotion]);
}
