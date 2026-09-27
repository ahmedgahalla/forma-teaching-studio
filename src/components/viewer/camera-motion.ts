import { Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCameraTransition, type CameraPose } from '@/lib/camera-transition';
import type { Vec3 } from '@/lib/model';
import type { ViewerCamera, ViewName } from './viewer-types';

type Destination = { position: Vec3; target: Vec3; up: Vec3 };

export function readViewerCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  view: ViewName,
  pending: ViewerCamera | null,
  destination?: CameraPose,
): ViewerCamera {
  return pending
    ? {
        ...pending,
        position: [...pending.position],
        target: [...pending.target],
        up: [...pending.up],
      }
    : {
        position: (destination?.position ?? camera.position).toArray(),
        target: (destination?.target ?? controls.target).toArray(),
        up: (destination?.up ?? camera.up).toArray(),
        view,
        far: camera.far,
        maxDistance: controls.maxDistance,
      };
}

/** Owns no GPU resources; the viewer owns its lifetime and supplies RAF time. */
export function createCameraMotion(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  reducedMotion: () => boolean,
  now = () => performance.now(),
) {
  const transition = createCameraTransition();
  let held = false;
  const pose: CameraPose = { position: camera.position, target: controls.target, up: camera.up };
  const destination = { position: new Vector3(), target: new Vector3(), up: new Vector3() };
  const savedPosition = new Vector3(),
    savedTarget = new Vector3();
  const drainDamping = () => {
    savedPosition.copy(camera.position);
    savedTarget.copy(controls.target);
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    camera.position.copy(savedPosition);
    controls.target.copy(savedTarget);
    camera.lookAt(controls.target);
  };
  return {
    get active() {
      return transition.active;
    },
    /** Requested pose during a transition; the displayed pose after it settles or is cancelled. */
    get pose(): CameraPose {
      return transition.active ? destination : pose;
    },
    read(view: ViewName, pending: ViewerCamera | null) {
      return readViewerCamera(camera, controls, view, pending, this.pose);
    },
    move(next: Destination, instant = false) {
      drainDamping();
      held = true;
      destination.position.fromArray(next.position);
      destination.target.fromArray(next.target);
      destination.up.fromArray(next.up);
      if (instant || reducedMotion()) {
        transition.cancel();
        camera.position.copy(destination.position);
        controls.target.copy(destination.target);
        camera.up.copy(destination.up);
        camera.lookAt(controls.target);
      } else transition.start(pose, destination, now());
    },
    update() {
      if (transition.active) {
        transition.sample(reducedMotion() ? Infinity : now(), pose);
        camera.lookAt(controls.target);
      } else if (!held) controls.update();
    },
    cancel() {
      transition.cancel();
      drainDamping();
      camera.up.set(0, 1, 0);
      camera.lookAt(controls.target);
      held = false;
    },
    finish() {
      if (!transition.active) return;
      transition.sample(Infinity, pose);
      camera.lookAt(controls.target);
    },
  };
}
