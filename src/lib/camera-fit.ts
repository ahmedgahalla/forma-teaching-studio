import { Box3, MathUtils, Matrix4, Vector3 } from 'three';
import { VOICE_HUD_SAFE_AREA } from './lecture-layout';

export type CameraFitMargin = number | { horizontal: number; vertical: number };

/** Horizontal canvas fill and vertical fill of the region above the overlaid HUD. */
export const LECTURE_CAMERA_MARGIN = { horizontal: 1 / 0.78, vertical: 1 / 0.9 };

function* corners(bounds: Box3) {
  const point = new Vector3();
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) yield point.set(x, y, z);
}

function fitParameters(
  bounds: Box3,
  direction: Vector3,
  up: Vector3,
  verticalFov: number,
  aspect: number,
  margin: CameraFitMargin,
) {
  const horizontal = typeof margin === 'number' ? margin : margin.horizontal,
    verticalMargin = typeof margin === 'number' ? margin : margin.vertical;
  if (
    bounds.isEmpty() ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    !Number.isFinite(verticalFov) ||
    verticalFov <= 0 ||
    verticalFov >= 180 ||
    !Number.isFinite(horizontal) ||
    horizontal < 1 ||
    !Number.isFinite(verticalMargin) ||
    verticalMargin < 1 ||
    !direction.lengthSq()
  )
    throw new Error('Invalid camera fit parameters.');
  // Use Three's lookAt basis so occlusal views have exactly the same orientation
  // as the rendered camera, including its nearly vertical viewing direction.
  const basis = new Matrix4().lookAt(direction, new Vector3(), up);
  const right = new Vector3(),
    vertical = new Vector3(),
    backward = new Vector3();
  basis.extractBasis(right, vertical, backward);
  const center = bounds.getCenter(new Vector3());
  const tanVertical = Math.tan(MathUtils.degToRad(verticalFov) / 2),
    tanHorizontal = tanVertical * aspect;
  return {
    center,
    right,
    vertical,
    backward,
    tanVertical,
    horizontalSlope: tanHorizontal / horizontal,
    verticalSlope: tanVertical / verticalMargin,
  };
}

/** Fit points around the box centre; actual anatomy avoids imaginary near box corners. */
export function perspectiveFitDistance(
  bounds: Box3,
  direction: Vector3,
  up: Vector3,
  verticalFov: number,
  aspect: number,
  margin: CameraFitMargin = 1.18,
  points: Iterable<Vector3> = corners(bounds),
): number {
  const { center, right, vertical, backward, horizontalSlope, verticalSlope } = fitParameters(
    bounds,
    direction,
    up,
    verticalFov,
    aspect,
    margin,
  );
  const corner = new Vector3();
  let distance = 0;
  for (const point of points) {
    corner.copy(point).sub(center);
    const depth = corner.dot(backward);
    distance = Math.max(
      distance,
      depth + Math.abs(corner.dot(right)) / horizontalSlope,
      depth + Math.abs(corner.dot(vertical)) / verticalSlope,
      depth + 1,
    );
  }
  return distance;
}

/**
 * Minimize distance and center the visible silhouette, rather than its world box.
 * Point coordinates are sampled only when framing changes, not on ordinary frames.
 */
export function perspectiveFitFrame(
  bounds: Box3,
  direction: Vector3,
  up: Vector3,
  verticalFov: number,
  aspect: number,
  margin: CameraFitMargin = LECTURE_CAMERA_MARGIN,
  points: Iterable<Vector3> = corners(bounds),
  bottomSafeArea = VOICE_HUD_SAFE_AREA,
) {
  if (!Number.isFinite(bottomSafeArea) || bottomSafeArea < 0 || bottomSafeArea >= 1)
    throw new Error('Invalid camera safe area.');
  const { center, right, vertical, backward, tanVertical, horizontalSlope, verticalSlope } =
    fitParameters(bounds, direction, up, verticalFov, aspect, margin);
  const verticalCenter = tanVertical * bottomSafeArea;
  const topSlope = verticalCenter + verticalSlope * (1 - bottomSafeArea),
    bottomSlope = verticalCenter - verticalSlope * (1 - bottomSafeArea);
  const point = new Vector3(),
    samples: number[] = [];
  let left = -Infinity,
    rightEdge = Infinity,
    bottom = -Infinity,
    top = Infinity,
    distance = 0;
  for (const source of points) {
    point.copy(source).sub(center);
    const x = point.dot(right),
      y = point.dot(vertical),
      z = point.dot(backward);
    samples.push(x, y, z);
    left = Math.max(left, x + horizontalSlope * z);
    rightEdge = Math.min(rightEdge, x - horizontalSlope * z);
    bottom = Math.max(bottom, y + topSlope * z);
    top = Math.min(top, y + bottomSlope * z);
    distance = Math.max(distance, z + 1);
  }
  // At distance d, target offset t lies between lower - highSlope*d and upper - lowSlope*d.
  // The first feasible distance is where both axis intervals have nonnegative width.
  distance = Math.max(
    distance,
    (left - rightEdge) / (2 * horizontalSlope),
    (bottom - top) / (topSlope - bottomSlope),
  );
  const centeredOffset = (
    axis: number,
    lower: number,
    upper: number,
    lowSlope: number,
    highSlope: number,
    desiredCenter = 0,
  ) => {
    let low = lower - highSlope * distance,
      high = upper - lowSlope * distance;
    // The constrained axis has one possible target. In the spare axis the sum of
    // projected extremes decreases monotonically with target: bisect its zero.
    for (let pass = 0; pass < 32 && high - low > 1e-10; pass++) {
      const offset = (low + high) / 2;
      let minimum = Infinity,
        maximum = -Infinity;
      for (let i = 0; i < samples.length; i += 3) {
        const projected = (samples[i + axis] - offset) / (distance - samples[i + 2]);
        minimum = Math.min(minimum, projected);
        maximum = Math.max(maximum, projected);
      }
      if (minimum + maximum > 2 * desiredCenter) low = offset;
      else high = offset;
    }
    return (low + high) / 2;
  };
  return {
    distance,
    target: center
      .addScaledVector(right, centeredOffset(0, left, rightEdge, -horizontalSlope, horizontalSlope))
      .addScaledVector(
        vertical,
        centeredOffset(1, bottom, top, bottomSlope, topSlope, verticalCenter),
      ),
  };
}
