import { describe, expect, it } from 'vitest';
import { sampleCaseDemonstration } from '../teaching-cases';
import { createDemoLectures, DEMO_LECTURES } from './catalog';
import { validateLectureDocument } from './documents';
import { createLectureSample } from './sample';
import { createAnchorageLecture } from './sample-anchorage';
import { createBiologyLecture } from './sample-biology';

describe('ready-made demo lecture pack', () => {
  it('has four distinct validated documents and preserves the original four-step sample', () => {
    const documents = createDemoLectures();
    expect(documents.map(item => item.id)).toEqual(DEMO_LECTURES.map(item => item.id));
    expect(new Set(documents.map(item => item.id)).size).toBe(4);
    expect(documents.map(item => item.steps.length)).toEqual([17, 4, 6, 6]);
    expect(documents[1]).toEqual(createLectureSample());
    for (const document of documents) {
      expect(validateLectureDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
      for (const step of document.steps) {
        expect(step.answer.split(/\s+/).length).toBeLessThanOrEqual(30);
        expect(step.answer).not.toMatch(/ask students|professor|presenter|reveal answer/i);
        expect(step.answer).not.toMatch(/^(Yes|No)[.:]/);
        if (document.id !== documents[0].id) {
          expect(step.notes).toMatch(/Suggested pacing: about \d+ seconds/);
          expect(step.notes).toMatch(/ask/i);
        }
        expect(step.question).toMatch(/\?$/);
        expect(step.answer.trim().length).toBeGreaterThan(30);
      }
    }
  });

  it('compares two authored space-use paths from the same start and retains their endpoints', () => {
    const { steps } = createAnchorageLecture();
    expect(steps[1].demo).toEqual({
      caseId: 'anchorage-space-closure',
      variantId: 'posterior-held',
    });
    expect(steps[2].demo).toEqual({
      caseId: 'anchorage-space-closure',
      variantId: 'shared-space-use',
    });
    expect(steps[1].scene.transforms).toEqual(steps[2].scene.transforms);
    for (const [offset, variant] of ['posterior-held', 'shared-space-use'].entries()) {
      expect(steps[3 + offset].scene.transforms).toEqual(
        sampleCaseDemonstration('anchorage-space-closure', variant, 1),
      );
      expect(steps[3 + offset].demo).toBeUndefined();
    }
    for (const step of steps) {
      expect(step.scene.setup.selectedIds).toEqual(expect.arrayContaining(['11', '16', '26']));
      expect(step.scene.setup.selectedIds).not.toContain('14');
      expect(step.scene.setup.selectedIds).not.toContain('24');
      expect(step.scene.mechanics).toBeUndefined();
    }
  });

  it('authors local biology vignettes independently from the one geometric replay', () => {
    const { steps } = createBiologyLecture();
    expect(steps.map(step => step.biology)).toEqual([
      'overview',
      'compression',
      'tension',
      'overview',
      undefined,
      'overview',
    ]);
    for (const step of steps)
      expect(step.scene.setup.anatomy).toMatchObject({
        bone: false,
        ligament: false,
        cutaway: false,
      });
    expect(steps.filter(step => step.demo).map(step => step.demo)).toEqual([
      { caseId: 'movement-types', variantId: 'translation' },
    ]);
    for (const step of steps.filter(step => step.biology)) expect(step.demo).toBeUndefined();
    expect(steps[3].answer).toContain('not a computed stress distribution');
    expect(steps[4].answer).toContain('cannot infer');
  });

  it('rejects unsupported or malformed authored biology selections', () => {
    for (const biology of ['pressure', 'off', '', 1, null, { view: 'compression' }]) {
      const document = createBiologyLecture();
      Object.assign(document.steps[1], { biology });
      expect(() => validateLectureDocument(document)).toThrow('Unsupported lecture option');
    }
  });

  it('does not share mutable notes, selection or poses between openings', () => {
    const original = createDemoLectures();
    const changed = createDemoLectures();
    changed[1].steps[0].notes = 'changed';
    changed[1].steps[0].scene.setup.selectedIds.length = 0;
    changed[2].steps[0].scene.transforms['11'].translation[0] = 80;
    expect(createDemoLectures()).toEqual(original);
    expect(changed[2].steps[1]).toEqual(original[2].steps[1]);
  });
});
