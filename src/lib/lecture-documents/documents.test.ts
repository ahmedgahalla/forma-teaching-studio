import { describe, expect, it } from 'vitest';
import { getTeachingCase, sampleCaseDemonstration } from '../teaching-cases';
import {
  createLectureDocument,
  createLectureStep,
  duplicateLectureStep,
  createLectureSample,
  parseLectureDocument,
  serializeLectureDocument,
  validateLectureDocument,
} from './index';
import { fixtureScene } from './documents.fixtures';

describe('teacher-authored lecture documents', () => {
  it('round trips ordered notes, hidden answers and the actual displayed static pose', () => {
    const document = createLectureDocument(fixtureScene(), 'Root comparison');
    document.steps[0].notes = 'First, ask the class.\nThen show the roots.';
    document.steps[0].question = 'Which points moved?';
    document.steps[0].answer = 'Compare each point with the baseline.';
    document.steps.push(createLectureStep(fixtureScene(), 'Another view'));
    document.steps[1].scene.transforms['11'].translation = [1.3, 0.2, 0];
    expect(parseLectureDocument(serializeLectureDocument(document))).toEqual(document);
    expect(document.steps[0].demo).toBeUndefined();
  });

  it('duplicates and reorders steps without sharing scene, notes or source objects', () => {
    const scene = fixtureScene(),
      first = createLectureStep(scene, 'First');
    const second = duplicateLectureStep(first);
    second.title = 'Second';
    second.scene.transforms['11'].rotation[0] = 12;
    second.scene.setup.camera!.position[0] = 60;
    second.scene.setup.selectedIds.push('21');
    scene.transforms['11'].translation[0] = 99;
    expect(second.id).not.toBe(first.id);
    expect(first.scene.transforms['11']).toEqual({ translation: [0.2, 0, 0], rotation: [0, 2, 0] });
    expect(first.scene.setup.camera!.position[0]).toBe(10);
    expect(first.scene.setup.selectedIds).toEqual(['11']);
    const document = createLectureDocument(fixtureScene());
    document.steps = [second, first];
    expect(
      parseLectureDocument(serializeLectureDocument(document)).steps.map(step => step.id),
    ).toEqual([second.id, first.id]);
  });

  it.each([
    [
      'unsupported version',
      (raw: Record<string, unknown>) => {
        raw.version = 2;
      },
    ],
    [
      'extra fields',
      (raw: Record<string, unknown>) => {
        raw.model = {};
      },
    ],
    [
      'oversized title',
      (raw: Record<string, unknown>) => {
        raw.title = 'x'.repeat(161);
      },
    ],
    [
      'empty title',
      (raw: Record<string, unknown>) => {
        raw.title = '  ';
      },
    ],
    [
      'invalid date',
      (raw: Record<string, unknown>) => {
        raw.updatedAt = 'yesterday';
      },
    ],
    [
      'unsafe identifier',
      (raw: Record<string, unknown>) => {
        raw.id = '../lecture';
      },
    ],
  ])('rejects %s', (_, change) => {
    const raw = createLectureDocument(fixtureScene()) as unknown as Record<string, unknown>;
    change(raw);
    expect(() => validateLectureDocument(raw)).toThrow();
  });

  it('rejects duplicate identifiers, oversized notes and more than 100 steps', () => {
    const document = createLectureDocument(fixtureScene());
    document.steps.push(structuredClone(document.steps[0]));
    expect(() => validateLectureDocument(document)).toThrow(/unique/);
    document.steps.pop();
    document.steps[0].notes = 'x'.repeat(20001);
    expect(() => validateLectureDocument(document)).toThrow(/characters/);
    document.steps[0].notes = '';
    document.steps = Array.from({ length: 100 }, () => duplicateLectureStep(document.steps[0]));
    expect(validateLectureDocument(document).steps).toHaveLength(100);
    document.steps.push(duplicateLectureStep(document.steps[0]));
    expect(() => validateLectureDocument(document)).toThrow(/100/);
  });

  it('retains an empty draft without inventing a step', () => {
    const document = createLectureDocument(fixtureScene());
    document.steps = [];
    expect(validateLectureDocument(document).steps).toEqual([]);
  });

  it('uses authored translation and tip baselines, clearing inherited camera and study state', () => {
    const scene = fixtureScene();
    scene.source = { kind: 'arrangement', id: 'dental-class-iii' };
    scene.toothStudy = { tooth: '46', view: 'apical' };
    scene.isolated = true;
    scene.setup.opening = 12;
    scene.setup.anatomy.bone = true;
    const sample = createLectureSample(scene);
    expect(sample.steps).toHaveLength(3);
    expect(new Set(sample.steps.map(step => step.id)).size).toBe(3);
    expect(sample.steps[0].scene).toEqual(scene);
    const definition = getTeachingCase('movement-types');
    for (const [index, id] of ['translation', 'tip'].entries()) {
      const step = sample.steps[index + 1];
      const variant = definition.variants.find(item => item.id === id)!;
      expect(step.demo).toEqual({ caseId: 'movement-types', variantId: id });
      expect(step.scene.source).toEqual({ kind: 'case', id: 'movement-types' });
      expect(step.scene.transforms).toEqual(sampleCaseDemonstration('movement-types', id, 0));
      expect(step.scene.setup).toMatchObject({
        camera: null,
        stage: 0,
        opening: 0,
        arch: 'upper',
        selectedIds: ['11'],
        responseRevealed: false,
        anatomy: { bone: false },
      });
      expect(step.scene.toothStudy).toBeUndefined();
      expect(step.scene.isolated).toBe(false);
      expect([step.question, step.answer]).toEqual([variant.question, variant.answer]);
    }
    sample.steps[0].scene.setup.camera!.position[0] = -20;
    expect(scene.setup.camera!.position[0]).toBe(10);
  });

  it('rejects a demonstration reference on a different source or with an unknown variant', () => {
    const document = createLectureSample(fixtureScene());
    document.steps[1].scene.source = { kind: 'reference' };
    expect(() => validateLectureDocument(document)).toThrow(/match/);
    document.steps[1].scene.source = { kind: 'case', id: 'movement-types' };
    document.steps[1].demo!.variantId = 'clinical-movement';
    expect(() => validateLectureDocument(document)).toThrow(/match/);
  });
});
