import { getTeachingCase, sampleCaseDemonstration } from '../teaching-cases';
import type { LectureScene } from './types';

/** Ready-made scenes always start from authored case data, never the live workspace. */
export function preparedLectureScene(
  caseId: string,
  variantId: string,
  progress = 0,
): LectureScene {
  const definition = getTeachingCase(caseId);
  const variant = definition.variants.find(item => item.id === variantId);
  if (!variant) throw new Error('Choose an available lecture demonstration.');
  return {
    source: { kind: 'case', id: caseId },
    transforms: sampleCaseDemonstration(caseId, variantId, progress),
    setup: {
      camera: null,
      selectedIds: [...definition.selectedIds],
      arch: definition.arch,
      view: definition.view,
      gums: false,
      labels: false,
      grid: false,
      stage: progress === 0 ? 0 : 10,
      opening: 0,
      anatomy: { bone: false, ligament: false, cutaway: false, opacity: 0.35 },
      magnification: 1,
      forceVectors: false,
      wirePreset: { material: 'stainless-steel', section: { shape: 'round', diameterMm: 0.35 } },
      mechanicsResponse: false,
      responseRevealed: false,
      predictResponse: false,
      playbackSpeed: 1,
      reverse: false,
    },
    roots: true,
    braces: variant.appliance.preset !== 'none',
    attachments: false,
    bracketStyle: 'metal',
    ligatureColor: '#3298bb',
    applianceDisplay: structuredClone(variant.appliance),
    isolated: false,
  };
}
