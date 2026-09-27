// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderBarrier } from '@/lib/render-barrier';
import { CAMERA_TRANSITION_MS } from '@/lib/camera-transition';
import { createCameraMotion, readViewerCamera } from './camera-motion';

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach(dispose => dispose()));
function setup() {
  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, 100);
  const controls = new OrbitControls(camera, document.createElement('div'));
  controls.enableDamping = true;
  cleanup.push(() => controls.dispose());
  let time = 0,
    reduced = false;
  const motion = createCameraMotion(
    camera,
    controls,
    () => reduced,
    () => time,
  );
  const destination = {
    position: [-100, 0, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
    up: [0, 1, 0] as [number, number, number],
  };
  return {
    camera,
    controls,
    motion,
    destination,
    time: (next: number) => {
      time = next;
    },
    reduce: () => {
      reduced = true;
    },
  };
}

it('settles only after the final transitioned frame, capturing the requested camera', async () => {
  const { camera, motion, destination, time } = setup();
  const barrier = createRenderBarrier(),
    captured = vi.fn();
  motion.move(destination);
  const waiting = barrier
    .wait(new AbortController().signal)
    .then(() => captured(camera.position.toArray()));
  time(260);
  motion.update();
  barrier.rendered(!motion.active);
  await Promise.resolve();
  expect(captured).not.toHaveBeenCalled();
  time(CAMERA_TRANSITION_MS);
  motion.update();
  barrier.rendered(!motion.active);
  await waiting;
  expect(captured).toHaveBeenCalledExactlyOnceWith(destination.position);
});

it('applies reduced-motion views and exact snapshot restoration instantly', () => {
  const { camera, controls, motion, destination, reduce } = setup();
  reduce();
  motion.move(destination);
  expect(motion.active).toBe(false);
  expect(camera.position.toArray()).toEqual(destination.position);
  const snapshot = {
    position: [1, 27, 3] as [number, number, number],
    target: [1, 2, 3] as [number, number, number],
    up: [0, 0, -1] as [number, number, number],
  };
  motion.move(snapshot, true);
  // OrbitControls clamps its poles; idle updates must not alter exact snapshots.
  motion.update();
  motion.update();
  expect(camera.position.toArray()).toEqual(snapshot.position);
  expect(controls.target.toArray()).toEqual(snapshot.target);
  expect(camera.up.toArray()).toEqual(snapshot.up);
});

it('completes in-flight movement if reduced motion becomes enabled', () => {
  const { camera, motion, destination, time, reduce } = setup();
  motion.move(destination);
  time(200);
  motion.update();
  reduce();
  motion.update();
  expect(motion.active).toBe(false);
  expect(camera.position.toArray()).toEqual(destination.position);
});

it('cancels without snapping on orbit and replaces a request from its current frame', () => {
  const { camera, controls, motion, destination, time } = setup();
  motion.move(destination);
  time(200);
  motion.update();
  const displayed = camera.position.clone();
  motion.cancel();
  expect(motion.active).toBe(false);
  time(2000);
  motion.update();
  expect(camera.position.distanceTo(displayed)).toBeLessThan(1e-10);
  motion.move({ ...destination, position: [0, 0, -100] });
  motion.update();
  expect(camera.position.distanceTo(displayed)).toBeLessThan(1e-10);
  expect(controls.enableDamping).toBe(true);
});

it('keeps the exact completed pole view on later frames and finishes before a resize', () => {
  const { camera, motion, destination, time } = setup();
  const pole = {
    ...destination,
    position: [0, 100, 0] as [number, number, number],
    up: [0, 0, -1] as [number, number, number],
  };
  motion.move(pole);
  time(CAMERA_TRANSITION_MS);
  motion.update();
  motion.update();
  expect(camera.position.toArray()).toEqual(pole.position);
  motion.move(destination);
  time(CAMERA_TRANSITION_MS + 100);
  motion.update();
  motion.finish();
  expect(motion.active).toBe(false);
  expect(camera.position.toArray()).toEqual(destination.position);
});

it.each([false, true])(
  'restores world-up and lookAt when orbit cancels a rolled pose (instant=%s)',
  instant => {
    const { camera, controls, motion, destination, time } = setup();
    motion.move({ ...destination, position: [0, 100, 1], up: [0, 0, -1] }, instant);
    if (!instant) {
      time(260);
      motion.update();
    }
    const displayed = camera.position.clone();
    motion.cancel();
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
    expect(camera.position.equals(displayed)).toBe(true);
    const expected = camera.clone();
    expected.up.set(0, 1, 0);
    expected.lookAt(controls.target);
    expect(camera.quaternion.angleTo(expected.quaternion)).toBeLessThan(1e-7);
    motion.update();
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
  },
);

it('reads the destination during a tween so undo never saves an interpolated camera', () => {
  const { camera, controls, motion, destination, time } = setup();
  motion.move(destination);
  time(260);
  motion.update();
  const snapshot = readViewerCamera(camera, controls, 'front', null, motion.pose);
  expect(snapshot).toMatchObject(destination);
  expect(motion.read('front', null)).toEqual(snapshot);
  snapshot.position[0] = 1000;
  expect(motion.pose.position.toArray()).toEqual(destination.position);
  motion.cancel();
  expect(readViewerCamera(camera, controls, 'front', null, motion.pose).position).toEqual(
    camera.position.toArray(),
  );
});

it('focuses along the requested front view while its transition is still running', () => {
  const { camera, controls, motion, time } = setup();
  motion.move({ position: [-100, 0, 0], target: [0, 0, 0], up: [0, 1, 0] }, true);
  motion.move({ position: [0, 0, 100], target: [0, 0, 0], up: [0, 1, 0] });
  time(100);
  motion.update();
  const { position, target, up } = motion.pose;
  const direction = position.clone().sub(target).normalize();
  expect(direction.toArray()).toEqual([0, 0, 1]);
  expect(up.toArray()).toEqual([0, 1, 0]);
  const toothCenter = new Vector3(10, 20, 30);
  motion.move({
    position: toothCenter.clone().addScaledVector(direction, 25).toArray(),
    target: toothCenter.toArray(),
    up: up.toArray(),
  });
  motion.finish();
  expect(camera.position.clone().sub(controls.target).normalize().toArray()).toEqual([0, 0, 1]);
});
