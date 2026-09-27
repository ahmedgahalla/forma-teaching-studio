import { describe, expect, it } from 'vitest';
import { createLectureSample, validateLectureDocument } from './index';
import { createLectureDocument, createLectureStep, fixtureScene } from './documents.fixtures';

describe('authored lecture document validation', () => {
  it('preserves ordered notes, questions, answers and authored static poses', () => {
    const document = createLectureDocument(fixtureScene(), 'Root comparison');
    document.steps[0].notes = 'First, ask the class.\nThen show the roots.';
    document.steps[0].question = 'Which points moved?';
    document.steps[0].answer = 'Compare each point with the baseline.';
    document.steps.push(createLectureStep(fixtureScene(), 'Another view'));
    document.steps[1].scene.transforms['11'].translation = [1.3, 0.2, 0];
    expect(validateLectureDocument(document)).toEqual(document);
    expect(document.steps[0].demo).toBeUndefined();
  });

  it('returns independent scene objects while preserving authored step order', () => {
    const document = createLectureDocument(fixtureScene());
    document.steps = [createLectureStep(fixtureScene(), 'Second'), document.steps[0]];
    const before = structuredClone(document),
      validated = validateLectureDocument(document);
    expect(validated.steps.map(step => step.id)).toEqual(document.steps.map(step => step.id));
    validated.steps[0].scene.transforms['11'].rotation[0] = 12;
    validated.steps[0].scene.setup.camera!.position[0] = 60;
    validated.steps[0].scene.setup.selectedIds.push('21');
    validated.steps[0].notes = 'A separate explanation';
    expect(document).toEqual(before);
    expect(validated.steps[1]).toEqual(before.steps[1]);
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
    document.steps = Array.from({ length: 100 }, () => createLectureStep(fixtureScene()));
    expect(validateLectureDocument(document).steps).toHaveLength(100);
    document.steps.push(createLectureStep(fixtureScene()));
    expect(() => validateLectureDocument(document)).toThrow(/100/);
  });

  it('rejects a demonstration reference on a different source or with an unknown variant', () => {
    const document = createLectureSample();
    document.steps[1].scene.source = { kind: 'reference' };
    expect(() => validateLectureDocument(document)).toThrow(/match/);
    document.steps[1].scene.source = { kind: 'case', id: 'movement-types' };
    document.steps[1].demo!.variantId = 'clinical-movement';
    expect(() => validateLectureDocument(document)).toThrow(/match/);
  });
});
