import { BoxGeometry, Group } from 'three';
import { expect, it } from 'vitest';
import { createGumFollower } from './gum-follow';
import type { DentalTooth, Gum } from './geometry';

it('supports saved nonindexed surfaces with missing bounds without changing source topology', () => {
  const geometry = new BoxGeometry(4, 12, 4).toNonIndexed();
  const gum: Gum = { id: 'saved-gum', arch: 'upper', position: [0, 0, 0], geometry };
  const tooth: DentalTooth = {
    id: '11',
    name: 'Saved incisor',
    geometry: new BoxGeometry(4, 12, 4),
    rootGeometry: new BoxGeometry(2, 10, 2),
    position: [0, 0, 0],
    buccal: [0, 0, 1],
    mesial: [1, 0, 0],
    occlusal: [0, -1, 0],
    calibrated: true,
  };
  const view = geometry.clone(),
    group = new Group();
  const sourcePosition = geometry.getAttribute('position').array.slice();
  const sourceNormal = geometry.getAttribute('normal').array.slice();
  expect(geometry.boundingBox).toBeNull();
  expect(tooth.geometry.boundingBox).toBeNull();
  const follow = createGumFollower(gum, [tooth], view, new Map([['11', group]]));
  follow(0);
  group.position.x = 1;
  expect(follow(0)).toBe(true);
  expect(view.getAttribute('position').array).not.toEqual(sourcePosition);
  expect(view.getAttribute('normal').array.every(Number.isFinite)).toBe(true);
  expect(geometry.index).toBeNull();
  group.position.x = 0;
  follow(0);
  expect(view.getAttribute('position').array).toEqual(sourcePosition);
  expect(view.getAttribute('normal').array).toEqual(sourceNormal);
  expect(geometry.getAttribute('position').array).toEqual(sourcePosition);
  geometry.dispose();
  view.dispose();
  tooth.geometry.dispose();
  tooth.rootGeometry!.dispose();
});
