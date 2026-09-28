import { expect, it } from 'vitest';
import { Euler, MathUtils, Object3D, Quaternion, Vector3 } from 'three';
import type { Pose, Tooth, Vec3 } from '@/lib/model';
import { canonicalJawPoint, canonicalJawPose, jawCurvePoints, jawProps } from './jaw-display';
import type { ViewerProps } from './viewer-types';

const tooth: Tooth = {
  id: '31',
  name: 'Lower',
  position: [4, -6, 10],
  buccal: [0, 0, 1],
  mesial: [-1, 0, 0],
  calibrated: true,
};
const pose: Pose = { translation: [2, -1, 0.5], rotation: [12, -8, 6] };
const hinge = new Vector3(0, 39.2, -77.8);
const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(14));

it('gates the display hinge to the Atlas mouth even when restoring an unsupported view', () => {
  const props = { model: { asset: 'claude-atlas-v1' }, jawOpen: true } as ViewerProps;
  expect(jawProps(props)).toBe(props);
  expect(jawProps({ ...props, model: { ...props.model, asset: undefined } }).jawOpen).toBe(false);
  expect(
    jawProps({ ...props, toothStudy: { tooth: '31' } as ViewerProps['toothStudy'] }).jawOpen,
  ).toBe(false);
  expect(props.jawOpen).toBe(true);
});

it.each([0, 12])(
  'commits canonical lower-tooth poses after a jaw hinge and %s mm spacing',
  opening => {
    const object = new Object3D();
    object.position.fromArray(tooth.position).add(new Vector3(...pose.translation));
    object.position.sub(hinge).applyQuaternion(rotation).add(hinge).y -= opening;
    object.quaternion.setFromEuler(new Euler(...(pose.rotation.map(MathUtils.degToRad) as Vec3)));
    object.quaternion.premultiply(rotation);
    const matrix = object.matrix.clone(),
      original = object.position.clone();
    const actual = canonicalJawPose(tooth, object, { jawOpen: true, opening });
    actual.translation.forEach((value, i) => expect(value).toBeCloseTo(pose.translation[i], 10));
    actual.rotation.forEach((value, i) => expect(value).toBeCloseTo(pose.rotation[i], 10));
    expect(object.position.equals(original)).toBe(true);
    expect(object.matrix.equals(matrix)).toBe(true);
  },
);

it('converts a lower gingival target back to case space while leaving upper targets alone', () => {
  const point = new Vector3(2, -8, 17),
    shown = point.clone().sub(hinge).applyQuaternion(rotation).add(hinge);
  shown.y -= 9;
  expect(
    canonicalJawPoint(shown, '36', { jawOpen: true, opening: 9 }).distanceTo(point),
  ).toBeLessThan(1e-10);
  expect(canonicalJawPoint(point.clone(), '16', { jawOpen: true, opening: 9 }).equals(point)).toBe(
    true,
  );
});

it('hinges a lower reference curve with spacing once, without changing its source points', () => {
  const points: Vec3[] = [
      [-4, -10, 2],
      [3, -10, 8],
    ],
    original = structuredClone(points);
  const actual = jawCurvePoints(points, true, { jawOpen: true, opening: 5 });
  points.forEach((point, i) => {
    const expected = new Vector3(...point);
    expected.y += 5;
    expected.sub(hinge).applyQuaternion(rotation).add(hinge).y -= 5;
    expect(actual[i].distanceTo(expected)).toBeLessThan(1e-10);
  });
  expect(
    jawCurvePoints(points, true, { jawOpen: false, opening: 5 }).map(p => p.toArray()),
  ).toEqual(points);
  expect(
    jawCurvePoints(points, false, { jawOpen: true, opening: 5 }).map(p => p.toArray()),
  ).toEqual(points);
  expect(points).toEqual(original);
});
