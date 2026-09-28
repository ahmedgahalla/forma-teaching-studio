import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { afterEach, expect, it } from 'vitest';
import { gumInfluences } from './gum-influences';
import type { DentalTooth, Gum } from './geometry';
import type { Vec3 } from './model';
import { cachedGumBinding, cacheGumBinding } from './gum-binding-cache';

const owned: BufferGeometry[] = [];
afterEach(() => owned.splice(0).forEach(geometry => geometry.dispose()));
function fixture(id = 'cache-fixture') {
  const geometry = new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute([0.5, 5, 0, 0.5, 4, 1, 0.5, 15, 1], 3))
    .setAttribute('dentalData', new Float32BufferAttribute(new Float32Array(12), 4));
  const crown = new BoxGeometry(2, 2, 2),
    root = new BoxGeometry(1, 4, 1);
  owned.push(geometry, crown, root);
  const gum: Gum = { id, arch: 'upper', position: [0, 0, 0], geometry };
  const tooth: DentalTooth = {
    id: '11',
    name: 'Cache tooth',
    position: [0.1, 5.2, 0.3],
    geometry: crown,
    rootGeometry: root,
    buccal: [0, 0, 1],
    mesial: [1, 0, 0],
    calibrated: true,
  };
  return { gum, tooth };
}
function copied(gum: Gum, tooth: DentalTooth) {
  const gumGeometry = gum.geometry.clone(),
    crown = tooth.geometry.clone(),
    root = tooth.rootGeometry!.clone();
  owned.push(gumGeometry, crown, root);
  return {
    gum: { ...gum, position: [...gum.position] as Vec3, geometry: gumGeometry },
    tooth: { ...tooth, position: [...tooth.position] as Vec3, geometry: crown, rootGeometry: root },
  };
}

it('reuses a rigid whole-arch translation despite subtraction roundoff', () => {
  const { gum, tooth } = fixture();
  const first = gumInfluences(gum, [tooth]),
    shift: Vec3 = [17.7, -5.37, 1 / 3];
  const movedGum = { ...gum, position: shift };
  const movedTooth = {
    ...tooth,
    position: tooth.position.map((value, i) => value + shift[i]) as Vec3,
  };
  expect(movedTooth.position[0] - movedGum.position[0]).not.toBe(tooth.position[0]);
  expect(cachedGumBinding(movedGum, [movedTooth])).toBe(first);
  expect(gumInfluences(movedGum, [movedTooth])).toBe(first);
  expect(gum.position).toEqual([0, 0, 0]);
  expect(tooth.position).toEqual([0.1, 5.2, 0.3]);
});

it('recomputes for a real tooth-only change to the reference origin', () => {
  const { gum, tooth } = fixture();
  const first = gumInfluences(gum, [tooth]);
  const moved = { ...tooth, position: [0.11, 5.2, 0.3] as Vec3 };
  expect(cachedGumBinding(gum, [moved])).toBeUndefined();
  const second = gumInfluences(gum, [moved]);
  expect(second).not.toBe(first);
  expect(second.weights.some((value, i) => value !== first.weights[i])).toBe(true);
});

it('reuses canonical bindings for equal copied saved geometry', () => {
  const { gum, tooth } = fixture('saved-equal');
  const first = gumInfluences(gum, [tooth]);
  cacheGumBinding(gum, [tooth], first, true);
  const saved = copied(gum, tooth);
  expect(saved.gum.geometry).not.toBe(gum.geometry);
  expect(saved.tooth.geometry).not.toBe(tooth.geometry);
  expect(saved.tooth.rootGeometry).not.toBe(tooth.rootGeometry);
  expect(gumInfluences(saved.gum, [saved.tooth])).toBe(first);
  expect(cachedGumBinding(saved.gum, [saved.tooth])).toBe(first);
});

it.each(['crown', 'root', 'gum', 'tissue-data'] as const)(
  'rejects canonical reuse when copied %s data changed',
  part => {
    const { gum, tooth } = fixture(`saved-changed-${part}`);
    const first = gumInfluences(gum, [tooth]);
    cacheGumBinding(gum, [tooth], first, true);
    const saved = copied(gum, tooth);
    const geometry =
      part === 'crown'
        ? saved.tooth.geometry
        : part === 'root'
          ? saved.tooth.rootGeometry!
          : saved.gum.geometry;
    const attribute = geometry.getAttribute(part === 'tissue-data' ? 'dentalData' : 'position');
    attribute.setZ(0, attribute.getZ(0) + 0.5);
    expect(cachedGumBinding(saved.gum, [saved.tooth])).toBeUndefined();
    expect(gumInfluences(saved.gum, [saved.tooth])).not.toBe(first);
  },
);

it('reuses matching source bindings and evicts the least recently used of four baselines', () => {
  const geometry = new BufferGeometry().setAttribute(
    'position',
    new Float32BufferAttribute([0.5, 5, 0, 0.5, 4, 1, 0.5, 15, 1], 3),
  );
  geometry.computeBoundingBox();
  const crown = new BoxGeometry(2, 2, 2);
  crown.computeBoundingBox();
  const gum: Gum = { id: 'upper', arch: 'upper', position: [0, 0, 0], geometry };
  const tooth: DentalTooth = {
    id: '11',
    name: 'Test tooth',
    position: [0, 5, 0],
    geometry: crown,
    buccal: [0, 0, 1],
    mesial: [1, 0, 0],
    calibrated: true,
  };
  const bind = (offset: number) => gumInfluences(gum, [{ ...tooth, position: [offset, 5, 0] }]);
  const first = bind(0),
    second = bind(1);
  bind(2);
  bind(3);
  expect(bind(0)).toBe(first);
  bind(4);
  expect(bind(0)).toBe(first);
  expect(bind(1)).not.toBe(second);
  expect(Array.from(first.weights).some(weight => weight > 0.9)).toBe(true);
  expect(Array.from(geometry.getAttribute('position').array)).toEqual([
    0.5, 5, 0, 0.5, 4, 1, 0.5, 15, 1,
  ]);
  geometry.dispose();
  crown.dispose();
});
