import { afterAll, describe, expect, it } from 'vitest';
import { BoxGeometry } from 'three';
import { jawProps } from './jaw-display';
import { createSelectionFramingKey } from './teaching-focus';
import type { ViewerProps } from './viewer-types';
import type { DentalCase } from '@/lib/geometry';
import { canRestoreViewerCamera, createViewerAutoFit } from './viewer-camera-policy';

const initial = {
  arch: 'both' as const,
  roots: false,
  gums: true,
  opening: 0,
  jawOpen: false,
  teachingFocus: true,
  preserveCamera: true,
};
const geometry = new BoxGeometry(2, 2, 2);
const model: DentalCase = {
  name: 'Case',
  demo: true,
  gums: [],
  teeth: [
    {
      id: '11',
      name: 'Incisor',
      geometry,
      position: [0, 0, 0],
      buccal: [0, 0, 1],
      mesial: [1, 0, 0],
      occlusal: [0, -1, 0],
      calibrated: true,
    },
  ],
};
afterAll(() => geometry.dispose());

describe('user-controlled lecture framing', () => {
  it.each([
    { arch: 'upper' as const },
    { roots: true },
    { gums: false },
    { opening: 8 },
    { jawOpen: true },
  ])('holds the camera when the authored scene changes %j', change => {
    const fit = createViewerAutoFit(initial, 'no-cutaway', '11');
    expect(fit({ ...initial, ...change }, 'no-cutaway', '11')).toBe(false);
    expect(fit({ ...initial, ...change, preserveCamera: false }, 'no-cutaway', '11')).toBe(false);
  });
  it('holds a user orbit through new selected teeth and anatomy, without suppressing explicit focus', () => {
    const fit = createViewerAutoFit(initial, 'no-cutaway', '11');
    expect(fit(initial, 'no-cutaway', '13,14,15,16,17')).toBe(false);
    expect(fit(initial, 'bone/ligament', '13,14,15,16,17')).toBe(false);
    const context = { ...initial, teachingFocus: false };
    expect(fit(context, 'bone/ligament', 'all')).toBe(true);
    expect(fit(context, 'bone/ligament', 'all')).toBe(false);
    expect(fit(initial, 'bone/ligament', '13,14,15,16,17')).toBe(true);
  });
  it('retains automatic Explore fits and triggers only once per display change', () => {
    const explore = { ...initial, preserveCamera: false };
    const fit = createViewerAutoFit(explore, 'none', 'all');
    expect(fit(explore, 'none', 'all')).toBe(false);
    expect(fit({ ...explore, roots: true }, 'none', 'all')).toBe(true);
    expect(fit({ ...explore, roots: true }, 'none', 'all')).toBe(false);
    expect(fit({ ...explore, roots: true }, 'none', '11')).toBe(true);
  });
  it('retains the saved camera through lecture model replacement but still fits a new Explore model', () => {
    const replacement = geometry.clone();
    try {
      const next = { ...model, teeth: [{ ...model.teeth[0], geometry: replacement }] };
      expect(canRestoreViewerCamera(model, next, true)).toBe(true);
      expect(canRestoreViewerCamera(model, next, false)).toBe(false);
      expect(canRestoreViewerCamera(model, { ...model })).toBe(true);
    } finally {
      replacement.dispose();
    }
  });
});

it('compares effective jaw display flags rather than unsupported raw hinge requests', () => {
  const props = { ...initial, model, preserveCamera: false } as ViewerProps;
  const fit = createViewerAutoFit(jawProps(props), 'none', 'all');
  expect(fit(jawProps({ ...props, jawOpen: true }), 'none', 'all')).toBe(false);
  const atlas = { ...props, model: { ...model, asset: 'claude-atlas-v1' as const }, jawOpen: true };
  expect(fit(jawProps(atlas), 'none', 'all')).toBe(true);
  expect(
    fit(
      jawProps({ ...atlas, toothStudy: { tooth: '11', view: 'buccal', revision: 0 } }),
      'none',
      'all',
    ),
  ).toBe(true);
});

it('keeps Explore focus fitting equivalent to the existing selection-key transitions', () => {
  const props = {
    ...initial,
    model,
    selected: '11',
    selectedIds: ['11'],
    teachingFocus: false,
    preserveCamera: false,
  } as ViewerProps;
  const key = createSelectionFramingKey();
  const fit = createViewerAutoFit(props, 'none', key(props));
  for (const teachingFocus of [true, false, true]) {
    const next = { ...props, teachingFocus };
    expect(fit(next, 'none', key(next))).toBe(true);
    expect(fit(next, 'none', key(next))).toBe(false);
  }
});
