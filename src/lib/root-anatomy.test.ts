import { describe, expect, it } from 'vitest';
import { validateRootAnatomy, type RootAnatomy } from './root-anatomy';

const source: RootAnatomy = { version: 1, trunk: [{ center: [0, 0, 0], radii: [3, 3] }, { center: [0, 2, 0], radii: [2, 2] }], branches: [[{ center: [1, 2, 0], radii: [1, 1] }, { center: [1.5, 10, 0], radii: [.025, .025] }], [{ center: [-1, 2, 0], radii: [1, 1] }, { center: [-1.5, 10, 0], radii: [.025, .025] }]] };

describe('explicit synthetic root sections', () => {
  it('copies trunk and branch sections without mutating their shared tooth-local coordinates', () => {
    const result = validateRootAnatomy(source, [0, -1, 0]);
    expect(result).toEqual(source); expect(result).not.toBe(source);
    result.branches[0][0].center[0] = 9;
    expect(source.branches[0][0].center[0]).toBe(1);
  });
  it('accepts a single root without a trunk and rejects reversed apical order', () => {
    expect(validateRootAnatomy({ version: 1, branches: [source.branches[0]] }, [0, -1, 0]).trunk).toBeUndefined();
    expect(() => validateRootAnatomy(source, [0, 1, 0])).toThrow(/root anatomy/);
  });
  it.each([null, {}, { ...source, version: 2 }, { ...source, branches: [] }, { ...source, branches: Array(4).fill(source.branches[0]) }, { ...source, trunk: [] }, { ...source, branches: [[{ center: [0, 0, 0], radii: [1, 1] }]] }])('rejects malformed or unbounded inventory %#', raw => {
    expect(() => validateRootAnatomy(raw)).toThrow(/root anatomy/);
  });
  it.each([NaN, Infinity, -1, 0, 13])('rejects invalid section radius %s', value => {
    const raw = structuredClone(source); raw.branches[0][0].radii[0] = value;
    expect(() => validateRootAnatomy(raw)).toThrow(/root anatomy/);
  });
  it('rejects nonfinite coordinates, implausible paths and duplicate sections', () => {
    for (const center of [[NaN, 2, 0], [100, 2, 0], [1, 2, 0], [1, 45, 0]]) {
      const raw = structuredClone(source); raw.branches[0][1].center = center as [number, number, number];
      expect(() => validateRootAnatomy(raw)).toThrow(/root anatomy/);
    }
  });
});
