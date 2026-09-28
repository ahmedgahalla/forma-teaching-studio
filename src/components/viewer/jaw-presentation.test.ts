// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Sprite,
  Vector3,
} from 'three';
import type { Line2 } from 'three/addons/lines/Line2.js';
import type { DentalCase, DentalTooth } from '@/lib/geometry';
import type { Pose } from '@/lib/model';
import type { MovementTrail } from '@/lib/movement-trails';
import { toothMatrix } from '@/lib/analysis';
import { displayedFitPoints, displayedToothBounds } from '@/lib/viewer-presentation';
import { perspectiveFitFrame } from '@/lib/camera-fit';
import { createToothPoseUpdater } from './tooth-pose';
import { createMovementTrailRenderer } from './movement-trail-renderer';

// Independent scalar expectation from the producer's documented 14-degree hinge.
function hinged(point: Vector3, opening = 0) {
  const radians = (14 * Math.PI) / 180,
    c = Math.cos(radians),
    s = Math.sin(radians);
  const y = point.y - 39.2,
    z = point.z + 77.8;
  return new Vector3(point.x, 39.2 + y * c - z * s - opening, -77.8 + y * s + z * c);
}
const pose: Pose = { translation: [3, 2, -1], rotation: [15, 30, -20] };
function tooth(id: string): DentalTooth {
  return {
    id,
    name: id,
    position: [4, id === '31' ? -6 : 6, 10],
    buccal: [0, 0, 1],
    mesial: [-1, 0, 0],
    calibrated: true,
    geometry: new BoxGeometry(6, 8, 4),
    rootGeometry: new BoxGeometry(3, 14, 3).translate(0, 9, 0),
  };
}
function setup(id = '31') {
  const item = tooth(id),
    group = new Group(),
    ghost = new Object3D(),
    rootGhost = new Object3D();
  const root = new Object3D(),
    attachment = new Object3D();
  attachment.position.set(2, 1, 3);
  group.add(root, attachment);
  const update = createToothPoseUpdater(
    new Map([[id, group]]),
    new Map([[id, ghost]]),
    new Map([[id, rootGhost]]),
    new Map([[id, root]]),
  );
  const dispose = () => {
    item.geometry.dispose();
    item.rootGeometry!.dispose();
  };
  return { item, group, ghost, rootGhost, attachment, update, dispose };
}
beforeEach(() =>
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D),
);
afterEach(() => vi.restoreAllMocks());

it('hinges lower teeth, reference ghosts and attached objects together without accumulating poses', () => {
  const s = setup(),
    reference: Pose = { translation: [-1, 0, 2], rotation: [2, 3, 4] };
  const transforms = { '31': pose },
    ghostTransforms = { '31': reference };
  const display = {
    transforms,
    ghostTransforms,
    jawOpen: true,
    opening: 8,
    roots: true,
    ghost: true,
  };
  const canonical = toothMatrix(s.item, transforms),
    oldPositions = s.item.geometry.getAttribute('position').array.slice();
  s.update(s.item, display);
  const first = s.group.matrixWorld.clone();
  for (let i = 0; i < 20; i++) s.update(s.item, display);
  expect(s.group.matrixWorld.equals(first)).toBe(true);
  for (const local of [new Vector3(), new Vector3(1, 2, 3), s.attachment.position.clone()]) {
    const actual = local.clone().applyMatrix4(s.group.matrixWorld);
    expect(actual.distanceTo(hinged(local.clone().applyMatrix4(canonical), 8))).toBeLessThan(1e-10);
  }
  expect(
    s.attachment
      .getWorldPosition(new Vector3())
      .distanceTo(hinged(s.attachment.position.clone().applyMatrix4(canonical), 8)),
  ).toBeLessThan(1e-10);
  const expectedGhost = hinged(new Vector3().applyMatrix4(toothMatrix(s.item, ghostTransforms)), 8);
  expect(s.ghost.getWorldPosition(new Vector3()).distanceTo(expectedGhost)).toBeLessThan(1e-10);
  expect(s.rootGhost.getWorldPosition(new Vector3()).distanceTo(expectedGhost)).toBeLessThan(1e-10);
  expect(s.rootGhost.quaternion.equals(s.ghost.quaternion)).toBe(true);
  s.update(s.item, { ...display, jawOpen: false, opening: 0 });
  expect(s.group.matrixWorld.equals(canonical)).toBe(true);
  expect(s.item.geometry.getAttribute('position').array).toEqual(oldPositions);
  s.dispose();
});

it('leaves the upper tooth and ghost exact when the lower jaw opens', () => {
  const s = setup('11'),
    display = { transforms: { '11': pose }, opening: 0, roots: true, ghost: true };
  s.update(s.item, display);
  const matrix = s.group.matrixWorld.clone(),
    ghost = s.ghost.position.clone();
  s.update(s.item, { ...display, opening: 12, jawOpen: true });
  expect(s.group.matrixWorld.equals(matrix)).toBe(true);
  expect(s.ghost.position.equals(ghost)).toBe(true);
  s.dispose();
});

it('fits the same hinged crown, root and gum points that the display draws', () => {
  const lower = tooth('31'),
    upper = tooth('11'),
    gumGeometry = new BoxGeometry(10, 6, 7);
  const model: DentalCase = {
    demo: true,
    name: 'Jaw fixture',
    teeth: [lower, upper],
    gums: [{ id: 'lower', arch: 'lower', position: [1, -10, 3], geometry: gumGeometry }],
  };
  const transforms = { '31': pose },
    opening = 8;
  const expected: Vector3[] = [];
  for (const item of model.teeth) {
    const matrix = toothMatrix(item, transforms);
    for (const geometry of [item.geometry, item.rootGeometry!]) {
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const point = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
        expected.push(item.id === '31' ? hinged(point, opening) : point);
      }
    }
  }
  const bounds = displayedToothBounds(model, transforms, ['31', '11'], true, opening, true);
  for (const point of expected)
    expect(bounds.clone().expandByScalar(1e-10).containsPoint(point)).toBe(true);
  const gumPositions = gumGeometry.getAttribute('position');
  for (let i = 0; i < gumPositions.count; i++)
    expected.push(
      hinged(
        new Vector3().fromBufferAttribute(gumPositions, i).add(new Vector3(1, -10, 3)),
        opening,
      ),
    );
  // Consume the reused generator vector as it is yielded.
  const actual: Vector3[] = [];
  for (const point of displayedFitPoints(
    model,
    transforms,
    ['31', '11'],
    true,
    opening,
    true,
    true,
  ))
    actual.push(point.clone());
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, i) => expect(point.distanceTo(expected[i])).toBeLessThan(1e-10));
  const camera = new PerspectiveCamera(20, 1.5, 0.1, 1000);
  for (const point of expected) bounds.expandByPoint(point);
  const direction = new Vector3(0.4, 0.3, 1).normalize();
  const fit = perspectiveFitFrame(bounds, direction, camera.up, camera.fov, camera.aspect, 1.25);
  camera.position.copy(fit.target).addScaledVector(direction, fit.distance);
  camera.lookAt(fit.target);
  camera.updateMatrixWorld(true);
  for (const point of actual) {
    point.project(camera);
    expect(Math.abs(point.x)).toBeLessThan(1);
    expect(Math.abs(point.y)).toBeLessThan(1);
  }
  for (const item of model.teeth) {
    item.geometry.dispose();
    item.rootGeometry!.dispose();
  }
  gumGeometry.dispose();
});

it('keeps hinged trail samples, live endpoints and screen-space labels aligned through seek and close', () => {
  const camera = new PerspectiveCamera(40, 1.5, 0.1, 1000);
  camera.position.set(20, 10, 150);
  camera.lookAt(0, -10, 0);
  camera.updateMatrixWorld(true);
  const trail: MovementTrail = {
    toothId: '31',
    crownPoint: [0, 1, 0],
    rootPoint: [0, -1, 0],
    progress: [0, 0.5, 1],
    crown: new Float32Array([0, 1, 0, 1, 1, 0, 2, 1, 0]),
    root: new Float32Array([0, -1, 0, 1, -1, 0, 2, -1, 0]),
  };
  const renderer = createMovementTrailRenderer(camera),
    group = new Group();
  renderer.setTrail(trail);
  const hinge = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (14 * Math.PI) / 180);
  for (const open of [true, false, true])
    for (const progress of [0.75, 0.25, 1]) {
      group.position.copy(
        open ? hinged(new Vector3(progress * 2, 0, 0), 8) : new Vector3(progress * 2, -8, 0),
      );
      group.quaternion.copy(open ? hinge : new Quaternion());
      group.updateMatrixWorld(true);
      renderer.update(
        {
          movementTrail: trail,
          trailProgress: progress,
          selected: '31',
          roots: true,
          opening: 8,
          jawOpen: open,
        },
        group,
        900,
        600,
      );
      renderer.group.updateMatrixWorld(true);
      for (const [index, local] of [trail.crownPoint, trail.rootPoint!].entries()) {
        const path = renderer.group.children[index] as Group,
          line = path.children[0] as Line2;
        const marker = path.children[1] as Mesh,
          label = path.children[2] as Sprite;
        const expected = new Vector3(...local).applyMatrix4(group.matrixWorld);
        const endpoint = new Vector3()
          .fromBufferAttribute(
            line.geometry.getAttribute('instanceEnd'),
            line.geometry.instanceCount - 1,
          )
          .applyMatrix4(path.matrixWorld);
        expect(endpoint.distanceTo(expected)).toBeLessThan(1e-6);
        expect(marker.getWorldPosition(new Vector3()).distanceTo(expected)).toBeLessThan(1e-10);
        const markerScreen = expected.project(camera),
          labelScreen = label.getWorldPosition(new Vector3()).project(camera);
        expect((labelScreen.x - markerScreen.x) * 450).toBeCloseTo(10, 8);
        expect((labelScreen.y - markerScreen.y) * 300).toBeCloseTo(index ? -20 : 20, 8);
        if (index)
          expect(
            marker.getWorldQuaternion(new Quaternion()).angleTo(camera.quaternion),
          ).toBeLessThan(1e-7);
      }
    }
  expect(trail.crown).toEqual(new Float32Array([0, 1, 0, 1, 1, 0, 2, 1, 0]));
  renderer.dispose();
});
