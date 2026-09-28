import { describe, expect, it } from 'vitest';
import { fitAudienceOverlay } from './overlay-layout';

describe('audience annotations in the contained video rectangle', () => {
  it.each([1, 2, 1.25])('maps source CSS pixels independently of DPR %s', dpr => {
    const target = { x: 0, y: 0, scaleX: 0, scaleY: 0 };
    expect(fitAudienceOverlay(target, 1000, 700, 1000 * dpr, 700 * dpr, 600, 600)).toBe(true);
    expect(target).toEqual({ x: 0, y: 90, scaleX: 0.6, scaleY: 0.6 });
    expect(target.x + 500 * target.scaleX).toBe(300);
    expect(target.y + 350 * target.scaleY).toBe(300);
  });

  it('letterboxes portrait destinations and pillars wide destinations', () => {
    const target = { x: 0, y: 0, scaleX: 0, scaleY: 0 };
    expect(fitAudienceOverlay(target, 400, 800, 800, 1600, 900, 600)).toBe(true);
    expect(target).toEqual({ x: 300, y: 0, scaleX: 0.75, scaleY: 0.75 });
    expect(fitAudienceOverlay(target, 1000, 500, 2000, 1000, 400, 800)).toBe(true);
    expect(target).toEqual({ x: 0, y: 300, scaleX: 0.4, scaleY: 0.4 });
  });

  it('allows rounded fractional source sizes while matching the actual video edges', () => {
    const target = { x: 0, y: 0, scaleX: 0, scaleY: 0 };
    expect(fitAudienceOverlay(target, 1000.4, 700.3, 1250, 875, 800, 600)).toBe(true);
    expect(target.x).toBe(0);
    expect(target.y).toBe(20);
    expect(target.scaleX * 1000.4).toBeCloseTo(800);
    expect(target.scaleY * 700.3).toBeCloseTo(560);
  });

  it.each([
    [1000, 700, 0, 0, 600, 600],
    [0, 0, 1000, 700, 600, 600],
    [1000, 700, 1000, 700, 0, 600],
    [700, 1000, 1000, 700, 600, 600],
    [1000, 700, 1920, 1080, 600, 600],
  ] as const)(
    'hides unready or incompatible source/video sizes %j',
    (sourceWidth, sourceHeight, videoWidth, videoHeight, boxWidth, boxHeight) => {
      expect(
        fitAudienceOverlay(
          { x: 0, y: 0, scaleX: 0, scaleY: 0 },
          sourceWidth,
          sourceHeight,
          videoWidth,
          videoHeight,
          boxWidth,
          boxHeight,
        ),
      ).toBe(false);
    },
  );
});
