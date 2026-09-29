import { getTeachingCase } from '../teaching-cases';
import { choice, fields, identifier, object, text } from './fields';
import { validateLectureScene, validateLectureTransforms } from './scene';
import { lectureSourceIds } from './model';
import type { LectureDocument, LectureStep } from './types';

export const MAX_LECTURE_STEPS = 100;

export function validateLectureStep(raw: unknown): LectureStep {
  const value = object(raw);
  fields(
    value,
    ['id', 'title', 'notes', 'question', 'answer', 'scene'],
    ['demo', 'biology', 'motion', 'comparison'],
  );
  const step: LectureStep = {
    id: identifier(value.id),
    title: text(value.title, 160),
    notes: text(value.notes, 20000, true),
    question: text(value.question, 2000, true),
    answer: text(value.answer, 10000, true),
    scene: validateLectureScene(value.scene),
  };
  if (value.biology !== undefined)
    step.biology = choice(value.biology, ['overview', 'compression', 'tension'] as const);
  if (value.comparison !== undefined)
    step.comparison = choice(value.comparison, ['start', 'finish'] as const);
  if (value.motion !== undefined) {
    if (value.demo !== undefined || step.scene.mechanics)
      throw new Error('Authored lecture motion cannot include another demonstration or mechanics.');
    const motion = object(value.motion);
    fields(motion, ['from']);
    step.motion = {
      from: validateLectureTransforms(motion.from, lectureSourceIds(step.scene.source)),
    };
  }
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
  const steps = value.steps.map(validateLectureStep);
  if (new Set(steps.map(step => step.id)).size !== steps.length)
    throw new Error('Lecture step identifiers must be unique.');
  const comparisons = steps.flatMap(step => (step.comparison ? [step.comparison] : []));
  if (comparisons.length && (comparisons.length !== 2 || new Set(comparisons).size !== 2))
    throw new Error('A case comparison needs one starting and one finished arrangement.');
  if (comparisons.length) {
    const sources = steps
      .filter(step => step.comparison)
      .map(step => JSON.stringify(step.scene.source));
    if (sources[0] !== sources[1])
      throw new Error('Case comparison arrangements must use the same model source.');
  }
  return {
    version: 1,
    id: identifier(value.id),
    title: text(value.title, 160),
    updatedAt,
    steps,
  };
}
