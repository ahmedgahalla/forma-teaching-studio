import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Object3D, Vector3 } from 'three';
import { toothMatrix } from '@/lib/analysis';
import type { Pose, Tooth } from '@/lib/model';
import { createToothPoseUpdater } from './tooth-pose';

const pose: Pose = { translation: [3, 2, -1], rotation: [15, 30, -20] };
const tooth: Tooth = {
  id: '31',
  name: 'Lower incisor',
  position: [4, -6, 10],
  buccal: [0, 0, 1],
  mesial: [-1, 0, 0],
  calibrated: true,
};
function setup(id = tooth.id) {
  const group = new Group(),
    ghost = new Object3D(),
    rootGhost = new Object3D(),
    root = new Object3D();
  const update = createToothPoseUpdater(
    new Map([[id, group]]),
    new Map([[id, ghost]]),
    new Map([[id, rootGhost]]),
    new Map([[id, root]]),
  );
  return { group, ghost, rootGhost, root, update };
}

describe('viewer tooth poses', () => {
  it('matches absolute geometry transforms and jaw opening without accumulating repeated frames', () => {
    const scene = setup(),
      geometry = new BoxGeometry(6, 8, 4);
    const originalVertices = [...geometry.getAttribute('position').array];
    const display = { transforms: { '31': pose }, opening: 8, ghost: true, roots: true };
    const position = scene.group.position,
      quaternion = scene.group.quaternion;
    scene.update(tooth, display);
    const first = scene.group.matrixWorld.clone();
    for (let frame = 0; frame < 20; frame++) scene.update(tooth, display);
    expect(scene.group.matrixWorld.equals(first)).toBe(true);
    expect(scene.group.position).toBe(position);
    expect(scene.group.quaternion).toBe(quaternion);
    const expected = toothMatrix({ ...tooth, geometry }, display.transforms);
    expected.elements[13] -= display.opening;
    const vertices = geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const local = new Vector3().fromBufferAttribute(vertices, i);
      const actual = local.clone().applyMatrix4(scene.group.matrixWorld);
      expect(actual.distanceTo(local.applyMatrix4(expected))).toBeLessThan(1e-10);
    }
    expect([...geometry.getAttribute('position').array]).toEqual(originalVertices);
    scene.update(tooth, { ...display, transforms: {} });
    expect(scene.group.position.toArray()).toEqual([4, -14, 10]);
    expect(scene.group.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    geometry.dispose();
  });

  it('keeps reference roots aligned with the reference pose and hides identical or disabled ghosts', () => {
    const scene = setup();
    const reference: Pose = { translation: [-1, 2, 0], rotation: [2, 10, 4] };
    const display = {
      transforms: { '31': pose },
      ghostTransforms: { '31': reference },
      opening: 8,
      ghost: true,
      roots: true,
    };
    scene.update(tooth, display);
    expect(scene.ghost.visible).toBe(true);
    expect(scene.rootGhost.visible).toBe(true);
    expect(scene.rootGhost.position.toArray()).toEqual([3, -12, 10]);
    expect(scene.rootGhost.quaternion.equals(scene.ghost.quaternion)).toBe(true);
    scene.update(tooth, { ...display, roots: false });
    expect(scene.root.visible).toBe(false);
    expect(scene.ghost.visible).toBe(true);
    expect(scene.rootGhost.visible).toBe(false);
    scene.update(tooth, { ...display, ghostTransforms: { '31': pose } });
    expect(scene.ghost.visible).toBe(false);
    expect(scene.rootGhost.visible).toBe(false);
    scene.update(tooth, { ...display, ghost: false });
    expect(scene.ghost.visible).toBe(false);
    scene.group.visible = false;
    scene.update(tooth, display);
    expect(scene.ghost.visible).toBe(false);
    expect(scene.rootGhost.visible).toBe(false);
  });

  it('leaves upper-arch poses independent of lower-jaw opening and restores absent reference poses', () => {
    const upper = { ...tooth, id: '11' },
      scene = setup('11');
    const display = {
      transforms: { '11': pose },
      ghostTransforms: { '11': pose },
      opening: 25,
      ghost: true,
      roots: true,
    };
    scene.update(upper, display);
    expect(scene.group.position.toArray()).toEqual([7, -4, 9]);
    scene.update(upper, { ...display, ghostTransforms: undefined });
    expect(scene.ghost.position.toArray()).toEqual(upper.position);
    expect(scene.ghost.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(scene.rootGhost.position.toArray()).toEqual(upper.position);
  });
});
