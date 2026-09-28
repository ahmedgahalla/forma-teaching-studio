import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry } from 'three';
import type { DentalCase } from '../geometry';
import type { MechanicsAction, MechanicsExperiment } from './types';
import type { Vec3 } from '../model';
import { bracketPlacementLocal } from '../bracket-placement';
import {
  createMechanicsExperiment,
  rotateLocal,
  transitionMechanics,
  validateMechanicsExperiment,
} from './state';
import { validateMechanicsAction } from './validation';
import { solveMechanics } from './solver';
import { hasBracketWireActivation, hasMechanicsActivation } from './bracket-wire';
import { norm } from './math';
import { MATERIAL_PRESETS } from './presets';
import { sectionProperties } from './beam';

const geometries: BoxGeometry[] = [];
function model(): DentalCase {
  return {
    name: 'Bracket rig',
    demo: true,
    gums: [],
    teeth: ['11', '21', '12'].map((id, index) => {
      const geometry = new BoxGeometry(4, 6, 2);
      geometries.push(geometry);
      return {
        id,
        name: id,
        geometry,
        calibrated: true,
        position: [index * 10, 0, 0] as Vec3,
        buccal: [0, 0, 1] as Vec3,
        mesial: [1, 0, 0] as Vec3,
        occlusal: [0, 1, 0] as Vec3,
        bracketPosition: [0, 0, 1.28] as Vec3,
      };
    }),
  };
}
afterEach(() => geometries.splice(0).forEach(geometry => geometry.dispose()));
const act = (state: MechanicsExperiment, ...actions: MechanicsAction[]) =>
  actions.reduce(transitionMechanics, state);
function installed(m = model()) {
  return transitionMechanics(createMechanicsExperiment(m), {
    type: 'brackets',
    teeth: ['11', '21', '12'],
    installed: true,
  });
}
const wire: MechanicsAction = {
  type: 'wire',
  id: 'wire',
  teeth: ['11', '21'],
  material: 'beta-titanium',
  section: { shape: 'round', diameterMm: 0.3 },
};

describe('bracket configuration', () => {
  it('keeps legacy actions and neutral configs unchanged, and accepts only bounded in-plane angles', () => {
    const action = { type: 'bracket-position', tooth: '11', local: [0, 0, 1] };
    expect(validateMechanicsAction(action)).toEqual(action);
    expect(installed().config).not.toHaveProperty('bracketAngles');
    for (const angleDeg of [-10, 0, 10])
      expect(validateMechanicsAction({ ...action, angleDeg })).toEqual({ ...action, angleDeg });
    for (const angleDeg of [-10.01, 10.01, Infinity, NaN, '2', null])
      expect(() => validateMechanicsAction({ ...action, angleDeg })).toThrow();
    expect(() => validateMechanicsAction({ ...action, torqueDeg: 3 })).toThrow();
  });

  it('preserves edits on repeated install and position-only edits, then removes or explicitly resets the angle', () => {
    let state = installed();
    const neutral = state.config.brackets['11'];
    state = transitionMechanics(state, {
      type: 'bracket-position',
      tooth: '11',
      local: [0.1, 0.2, 1.9],
      angleDeg: 4,
    });
    const edited = state.config;
    state = transitionMechanics(state, { type: 'brackets', teeth: ['11'], installed: true });
    expect(state.config).toEqual(edited);
    state = transitionMechanics(state, { type: 'bracket-position', tooth: '11', local: neutral });
    expect(state.config.bracketAngles).toEqual({ '11': 4 });
    const reset = transitionMechanics(state, {
      type: 'bracket-position',
      tooth: '11',
      local: neutral,
      angleDeg: 0,
    });
    expect(reset.config).not.toHaveProperty('bracketAngles');
    const removed = transitionMechanics(state, {
      type: 'brackets',
      teeth: ['11'],
      installed: false,
    });
    expect(removed.config.brackets).not.toHaveProperty('11');
    expect(removed.config).not.toHaveProperty('bracketAngles');
    expect(state.config.bracketAngles).toEqual({ '11': 4 });
  });

  it('round-trips edited configs and saved stages deterministically without changing the reference', () => {
    const m = model(),
      original = installed(m);
    const local = bracketPlacementLocal(m.teeth[0], 0.2, 0.1);
    let state = act(
      original,
      wire,
      { type: 'bracket-position', tooth: '11', local, angleDeg: 1 },
      { type: 'save-stage', label: 'Bond placement' },
    );
    state = transitionMechanics(state, {
      type: 'bracket-position',
      tooth: '11',
      local: original.config.brackets['11'],
      angleDeg: 0,
    });
    const restored = validateMechanicsExperiment(JSON.parse(JSON.stringify(state)), m);
    expect(restored.config).toEqual(state.config);
    expect(restored.stages).toEqual(state.stages);
    expect(restored.reference).toEqual(original.reference);
    const staged = transitionMechanics(restored, { type: 'stage', index: 0 });
    expect(staged.config.brackets['11']).toEqual(local);
    expect(staged.config.bracketAngles).toEqual({ '11': 1 });
    expect(solveMechanics(staged)).toEqual(solveMechanics(staged));
    expect(validateMechanicsExperiment(JSON.parse(JSON.stringify(staged)), m).config).toEqual(
      staged.config,
    );
    expect(validateMechanicsExperiment(JSON.parse(JSON.stringify(original)), m).config).toEqual(
      original.config,
    );
  });

  it.each([{ '99': 1 }, { '11': 11 }, { '11': NaN }, [], null])(
    'rejects invalid saved angle maps %j',
    angles => {
      const m = model(),
        state = installed(m);
      (state.config as unknown as { bracketAngles: unknown }).bracketAngles = angles;
      expect(() => validateMechanicsExperiment(state, m)).toThrow(/angles/);
    },
  );

  it('rejects an angle on a known but uninstalled tooth, including saved stages', () => {
    const m = model(),
      state = installed(m);
    delete state.config.brackets['12'];
    state.config.bracketAngles = { '12': 1 };
    expect(() => validateMechanicsExperiment(state, m)).toThrow(/angles/);
    const clean = installed(m);
    clean.stages = [{ label: 'Bad stage', config: state.config }];
    expect(() => validateMechanicsExperiment(clean, m)).toThrow(/angles/);
  });
});

describe('bonding position and angle in the bounded wire solve', () => {
  it('leaves passive neutral response exactly zero and counts only wired bracket changes as activation', () => {
    const neutral = installed(),
      connected = transitionMechanics(neutral, wire);
    expect(solveMechanics(connected).diagnostics.maxDisplacementMm).toBe(0);
    const changed = transitionMechanics(neutral, {
      type: 'bracket-position',
      tooth: '11',
      local: [0, 0.1, 1.95],
      angleDeg: 2,
    });
    expect(hasBracketWireActivation(changed.config, changed.reference.teeth)).toBe(false);
    expect(solveMechanics(changed).diagnostics.maxDisplacementMm).toBe(0);
    expect(() => transitionMechanics(changed, { type: 'solve' })).toThrow(/activation/);
    const unwired = transitionMechanics(connected, {
      type: 'bracket-position',
      tooth: '12',
      local: [0, 0.1, 1.95],
      angleDeg: 2,
    });
    expect(hasBracketWireActivation(unwired.config, unwired.reference.teeth)).toBe(false);
    expect(solveMechanics(unwired).diagnostics.maxDisplacementMm).toBe(0);
    const active = transitionMechanics(changed, wire);
    expect(hasBracketWireActivation(active.config, active.reference.teeth)).toBe(true);
    expect(hasMechanicsActivation(active.config, active.reference.teeth)).toBe(true);
    expect(() => transitionMechanics(active, { type: 'solve' })).not.toThrow();
  });

  it('uses surface bonding height to load an otherwise passive round wire without reference drift', () => {
    const m = model(),
      neutral = act(installed(m), wire);
    const local = bracketPlacementLocal(m.teeth[0], 0, 0.1);
    const edited = transitionMechanics(neutral, { type: 'bracket-position', tooth: '11', local });
    const before = JSON.stringify(edited),
      result = solveMechanics(edited);
    expect(norm(result.teeth[0].forceN)).toBeGreaterThan(0.01);
    expect(result.teeth[0].displacementMm[1]).toBeLessThan(0);
    expect(result.teeth[1].displacementMm[1]).toBeGreaterThan(0);
    expect(result.diagnostics.residual).toBeLessThan(1e-8);
    expect(JSON.stringify(edited)).toBe(before);
    expect(edited.reference).toEqual(neutral.reference);
    const reset = transitionMechanics(edited, {
      type: 'bracket-position',
      tooth: '11',
      local: neutral.config.brackets['11'],
      angleDeg: 0,
    });
    expect(solveMechanics(reset).teeth).toEqual(solveMechanics(neutral).teeth);
    expect(hasMechanicsActivation(reset.config, reset.reference.teeth)).toBe(false);
    expect(() => transitionMechanics(reset, { type: 'solve' })).toThrow(/activation/);
    const otherActivation = transitionMechanics(reset, {
      type: 'wire-activation',
      id: 'wire',
      expansionMm: 0.1,
    });
    expect(hasMechanicsActivation(otherActivation.config, otherActivation.reference.teeth)).toBe(
      true,
    );
    expect(() => transitionMechanics(otherActivation, { type: 'solve' })).not.toThrow();
  });

  it('expresses in-plane angle as round-wire bending with opposite responses for opposite signs', () => {
    const neutral = act(installed(), wire);
    const result = (angleDeg: number) =>
      solveMechanics(
        transitionMechanics(neutral, {
          type: 'bracket-position',
          tooth: '11',
          local: neutral.config.brackets['11'],
          angleDeg,
        }),
      );
    const positive = result(1),
      negative = result(-1);
    expect(Math.abs(positive.teeth[0].rotationRad[2])).toBeGreaterThan(1e-5);
    expect(positive.teeth[0].rotationRad[2]).toBeLessThan(0);
    positive.teeth.forEach((tooth, index) =>
      tooth.rotationRad.forEach((value, axis) => {
        expect(value).toBeCloseTo(-negative.teeth[index].rotationRad[axis], 10);
      }),
    );
    expect(positive.wires[0].maxStrain).toBeGreaterThan(0);
    expect(neutral.config).not.toHaveProperty('bracketAngles');
  });

  it('matches fixed-end beam forces for a one-degree imposed bracket slope', () => {
    const neutral = act(installed(), wire, { type: 'anchor', teeth: ['11', '21'], fixed: true });
    const state = transitionMechanics(neutral, {
      type: 'bracket-position',
      tooth: '11',
      local: neutral.config.brackets['11'],
      angleDeg: 1,
    });
    const result = solveMechanics(state),
      theta = Math.PI / 180;
    const ei =
      MATERIAL_PRESETS['beta-titanium'].youngNPerMm2 *
      sectionProperties({ shape: 'round', diameterMm: 0.3 }).iz;
    expect(result.teeth[0].forceN[1]).toBeCloseTo((-6 * ei * theta) / 100, 10);
    expect(result.teeth[1].forceN[1]).toBeCloseTo((6 * ei * theta) / 100, 10);
    expect(result.teeth[0].rotationRad).toEqual([0, 0, 0]);
    expect(result.teeth[0].displacementMm).toEqual([0, 0, 0]);
  });

  it('keeps bonding inputs tooth-local under a rotated and translated mechanics reference', () => {
    const m = model(),
      rotation: Vec3 = [20, -10, 25];
    const local = bracketPlacementLocal(m.teeth[0], 0, 0.1);
    const action: MechanicsAction = { type: 'bracket-position', tooth: '11', local, angleDeg: 0.5 };
    const base = act(installed(m), wire, action);
    const transforms = Object.fromEntries(
      m.teeth.map(tooth => {
        const world = rotateLocal(tooth.position, rotation);
        return [
          tooth.id,
          {
            rotation,
            translation: world.map((n, i) => n - tooth.position[i] + [7, -4, 2][i]) as Vec3,
          },
        ];
      }),
    );
    const posed = act(
      createMechanicsExperiment(m, transforms),
      { type: 'brackets', teeth: ['11', '21', '12'], installed: true },
      wire,
      action,
    );
    const first = solveMechanics(base),
      second = solveMechanics(posed);
    first.teeth.forEach((tooth, i) => {
      for (const field of ['forceN', 'momentNmm', 'rotationRad', 'displacementMm'] as const) {
        const expected = rotateLocal(tooth[field], rotation);
        expected.forEach((value, axis) =>
          expect(second.teeth[i][field][axis]).toBeCloseTo(value, 9),
        );
      }
    });
    expect(posed.config.brackets).toEqual(base.config.brackets);
    expect(posed.config.bracketAngles).toEqual(base.config.bracketAngles);
  });
});
