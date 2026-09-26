import { Box3, Euler, MathUtils, Vector3 } from 'three';
import { perspectiveFitDistance } from '../camera-fit';
import { anatomicalFrame, type Pose, type Tooth, type Vec3 } from '../model';
import type { ToothStudyView } from './types';

export type ToothFrame = ReturnType<typeof anatomicalFrame>;
export type ToothStudyCamera = { position: Vec3; target: Vec3; up: Vec3 };

/** Same XYZ degree rotation as the tooth mesh, evaluated only when framing changes. */
export function transformedToothFrame(tooth: Tooth, pose?: Pose): ToothFrame {
  const frame = anatomicalFrame(tooth);
  if (!pose) return frame;
  const rotation = new Euler(
    MathUtils.degToRad(pose.rotation[0]),
    MathUtils.degToRad(pose.rotation[1]),
    MathUtils.degToRad(pose.rotation[2]),
    'XYZ',
  );
  const rotate = (axis: Vec3): Vec3 => new Vector3(...axis).applyEuler(rotation).toArray();
  return {
    buccal: rotate(frame.buccal),
    mesial: rotate(frame.mesial),
    occlusal: rotate(frame.occlusal),
  };
}

/** Direction is from the tooth toward the camera, not the camera's look vector. */
export function toothSurfaceDirection(frame: ToothFrame, view: ToothStudyView): Vec3 {
  const axis =
    view === 'buccal' || view === 'lingual'
      ? frame.buccal
      : view === 'mesial' || view === 'distal'
        ? frame.mesial
        : frame.occlusal;
  const sign = view === 'lingual' || view === 'distal' || view === 'apical' ? -1 : 1;
  const length = Math.hypot(...axis);
  if (!Number.isFinite(length) || length === 0) throw new Error('Invalid tooth camera axis.');
  return [(axis[0] * sign) / length, (axis[1] * sign) / length, (axis[2] * sign) / length];
}

/** Side views preserve world superior; biting/root-tip views put the buccal side at screen top. */
export function toothStudyCamera(
  frame: ToothFrame,
  view: ToothStudyView,
): { direction: Vec3; up: Vec3 } {
  return {
    direction: toothSurfaceDirection(frame, view),
    up: view === 'occlusal' || view === 'apical' ? [...frame.buccal] : [0, 1, 0],
  };
}

/**
 * Frame transformed world bounds, including roots. A 62% height target leaves
 * space for direction labels; narrow viewports additionally constrain width.
 * Bounds are supplied by the viewer after applying tooth and arch transforms.
 */
export function getToothStudyCamera(
  tooth: Tooth,
  pose: Pose | undefined,
  bounds: Box3,
  view: ToothStudyView,
  verticalFov: number,
  aspect: number,
): ToothStudyCamera {
  const { direction, up } = toothStudyCamera(transformedToothFrame(tooth, pose), view);
  const ray = new Vector3(...direction);
  const target = bounds.getCenter(new Vector3());
  const distance = perspectiveFitDistance(
    bounds,
    ray,
    new Vector3(...up),
    verticalFov,
    aspect,
    1 / 0.62,
  );
  return {
    position: ray.multiplyScalar(distance).add(target).toArray(),
    target: target.toArray(),
    up,
  };
}
