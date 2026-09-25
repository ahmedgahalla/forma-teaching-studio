import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Euler, Group, MathUtils, Vector3 } from 'three';
import { createApplianceKit } from '../appliances';
import { dentalCaseFromAsset } from '../anatomy-assets';
import { createTeachingCase } from '../teaching-cases';
import type { DentalCase } from '../geometry';
import {
  attachMechanicsResult,
  createMechanicsExperiment,
  solveMechanics,
  transitionMechanics,
  validateMechanicsExperiment,
  type MechanicsExperiment,
} from './index';
import { add, cross, norm } from './math';
import { rotateLocal } from './state';
import type { Vec3 } from '../model';

let model: DentalCase;
beforeAll(async () => {
  const data = readFileSync('public/models/forma-teaching-v1.glb');
  const gltf = await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '',
  );
  model = createTeachingCase(
    dentalCaseFromAsset(
      gltf.scene,
      JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8')),
    ),
    'reference-occlusion',
  ).model;
});
const upper = ['11', '12', '13', '21', '22', '23'];
const install = (): MechanicsExperiment => {
  let state = createMechanicsExperiment(model);
  state = transitionMechanics(state, { type: 'brackets', teeth: upper, installed: true });
  return transitionMechanics(state, {
    type: 'wire',
    id: 'wire',
    teeth: upper,
    material: 'stainless-steel',
    section: { shape: 'round', diameterMm: 0.014 * 25.4 },
    expansionMm: 0.2,
  });
};
describe('shipped synthetic geometry and absolute mechanics stages', () => {
  it('registers every authored slot to the actual bracket after tooth rotation and translation', () => {
    const baseline = Object.fromEntries(
      model.teeth.map(tooth => [
        tooth.id,
        { translation: [1, 2, 3] as Vec3, rotation: [10, 20, 30] as Vec3 },
      ]),
    );
    const state = createMechanicsExperiment(model, baseline),
      kit = createApplianceKit();
    try {
      model.teeth.forEach((tooth, index) => {
        const bracket = kit.bracket(tooth)!,
          reference = state.reference.teeth[index];
        expect(reference.bracketLocal).toEqual((bracket.userData.anchor as Vector3).toArray());
        expect(
          new Vector3(...reference.bracketLocal).distanceTo(new Vector3(...tooth.bracketPosition!)),
        ).toBeCloseTo(0.67, 10);
        const group = new Group();
        group.add(bracket);
        group.position.fromArray(reference.position);
        group.rotation.setFromVector3(
          new Vector3(...baseline[tooth.id].rotation.map(MathUtils.degToRad)),
        );
        group.updateMatrixWorld(true);
        const renderedSlot = bracket.localToWorld(new Vector3(0, 0, 0.67));
        const solverSlot = new Vector3(...reference.bracketLocal)
          .applyEuler(new Euler(...(reference.rotation.map(MathUtils.degToRad) as Vec3)))
          .add(new Vector3(...reference.position));
        expect(renderedSlot.distanceTo(solverSlot)).toBeLessThan(1e-10);
      });
    } finally {
      kit.dispose();
    }
  });
  it('calculates the actual six-anterior wire and balances its reference forces/moments', () => {
    const state = install(),
      result = solveMechanics(state);
    expect(result.teeth).toHaveLength(28);
    expect(result.wires[0].maxStrain).toBeGreaterThan(0);
    expect(result.diagnostics.maxDisplacementMm).toBeGreaterThan(0);
    expect(result.wires[0].points).toHaveLength(6);
    expect(result.diagnostics.maxDisplacementMm).toBeLessThan(0.1);
    let force: Vec3 = [0, 0, 0],
      moment: Vec3 = [0, 0, 0];
    result.teeth.forEach((tooth, i) => {
      const ref = state.reference.teeth[i];
      force = add(force, tooth.forceN);
      moment = add(
        moment,
        add(
          tooth.momentNmm,
          cross(add(ref.position, rotateLocal(ref.supportLocal, ref.rotation)), tooth.forceN),
        ),
      );
      if (!upper.includes(tooth.id)) expect(tooth.displacementMm).toEqual([0, 0, 0]);
    });
    expect(norm(force)).toBeLessThan(1e-8);
    expect(norm(moment)).toBeLessThan(1e-7);
  });
  it('keeps configured reference tooth poses after Apply, re-solve and save/load', () => {
    let state = install();
    const first = solveMechanics(state),
      before = JSON.stringify(state.reference);
    state = transitionMechanics(attachMechanicsResult(state, first), { type: 'apply' });
    expect(solveMechanics(state).transforms).toEqual(first.transforms);
    const restored = validateMechanicsExperiment(JSON.parse(JSON.stringify(state)), model);
    expect(restored.result).toBeNull();
    expect(restored.applied).toBeNull();
    expect(solveMechanics(restored).transforms).toEqual(first.transforms);
    expect(JSON.stringify(state.reference)).toBe(before);
  });
  it('handles a rotated starting tooth with the same millimetre pivot as the renderer', () => {
    const baseline = { '11': { translation: [1, 2, 3] as Vec3, rotation: [10, 20, 30] as Vec3 } };
    const state = createMechanicsExperiment(model, baseline),
      result = solveMechanics(state);
    expect(result.transforms['11'].translation).toEqual(baseline['11'].translation);
    result.transforms['11'].rotation.forEach((v, i) =>
      expect(v).toBeCloseTo(baseline['11'].rotation[i], 10),
    );
  });
});
