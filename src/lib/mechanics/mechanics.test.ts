import { describe, expect, it } from 'vitest';
import { BoxGeometry } from 'three';
import type { DentalCase, DentalTooth } from '../geometry';
import type { Vec3 } from '../model';
import { attachMechanicsResult, createMechanicsExperiment, experimentWithoutTad, transitionMechanics, validateMechanicsExperiment } from './state';
import { solveMechanics } from './solver';
import { beamBendingMatrix, sectionProperties, slotPlayRadians } from './beam';
import { validateMechanicsAction } from './validation';
import type { MechanicsAction, MechanicsExperiment } from './types';
import { add, cross, norm, solvePositive } from './math';
import { rotateLocal } from './state';

// The analytical fixture places the slot (base + 0.67 mm buccally) at the support origin.
const tooth = (id: string, position: Vec3): DentalTooth => ({ id, name: id, position, geometry: new BoxGeometry(2, 2, 2), bracketPosition: [0, -6, -.67], buccal: [0, 0, 1], mesial: [1, 0, 0], occlusal: [0, 1, 0], calibrated: true });
const model = (...teeth: DentalTooth[]): DentalCase => ({ demo: true, name: 'Virtual rig', teeth, gums: [] });
const single = () => model(tooth('11', [0, 0, 0]));
const pair = () => model(tooth('11', [-5, 0, 0]), tooth('21', [5, 0, 0]));
const act = (state: MechanicsExperiment, ...actions: MechanicsAction[]) => actions.reduce(transitionMechanics, state);
const loaded = () => act(createMechanicsExperiment(single()), { type: 'tad', id: 'tad-1', position: [10, -6, 0] }, { type: 'elastic', id: 'elastic-1', from: { kind: 'tooth', tooth: '11', local: [0, -6, 0] }, to: { kind: 'tad', id: 'tad-1' }, law: { kind: 'constant', forceN: 1 } });

describe('independent beam and section benchmarks', () => {
  it('uses diameter to the fourth power and distinct rectangular bending axes', () => {
    const a = sectionProperties({ shape: 'round', diameterMm: .3 }), b = sectionProperties({ shape: 'round', diameterMm: .6 });
    expect(b.iy / a.iy).toBeCloseTo(16, 12);
    const r = sectionProperties({ shape: 'rectangle', heightMm: .4, widthMm: .6 });
    expect(r.iy).toBeCloseTo(.4 * .6 ** 3 / 12, 14); expect(r.iz).toBeCloseTo(.6 * .4 ** 3 / 12, 14);
  });
  it('matches the fixed-end beam 12EI/L³ and 6EI/L² reactions', () => {
    const section = { shape: 'round' as const, diameterMm: .4 }, ei = 200000 * Math.PI * .4 ** 4 / 64;
    const k = beamBendingMatrix(10, 'stainless-steel', section);
    expect(k[1][1]).toBeCloseTo(12 * ei / 1000, 12); expect(k[1][5]).toBeCloseTo(6 * ei / 100, 12);
    expect(k[1][7]).toBeCloseTo(-k[1][1], 12); expect(k[0].every(v => v === 0)).toBe(true);
    const long = beamBendingMatrix(20, 'stainless-steel', section);
    expect(k[1][1] / long[1][1]).toBeCloseTo(8, 12);
    expect(beamBendingMatrix(10, 'beta-titanium', section)[1][1] / k[1][1]).toBeCloseTo(69000 / 200000, 12);
  });
  it('calculates slot play geometrically and rejects oversized sections', () => {
    const play = slotPlayRadians({ shape: 'rectangle', heightMm: .019 * 25.4, widthMm: .025 * 25.4 });
    expect(play * 180 / Math.PI).toBeCloseTo(7.24, 1);
    expect(slotPlayRadians({ shape: 'rectangle', heightMm: .022 * 25.4, widthMm: .025 * 25.4 })).toBeCloseTo(0, 10);
    expect(() => slotPlayRadians({ shape: 'rectangle', heightMm: .7, widthMm: .7 })).toThrow(/fit/);
  });
  it('rejects singular numerical systems instead of inventing a displacement', () => {
    expect(() => solvePositive([[1, 1], [1, 1]], [1, 0])).toThrow(/singular/);
    expect(() => solvePositive([[0]], [1])).toThrow(/unconstrained/);
  });
});

describe('six-DOF virtual supports and ideal attachments', () => {
  it('zero load is exactly zero and input/reference remain unchanged', () => {
    const state = createMechanicsExperiment(pair()), before = JSON.stringify(state), result = solveMechanics(state);
    expect(result.diagnostics.maxDisplacementMm).toBe(0); expect(result.teeth.every(t => t.forceN.every(n => n === 0))).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('matches F/k at the support origin and reports balancing TAD reaction', () => {
    const result = solveMechanics(loaded()), t = result.teeth[0];
    expect(t.displacementMm[0]).toBeCloseTo(.01, 10); expect(t.rotationRad).toEqual([0, 0, 0]);
    expect(t.forceN[0]).toBeCloseTo(1, 10); expect(t.supportReactionN[0]).toBeCloseTo(-1, 10); expect(result.tads[0].reactionN[0]).toBeCloseTo(1, 10);
  });
  it('uses the attachment lever arm, rather than rotating around the crown centre', () => {
    const state = act(loaded(), { type: 'elastic', id: 'elastic-1', from: { kind: 'tooth', tooth: '11', local: [0, 0, 0] }, to: { kind: 'tad', id: 'tad-1' }, law: { kind: 'constant', forceN: 1 } });
    const t = solveMechanics(state).teeth[0];
    expect(t.momentNmm[2]).toBeCloseTo(-6 * t.forceN[0], 9); expect(t.rotationRad[2]).toBeCloseTo(t.momentNmm[2] / 1000, 9);
    expect(t.displacementMm[0]).toBeGreaterThan(t.forceN[0] / 100);
  });
  it('matches two compliant teeth and a spring in series, with equal/opposite forces', () => {
    const state = act(createMechanicsExperiment(pair()), { type: 'elastic', id: 'spring', from: { kind: 'tooth', tooth: '11', local: [0, -6, 0] }, to: { kind: 'tooth', tooth: '21', local: [0, -6, 0] }, law: { kind: 'spring', stiffnessNPerMm: 10, restLengthMm: 9 } });
    const result = solveMechanics(state), expected = 1 / (1 / 10 + 2 / 100);
    expect(result.elastics[0].forceN).toBeCloseTo(expected, 9);
    expect(result.teeth[0].displacementMm[0]).toBeCloseTo(expected / 100, 9); expect(result.teeth[1].forceN[0]).toBeCloseTo(-expected, 9);
  });
  it('a slack spring has no force and fixed teeth still report appliance reactions', () => {
    const slack = act(loaded(), { type: 'elastic', id: 'elastic-1', from: { kind: 'tooth', tooth: '11', local: [0, -6, 0] }, to: { kind: 'tad', id: 'tad-1' }, law: { kind: 'spring', stiffnessNPerMm: 2, restLengthMm: 15 } });
    expect(solveMechanics(slack).elastics[0].forceN).toBe(0);
    const fixed = solveMechanics(act(loaded(), { type: 'anchor', teeth: ['11'], fixed: true }));
    expect(fixed.teeth[0].displacementMm).toEqual([0, 0, 0]); expect(fixed.teeth[0].forceN[0]).toBeCloseTo(1, 10);
  });
  it('virtual support changes are explicit, with inverse displacement scaling', () => {
    const standard = solveMechanics(loaded()), soft = solveMechanics(act(loaded(), { type: 'support', preset: 'soft' }));
    expect(soft.teeth[0].displacementMm[0] / standard.teeth[0].displacementMm[0]).toBeCloseTo(2, 10);
  });
});

describe('palatal actuator and separate dental/skeletal compliance', () => {
  const expander = (palateStiffnessNPerMm?: number) => act(createMechanicsExperiment(pair()), { type: 'expander', id: 'expander', left: ['11'], right: ['21'], activationMm: .5, stiffnessNPerMm: 10, ...(palateStiffnessNPerMm === undefined ? {} : { palateStiffnessNPerMm }) });
  it('matches appliance+dental springs in series with fixed skeletal support', () => {
    const result = solveMechanics(expander()), e = result.expanders[0], expected = .5 / (.1 + .02);
    expect(e.forceN).toBeCloseTo(expected, 10); expect(e.skeletalOpeningMm).toBe(0); expect(e.dentalOpeningMm).toBeCloseTo(expected * .02, 10);
    expect(e.dentalOpeningMm + e.applianceDeflectionMm).toBeCloseTo(.5, 10);
  });
  it('solves all three compliances together and conserves the prescribed activation', () => {
    const result = solveMechanics(expander(20)), e = result.expanders[0], expected = .5 / (.1 + .02 + .05);
    expect(e.forceN).toBeCloseTo(expected, 9); expect(e.skeletalOpeningMm).toBeCloseTo(expected / 20, 9); expect(e.dentalOpeningMm).toBeCloseTo(expected * .02, 9);
    expect(e.dentalOpeningMm + e.skeletalOpeningMm + e.applianceDeflectionMm).toBeCloseTo(.5, 9);
  });
  it('leaves lower teeth unaffected and rejects noncontralateral actuator supports', () => {
    const m = model(...pair().teeth, tooth('31', [0, -20, 0]));
    const state = act(createMechanicsExperiment(m), { type: 'expander', id: 'e', left: ['11'], right: ['21'], activationMm: .2, stiffnessNPerMm: 10, palateStiffnessNPerMm: 20 });
    expect(solveMechanics(state).teeth[2].displacementMm).toEqual([0, 0, 0]);
    const bad = model(tooth('11', [0, 0, 0]), tooth('21', [0, 0, 10]));
    expect(() => solveMechanics(act(createMechanicsExperiment(bad), { type: 'expander', id: 'e', left: ['11'], right: ['21'], activationMm: .2, stiffnessNPerMm: 10 }))).toThrow(/contralateral/);
  });
});

describe('coupled wire, load and expander mechanics', () => {
  const curved = () => model(tooth('13', [-8, 0, 0]), tooth('11', [-3, 0, 5]), tooth('21', [3, 0, 5]), tooth('23', [8, 0, 0]));
  const wired = () => act(createMechanicsExperiment(curved()), { type: 'brackets', teeth: ['13', '11', '21', '23'], installed: true }, { type: 'wire', id: 'upper-wire', teeth: ['13', '11', '21', '23'], material: 'stainless-steel', section: { shape: 'round', diameterMm: .3 }, expansionMm: .1 });
  it('changes force quantitatively with material/activation while passive wire is unloaded', () => {
    const state = wired(), first = solveMechanics(state), twice = solveMechanics(act(state, { type: 'wire-activation', id: 'upper-wire', expansionMm: .2 }));
    expect(first.teeth.some(t => norm(t.forceN) > .01)).toBe(true);
    first.teeth.forEach((t, i) => t.forceN.forEach((v, axis) => expect(twice.teeth[i].forceN[axis]).toBeCloseTo(2 * v, 9)));
    const beta = solveMechanics(act(state, { type: 'wire-material', id: 'upper-wire', material: 'beta-titanium' }));
    expect(beta.teeth.reduce((sum, t) => sum + norm(t.forceN), 0)).toBeLessThan(first.teeth.reduce((sum, t) => sum + norm(t.forceN), 0));
    const passive = act(state, { type: 'wire-activation', id: 'upper-wire', expansionMm: 0 });
    expect(solveMechanics(passive).diagnostics.maxDisplacementMm).toBe(0); expect(() => transitionMechanics(passive, { type: 'solve' })).toThrow(/activation/);
  });
  it('transmits no rectangular torsion inside slot play, then follows GJ/L outside it', () => {
    let state = act(createMechanicsExperiment(pair()), { type: 'brackets', teeth: ['11', '21'], installed: true }, { type: 'wire', id: 'w', teeth: ['11', '21'], material: 'stainless-steel', section: { shape: 'rectangle', widthMm: .025 * 25.4, heightMm: .019 * 25.4 }, torqueDeg: 5 });
    expect(solveMechanics(state).diagnostics.maxRotationDeg).toBe(0);
    state = act(state, { type: 'wire-section', id: 'w', section: { shape: 'rectangle', widthMm: .025 * 25.4, heightMm: .022 * 25.4 } }, { type: 'wire-activation', id: 'w', expansionMm: 0, torqueDeg: 1 });
    const result = solveMechanics(state), section = sectionProperties(state.config.wires[0].section), kt = 200000 / 2.6 * section.j / 10, expectedMoment = kt * Math.PI / 180 / (1 + 2 * kt / 1000);
    expect(Math.abs(result.teeth[0].momentNmm[0])).toBeCloseTo(expectedMoment, 9);
    expect(result.teeth[0].momentNmm[0] + result.teeth[1].momentNmm[0]).toBeCloseTo(0, 10);
  });
  it('conserves reference force and moment for a complete wire without external anchors', () => {
    const state = wired(), result = solveMechanics(state);
    const force = result.teeth.reduce((sum, t) => add(sum, t.forceN), [0, 0, 0] as Vec3);
    const moment = result.teeth.reduce((sum, t, i) => { const ref = state.reference.teeth[i], support = add(ref.position, rotateLocal(ref.supportLocal, ref.rotation)); return add(sum, add(t.momentNmm, cross(support, t.forceN))); }, [0, 0, 0] as Vec3);
    expect(norm(force)).toBeLessThan(1e-9); expect(norm(moment)).toBeLessThan(1e-8);
  });
  it('solves all families simultaneously and balances TAD/support reactions in force and moment', () => {
    let state = act(createMechanicsExperiment(pair()), { type: 'brackets', teeth: ['11', '21'], installed: true }, { type: 'wire', id: 'w', teeth: ['11', '21'], material: 'beta-titanium', section: { shape: 'round', diameterMm: .3 } }, { type: 'tad', id: 't', position: [-5, -6, 10] }, { type: 'elastic', id: 'e', from: { kind: 'tooth', tooth: '11', local: [0, -6, 0] }, to: { kind: 'tad', id: 't' }, law: { kind: 'constant', forceN: 1 } }, { type: 'expander', id: 'x', left: ['11'], right: ['21'], activationMm: .1, stiffnessNPerMm: 10 });
    const result = solveMechanics(state);
    expect(result.teeth[1].displacementMm[2]).toBeGreaterThan(0); expect(result.expanders[0].forceN).toBeGreaterThan(0);
    let force: Vec3 = [0, 0, 0], moment: Vec3 = [0, 0, 0];
    result.teeth.forEach((t, i) => { const ref = state.reference.teeth[i], support = add(ref.position, rotateLocal(ref.supportLocal, ref.rotation)); force = add(force, t.supportReactionN); moment = add(moment, add(t.supportReactionNmm, cross(support, t.supportReactionN))); });
    result.tads.forEach(t => { force = add(force, t.reactionN); moment = add(moment, cross(t.position, t.reactionN)); });
    expect(norm(force)).toBeLessThan(1e-9); expect(norm(moment)).toBeLessThan(1e-8);
    state = transitionMechanics(state, { type: 'expander', id: 'x', left: ['11'], right: ['21'], activationMm: .1, stiffnessNPerMm: 10, palateStiffnessNPerMm: 20 });
    expect(solveMechanics(state).expanders[0].skeletalOpeningMm).toBeGreaterThan(0);
  });
});

describe('immutable experiment lifecycle and validation', () => {
  it('stage replay is absolute and never accumulates elastic displacement', () => {
    let state = act(loaded(), { type: 'save-stage', label: 'One newton' }, { type: 'support', preset: 'soft' }, { type: 'save-stage', label: 'Softer' });
    for (const index of [0, 1, 0, 1, 0]) { state = transitionMechanics(state, { type: 'stage', index }); expect(solveMechanics(state).teeth[0].displacementMm[0]).toBeCloseTo(index ? .02 : .01, 10); }
    expect(state.reference.transforms['11'].translation).toEqual([0, 0, 0]);
  });
  it('preview, apply, configuration invalidation and stale result guards are separate', () => {
    let state = loaded(); const result = solveMechanics(state); state = attachMechanicsResult(state, result);
    expect(state.applied).toBeNull(); state = transitionMechanics(state, { type: 'apply' }); expect(state.applied?.transforms).toEqual(result.transforms); expect(state.result).toBeNull();
    state = transitionMechanics(state, { type: 'support', preset: 'firm' }); expect(() => attachMechanicsResult(state, result)).toThrow(/stale/); expect(() => transitionMechanics(state, { type: 'apply' })).toThrow(/fresh/);
  });
  it('comparison without a TAD removes attached elastics without changing the main experiment', () => {
    const state = loaded(), comparison = experimentWithoutTad(state, 'tad-1');
    expect(comparison.config.tads).toHaveLength(0); expect(comparison.config.elastics).toHaveLength(0); expect(state.config.tads).toHaveLength(1);
    expect(solveMechanics(comparison).diagnostics.maxDisplacementMm).toBe(0);
  });
  it('validates persisted reference/config and discards forged numerical results', () => {
    const m = single(), state = loaded(), raw = JSON.parse(JSON.stringify({ ...state, result: { transforms: { bad: 'forged' } } }));
    expect(validateMechanicsExperiment(raw, m).result).toBeNull();
    raw.reference.teeth[0].position[0] = 99; expect(() => validateMechanicsExperiment(raw, m)).toThrow(/match/);
  });
  it('rejects unsupported materials, units, extra fields, nonfinite values and invalid references atomically', () => {
    expect(() => validateMechanicsAction({ type: 'wire-material', id: 'wire', material: 'niti' })).toThrow();
    expect(() => validateMechanicsAction({ type: 'wire-section', id: 'wire', section: { shape: 'round', diameterMm: NaN } })).toThrow();
    expect(() => validateMechanicsAction({ type: 'solve', javascript: 'arbitrary' })).toThrow();
    const state = loaded(), before = JSON.stringify(state);
    expect(() => transitionMechanics(state, { type: 'elastic', id: 'bad', from: { kind: 'tad', id: 'missing' }, to: { kind: 'tooth', tooth: '11', local: [0, 0, 0] }, law: { kind: 'constant', forceN: 1 } })).toThrow(/no appliance/);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('rejects same-side and mixed-side attachment groups for a palatal actuator', () => {
    const model = pair(); model.teeth.push({ ...model.teeth[0], id: '12', position: [15, 0, 0] });
    const state = createMechanicsExperiment(model), actuator = { type: 'expander' as const, id: 'x', activationMm: .1, stiffnessNPerMm: 20 };
    expect(() => transitionMechanics(state, { ...actuator, left: ['11'], right: ['12'] })).toThrow(/opposite/);
    expect(() => transitionMechanics(state, { ...actuator, left: ['11', '21'], right: ['12'] })).toThrow(/opposite/);
    expect(state.config.expanders).toHaveLength(0);
  });
  it('rejects exaggerated response/strain rather than clamping a result into the domain', () => {
    const tooMuch = act(loaded(), { type: 'elastic', id: 'elastic-1', from: { kind: 'tooth', tooth: '11', local: [0, 12, 0] }, to: { kind: 'tad', id: 'tad-1' }, law: { kind: 'constant', forceN: 20 } });
    expect(() => solveMechanics(tooMuch)).toThrow(/domain/);
    const state = act(createMechanicsExperiment(pair()), { type: 'brackets', teeth: ['11', '21'], installed: true }, { type: 'wire', id: 'w', teeth: ['11', '21'], material: 'stainless-steel', section: { shape: 'rectangle', heightMm: .022 * 25.4, widthMm: .025 * 25.4 }, torqueDeg: 20 });
    expect(() => solveMechanics(state)).toThrow(/strain/);
  });
  it('rejects corrupt or duplicate session objects and invalid worker output', () => {
    const state = loaded(), raw = JSON.parse(JSON.stringify(state)); raw.config.tads.push(raw.config.tads[0]);
    expect(() => validateMechanicsExperiment(raw, single())).toThrow(/duplicate/);
    const result = solveMechanics(state); result.teeth[0].forceN[0] = NaN;
    expect(() => attachMechanicsResult(state, result)).toThrow(/invalid/);
  });
});
