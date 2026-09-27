import { getTeachingAssetCase } from '../anatomy-assets';
import { validateAttachment } from '../attachments';
import { createDentalArrangement, DENTAL_ARRANGEMENTS } from '../dental-arrangements';
import { createDemo, type DentalCase } from '../geometry';
import { createTeachingCase, getTeachingCase } from '../teaching-cases';
import { choice, fields, object, text } from './fields';
import type { LectureScene, LectureSource } from './types';

export function validateLectureSource(raw: unknown): LectureSource {
  const value = object(raw);
  const kind = choice(value.kind, ['reference', 'case', 'arrangement'] as const);
  fields(value, kind === 'reference' ? ['kind'] : ['kind', 'id']);
  if (kind === 'reference') return { kind };
  const id = text(value.id, 100);
  if (kind === 'case') getTeachingCase(id);
  else if (!DENTAL_ARRANGEMENTS.some(item => item.id === id))
    throw new Error('Unknown lecture dental arrangement.');
  return { kind, id };
}

const referenceIds = ['1', '2', '3', '4'].flatMap(quadrant =>
  Array.from({ length: 7 }, (_, i) => `${quadrant}${i + 1}`),
);
const caseIds = new Map<string, string[]>();

/** Tooth presence is recipe data; avoid rebuilding an arrangement's surface audit here. */
export function lectureSourceIds(source: LectureSource): Set<string> {
  if (source.kind !== 'case') return new Set(referenceIds);
  let ids = caseIds.get(source.id);
  if (!ids) {
    const asset = getTeachingAssetCase(),
      base = asset ?? createDemo();
    try {
      ids = createTeachingCase(base, source.id).model.teeth.map(tooth => tooth.id);
      caseIds.set(source.id, ids);
    } finally {
      if (!asset) {
        base.teeth.forEach(tooth => {
          tooth.geometry.dispose();
          tooth.rootGeometry?.dispose();
        });
        base.gums.forEach(gum => gum.geometry.dispose());
      }
    }
  }
  return new Set(ids);
}

/** Rebuild source metadata, borrowing the canonical model's immutable geometry. */
export function lectureSceneModel(scene: LectureScene): DentalCase {
  const source = validateLectureSource(scene.source),
    base = createDemo();
  const model =
    source.kind === 'reference'
      ? base
      : source.kind === 'case'
        ? createTeachingCase(base, source.id).model
        : createDentalArrangement(base, source.id).model;
  const attachments = scene.attachmentsByTooth ?? {};
  if (Object.keys(attachments).some(id => !model.teeth.some(tooth => tooth.id === id)))
    throw new Error('A lecture attachment refers to an absent tooth.');
  return {
    ...model,
    teeth: model.teeth.map(tooth => ({
      ...tooth,
      ...(attachments[tooth.id] ? { attachment: validateAttachment(attachments[tooth.id]) } : {}),
    })),
  };
}
