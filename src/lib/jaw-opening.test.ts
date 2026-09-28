import { describe, expect, it } from 'vitest';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import {
  applyJawDirection,
  applyJawMatrix,
  applyJawPoint,
  applyJawQuaternion,
  inverseJawPoint,
  inverseJawQuaternion,
} from './jaw-opening';

describe('Atlas display-only hinge', () => {
  it('matches the original 14-degree X-axis hinge and leaves its centre fixed', () => {
    // Captured from Claude model.js setJaw(1), hinge [0, 39.2, -77.8].
    const point = new Vector3(12, -8, 30);
    expect(applyJawPoint(point, true)).toBe(point);
    expect(point.distanceTo(new Vector3(12, -32.67713862587121, 15.379165820248105))).toBeLessThan(
      1e-12,
    );
    expect(
      applyJawPoint(new Vector3(0, 39.2, -77.8), true).distanceTo(new Vector3(0, 39.2, -77.8)),
    ).toBeLessThan(1e-12);
  });

  it('makes every omitted or closed transform an in-place identity', () => {
    const point = new Vector3(5, 6, 7),
      quaternion = new Quaternion().setFromEuler(new Euler(0.2, -0.3, 0.1)),
      matrix = new Matrix4().compose(point, quaternion, new Vector3(1, 1, 1));
    const before = { point: point.clone(), quaternion: quaternion.clone(), matrix: matrix.clone() };
    for (const open of [undefined, false]) {
      expect(applyJawPoint(point, open)).toBe(point);
      expect(inverseJawPoint(point, open)).toBe(point);
      expect(applyJawDirection(point, open)).toBe(point);
      expect(applyJawQuaternion(quaternion, open)).toBe(quaternion);
      expect(inverseJawQuaternion(quaternion, open)).toBe(quaternion);
      expect(applyJawMatrix(matrix, open)).toBe(matrix);
    }
    expect(point).toEqual(before.point);
    expect(quaternion).toEqual(before.quaternion);
    expect(matrix).toEqual(before.matrix);
  });

  it('rotates direction and orientation without applying hinge translation', () => {
    const direction = new Vector3(0, 3, 0);
    expect(applyJawDirection(direction, true)).toBe(direction);
    expect(
      direction.distanceTo(new Vector3(0, 2.9108871788279895, 0.7257656867990032)),
    ).toBeLessThan(1e-12);
    const pose = new Quaternion().setFromEuler(new Euler(0.2, -0.3, 0.1)),
      axis = new Vector3(0.4, -0.5, 0.7).normalize(),
      expected = applyJawDirection(axis.clone().applyQuaternion(pose), true);
    expect(applyJawQuaternion(pose, true)).toBe(pose);
    expect(axis.applyQuaternion(pose).distanceTo(expected)).toBeLessThan(1e-12);
  });

  it('premultiplies a posed tooth matrix and applies millimetre separation afterwards', () => {
    const pose = new Matrix4().compose(
        new Vector3(12, -8, 30),
        new Quaternion().setFromEuler(new Euler(0.2, -0.3, 0.1)),
        new Vector3(1, 1, 1),
      ),
      display = pose.clone();
    expect(applyJawMatrix(display, true)).toBe(display);
    display.elements[13] -= 5;
    for (const local of [new Vector3(), new Vector3(2, 3, 4), new Vector3(-1, -6, 2)]) {
      const expected = applyJawPoint(local.clone().applyMatrix4(pose), true);
      expected.y -= 5;
      expect(local.applyMatrix4(display).distanceTo(expected)).toBeLessThan(1e-12);
    }
    expect(new Vector3().setFromMatrixPosition(pose)).toEqual(new Vector3(12, -8, 30));
  });

  it('recovers canonical picking/editing points and rotations after removing separation', () => {
    const canonical = new Vector3(12, -8, 30),
      rotation = new Quaternion().setFromEuler(new Euler(0.2, -0.3, 0.1)),
      displayed = applyJawPoint(canonical.clone(), true),
      displayedRotation = applyJawQuaternion(rotation.clone(), true);
    displayed.y -= 9;
    displayed.y += 9;
    expect(inverseJawPoint(displayed, true)).toBe(displayed);
    expect(displayed.distanceTo(canonical)).toBeLessThan(1e-12);
    expect(inverseJawQuaternion(displayedRotation, true)).toBe(displayedRotation);
    expect(1 - Math.abs(displayedRotation.dot(rotation))).toBeLessThan(1e-12);
  });
});
