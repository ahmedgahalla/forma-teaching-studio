import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAsset } from '../anatomy-assets';
import { createTeachingCase } from '../teaching-cases';
import type { DentalCase } from '../geometry';
import { solveMechanics, validateMechanicsExperiment } from '../mechanics';
import { dot, norm, add, scale } from '../mechanics/math';
import { rotateLocal } from '../mechanics/state';
import { anatomicalFrame, type Transforms } from '../model';
import { MECHANICS_EXAMPLES, type MechanicsExampleId } from './catalog';
import { createMechanicsExample } from './factory';
import { findSurfaceIntersections } from '../analysis';
import { interpolateTransforms } from '../planning';

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
const build = (
  id: MechanicsExampleId,
  variant: string,
  selected = '11',
  baseline: Transforms = {},
) =>
  createMechanicsExample(model, baseline, selected, { kind: 'mechanics-example', id, variant })
    .experiment;
const result = (id: MechanicsExampleId, variant: string, selected = '11') =>
  solveMechanics(build(id, variant, selected));
const tooth = (value: ReturnType<typeof result>, id = '11') =>
  value.teeth.find(item => item.id === id)!;

describe('prepared force systems on the shipped synthetic asset', () => {
  it.each(MECHANICS_EXAMPLES.map(example => [example.id, example.variants[0].id] as const))(
    'has no new crown crossing along six sampled default %s response frames',
    (id, variant) => {
      const state = build(id, variant),
        response = solveMechanics(state);
      const before = new Set(
        findSurfaceIntersections(model, state.reference.transforms).map(
          pair => `${pair.a}/${pair.b}`,
        ),
      );
      for (let sample = 1; sample <= 6; sample++) {
        const crossings = findSurfaceIntersections(
          model,
          interpolateTransforms(state.reference.transforms, response.transforms, sample / 6),
        );
        expect(crossings.filter(pair => !before.has(`${pair.a}/${pair.b}`))).toEqual([]);
      }
    },
  );
  it.each(
    MECHANICS_EXAMPLES.flatMap(example =>
      example.variants.map(variant => [example.id, variant.id] as const),
    ),
  )(
    'validates, solves and exactly repeats %s / %s without changing the reference',
    (id, variant) => {
      const baseline: Transforms = {
        '11': { translation: [0.2, -0.1, 0.3], rotation: [8, 12, 4] },
      };
      const state = build(id, variant, '11', baseline),
        original = structuredClone(state);
      expect(validateMechanicsExperiment(state, model).config).toEqual(state.config);
      const response = solveMechanics(state);
      expect(response).toEqual(solveMechanics(build(id, variant, '11', baseline)));
      expect(response.diagnostics.residual).toBeLessThan(1e-6);
      expect(state).toEqual(original);
      expect(state.reference.transforms['11']).toEqual(baseline['11']);
      expect(Object.keys(response.transforms)).toEqual(model.teeth.map(item => item.id));
    },
  );
  it('balances the crown-pull moment while preserving its net force', () => {
    const pull = tooth(result('crown-pull', 'buccal'));
    const balanced = tooth(result('counter-couple', 'balanced'));
    const half = tooth(result('counter-couple', 'half'));
    expect(norm(pull.rotationRad)).toBeGreaterThan(1e-5);
    expect(norm(balanced.rotationRad)).toBeLessThan(1e-12);
    expect(norm(balanced.forceN)).toBeCloseTo(norm(pull.forceN), 12);
    expect(norm(half.rotationRad)).toBeCloseTo(norm(pull.rotationRad) / 2, 10);
  });
  it.each(['axial-rotation', 'inclination'] as const)(
    'reverses a %s couple with no resultant force',
    id => {
      const forward = tooth(result(id, 'forward')),
        reverse = tooth(result(id, 'reverse'));
      expect(norm(forward.forceN)).toBeLessThan(1e-12);
      expect(norm(reverse.forceN)).toBeLessThan(1e-12);
      expect(norm(forward.momentNmm)).toBeGreaterThan(0.1);
      expect(norm(add(forward.rotationRad, reverse.rotationRad))).toBeLessThan(1e-12);
      const frame = anatomicalFrame(model.teeth.find(item => item.id === '11')!);
      const axis = id === 'axial-rotation' ? frame.occlusal : frame.mesial;
      expect(Math.abs(dot(forward.rotationRad, axis))).toBeCloseTo(norm(forward.rotationRad), 10);
    },
  );
  it.each(['11', '13', '14', '16', '46'])(
    'intrudes and extrudes tooth %s along its own axis',
    id => {
      const axis = anatomicalFrame(model.teeth.find(item => item.id === id)!).occlusal;
      const intrusion = tooth(result('vertical', 'intrusion', id), id);
      const extrusion = tooth(result('vertical', 'extrusion', id), id);
      expect(dot(intrusion.displacementMm, axis)).toBeLessThan(0);
      expect(dot(extrusion.displacementMm, axis)).toBeGreaterThan(0);
      expect(norm(add(intrusion.displacementMm, extrusion.displacementMm))).toBeLessThan(1e-12);
      expect(norm(intrusion.rotationRad)).toBeLessThan(1e-12);
    },
  );
  it('uses rotated anatomical axes at the current baseline', () => {
    const state = build('vertical', 'intrusion', '46', {
      '46': { translation: [1, 2, 3], rotation: [10, 20, 30] },
    });
    const response = tooth(solveMechanics(state), '46');
    const axis = rotateLocal(
      anatomicalFrame(model.teeth.find(item => item.id === '46')!).occlusal,
      [10, 20, 30],
    );
    expect(dot(response.displacementMm, axis)).toBeLessThan(0);
    expect(norm(response.rotationRad)).toBeLessThan(1e-12);
  });
  it('splits the same total intrusion load and removes its tipping moment in this virtual rig', () => {
    const single = tooth(result('balanced-intrusion', 'single'), '16');
    const balanced = tooth(result('balanced-intrusion', 'balanced'), '16');
    expect(norm(single.rotationRad)).toBeGreaterThan(1e-5);
    expect(norm(balanced.rotationRad)).toBeLessThan(1e-12);
    expect(norm(balanced.forceN)).toBeCloseTo(norm(single.forceN), 12);
  });
  it('routes the matched reaction to another tooth or to an ideal fixed anchor', () => {
    const reciprocal = result('anchorage', 'reciprocal'),
      fixed = result('anchorage', 'fixed');
    expect(norm(add(tooth(reciprocal, '13').forceN, tooth(reciprocal, '16').forceN))).toBeLessThan(
      1e-12,
    );
    expect(norm(tooth(reciprocal, '16').displacementMm)).toBeGreaterThan(0);
    expect(norm(tooth(fixed, '16').displacementMm)).toBe(0);
    expect(tooth(fixed, '13').forceN).toEqual(tooth(reciprocal, '13').forceN);
    expect(norm(add(fixed.tads[0].reactionN, tooth(fixed, '13').supportReactionN))).toBeLessThan(
      1e-12,
    );
  });
  it('demonstrates different ideal slot engagement and material stiffness', () => {
    const large = result('wire-play', 'large-steel');
    const small = result('wire-play', 'small-steel');
    const beta = result('wire-play', 'large-beta');
    expect(large.diagnostics.maxRotationDeg).toBeGreaterThan(small.diagnostics.maxRotationDeg);
    expect(large.diagnostics.maxRotationDeg).toBeGreaterThan(beta.diagnostics.maxRotationDeg);
  });
  it('balances applied loads with declared virtual support and fixed-anchor reactions', () => {
    const response = result('counter-couple', 'balanced');
    const sum = response.teeth.reduce(
      (value, item) => add(value, item.supportReactionN),
      scale([1, 1, 1], 0),
    );
    expect(
      norm(response.tads.reduce((value, item) => add(value, item.reactionN), sum)),
    ).toBeLessThan(1e-10);
  });
  it('rejects unknown variants, missing target IDs, imports and uncalibrated frames', () => {
    expect(() => build('vertical', 'unknown')).toThrow(/named mechanics/);
    const action = {
      kind: 'mechanics-example' as const,
      id: 'anchorage' as const,
      variant: 'fixed',
    };
    expect(() =>
      createMechanicsExample(
        { ...model, teeth: model.teeth.filter(item => item.id !== '16') },
        {},
        '11',
        action,
      ),
    ).toThrow(/needs teeth/);
    expect(() => createMechanicsExample({ ...model, demo: false }, {}, '11', action)).toThrow(
      /synthetic/,
    );
    expect(() =>
      createMechanicsExample(
        { ...model, teeth: model.teeth.map(item => ({ ...item, calibrated: false })) },
        {},
        '11',
        action,
      ),
    ).toThrow(/calibrated/);
  });
});
