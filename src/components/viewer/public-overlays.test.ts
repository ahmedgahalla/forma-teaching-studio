// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  createPublicOverlaySource,
  setPublicLecturePointer,
  subscribePublicOverlays,
  type PublicOverlayFrame,
} from './public-overlays';

function fixture(canvas = document.createElement('canvas')) {
  const source = createPublicOverlaySource(canvas, {
    teeth: [{ id: '11', x: 100, y: 80, visible: true, selected: true }],
    surfaces: [{ text: 'Mesial', x: 70, y: 95, visible: true }],
    anatomy: [
      {
        text: 'Crown',
        x: 9,
        y: 96,
        visible: true,
        width: 120,
        side: 'left',
        color: '#ffffff',
        anchorX: 110,
        anchorY: 90,
      },
    ],
  });
  Object.assign(source.frame, {
    ready: true,
    width: 400,
    height: 200,
    anatomyCaption: 'Schematic section',
    studyCaption: 'Synthetic teaching anatomy',
  });
  source.publish();
  let latest: PublicOverlayFrame | null = null;
  const unsubscribe = subscribePublicOverlays(canvas, frame => {
    latest = frame;
  });
  return {
    canvas,
    source,
    unsubscribe,
    get latest() {
      return latest;
    },
  };
}

describe('public model annotation feed', () => {
  it('keeps successful-frame storage separate from in-progress geometry and copies only public fields', () => {
    const h = fixture();
    const published = h.latest!;
    const before = structuredClone(published);
    Object.assign(h.source.frame.teeth[0], { x: 290, locked: true, notes: 'SECRET' });
    h.source.frame.surfaces[0].text = 'Distal';
    h.source.frame.anatomy[0].anchorY = 160;
    h.source.frame.anatomyCaption = 'New section';
    Object.assign(h.source.frame, { notes: 'PRIVATE NOTES', model: { secret: true } });
    // A failed draw or popup resize must never expose the staged placements.
    expect(published).toEqual(before);
    const observer = vi.fn();
    const off = subscribePublicOverlays(h.canvas, observer);
    expect(observer).toHaveBeenLastCalledWith(before);
    h.source.publish();
    expect(h.latest).toBe(published);
    expect(h.latest!.teeth[0]).toEqual({ id: '11', x: 290, y: 80, selected: true, visible: true });
    expect(h.latest!.surfaces[0].text).toBe('Distal');
    expect(h.latest!.anatomy[0].anchorY).toBe(160);
    expect(JSON.stringify(published)).not.toMatch(/locked|notes|secret|PRIVATE/);
    off();
    h.unsubscribe();
    h.source.dispose();
  });

  it('reuses all public arrays and slots across commits and updates visibility and captions', () => {
    const h = fixture(),
      first = h.latest!;
    const teeth = first.teeth,
      tooth = teeth[0],
      surfaces = first.surfaces;
    const surface = surfaces[0],
      anatomy = first.anatomy,
      tissue = anatomy[0],
      pointer = first.pointer;
    for (let i = 0; i < 100; i++) {
      h.source.frame.teeth[0].x = i;
      h.source.frame.surfaces[0].visible = i % 2 === 0;
      h.source.publish();
      expect(h.latest).toBe(first);
      expect(first.teeth).toBe(teeth);
      expect(first.teeth[0]).toBe(tooth);
      expect(first.surfaces).toBe(surfaces);
      expect(first.surfaces[0]).toBe(surface);
      expect(first.anatomy).toBe(anatomy);
      expect(first.anatomy[0]).toBe(tissue);
      expect(first.pointer).toBe(pointer);
    }
    h.source.frame.anatomyCaption = null;
    h.source.frame.studyCaption = null;
    h.source.frame.anatomy[0].visible = false;
    h.source.publish();
    expect(first.anatomyCaption).toBeNull();
    expect(first.studyCaption).toBeNull();
    expect(first.anatomy[0].visible).toBe(false);
    h.unsubscribe();
    h.source.dispose();
  });

  it('supports late publishers, clears failed frames and cannot be overwritten by an old generation', () => {
    const canvas = document.createElement('canvas'),
      observer = vi.fn();
    const off = subscribePublicOverlays(canvas, observer);
    expect(observer).toHaveBeenLastCalledWith(null);
    const a = fixture(canvas);
    expect(observer.mock.lastCall![0].ready).toBe(true);
    a.source.clear();
    expect(observer.mock.lastCall![0].ready).toBe(false);
    const b = fixture(canvas);
    const published = b.latest;
    a.source.dispose();
    a.source.publish();
    expect(observer).toHaveBeenLastCalledWith(published);
    off();
    observer.mockClear();
    b.source.publish();
    expect(observer).not.toHaveBeenCalled();
    b.source.dispose();
    expect(b.latest).toBeNull();
    a.unsubscribe();
    b.unsubscribe();
  });

  it.each([1, 2])('maps pointer client coordinates into source CSS pixels at DPR %s', dpr => {
    const h = fixture();
    h.canvas.width = 400 * dpr;
    h.canvas.height = 200 * dpr;
    vi.spyOn(h.canvas, 'getBoundingClientRect').mockReturnValue({
      left: 20,
      top: 40,
      width: 800,
      height: 400,
    } as DOMRect);
    setPublicLecturePointer(h.canvas, 420, 240);
    expect(h.latest!.pointer).toEqual({ visible: true, x: 200, y: 100 });
    // Pointer updates see committed labels, even if the next model frame has failed.
    h.source.frame.teeth[0].x = 999;
    setPublicLecturePointer(h.canvas, 220, 140);
    expect(h.latest!.teeth[0].x).toBe(100);
    expect(h.latest!.pointer).toEqual({ visible: true, x: 100, y: 50 });
    for (const [x, y] of [
      [19, 140],
      [821, 140],
      [220, 39],
      [220, 441],
      [NaN, 60],
    ]) {
      setPublicLecturePointer(h.canvas, x, y);
      expect(h.latest!.pointer.visible).toBe(false);
    }
    setPublicLecturePointer(h.canvas, 220, 140);
    setPublicLecturePointer(h.canvas);
    expect(h.latest!.pointer.visible).toBe(false);
    setPublicLecturePointer(h.canvas, 220, 140);
    h.source.frame.width = 500;
    h.source.publish();
    expect(h.latest!.pointer.visible).toBe(false);
    h.source.clear();
    setPublicLecturePointer(h.canvas, 220, 140);
    expect(h.latest!.pointer.visible).toBe(false);
    h.source.dispose();
    setPublicLecturePointer(h.canvas, 220, 140);
    expect(h.latest).toBeNull();
    h.unsubscribe();
  });
});
