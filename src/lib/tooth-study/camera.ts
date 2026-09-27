import { Box3, Euler, MathUtils, Vector3 } from 'three';
import { perspectiveFitFrame } from '../camera-fit';
import { VOICE_HUD_SAFE_AREA } from '../lecture-layout';
import { anatomicalFrame, type Pose, type Tooth, type Vec3 } from '../model';
import type { ToothStudyView } from './types';

export type ToothFrame = ReturnType<typeof anatomicalFrame>;
export type ToothStudyCamera = { position: Vec3; target: Vec3; up: Vec3 };
export const TOOTH_STUDY_CAMERA_MARGIN = { horizontal: 1 / 0.7, vertical: 1 / 0.76 };

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

/** World-up matches OrbitControls; a tiny pole tilt projects superior toward buccal. */
export function toothStudyCamera(
  frame: ToothFrame,
  view: ToothStudyView,
): { direction: Vec3; up: Vec3 } {
  const direction = new Vector3(...toothSurfaceDirection(frame, view));
  if (view === 'occlusal' || view === 'apical')
    direction.addScaledVector(new Vector3(...frame.buccal), -Math.sign(direction.y) * 0.001);
  return { direction: direction.normalize().toArray(), up: [0, 1, 0] };
}

/**
 * Frame crown and roots above the overlaid HUD, leaving space for direction labels.
 * The explanation card occupies a separate layout region beside/below the canvas.
 */
export function getToothStudyCamera(
  tooth: Tooth,
  pose: Pose | undefined,
  bounds: Box3,
  view: ToothStudyView,
  verticalFov: number,
  aspect: number,
  bottomSafeArea = VOICE_HUD_SAFE_AREA,
): ToothStudyCamera {
  const { direction, up } = toothStudyCamera(transformedToothFrame(tooth, pose), view);
  const ray = new Vector3(...direction);
  const { target, distance } = perspectiveFitFrame(
    bounds,
    ray,
    new Vector3(...up),
    verticalFov,
    aspect,
    TOOTH_STUDY_CAMERA_MARGIN,
    undefined,
    bottomSafeArea,
  );
  return {
    position: ray.multiplyScalar(distance).add(target).toArray(),
    target: target.toArray(),
    up,
  };
}
