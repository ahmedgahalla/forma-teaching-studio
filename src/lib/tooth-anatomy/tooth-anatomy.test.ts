import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TOOTH_ANATOMY_DISCLAIMER,
  TOOTH_ANATOMY_IDS,
  hasToothAnatomy,
  resolveToothName,
  rootSummary,
  spokenToothExplanation,
  getToothAnatomy,
} from '.';

type MetadataTooth = { id: string; rootAnatomy: { branches: unknown[] } };
const metadata: { teeth: MetadataTooth[] } = JSON.parse(
  readFileSync('public/models/forma-teaching-v1.json', 'utf8'),
);

describe('tooth anatomy content', () => {
  it('covers all 28 teeth of the synthetic model and nothing else', () => {
    expect(TOOTH_ANATOMY_IDS).toHaveLength(28);
    expect([...TOOTH_ANATOMY_IDS].sort()).toEqual(metadata.teeth.map(tooth => tooth.id).sort());
    for (const id of ['18', '28', '38', '48', '10', '51', 'x1'])
      expect(hasToothAnatomy(id)).toBe(false);
    expect(() => getToothAnatomy('18')).toThrow(/11–17/);
  });

  it('matches root counts to the root branches in the GLB metadata', () => {
    for (const tooth of metadata.teeth)
      expect(getToothAnatomy(tooth.id).rootCount, tooth.id).toBe(tooth.rootAnatomy.branches.length);
    const counts = (quadrant: number) =>
      [1, 2, 3, 4, 5, 6, 7].map(digit => getToothAnatomy(`${quadrant}${digit}`).rootCount);
    for (const quadrant of [1, 2]) expect(counts(quadrant)).toEqual([1, 1, 1, 2, 1, 3, 3]);
    for (const quadrant of [3, 4]) expect(counts(quadrant)).toEqual([1, 1, 1, 1, 1, 2, 2]);
    expect(getToothAnatomy('16').roots).toEqual(['Mesiobuccal', 'Distobuccal', 'Palatal']);
    expect(getToothAnatomy('24').roots).toEqual(['Buccal', 'Palatal']);
    expect(getToothAnatomy('46').roots).toEqual(['Mesial', 'Distal']);
  });

  it('derives names, sides and surface wording from the FDI digits', () => {
    expect(getToothAnatomy('16')).toMatchObject({
      name: 'Maxillary right first molar',
      shortName: 'Upper right first molar',
      arch: 'upper',
      side: 'right',
      toothClass: 'first-molar',
      facial: 'buccal',
      inner: 'palatal',
      biting: 'occlusal',
    });
    expect(getToothAnatomy('33')).toMatchObject({
      name: 'Mandibular left canine',
      facial: 'labial',
      inner: 'lingual',
      biting: 'incisal',
    });
    expect(getToothAnatomy('21').name).toBe('Maxillary left central incisor');
    expect(getToothAnatomy('47').name).toBe('Mandibular right second molar');
  });

  it('mirrors left and right content and authors every field', () => {
    for (const id of TOOTH_ANATOMY_IDS) {
      const tooth = getToothAnatomy(id),
        mirror = getToothAnatomy(`${{ 1: 2, 2: 1, 3: 4, 4: 3 }[Number(id[0])]}${id[1]}`);
      expect(tooth.explanation).toBe(mirror.explanation);
      expect(tooth.features.length).toBeGreaterThanOrEqual(3);
      expect(tooth.features.length).toBeLessThanOrEqual(4);
      expect(tooth.cusps).not.toBe('');
      expect(tooth.orthodontics).not.toBe('');
      const sentences = tooth.explanation.split(/(?<=\.)\s+/);
      expect(sentences.length, id).toBeGreaterThanOrEqual(2);
      expect(sentences.length, id).toBeLessThanOrEqual(4);
      // Conservative teaching text: no force values, doses or clinical instructions.
      expect(`${tooth.explanation} ${tooth.orthodontics}`).not.toMatch(
        /\b\d+\s*(?:g|cn|n|grams?|newtons?)\b|\byou should\b|\brecommend|\bprescri/i,
      );
    }
  });

  it('speaks the name, number and review status', () => {
    expect(spokenToothExplanation('16')).toMatch(
      /^Maxillary right first molar, tooth 16\. The maxillary first molar has three roots/,
    );
    expect(spokenToothExplanation('16').endsWith(`${TOOTH_ANATOMY_DISCLAIMER}.`)).toBe(true);
    expect(rootSummary(getToothAnatomy('16'))).toBe('3 roots · mesiobuccal, distobuccal, palatal');
    expect(rootSummary(getToothAnatomy('11'))).toBe('1 root · single root');
  });
});

describe('tooth name aliases', () => {
  it.each([
    ['upper right first molar', '16'],
    ['the upper right first molar', '16'],
    ['maxillary right first molar', '16'],
    ['right upper first molar', '16'],
    ['upper first molar', '16'],
    ['upper six-year molar', '16'],
    ['upper 6-year molar', '16'],
    ['lower left canine', '33'],
    ['mandibular left cuspid', '33'],
    ['lower eye tooth', '43'],
    ['upper left central incisor', '21'],
    ['upper central', '11'],
    ['lower right lateral incisor', '42'],
    ['upper left first bicuspid', '24'],
    ['lower second premolar', '45'],
    ['lower left 2nd molar', '37'],
    ['lower 12-year molar', '47'],
    ["the patient's upper left second molar", '27'],
  ])('resolves “%s” to %s', (text, tooth) => {
    expect(resolveToothName(text)).toEqual({ tooth });
  });

  it('asks for an arch and ignores groups or unrelated text', () => {
    expect(resolveToothName('first molar')).toEqual({ missing: 'arch' });
    expect(resolveToothName('the canine')).toEqual({ missing: 'arch' });
    for (const text of ['upper molars', 'upper teeth', 'roots', 'upper lower canine', 'tooth 16'])
      expect(resolveToothName(text), text).toBeNull();
  });
});
