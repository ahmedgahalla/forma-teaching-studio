import { describe, expect, it } from 'vitest';
import { hasMechanicsMovement, mechanicsDisplayPoses, mechanicsResponseCaption, recommendedMechanicsMagnification } from './mechanics-presentation';
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
  it('automatically makes a small response visible without changing its values', () => {
    const size = { maxDisplacementMm: .025, maxRotationDeg: .2 };
    const scale = recommendedMechanicsMagnification(size);
    expect(scale).toBe(50);
    expect(mechanicsResponseCaption(size, scale)).toBe('Actual maximum: 0.0250 mm · 0.200° · visualization exaggerated 50×');
    expect(size).toEqual({ maxDisplacementMm: .025, maxRotationDeg: .2 });
  });
  it('bounds the automatic scale by translation and rotation independently', () => {
    expect(recommendedMechanicsMagnification({ maxDisplacementMm: .2, maxRotationDeg: .01 })).toBe(5);
    expect(recommendedMechanicsMagnification({ maxDisplacementMm: .001, maxRotationDeg: 1 })).toBe(10);
    expect(recommendedMechanicsMagnification({ maxDisplacementMm: 2, maxRotationDeg: 15 })).toBe(1);
    expect(recommendedMechanicsMagnification({ maxDisplacementMm: 0, maxRotationDeg: .1 })).toBe(50);
  });
  it('does not invent movement for a zero response or amplify numerical noise', () => {
    const size = { maxDisplacementMm: 1e-10, maxRotationDeg: 1e-8 };
    expect(hasMechanicsMovement(size)).toBe(false);
    expect(recommendedMechanicsMagnification(size)).toBe(1);
    expect(mechanicsResponseCaption(size, 1)).toContain('No measurable response');
    const shown = mechanicsDisplayPoses(baseline, baseline, 1, 50)['11'];
    expect(shown.translation).toEqual(baseline['11'].translation);
    shown.rotation.forEach((angle, axis) => expect(angle).toBeCloseTo(baseline['11'].rotation[axis], 10));
  });
  it('rejects invalid response diagnostics', () => {
    expect(() => recommendedMechanicsMagnification({ maxDisplacementMm: NaN, maxRotationDeg: 0 })).toThrow();
    expect(() => recommendedMechanicsMagnification({ maxDisplacementMm: 0, maxRotationDeg: -1 })).toThrow();
  });
});
