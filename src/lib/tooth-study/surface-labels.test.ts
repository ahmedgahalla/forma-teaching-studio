import { describe, expect, it } from 'vitest';
import { getToothAnatomy } from '../tooth-anatomy';
import {
  createSurfaceLabels,
  placeSurfaceLabel,
  surfaceLabelShown,
  surfaceLabelText,
} from './surface-labels';
import { TOOTH_STUDY_VIEWS } from './types';

describe('surface direction labels', () => {
  it.each([
    ['11', ['Labial', 'Mesial', 'Palatal', 'Distal', 'Incisal', 'Apex']],
    ['16', ['Buccal', 'Mesial', 'Palatal', 'Distal', 'Occlusal', 'Apex']],
    ['33', ['Labial', 'Mesial', 'Lingual', 'Distal', 'Incisal', 'Apex']],
    ['46', ['Buccal', 'Mesial', 'Lingual', 'Distal', 'Occlusal', 'Apex']],
  ])('uses tooth-specific wording for %s', (id, expected) => {
    const tooth = getToothAnatomy(id);
    expect(TOOTH_STUDY_VIEWS.map(view => surfaceLabelText(tooth, view))).toEqual(expected);
  });

  it('builds six anatomical label rays with opposed surfaces', () => {
    const labels = createSurfaceLabels(getToothAnatomy('16'), {
      buccal: [0, 0, 1],
      mesial: [1, 0, 0],
      occlusal: [0, -1, 0],
    });
    expect(labels.map(label => label.direction)).toEqual([
      [0, 0, 1],
      [1, 0, 0],
      [-0, -0, -1],
      [-1, -0, -0],
      [0, -1, 0],
      [-0, 1, -0],
    ]);
    expect(labels.map(label => label.side)).toEqual(TOOTH_STUDY_VIEWS);
  });

  it('hides camera-facing and directly rearward labels while retaining transverse directions', () => {
    for (const facing of [1, -1, 0.9, -0.8, NaN, Infinity])
      expect(surfaceLabelShown(facing)).toBe(false);
    for (const facing of [0, 0.5, -0.5, 0.79]) expect(surfaceLabelShown(facing)).toBe(true);
  });

  it('extends short rays past the crown using caller-owned output', () => {
    const out = { x: 0, y: 0 };
    expect(placeSurfaceLabel(200, 150, 206, 158, 600, 400, out, 100)).toBe(true);
    expect(out).toEqual({ x: 260, y: 230 });
    expect(placeSurfaceLabel(200, 150, 350, 150, 600, 400, out)).toBe(true);
    expect(out).toEqual({ x: 350, y: 150 });
  });

  it('clamps to safe viewport edges, including narrow screens', () => {
    const out = { x: 0, y: 0 };
    expect(placeSurfaceLabel(200, 150, 900, -100, 600, 400, out)).toBe(true);
    expect(out).toEqual({ x: 536, y: 24 });
    expect(placeSurfaceLabel(30, 20, 40, 50, 60, 40, out)).toBe(true);
    expect(out).toEqual({ x: 30, y: 20 });
  });

  it('rejects coincident, invalid or missing viewport coordinates without changing output', () => {
    const out = { x: 1, y: 2 };
    expect(placeSurfaceLabel(20, 20, 20, 20, 600, 400, out)).toBe(false);
    expect(placeSurfaceLabel(20, 20, Infinity, 20, 600, 400, out)).toBe(false);
    expect(placeSurfaceLabel(20, 20, 30, 20, 0, 400, out)).toBe(false);
    expect(placeSurfaceLabel(20, 20, 30, 20, Infinity, 400, out)).toBe(false);
    expect(out).toEqual({ x: 1, y: 2 });
  });

  it.each([33, 54, 75])('reserves a %s px caption band above top-clamped labels', captionBottom => {
    const out = { x: 0, y: 0 };
    expect(placeSurfaceLabel(300, 90, 300, -100, 600, 290, out, 72, captionBottom + 8)).toBe(true);
    expect(out.y - 24).toBeGreaterThanOrEqual(captionBottom + 8);
    expect(out.y).toBeLessThanOrEqual(290 - 24);
  });

  it('hides a label if the caption leaves no safe vertical space', () => {
    expect(placeSurfaceLabel(30, 20, 30, -10, 60, 40, { x: 0, y: 0 }, 72, 54)).toBe(false);
  });
});
