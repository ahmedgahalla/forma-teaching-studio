import { Box3, MathUtils, Matrix4, Vector3 } from 'three';

/** Distance from the box centre that fits every corner within a perspective view. */
export function perspectiveFitDistance(bounds: Box3, direction: Vector3, up: Vector3, verticalFov: number, aspect: number, margin = 1.18): number {
  if (bounds.isEmpty() || !Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(verticalFov) || verticalFov <= 0 || verticalFov >= 180 || !Number.isFinite(margin) || margin < 1 || !direction.lengthSq()) throw new Error('Invalid camera fit parameters.');
  // Use Three's lookAt basis so occlusal views have exactly the same orientation
  // as the rendered camera, including its nearly vertical viewing direction.
  const basis = new Matrix4().lookAt(direction, new Vector3(), up);
  const right = new Vector3(), vertical = new Vector3(), backward = new Vector3();
  basis.extractBasis(right, vertical, backward);
  const center = bounds.getCenter(new Vector3());
  const tanVertical = Math.tan(MathUtils.degToRad(verticalFov) / 2), tanHorizontal = tanVertical * aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const corner = new Vector3(x, y, z).sub(center);
    const depth = corner.dot(backward);
    distance = Math.max(distance, depth + Math.abs(corner.dot(right)) * margin / tanHorizontal, depth + Math.abs(corner.dot(vertical)) * margin / tanVertical, depth + 1);
  }
  return distance;
}
