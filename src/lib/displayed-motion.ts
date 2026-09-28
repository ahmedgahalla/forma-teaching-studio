import type { Transforms } from './model';
import { stageTransforms, type Checkpoint } from './planning';
import { getTeachingCase, sampleCaseDemonstration } from './teaching-cases';
import { previewPose, type TryPreview } from './try-mode';
import { mechanicsDisplayPoses } from './mechanics-presentation';

/** The model and its teaching trails use one deterministic playback source. */
export type DisplayedMotion = {
  sample: (progress: number) => Transforms;
  breaks: readonly number[];
  traceable: boolean;
};

export function geometricMotion({
  caseId,
  variantId,
  demonstration,
  current,
  checkpoints,
  original,
}: {
  caseId?: string | null;
  variantId?: string | null;
  demonstration: TryPreview | null;
  current: Transforms;
  checkpoints: Checkpoint[];
  original?: Transforms;
}): DisplayedMotion {
  if (caseId && variantId)
    return {
      sample: progress => sampleCaseDemonstration(caseId, variantId, progress),
      breaks: getTeachingCase(caseId)
        .variants.find(variant => variant.id === variantId)!
        .keyframes.map(frame => frame.progress),
      traceable: true,
    };
  if (demonstration)
    return {
      sample: progress => previewPose(demonstration, progress),
      breaks: [],
      traceable: true,
    };
  return {
    // stageTransforms uses only the ratio, so two stages preserve the same path.
    sample: progress => stageTransforms(current, checkpoints, progress * 2, 2, original),
    breaks: checkpoints.map((_, index) => (index + 1) / (checkpoints.length + 1)),
    traceable: true,
  };
}

export function mechanicalMotion(
  reference: Transforms,
  result: Transforms,
  magnification: number,
  revealed: boolean,
): DisplayedMotion {
  return {
    sample: progress =>
      mechanicsDisplayPoses(reference, result, revealed ? progress : 0, magnification),
    breaks: [],
    traceable: revealed,
  };
}
