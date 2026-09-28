import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Group, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import type { DentalTooth } from './geometry';
import { createApplianceKit } from './appliances';
import {
  bracketPlacementLocal,
  bracketPlacementOffsets,
  bracketSlotLocal,
  createBracketPlacementUpdater,
} from './bracket-placement';

const geometries: BufferGeometry[] = [];
function tooth(lower = false): DentalTooth {
  const geometry = new SphereGeometry(3, 48, 32);
  geometries.push(geometry);
  return {
    id: lower ? '31' : '11',
    name: 'Placement fixture',
    geometry,
    calibrated: true,
    position: [2, 3, 4],
    buccal: [0, 0, 1],
    mesial: lower ? [-1, 0, 0] : [1, 0, 0],
    occlusal: lower ? [0, -1, 0] : [0, 1, 0],
    bracketPosition: [0, 0, 3.28],
  };
}
afterEach(() => geometries.splice(0).forEach(geometry => geometry.dispose()));

describe('bonded bracket placement', () => {
  it('keeps neutral placement exactly at the existing slot', () => {
    const t = tooth(),
      kit = createApplianceKit();
    try {
      const bracket = kit.bracket(t)!;
      expect(bracketPlacementLocal(t, 0, 0)).toEqual(bracketSlotLocal(t));
      expect(bracketSlotLocal(t)).toEqual(bracket.userData.anchor.toArray());
    } finally {
      kit.dispose();
    }
  });

  it.each([false, true])(
    'uses anatomical signed offsets and follows the curved crown (lower=%s)',
    lower => {
      const t = tooth(lower);
      const before = t.geometry.getAttribute('position').array.slice();
      const local = bracketPlacementLocal(t, 0.5, 1);
      expect(local[0]).toBeCloseTo(lower ? -0.5 : 0.5, 10);
      expect(local[1]).toBeCloseTo(lower ? -1 : 1, 10);
      expect(local[2]).toBeCloseTo(Math.sqrt(9 - 0.25 - 1) + 0.95, 1);
      expect(local[2]).toBeLessThan(bracketSlotLocal(t)[2]);
      const offsets = bracketPlacementOffsets(t, local);
      expect(offsets.mesialMm).toBeCloseTo(0.5, 10);
      expect(offsets.occlusalMm).toBeCloseTo(1, 10);
      expect(t.geometry.getAttribute('position').array).toEqual(before);
    },
  );

  it.each([NaN, Infinity, -Infinity, 2.001, -2.001])('rejects unsupported offset %s', value => {
    const t = tooth();
    expect(() => bracketPlacementLocal(t, value, 0)).toThrow(/within 2 mm/);
    expect(() => bracketPlacementLocal(t, 0, value)).toThrow(/within 2 mm/);
  });

  it('rejects a bounded but off-crown bond site instead of drawing a floating bracket', () => {
    const t = tooth();
    t.geometry = new BoxGeometry(1, 1, 2);
    geometries.push(t.geometry);
    expect(() => bracketPlacementLocal(t, 2, 0)).toThrow(/no buccal surface/);
  });

  it('rotates the rendered bracket in plane while keeping the configured slot registered under parent poses', () => {
    const t = tooth(true),
      kit = createApplianceKit();
    try {
      const bracket = kit.bracket(t)!;
      const neutralPosition = bracket.position.clone(),
        neutralRotation = bracket.quaternion.clone();
      const update = createBracketPlacementUpdater(bracket),
        local = bracketPlacementLocal(t, 0.5, 1);
      const parent = new Group();
      parent.position.set(8, -4, 3);
      parent.rotation.set(0.2, 0.3, -0.4);
      parent.add(bracket);
      update(local, 7);
      const firstRotation = bracket.quaternion.clone(),
        firstPosition = bracket.position.clone();
      for (let i = 0; i < 20; i++) update(local, 7);
      expect(bracket.quaternion.equals(firstRotation)).toBe(true);
      expect(bracket.position.equals(firstPosition)).toBe(true);
      expect(neutralRotation.angleTo(firstRotation)).toBeCloseTo((7 * Math.PI) / 180, 12);
      parent.updateMatrixWorld(true);
      expect(
        bracket
          .localToWorld(new Vector3(0, 0, 0.67))
          .distanceTo(parent.localToWorld(new Vector3(...local))),
      ).toBeLessThan(1e-10);
      update();
      expect(bracket.position.equals(neutralPosition)).toBe(true);
      expect(bracket.quaternion.equals(neutralRotation)).toBe(true);
    } finally {
      kit.dispose();
    }
  });
});
