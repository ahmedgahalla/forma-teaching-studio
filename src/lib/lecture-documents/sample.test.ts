import { describe, expect, it, vi } from 'vitest';
import { getTeachingCase, sampleCaseDemonstration } from '../teaching-cases';
import { validateLectureDocument } from './documents';
import { createLectureSample, SAMPLE_LECTURE_ID } from './sample';

describe('the built-in translation and tipping lecture', () => {
  it('has stable identity and content independent of the opening time', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
      const first = createLectureSample();
      vi.setSystemTime(new Date('2028-01-01T10:00:00Z'));
      const reopened = createLectureSample();
      expect(reopened).toEqual(first);
      expect(reopened.id).toBe(SAMPLE_LECTURE_ID);
      expect(new Set(reopened.steps.map(step => step.id)).size).toBe(4);
      expect(validateLectureDocument(reopened)).toEqual(reopened);
      expect(validateLectureDocument(JSON.parse(JSON.stringify(reopened)))).toEqual(reopened);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts with a static prediction and finishes at the authored tipping endpoint', () => {
    const sample = createLectureSample();
    expect(sample.steps).toHaveLength(4);
    const [prediction, , , recap] = sample.steps;
    expect(prediction.demo).toBeUndefined();
    expect(recap.demo).toBeUndefined();
    expect(prediction.scene.transforms).toEqual(
      sampleCaseDemonstration('movement-types', 'translation', 0),
    );
    expect(recap.scene.transforms).toEqual(sampleCaseDemonstration('movement-types', 'tip', 1));
    expect(prediction.scene.setup.stage).toBe(10);
    expect(recap.scene.setup.stage).toBe(10);
    for (const step of sample.steps) {
      expect(step.scene.source).toEqual({ kind: 'case', id: 'movement-types' });
      expect(step.scene.setup).toMatchObject({
        selectedIds: ['11'],
        arch: 'upper',
        camera: null,
        opening: 0,
        magnification: 1,
        anatomy: { bone: false, ligament: false, cutaway: false },
      });
      expect(step.scene.roots).toBe(true);
      expect(step.scene.braces).toBe(false);
      expect(step.scene.toothStudy).toBeUndefined();
      expect(step.scene.mechanics).toBeUndefined();
    }
  });

  it('reuses the audited variants and their questions without adding a movement path', () => {
    const sample = createLectureSample();
    const definition = getTeachingCase('movement-types');
    for (const [offset, id] of ['translation', 'tip'].entries()) {
      const step = sample.steps[offset + 1];
      const variant = definition.variants.find(item => item.id === id)!;
      expect(step.demo).toEqual({ caseId: definition.id, variantId: variant.id });
      expect(step.scene.transforms).toEqual(sampleCaseDemonstration(definition.id, id, 0));
      expect(step.scene.setup.stage).toBe(0);
      expect(step.scene.applianceDisplay).toEqual(variant.appliance);
      expect(step.question).toBe(variant.question);
      expect(step.notes).toContain(variant.description);
      expect(step.notes).toContain(variant.answer);
    }
    expect(sample.steps[1].scene.transforms).toEqual(sample.steps[2].scene.transforms);
    expect(sample.steps[0].notes).toContain(definition.assumptions[1]);
  });

  it('keeps presenter notes, questions and answers ready on all four steps', () => {
    for (const step of createLectureSample().steps) {
      expect(step.notes).toMatch(/Suggested pacing: about \d+ seconds/);
      expect(step.notes).toMatch(/ask/i);
      expect(step.question).toMatch(/\?$/);
      expect(step.answer.trim().length).toBeGreaterThan(0);
    }
  });

  it('gives steps and openings independent scene data without changing case content', () => {
    const canonical = createLectureSample();
    const changed = createLectureSample();
    const caseBefore = getTeachingCase('movement-types');
    changed.steps[1].scene.transforms['11'].translation[2] = 90;
    changed.steps[1].scene.setup.selectedIds.push('21');
    changed.steps[1].scene.setup.anatomy.opacity = 0.8;
    changed.steps[1].scene.applianceDisplay.preset = 'braces';
    changed.steps[1].notes = 'Temporary change';
    expect(changed.steps[0]).toEqual(canonical.steps[0]);
    expect(changed.steps[2]).toEqual(canonical.steps[2]);
    expect(createLectureSample()).toEqual(canonical);
    expect(getTeachingCase('movement-types')).toEqual(caseBefore);
  });
});
