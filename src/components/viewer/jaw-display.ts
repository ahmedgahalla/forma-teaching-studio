import { Euler, MathUtils, Vector3, type Object3D } from 'three';
import { applyJawPoint, inverseJawPoint, inverseJawQuaternion } from '@/lib/jaw-opening';
import { toothArch } from '@/lib/appliances';
import type { Pose, Tooth, Vec3 } from '@/lib/model';
import type { ViewerProps } from './viewer-types';

type JawDisplay = { opening: number; jawOpen?: boolean };

export function jawProps(props: ViewerProps): ViewerProps {
  return props.jawOpen && (props.model.asset !== 'claude-atlas-v1' || props.toothStudy)
    ? { ...props, jawOpen: false }
    : props;
}

/** Undo display-only transforms before committing a pick or an edited tooth pose. */
export function canonicalJawPoint(point: Vector3, tooth: string, display: JawDisplay) {
  if (toothArch(tooth) === 'lower') {
    point.y += display.opening;
    inverseJawPoint(point, display.jawOpen);
  }
  return point;
}

/** Allocates only during a user gizmo event, never in the render loop. */
export function canonicalJawPose(tooth: Tooth, object: Object3D, display: JawDisplay): Pose {
  const point = canonicalJawPoint(object.position.clone(), tooth.id, display);
  const rotation = object.quaternion.clone();
  if (toothArch(tooth.id) === 'lower') inverseJawQuaternion(rotation, display.jawOpen);
  const euler = new Euler().setFromQuaternion(rotation, 'XYZ');
  return {
    translation: point.sub(new Vector3(...tooth.position)).toArray() as Vec3,
    rotation: [euler.x, euler.y, euler.z].map(MathUtils.radToDeg) as Vec3,
  };
}

/** The existing curve already contains vertical display spacing; keep that offset last. */
export function jawCurvePoints(points: Vec3[] = [], lower: boolean, display: JawDisplay) {
  return points.map(point => {
    const shown = new Vector3(...point);
    if (lower) {
      shown.y += display.opening;
      applyJawPoint(shown, display.jawOpen).y -= display.opening;
    }
    return shown;
  });
}
