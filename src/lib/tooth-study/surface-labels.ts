import type { ToothAnatomy } from '../tooth-anatomy';
import { toothSurfaceDirection, type ToothFrame } from './camera';
import { TOOTH_STUDY_VIEWS, type ToothStudyView } from './types';

type SurfaceWording = Pick<ToothAnatomy, 'facial' | 'inner' | 'biting'>;

export function toothSideName(tooth: SurfaceWording, view: ToothStudyView): string {
  const name = {
    buccal: tooth.facial,
    lingual: tooth.inner,
    mesial: 'mesial',
    distal: 'distal',
    occlusal: tooth.biting,
    apical: 'apical',
  }[view];
  return name[0].toUpperCase() + name.slice(1);
}

export function surfaceLabelText(tooth: SurfaceWording, view: ToothStudyView): string {
  return view === 'apical' ? 'Apex' : toothSideName(tooth, view);
}

/** Allocate descriptors when the studied tooth/pose changes, never inside RAF. */
export function createSurfaceLabels(tooth: SurfaceWording, frame: ToothFrame) {
  return TOOTH_STUDY_VIEWS.map(side => ({
    side,
    text: surfaceLabelText(tooth, side),
    direction: toothSurfaceDirection(frame, side),
  }));
}

/** Hide camera-facing and directly rearward labels because both project over the tooth. */
export function surfaceLabelShown(facing: number): boolean {
  return Number.isFinite(facing) && Math.abs(facing) < 0.8;
}

export type LabelPoint = { x: number; y: number };

/** Position along a projected anatomical ray, clear of the tooth and inside the viewport. */
export function placeSurfaceLabel(
  cx: number,
  cy: number,
  px: number,
  py: number,
  width: number,
  height: number,
  out: LabelPoint,
  radius = 72,
  topInset = 0,
): boolean {
  const dx = px - cx,
    dy = py - cy,
    length = Math.hypot(dx, dy);
  if (
    !Number.isFinite(cx) ||
    !Number.isFinite(cy) ||
    !Number.isFinite(length) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(topInset) ||
    length < 1e-6 ||
    width <= 0 ||
    height <= 0 ||
    radius < 0 ||
    topInset < 0
  )
    return false;
  const distance = Math.max(length, radius);
  const marginX = Math.min(64, width / 2),
    marginY = Math.min(24, height / 2);
  if (topInset + marginY * 2 > height) return false;
  out.x = Math.min(width - marginX, Math.max(marginX, cx + (dx / length) * distance));
  out.y = Math.min(height - marginY, Math.max(topInset + marginY, cy + (dy / length) * distance));
  return true;
}
