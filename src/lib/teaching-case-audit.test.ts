import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import audit from './teaching-case-audit.json';
import { CASE_REFERENCE_SHIFT, TEACHING_CASES } from './teaching-cases';

type Pair = { a: string; b: string };
type Frame = { progress: number; crownPairs: Pair[]; rootPairs: Pair[]; newCrownPairs: Pair[]; newRootPairs: Pair[] };
type CaseAudit = { baseline: { crownPairs: Pair[]; rootPairs: Pair[] }; variants: Record<string, { sampleCount: number; frames: Frame[] }> };
const cases: Record<string, CaseAudit> = audit.cases;
const key = (pair: Pair) => `${pair.a}/${pair.b}`;
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('published Blender teaching-case contact audit', () => {
  it('is tied to the exact shipped geometry, metadata and authored paths', () => {
    expect(audit.asset.sha256).toBe(sha256(audit.asset.file));
    expect(audit.asset.metadataSha256).toBe(sha256('public/models/forma-teaching-v1.json'));
    expect(audit.caseSourceSha256).toBe(sha256('src/lib/teaching-cases.ts'));
    expect(audit.referenceShiftMm).toBe(CASE_REFERENCE_SHIFT);
    expect(audit.reference).toEqual({ crownPairs: [], rootPairs: [] });
  });

  it('covers every variant, every authored keyframe and all advertised intermediate samples', () => {
    expect(Object.keys(cases)).toEqual(TEACHING_CASES.map(item => item.id));
    for (const definition of TEACHING_CASES) {
      const report = cases[definition.id];
      expect(Object.keys(report.variants)).toEqual(definition.variants.map(item => item.id));
      for (const variant of definition.variants) {
        const result = report.variants[variant.id];
        expect(result.sampleCount).toBe(result.frames.length);
        expect(result.frames.map(item => item.progress)).toEqual([...new Set([...audit.samples, ...variant.keyframes.map(item => item.progress)])].sort((a, b) => a - b));
        expect(result.frames[0].crownPairs).toEqual(report.baseline.crownPairs);
        expect(result.frames[0].rootPairs).toEqual(report.baseline.rootPairs);
      }
    }
  });

  it('uses present, unique tooth pairs and distinguishes new crossings from baseline crossings', () => {
    for (const definition of TEACHING_CASES) {
      const report = cases[definition.id];
      for (const variant of Object.values(report.variants)) for (const frame of variant.frames) {
        for (const component of ['crownPairs', 'rootPairs'] as const) {
          const pairs = frame[component], before = new Set(report.baseline[component].map(key));
          expect(new Set(pairs.map(key)).size).toBe(pairs.length);
          for (const pair of pairs) {
            expect(pair.a).toMatch(/^[1-4][1-7]$/); expect(pair.b).toMatch(/^[1-4][1-7]$/);
            expect(Number(pair.a)).toBeLessThan(Number(pair.b));
            if (definition.id === 'anchorage-space-closure') { expect([pair.a, pair.b]).not.toContain('14'); expect([pair.a, pair.b]).not.toContain('24'); }
          }
          expect(frame[component === 'crownPairs' ? 'newCrownPairs' : 'newRootPairs']).toEqual(pairs.filter(pair => !before.has(key(pair))));
        }
      }
    }
  });

  it('keeps the fixed-jaw posterior-extrusion limitation visible rather than reporting a clear path', () => {
    const frames = cases.deepbite.variants['posterior-extrusion'].frames;
    expect(frames.some(frame => frame.newCrownPairs.length > 0)).toBe(true);
    expect(audit.limitation).toMatch(/Not swept collision detection/);
    expect(audit.limitation).toMatch(/Empty pairs do not validate/);
  });
});
