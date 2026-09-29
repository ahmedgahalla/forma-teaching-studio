import { describe, expect, it } from 'vitest';
import { createLectureDocument, fixtureScene } from './documents.fixtures';
import { validateLectureDocument, validateLectureStep } from './documents';

function document() {
  const scene = fixtureScene();
  const value = createLectureDocument(scene);
  value.steps[0].motion = { from: {} };
  return value;
}

describe('authored lecture motion and case comparison schema', () => {
  it('round-trips independent start and endpoint poses without aliasing', () => {
    const value = document();
    value.steps[0].motion!.from = { '11': { translation: [1, 2, 3], rotation: [0, 20, 0] } };
    const validated = validateLectureDocument(JSON.parse(JSON.stringify(value)));
    expect(validated).toEqual(value);
    validated.steps[0].motion!.from['11'].translation[0] = 8;
    expect(value.steps[0].motion!.from['11'].translation[0]).toBe(1);
  });

  it.each([
    null,
    [],
    {},
    { from: {}, extra: true },
    { from: { '99': { translation: [0, 0, 0], rotation: [0, 0, 0] } } },
    { from: { '11': { translation: [NaN, 0, 0], rotation: [0, 0, 0] } } },
    { from: { '11': { translation: [10001, 0, 0], rotation: [0, 0, 0] } } },
    { from: { '11': { translation: [0, 0, 0], rotation: [0, 0, 0], ignored: true } } },
  ])('rejects malformed motion: %j', motion => {
    const value = document();
    Object.assign(value.steps[0], { motion });
    expect(() => validateLectureDocument(value)).toThrow();
  });

  it('rejects simultaneous authored paths and prepared demonstrations', () => {
    const value = document();
    value.steps[0].demo = { caseId: 'movement-types', variantId: 'translation' };
    expect(() => validateLectureDocument(value)).toThrow(/another demonstration or mechanics/);
  });

  it('requires exactly one comparison start and finish on the same model source', () => {
    const value = document();
    const start = value.steps[0];
    start.comparison = 'start';
    expect(() => validateLectureDocument(value)).toThrow(/one starting and one finished/);
    value.steps.push({ ...structuredClone(start), id: 'finished', comparison: 'finish' });
    expect(validateLectureDocument(value)).toEqual(value);
    value.steps[1].comparison = 'start';
    expect(() => validateLectureDocument(value)).toThrow(/one starting and one finished/);
    value.steps[1].comparison = 'finish';
    value.steps[1].scene.source = { kind: 'case', id: 'movement-types' };
    expect(() => validateLectureDocument(value)).toThrow(/same model source/);
  });

  it.each(['end', null, 2, { target: 'start' }])(
    'rejects unsupported comparison roles: %j',
    comparison => {
      expect(() => validateLectureStep({ ...document().steps[0], comparison })).toThrow();
    },
  );
});
