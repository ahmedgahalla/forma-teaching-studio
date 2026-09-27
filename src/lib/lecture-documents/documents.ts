import { getTeachingCase } from '../teaching-cases';
import { fields, identifier, object, text } from './fields';
import { validateLectureScene } from './scene';
import type { LectureDocument, LectureScene, LectureStep } from './types';

export const MAX_LECTURE_STEPS = 100;

function validateStep(raw: unknown): LectureStep {
  const value = object(raw);
  fields(value, ['id', 'title', 'notes', 'question', 'answer', 'scene'], ['demo']);
  const step: LectureStep = {
    id: identifier(value.id),
    title: text(value.title, 160),
    notes: text(value.notes, 20000, true),
    question: text(value.question, 2000, true),
    answer: text(value.answer, 10000, true),
    scene: validateLectureScene(value.scene),
  };
  if (value.demo !== undefined) {
    const demo = object(value.demo);
    fields(demo, ['caseId', 'variantId']);
    const caseId = text(demo.caseId, 100),
      variantId = text(demo.variantId, 100);
    if (
      step.scene.source.kind !== 'case' ||
      step.scene.source.id !== caseId ||
      !getTeachingCase(caseId).variants.some(item => item.id === variantId)
    )
      throw new Error('Lecture demonstration must match its prepared case and variant.');
    step.demo = { caseId, variantId };
  }
  return step;
}

export function validateLectureDocument(raw: unknown): LectureDocument {
  const value = object(raw);
  fields(value, ['version', 'id', 'title', 'updatedAt', 'steps']);
  if (value.version !== 1) throw new Error('Unsupported lecture document version.');
  const updatedAt = text(value.updatedAt, 40);
  if (!Number.isFinite(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt)
    throw new Error('Invalid lecture update date.');
  if (!Array.isArray(value.steps) || value.steps.length > MAX_LECTURE_STEPS)
    throw new Error(`A lecture may contain at most ${MAX_LECTURE_STEPS} steps.`);
  const steps = value.steps.map(validateStep);
  if (new Set(steps.map(step => step.id)).size !== steps.length)
    throw new Error('Lecture step identifiers must be unique.');
  return {
    version: 1,
    id: identifier(value.id),
    title: text(value.title, 160),
    updatedAt,
    steps,
  };
}

export function createLectureStep(scene: LectureScene, title = 'New step'): LectureStep {
  return validateStep({
    id: crypto.randomUUID(),
    title,
    notes: '',
    question: '',
    answer: '',
    scene,
  });
}

export function createLectureDocument(
  scene: LectureScene,
  title = 'Untitled lecture',
): LectureDocument {
  return validateLectureDocument({
    version: 1,
    id: crypto.randomUUID(),
    title,
    updatedAt: new Date().toISOString(),
    steps: [createLectureStep(scene)],
  });
}

export function duplicateLectureStep(step: LectureStep): LectureStep {
  return validateStep({ ...step, id: crypto.randomUUID() });
}
