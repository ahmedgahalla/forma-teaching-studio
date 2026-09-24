import { describe, expect, it } from 'vitest';
import { mechanicsDisplayPoses } from './mechanics-presentation';
import type { Transforms } from './model';

describe('mechanics presentation', () => {
  const baseline: Transforms = { '11': { translation: [2, 3, 4], rotation: [0, 10, 0] } };
  const result: Transforms = { '11': { translation: [2.01, 3, 4], rotation: [0, 11, 0] } };
  it('replays from the same baseline and leaves the numerical response untouched', () => {
    expect(mechanicsDisplayPoses(baseline, result, 0, 50)).toBe(baseline);
    expect(mechanicsDisplayPoses(baseline, result, 1)).toBe(result);
    const shown = mechanicsDisplayPoses(baseline, result, 1, 10);
    expect(shown['11'].translation[0]).toBeCloseTo(2.1);
    expect(shown['11'].rotation[1]).toBeCloseTo(20);
    expect(result['11'].translation[0]).toBe(2.01);
    expect(mechanicsDisplayPoses(baseline, result, 1, 10)).toEqual(shown);
  });
  it('interpolates relative to a nonzero unloaded pose', () => {
    expect(mechanicsDisplayPoses(baseline, result, .5)['11'].translation[0]).toBeCloseTo(2.005);
    expect(mechanicsDisplayPoses(baseline, result, .5)['11'].rotation[1]).toBeCloseTo(10.5);
  });
  it('rejects uncontrolled exaggeration and invalid progress', () => {
    expect(() => mechanicsDisplayPoses(baseline, result, 2)).toThrow();
    expect(() => mechanicsDisplayPoses(baseline, result, 1, 10000)).toThrow();
  });
});
