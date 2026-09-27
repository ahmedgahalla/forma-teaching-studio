import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CAMERA_TRANSITION_MS, cameraEase, createCameraTransition } from './camera-transition';

const pose = (x = 0, y = 0, z = 10) => ({
  position: new Vector3(x, y, z),
  target: new Vector3(),
  up: new Vector3(0, 1, 0),
});

describe('camera interpolation', () => {
  it('eases symmetrically with clamped endpoints and zero endpoint velocity', () => {
    expect(cameraEase(-1)).toBe(0);
    expect(cameraEase(2)).toBe(1);
    expect(cameraEase(0.5)).toBe(0.5);
    expect(cameraEase(0.2)).toBeCloseTo(1 - cameraEase(0.8));
    expect(cameraEase(0.001)).toBeLessThan(0.00001);
    expect(1 - cameraEase(0.999)).toBeLessThan(0.00001);
  });

  it('orbits between opposite sides without crossing through the model', () => {
    const transition = createCameraTransition(),
      output = pose();
    transition.start(pose(), pose(0, 0, -10), 100);
    for (const t of [0, 0.1, 0.5, 0.9]) {
      transition.sample(100 + CAMERA_TRANSITION_MS * t, output);
      expect(output.position.distanceTo(output.target)).toBeCloseTo(10);
      expect(output.up.length()).toBeCloseTo(1);
      expect(output.position.dot(output.up)).toBeCloseTo(0);
      expect(transition.active).toBe(true);
    }
    transition.sample(100 + CAMERA_TRANSITION_MS, output);
    expect(transition.active).toBe(false);
    expect(output.position.toArray()).toEqual([0, 0, -10]);
  });

  it('restarts from the displayed pose and finishes at exact target/up coordinates', () => {
    const transition = createCameraTransition(),
      output = pose();
    transition.start(pose(), pose(-10, 0, 0), 0);
    transition.sample(200, output);
    const before = output.position.clone();
    const end = pose(4, 18, -2);
    end.target.set(4, 3, -2);
    end.up.set(0, 0, -1);
    transition.start(output, end, 200);
    transition.sample(200, output);
    expect(output.position.distanceTo(before)).toBeLessThan(1e-10);
    transition.sample(200 + CAMERA_TRANSITION_MS, output);
    expect(output).toEqual(end);
    expect(transition.active).toBe(false);
  });

  it('is frame-rate independent, reuses output vectors and does no work after cancel', () => {
    const a = createCameraTransition(),
      b = createCameraTransition();
    const outA = pose(),
      outB = pose();
    const position = outA.position,
      target = outA.target,
      up = outA.up;
    a.start(pose(), pose(20, 0, 0), 0);
    b.start(pose(), pose(20, 0, 0), 0);
    for (let time = 0; time <= 260; time += 10) a.sample(time, outA);
    b.sample(260, outB);
    expect(outA).toEqual(outB);
    expect(outA.position).toBe(position);
    expect(outA.target).toBe(target);
    expect(outA.up).toBe(up);
    a.cancel();
    a.sample(999, outA);
    expect(outA).toEqual(outB);
    expect(a.active).toBe(false);
  });
});
