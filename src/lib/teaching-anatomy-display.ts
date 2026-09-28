import { Box3, Matrix4, Plane, Vector3 } from 'three';
import { applyJawMatrix } from './jaw-opening';

export type AnatomyDisplayOptions = { opening?: number; jawOpen?: boolean };

export function anatomyDisplayMatrix(
  matrix: Matrix4,
  lower: boolean,
  options: AnatomyDisplayOptions,
) {
  if (lower) applyJawMatrix(matrix, options.jawOpen).elements[13] -= options.opening || 0;
  return matrix;
}

/** Keep the socket crop rigid with the jaw, independently of the selected tooth pose. */
export function anatomyClipPlanes(
  bounds: Box3,
  buccal: Vector3,
  rootCenter: Vector3,
  reference: Matrix4,
) {
  const center = bounds.getCenter(new Vector3()),
    half = bounds.getSize(new Vector3()).multiplyScalar(0.5),
    planes: Plane[] = [];
  for (const [axis, extent] of [
    [new Vector3(1, 0, 0), half.x],
    [new Vector3(0, 1, 0), half.y],
    [new Vector3(0, 0, 1), half.z],
  ] as const)
    for (const sign of [-1, 1]) {
      const normal = axis.clone().multiplyScalar(sign);
      planes.push(
        new Plane().setFromNormalAndCoplanarPoint(
          normal,
          center.clone().addScaledVector(normal, -extent),
        ),
      );
    }
  planes.push(
    new Plane().setFromNormalAndCoplanarPoint(
      buccal.clone().negate(),
      buccal.clone().multiplyScalar(rootCenter.dot(buccal)),
    ),
  );
  return planes.map(plane => plane.applyMatrix4(reference));
}
