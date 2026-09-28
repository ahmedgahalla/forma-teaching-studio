import { Vector3, type BufferGeometry } from 'three';
import type { DentalTooth } from './geometry';
import { anatomicalFrame, type Transforms, type Vec3 } from './model';
import { toothMatrix } from './analysis';

export type MovementTrail = {
  toothId: string;
  /** Local geometry reference points, not anatomical centres or resistance estimates. */
  crownPoint: Vec3;
  rootPoint: Vec3 | null;
  progress: readonly number[];
  /** Packed world XYZ positions, without the viewer's jaw-opening offset. */
  crown: Float32Array;
  root: Float32Array | null;
};

function extremeVertex(geometry: BufferGeometry, direction: Vec3): Vec3 | null {
  const positions = geometry.getAttribute('position');
  if (!positions?.count) return null;
  let maximum = -Infinity;
  let result: Vec3 | null = null;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index),
      y = positions.getY(index),
      z = positions.getZ(index);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    const projection = x * direction[0] + y * direction[1] + z * direction[2];
    if (projection > maximum) {
      maximum = projection;
      result = [x, y, z];
    }
  }
  return result;
}

function rootReference(tooth: DentalTooth, rootward: Vec3): Vec3 | null {
  if (!tooth.rootGeometry) return null;
  if (!tooth.rootAnatomy) return extremeVertex(tooth.rootGeometry, rootward);
  let maximum = -Infinity;
  let result: Vec3 | null = null;
  for (const branch of tooth.rootAnatomy.branches) {
    const point = branch[branch.length - 1].center;
    const projection = point[0] * rootward[0] + point[1] * rootward[1] + point[2] * rootward[2];
    if (projection > maximum) {
      maximum = projection;
      result = [...point];
    }
  }
  return result;
}

/** Sample the model's own trajectory outside RAF; never infer a path from its endpoints.
 * Extra authored breakpoints preserve corners between the 64 uniform display intervals.
 * A multi-root tooth uses one real terminal branch point, never an invented average apex. */
export function createMovementTrail(
  tooth: DentalTooth,
  sample: (progress: number) => Transforms,
  breaks: readonly number[] = [],
): MovementTrail | null {
  if (!tooth.calibrated || !tooth.occlusal) return null;
  let occlusal: Vec3;
  try {
    occlusal = anatomicalFrame(tooth).occlusal;
  } catch {
    return null;
  }
  const crownPoint = extremeVertex(tooth.geometry, occlusal);
  if (!crownPoint) return null;
  const rootPoint = rootReference(tooth, [-occlusal[0], -occlusal[1], -occlusal[2]]);
  const progress = [
    ...new Set([
      ...Array.from({ length: 65 }, (_, index) => index / 64),
      ...breaks.filter(value => Number.isFinite(value) && value > 0 && value < 1),
    ]),
  ].sort((a, b) => a - b);
  const crown = new Float32Array(progress.length * 3);
  const root = rootPoint ? new Float32Array(progress.length * 3) : null;
  const point = new Vector3();
  for (let index = 0; index < progress.length; index++) {
    const matrix = toothMatrix(tooth, sample(progress[index]));
    point
      .fromArray(crownPoint)
      .applyMatrix4(matrix)
      .toArray(crown, index * 3);
    if (root && rootPoint)
      point
        .fromArray(rootPoint)
        .applyMatrix4(matrix)
        .toArray(root, index * 3);
  }
  return { toothId: tooth.id, crownPoint, rootPoint, progress, crown, root };
}
