import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ATLAS_DIAGRAM_HEIGHT, ATLAS_TOOTH_DIAGRAMS } from './atlas-tooth-diagram';

describe('Claude atlas tooth diagrams', () => {
  it('matches all 32 original crown/root drawings exactly', () => {
    // Captured by executing the producer's unmodified glyphPaths with the bundled
    // model metadata and Claude's tooth-info.json; this fixture does not use our port.
    // Producer glyph source SHA-256:
    // ef008631846d837772032965df6cfaf7b0c7558c298179236f630da7684bfe05
    const digest = createHash('sha256').update(JSON.stringify(ATLAS_TOOTH_DIAGRAMS)).digest('hex');
    expect(digest).toBe('34eb375035f2e868be7103a3dceb1613d2285b164d985727ba42e03cc6be5fc5');
    expect(Object.keys(ATLAS_TOOTH_DIAGRAMS)).toHaveLength(32);
    expect(ATLAS_DIAGRAM_HEIGHT).toBe(21);
  });

  it.each([
    ['11', 1],
    ['13', 1],
    ['14', 2],
    ['15', 1],
    ['16', 3],
    ['17', 3],
    ['18', 1],
    ['31', 1],
    ['34', 1],
    ['36', 2],
    ['38', 2],
  ])('preserves the source root depiction for tooth %s', (id, count) => {
    expect(ATLAS_TOOTH_DIAGRAMS[id].roots).toHaveLength(count);
  });

  it('uses distinct upper and lower tooth dimensions rather than one generic silhouette', () => {
    expect(ATLAS_TOOTH_DIAGRAMS['11'].md).toBe(8.62);
    expect(ATLAS_TOOTH_DIAGRAMS['31'].md).toBe(5.19);
    expect(ATLAS_TOOTH_DIAGRAMS['16'].md).toBe(10.32);
    expect(ATLAS_TOOTH_DIAGRAMS['36'].md).toBe(11.41);
    expect(ATLAS_TOOTH_DIAGRAMS['11'].crown).not.toBe(ATLAS_TOOTH_DIAGRAMS['31'].crown);
    expect(ATLAS_TOOTH_DIAGRAMS['16'].roots).not.toEqual(ATLAS_TOOTH_DIAGRAMS['36'].roots);
  });

  it('shares immutable precomputed paths across chart renders', () => {
    expect(Object.isFrozen(ATLAS_TOOTH_DIAGRAMS)).toBe(true);
    for (const tooth of Object.values(ATLAS_TOOTH_DIAGRAMS)) {
      expect(Object.isFrozen(tooth)).toBe(true);
      expect(Object.isFrozen(tooth.roots)).toBe(true);
    }
  });
});
