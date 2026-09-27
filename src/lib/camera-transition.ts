import { Matrix4, Quaternion, Vector3 } from 'three';

export const CAMERA_TRANSITION_MS = 520;
export type CameraPose = { position: Vector3; target: Vector3; up: Vector3 };

/** Smoothstep has zero velocity at both ends and is independent of frame rate. */
export function cameraEase(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

/** Reusable orbit interpolation: opposite views never travel through the teeth. */
export function createCameraTransition() {
  const startTarget = new Vector3(),
    endTarget = new Vector3();
  const endPosition = new Vector3(),
    endUp = new Vector3();
  const startRotation = new Quaternion(),
    endRotation = new Quaternion();
  const rotation = new Quaternion(),
    basis = new Matrix4();
  let startRadius = 0,
    endRadius = 0,
    started = 0,
    running = false;
  return {
    get active() {
      return running;
    },
    start(from: CameraPose, to: CameraPose, now: number) {
      startTarget.copy(from.target);
      endTarget.copy(to.target);
      endPosition.copy(to.position);
      endUp.copy(to.up);
      startRadius = from.position.distanceTo(from.target);
      endRadius = to.position.distanceTo(to.target);
      startRotation.setFromRotationMatrix(basis.lookAt(from.position, from.target, from.up));
      endRotation.setFromRotationMatrix(basis.lookAt(to.position, to.target, to.up));
      started = now;
      running = true;
    },
    sample(now: number, output: CameraPose) {
      if (!running) return;
      const progress = Math.min(1, Math.max(0, (now - started) / CAMERA_TRANSITION_MS));
      if (progress === 1) {
        output.position.copy(endPosition);
        output.target.copy(endTarget);
        output.up.copy(endUp);
        running = false;
        return;
      }
      const t = cameraEase(progress);
      rotation.slerpQuaternions(startRotation, endRotation, t);
      output.target.lerpVectors(startTarget, endTarget, t);
      output.position
        .set(0, 0, startRadius + (endRadius - startRadius) * t)
        .applyQuaternion(rotation)
        .add(output.target);
      output.up.set(0, 1, 0).applyQuaternion(rotation);
    },
    cancel() {
      running = false;
    },
  };
}
