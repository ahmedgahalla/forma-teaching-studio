import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Vector3 } from 'three';
import { createApplianceKit } from '../appliances';
import type { DentalCase, DentalTooth } from '../geometry';
import { createMechanicsExperiment, solveMechanics, transitionMechanics } from './index';
import type { Vec3 } from '../model';

const geometries: BoxGeometry[] = [];
function tooth(bracketPosition?: Vec3): DentalTooth {
  const geometry = new BoxGeometry(4, 6, 2); geometries.push(geometry);
  return { id: '11', name: 'Registration fixture', geometry, position: [3, 2, 1], buccal: [0, 0, 1], mesial: [1, 0, 0], occlusal: [0, 1, 0], calibrated: true, ...(bracketPosition ? { bracketPosition } : {}) };
}
const model = (t: DentalTooth): DentalCase => ({ demo: true, name: 'Registration fixture', teeth: [t], gums: [] });
afterEach(() => geometries.splice(0).forEach(geometry => geometry.dispose()));

describe('mechanical attachment registration', () => {
  it('matches the kit raycast fallback at the crown surface plus base and slot offsets', () => {
    const t = tooth(), state = createMechanicsExperiment(model(t)), kit = createApplianceKit();
    try {
      const bracket = kit.bracket(t)!;
      expect(bracket.position.toArray()).toEqual([0, 0, 1.28]);
      expect(state.reference.teeth[0].bracketLocal).toEqual((bracket.userData.anchor as Vector3).toArray());
      expect(state.reference.teeth[0].bracketLocal[2]).toBeCloseTo(1.95, 12);
      const installed = transitionMechanics(state, { type: 'brackets', teeth: ['11'], installed: true });
      expect(installed.config.brackets['11']).toEqual(state.reference.teeth[0].bracketLocal);
    } finally { kit.dispose(); }
  });
  it('keeps a repositioned bracket slot at the configured local attachment without losing its base offset', () => {
    const t = tooth([0, 0, 1.2]), kit = createApplianceKit();
    try {
      const bracket = kit.bracket(t)!, originalBase = bracket.position.clone(), originalSlot = (bracket.userData.anchor as Vector3).clone(), newSlot = originalSlot.clone().add(new Vector3(.3, -.4, .2));
      let state = transitionMechanics(createMechanicsExperiment(model(t)), { type: 'brackets', teeth: ['11'], installed: true });
      state = transitionMechanics(state, { type: 'bracket-position', tooth: '11', local: newSlot.toArray() as Vec3 });
      bracket.position.copy(originalBase).add(newSlot).sub(originalSlot);
      const parent = new Group(); parent.position.set(8, -4, 3); parent.rotation.set(.2, .3, -.4); parent.add(bracket); parent.updateMatrixWorld(true);
      expect(bracket.localToWorld(new Vector3(0, 0, .67)).distanceTo(parent.localToWorld(new Vector3(...state.config.brackets['11'])))).toBeLessThan(1e-10);
    } finally { kit.dispose(); }
  });
  it('uses the actual slot lever arm for a tooth-to-TAD force and moment', () => {
    const t = tooth([0, 0, 1]), m = model(t);
    let state = transitionMechanics(createMechanicsExperiment(m), { type: 'brackets', teeth: ['11'], installed: true });
    const slot = state.config.brackets['11'];
    state = transitionMechanics(state, { type: 'tad', id: 't', position: [t.position[0] + 10, t.position[1], t.position[2] + 1.67] });
    state = transitionMechanics(state, { type: 'elastic', id: 'e', from: { kind: 'tooth', tooth: '11', local: slot }, to: { kind: 'tad', id: 't' }, law: { kind: 'constant', forceN: 1 } });
    const result = solveMechanics(state).teeth[0];
    expect(result.forceN).toEqual([1, 0, 0]);
    // r=(0,6,1.67) mm from the virtual support; r cross (1,0,0) N.
    expect(result.momentNmm[0]).toBeCloseTo(0, 12); expect(result.momentNmm[1]).toBeCloseTo(1.67, 12); expect(result.momentNmm[2]).toBeCloseTo(-6, 12);
  });
  it('rejects missing fallback surfaces instead of installing a floating mechanical attachment', () => {
    const t = tooth(); t.geometry.translate(20, 0, 0);
    const kit = createApplianceKit();
    try { expect(kit.bracket(t)).toBeNull(); expect(() => createMechanicsExperiment(model(t))).toThrow(/no buccal surface/); }
    finally { kit.dispose(); }
  });
});
