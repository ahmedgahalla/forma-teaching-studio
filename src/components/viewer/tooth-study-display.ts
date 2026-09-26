import type { ViewerProps } from './viewer-types';

/** Study is a temporary presentation; saved workspace display settings stay untouched. */
export const TOOTH_STUDY_DISPLAY: Partial<ViewerProps> = {
  ghost: false,
  gums: false,
  labels: false,
  grid: false,
  roots: true,
  arch: 'both',
  braces: false,
  attachments: false,
  traceFrom: undefined,
  archCurve: undefined,
  anatomy: undefined,
  removableRetainer: false,
  mechanicsForces: false,
  pointed: null,
  landmarks: [],
  tool: 'orbit',
  measureMode: false,
  intersections: [],
  lockedIds: [],
};
