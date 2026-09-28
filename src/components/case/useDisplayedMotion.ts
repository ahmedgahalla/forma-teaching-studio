'use client';
import { useMemo } from 'react';
import { geometricMotion, mechanicalMotion } from '@/lib/displayed-motion';
import { interpolateTransforms } from '@/lib/planning';
import type { MechanicsExperiment } from '@/lib/mechanics';

type MotionInputs = Parameters<typeof geometricMotion>[0] & {
  mechanics: MechanicsExperiment | null;
  pending: boolean;
  responseRevealed: boolean;
  magnification: number;
  stage: number;
  stages: number;
};

/** Share the exact displayed trajectory with teaching trails, independent of playback cadence. */
export function useDisplayedMotion({
  caseId,
  variantId,
  demonstration,
  current,
  checkpoints,
  original,
  mechanics,
  pending,
  responseRevealed,
  magnification,
  stage,
  stages,
}: MotionInputs) {
  const geometricPath = useMemo(
    () => geometricMotion({ caseId, variantId, demonstration, current, checkpoints, original }),
    [caseId, variantId, demonstration, current, checkpoints, original],
  );
  const geometricShown = useMemo(
    () => geometricPath.sample(stage / stages),
    [geometricPath, stage, stages],
  );
  const displayedMotion = useMemo(
    () =>
      mechanics?.result && !pending
        ? mechanicalMotion(
            mechanics.reference.transforms,
            mechanics.result.transforms,
            magnification,
            responseRevealed,
          )
        : geometricPath,
    [mechanics, pending, magnification, responseRevealed, geometricPath],
  );
  const shown = useMemo(
    () =>
      displayedMotion === geometricPath ? geometricShown : displayedMotion.sample(stage / stages),
    [displayedMotion, geometricPath, geometricShown, stage, stages],
  );
  const actualShown = useMemo(
    () =>
      mechanics?.result && !pending
        ? interpolateTransforms(
            mechanics.reference.transforms,
            mechanics.result.transforms,
            responseRevealed ? stage / stages : 0,
          )
        : geometricShown,
    [mechanics, pending, responseRevealed, stage, stages, geometricShown],
  );
  return { geometricShown, actualShown, shown, displayedMotion };
}
