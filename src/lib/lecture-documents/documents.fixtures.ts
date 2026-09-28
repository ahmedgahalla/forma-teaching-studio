import { validateLectureScene } from './scene';
import type { LectureDocument, LectureScene, LectureStep } from './types';

export function createLectureStep(scene: LectureScene, title = 'Test step'): LectureStep {
  return {
    id: crypto.randomUUID(),
    title,
    notes: '',
    question: '',
    answer: '',
    scene: validateLectureScene(scene),
  };
}

export function createLectureDocument(
  scene: LectureScene,
  title = 'Test lecture',
): LectureDocument {
  return {
    version: 1,
    id: crypto.randomUUID(),
    title,
    updatedAt: '2026-09-27T00:00:00.000Z',
    steps: [createLectureStep(scene)],
  };
}

export function fixtureScene(): LectureScene {
  return {
    source: { kind: 'reference' },
    transforms: { '11': { translation: [0.2, 0, 0], rotation: [0, 2, 0] } },
    setup: {
      camera: {
        position: [10, 30, 80],
        target: [0, 0, 0],
        up: [0, 1, 0],
        view: 'perspective',
        far: 10000,
        maxDistance: 3000,
      },
      selectedIds: ['11'],
      arch: 'both',
      view: 'perspective',
      gums: true,
      labels: false,
      grid: false,
      stage: 10,
      opening: 0,
      jawOpen: false,
      anatomy: { bone: false, ligament: false, cutaway: false, opacity: 0.35 },
      magnification: 10,
      forceVectors: false,
      wirePreset: { material: 'stainless-steel', section: { shape: 'round', diameterMm: 0.35 } },
      mechanicsResponse: false,
      responseRevealed: false,
      predictResponse: false,
      playbackSpeed: 1,
      reverse: false,
    },
    roots: true,
    braces: false,
    attachments: false,
    bracketStyle: 'metal',
    ligatureColor: '#3298bb',
    applianceDisplay: { preset: 'none', progress: 0, palate: false },
    isolated: false,
  };
}
