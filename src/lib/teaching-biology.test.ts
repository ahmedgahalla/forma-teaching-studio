import { describe, expect, it } from 'vitest';
import {
  BIOLOGY_LIMITS,
  BIOLOGY_SCOPE,
  BIOLOGY_SOURCES,
  BIOLOGY_VIGNETTES,
} from './teaching-biology';

describe('qualitative remodeling teaching content', () => {
  it('distinguishes bone resorption from bone formation without promising a response', () => {
    const { compression, tension } = BIOLOGY_VIGNETTES;
    expect(compression.cell).toBe('Osteoclast');
    expect(compression.caption).toMatch(/can promote.*bone resorption/);
    expect(compression.description).toContain('not on the root');
    expect(tension.cell).toBe('Osteoblasts');
    expect(tension.caption).toMatch(/can support.*bone formation/);
    expect(tension.description).toContain('new bone');
  });

  it('states the spatial and model limits instead of implying a calculated tissue field', () => {
    expect(BIOLOGY_SCOPE).toContain('not a stress map or prediction for this model');
    expect(BIOLOGY_LIMITS).toContain('not two fixed sides of a tooth');
    expect(BIOLOGY_LIMITS).toContain('enlarged for visibility');
  });

  it('identifies human, animal and computational evidence with distinct primary sources', () => {
    expect(new Set(BIOLOGY_SOURCES.map(source => source.url)).size).toBe(BIOLOGY_SOURCES.length);
    expect(BIOLOGY_SOURCES.map(source => source.evidence)).toEqual(
      expect.arrayContaining([
        'Human tissue study',
        'Mouse experiment',
        'Rat experiment',
        'Finite-element study',
      ]),
    );
    for (const source of BIOLOGY_SOURCES) {
      expect(new URL(source.url).protocol).toBe('https:');
      expect(new URL(source.url).hostname).toBe('pubmed.ncbi.nlm.nih.gov');
      expect(source.title).toMatch(/et al\. \(\d{4}\)/);
    }
  });
});
