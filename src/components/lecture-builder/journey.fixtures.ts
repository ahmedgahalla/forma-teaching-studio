import { vi } from 'vitest';
import * as assets from '@/lib/anatomy-assets';
import * as geometry from '@/lib/geometry';
import { fixtureScene } from '@/lib/lecture-documents/documents.fixtures';
import { validateLectureDocument } from '@/lib/lecture-documents';
import { geometricMotion } from '@/lib/displayed-motion';
import type { ClassroomSnapshot } from '../case/types';

export function journeyFixture() {
  const start = fixtureScene();
  start.transforms = { '11': { translation: [1, 0, 0], rotation: [0, 20, 0] } };
  start.braces = false;
  start.applianceDisplay.preset = 'none';
  const finish = structuredClone(start);
  finish.transforms = { '11': { translation: [0, 0, 0], rotation: [0, 0, 0] } };
  finish.braces = true;
  finish.applianceDisplay.preset = 'braces';
  const content = {
    notes: 'Ask what changes.',
    question: 'What changes?',
    answer: 'Position and orientation.',
  };
  return validateLectureDocument({
    version: 1,
    id: 'journey-test',
    title: 'Journey',
    updatedAt: '2026-09-29T00:00:00.000Z',
    steps: [
      { id: 'start', title: 'Initial', ...content, scene: start, comparison: 'start' },
      { id: 'move', title: 'Align', ...content, scene: finish, motion: { from: start.transforms } },
      { id: 'finish', title: 'Finish', ...content, scene: finish, comparison: 'finish' },
    ],
  });
}

export function snapshotMotion(snapshot: ClassroomSnapshot) {
  return geometricMotion({
    demonstration: null,
    current: snapshot.history.current,
    original: snapshot.sandbox.original,
    checkpoints: snapshot.checkpoints,
  });
}

/** Share immutable test geometry while retaining fresh mutable metadata per scene. */
export function borrowJourneyModel(asset?: 'claude-atlas-v1') {
  const base = geometry.createDemo();
  const copy = (): geometry.DentalCase => ({
    ...base,
    ...(asset ? { asset } : {}),
    teeth: base.teeth.map(({ geometry, rootGeometry, ...metadata }) => ({
      ...structuredClone(metadata),
      geometry,
      rootGeometry,
    })),
    gums: base.gums.map(gum => ({ ...gum, position: [...gum.position] })),
  });
  vi.spyOn(geometry, 'createDemo').mockImplementation(copy);
  vi.spyOn(assets, 'getTeachingAssetCase').mockImplementation(copy);
  return () => {
    vi.restoreAllMocks();
    base.teeth.forEach(tooth => {
      tooth.geometry.dispose();
      tooth.rootGeometry?.dispose();
    });
    base.gums.forEach(gum => gum.geometry.dispose());
  };
}
