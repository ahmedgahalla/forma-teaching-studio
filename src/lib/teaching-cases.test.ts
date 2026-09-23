import { afterAll, describe, expect, it } from 'vitest';
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { createOrthodonticDemo } from './demo';
import { CASE_REFERENCE_OFFSETS, CASE_REFERENCE_SHIFT, TEACHING_CASES, createTeachingCase, getTeachingCase, sampleCaseDemonstration } from './teaching-cases';
import { emptyPose, isPose, type Pose, type Transforms, type Vec3 } from './model';
import { centreDistance, findSurfaceIntersections, toothMatrix } from './analysis';

const base = createOrthodonticDemo();
afterAll(() => { base.teeth.forEach(tooth => { tooth.geometry.dispose(); tooth.rootGeometry?.dispose(); }); base.gums.forEach(gum => gum.geometry.dispose()); });
const at = (transforms: Transforms, id: string) => transforms[id] || emptyPose();
const quaternion = (value: Pose) => new Quaternion().setFromEuler(new Euler(...value.rotation.map(MathUtils.degToRad) as Vec3));

describe('prepared synthetic teaching case library', () => {
  it('contains the twelve requested cases with usable distinct variant identifiers and discussion material', () => {
    expect(TEACHING_CASES.map(item => item.id)).toEqual(['reference-occlusion', 'movement-types', 'crowding', 'midline-diastema', 'increased-overjet', 'anterior-crossbite', 'deepbite', 'openbite', 'posterior-crossbite', 'anchorage-space-closure', 'occlusal-finishing', 'removable-retention']);
    expect(TEACHING_CASES.reduce((n, item) => n + item.variants.length, 0)).toBe(19);
    for (const definition of TEACHING_CASES) {
      expect(definition.aliases?.length).toBeGreaterThan(0);
      expect(definition.assumptions.join(' ')).toMatch(/not a patient diagnosis/);
      expect(new Set(definition.variants.map(item => item.id)).size).toBe(definition.variants.length);
      expect(definition.sources.every(item => item.url.startsWith('https://'))).toBe(true);
      for (const variant of definition.variants) {
        expect(variant.question).toContain('?'); expect(variant.answer.length).toBeGreaterThan(20);
        expect(variant.sources.length).toBeGreaterThan(0); expect(variant.aliases?.length).toBeGreaterThan(0);
        expect(variant.keyframes[0].progress).toBe(0); expect(variant.keyframes.at(-1)?.progress).toBe(1);
        expect(variant.keyframes.every((item, i) => !i || item.progress > variant.keyframes[i - 1].progress)).toBe(true);
      }
    }
  });

  it('registers tooth and gum origins together without moving or cloning their mesh buffers', () => {
    const originalPositions = base.teeth.map(tooth => [...tooth.position]);
    const result = createTeachingCase(base, 'reference-occlusion');
    expect(CASE_REFERENCE_SHIFT).toBe(1.6);
    for (const tooth of result.model.teeth) {
      const original = base.teeth.find(item => item.id === tooth.id)!;
      const shift = CASE_REFERENCE_OFFSETS[/^[12]/.test(tooth.id) ? 'upper' : 'lower'];
      expect(tooth.position).toEqual(original.position.map((n, i) => n + shift[i]));
      expect(tooth.geometry).toBe(original.geometry); expect(tooth.rootGeometry).toBe(original.rootGeometry);
      expect(tooth.buccal).toEqual(original.buccal); expect(tooth.buccal).not.toBe(original.buccal);
      expect(tooth.bracketPosition).toEqual(original.bracketPosition);
    }
    result.model.gums.forEach((gum, i) => { expect(gum.geometry).toBe(base.gums[i].geometry); expect(gum.position).toEqual(base.gums[i].position.map((n, axis) => n + CASE_REFERENCE_OFFSETS[gum.arch!][axis])); });
    expect(base.teeth.map(tooth => tooth.position)).toEqual(originalPositions);
    expect(result.model.name).not.toBe(base.name);
  });

  it('avoids baseline crown-surface intersections with the chosen reference shift', () => {
    expect(findSurfaceIntersections(createTeachingCase(base, 'reference-occlusion').model, {})).toEqual([]);
  }, 30000);

  it('removes only the prepared extraction-example premolars and keeps the supplied full model intact', () => {
    for (const definition of TEACHING_CASES) {
      const result = createTeachingCase(base, definition.id);
      expect(result.model.teeth).toHaveLength(definition.id === 'anchorage-space-closure' ? 26 : 28);
      expect(result.selectedIds.every(id => result.model.teeth.some(tooth => tooth.id === id))).toBe(true);
    }
    expect(createTeachingCase(base, 'anchorage-space-closure').model.teeth.some(tooth => tooth.id === '14' || tooth.id === '24')).toBe(false);
    expect(base.teeth).toHaveLength(28); expect(base.teeth.some(tooth => tooth.id === '14')).toBe(true);
  });

  it('copies metadata, initial poses, and samples so edits cannot change another demonstration', () => {
    const first = createTeachingCase(base, 'crowding'), expected = createTeachingCase(base, 'crowding');
    first.transforms['11'].translation[0] = 50; first.selectedIds.length = 0;
    first.definition.aliases!.push('mutated'); first.model.teeth[0].position[0] = 500;
    first.model.teeth[0].buccal[0] = 0;
    const sample = sampleCaseDemonstration('crowding', 'position-then-rotation', 0);
    expect(sample).toEqual(expected.transforms); sample['11'].rotation[1] = 99;
    expect(sampleCaseDemonstration('crowding', 'position-then-rotation', 0)).toEqual(expected.transforms);
    expect(getTeachingCase('crowding').aliases).not.toContain('mutated');
    expect(base.teeth[0].position[0]).not.toBe(500);
  });

  it.each(TEACHING_CASES.map(item => item.id))('samples %s only from its prepared baseline using valid present-tooth poses', caseId => {
    const prepared = createTeachingCase(base, caseId), present = new Set(prepared.model.teeth.map(tooth => tooth.id));
    for (const variant of prepared.definition.variants) {
      expect(sampleCaseDemonstration(caseId, variant.id, 0)).toEqual(prepared.transforms);
      for (const progress of [...variant.keyframes.map(item => item.progress), .17, .5, .83]) {
        const sample = sampleCaseDemonstration(caseId, variant.id, progress);
        for (const [id, value] of Object.entries(sample)) { expect(present.has(id)).toBe(true); expect(isPose(value)).toBe(true); }
        expect(sampleCaseDemonstration(caseId, variant.id, progress)).toEqual(sample);
      }
    }
  });

  it('rejects unknown paths, invalid progress, imports and incomplete or uncalibrated reference models', () => {
    expect(() => getTeachingCase('automatic-treatment')).toThrow(/supported/);
    expect(() => sampleCaseDemonstration('crowding', 'automatic-treatment', .5)).toThrow(/supported/);
    for (const progress of [-.1, 1.1, NaN, Infinity]) expect(() => sampleCaseDemonstration('crowding', 'position-then-rotation', progress)).toThrow(/between 0 and 1/);
    expect(() => createTeachingCase({ ...base, demo: false }, 'crowding')).toThrow(/synthetic/);
    expect(() => createTeachingCase({ ...base, teeth: base.teeth.slice(1) }, 'crowding')).toThrow(/28-tooth/);
    expect(() => createTeachingCase({ ...base, teeth: base.teeth.map((tooth, i) => i ? tooth : { ...tooth, calibrated: false }) }, 'crowding')).toThrow(/calibrated/);
    expect(() => createTeachingCase({ ...base, teeth: base.teeth.map((tooth, i) => i ? tooth : { ...tooth, rootGeometry: undefined }) }, 'crowding')).toThrow(/geometry/);
    expect(() => createTeachingCase({ ...base, gums: base.gums.map(gum => ({ ...gum, arch: undefined })) }, 'crowding')).toThrow(/arch metadata/);
  });
});

describe('distinct authored geometry lessons', () => {
  it('distinguishes translation and three rotation axes, including quaternion-interpolated orientation', () => {
    const translation = sampleCaseDemonstration('movement-types', 'translation', 1)['11'];
    expect(translation.translation).toEqual([0, 0, 3.2]); expect(translation.rotation).toEqual([0, 0, 0]);
    const endpoints = ['tip', 'torque', 'axial-rotation'].map(id => sampleCaseDemonstration('movement-types', id, 1)['11']);
    endpoints.forEach(value => expect(value.translation).toEqual([0, 0, 1.2]));
    expect(quaternion(endpoints[0]).angleTo(quaternion(endpoints[1]))).toBeGreaterThan(.1);
    expect(quaternion(endpoints[1]).angleTo(quaternion(endpoints[2]))).toBeGreaterThan(.1);
    const half = quaternion(sampleCaseDemonstration('movement-types', 'tip', .5)['11']);
    expect(half.angleTo(new Quaternion())).toBeCloseTo(quaternion(endpoints[0]).angleTo(new Quaternion()) / 2, 10);
    const model = createTeachingCase(base, 'movement-types').model, tooth = model.teeth.find(item => item.id === '11')!;
    const before = toothMatrix(tooth, sampleCaseDemonstration('movement-types', 'translation', 0)), after = toothMatrix(tooth, sampleCaseDemonstration('movement-types', 'translation', 1));
    for (const geometry of [tooth.geometry, tooth.rootGeometry!]) {
      const local = new Vector3().fromBufferAttribute(geometry.getAttribute('position'), 0);
      expect(local.clone().applyMatrix4(after).sub(local.clone().applyMatrix4(before)).distanceTo(new Vector3(0, 0, 2))).toBeLessThan(1e-10);
    }
  });

  it('keeps rotations visible at the crowding waypoint instead of using a generic direct interpolation', () => {
    const start = sampleCaseDemonstration('crowding', 'position-then-rotation', 0), waypoint = sampleCaseDemonstration('crowding', 'position-then-rotation', .45);
    for (const [id, value] of Object.entries(start)) { expect(waypoint[id].translation).toEqual([0, 0, 0]); expect(waypoint[id].rotation).toEqual(value.rotation); }
    expect(sampleCaseDemonstration('crowding', 'position-then-rotation', 1)).toEqual({});
  });

  it('closes the central space with different midline outcomes in the two diastema variants', () => {
    const { model, transforms } = createTeachingCase(base, 'midline-diastema');
    const symmetric = sampleCaseDemonstration('midline-diastema', 'symmetric-closure', 1), offset = sampleCaseDemonstration('midline-diastema', 'offset-closure', 1);
    expect(centreDistance(model, transforms, '11', '21')! - centreDistance(model, symmetric, '11', '21')!).toBeCloseTo(2.4, 8);
    expect(centreDistance(model, symmetric, '11', '21')).toBeCloseTo(centreDistance(model, offset, '11', '21')!, 8);
    expect((at(offset, '11').translation[0] + at(offset, '21').translation[0]) / 2).toBeCloseTo(1.2);
    expect(transforms['17'].translation).toEqual([-1.2, 0, 0]); expect(transforms['27'].translation).toEqual([1.2, 0, 0]);
    expect(offset['17'].translation).toEqual([1.2, 0, 0]); expect(at(offset, '47')).toEqual(emptyPose());
  });

  it('separates overjet translation from inclination and leaves lower teeth unchanged', () => {
    const moved = sampleCaseDemonstration('increased-overjet', 'segment-retraction', 1), inclined = sampleCaseDemonstration('increased-overjet', 'inclination-comparison', 1);
    expect(moved['11'].translation[2]).toBe(.4); expect(moved['11'].rotation).toEqual([0, 0, 0]);
    expect(inclined['11'].translation[2]).toBe(2.6); expect(inclined['11'].rotation[0]).toBe(14);
    expect(Object.keys(moved).every(id => /^[12]/.test(id))).toBe(true);
  });

  it('uses an explicit anterior-crossbite clearance waypoint before returning to reference height', () => {
    const start = sampleCaseDemonstration('anterior-crossbite', 'local-repositioning', 0), waypoint = sampleCaseDemonstration('anterior-crossbite', 'local-repositioning', .25);
    expect(start['11'].translation).toEqual([0, 0, -3.5]); expect(waypoint['11'].translation).toEqual([.4, 1.4, -3.5]);
    expect(sampleCaseDemonstration('anterior-crossbite', 'local-repositioning', .5)['11'].translation).toEqual([.4, 1.4, -1.75]);
    expect(sampleCaseDemonstration('anterior-crossbite', 'local-repositioning', .75)['11'].translation).toEqual([0, 1.4, 0]);
    expect(sampleCaseDemonstration('anterior-crossbite', 'local-repositioning', 1)).toEqual({});
  });

  it('compares intrusion against posterior extrusion without silently rotating a jaw or correcting the anterior overlap', () => {
    const baseline = createTeachingCase(base, 'deepbite').transforms;
    const intruded = sampleCaseDemonstration('deepbite', 'anterior-intrusion', 1), extruded = sampleCaseDemonstration('deepbite', 'posterior-extrusion', 1);
    expect(at(intruded, '11').translation[1] - baseline['11'].translation[1]).toBeCloseTo(2.2);
    expect(intruded['41']).toEqual(baseline['41']); expect(at(intruded, '16')).toEqual(emptyPose());
    expect(extruded['11']).toEqual(baseline['11']); expect(extruded['41']).toEqual(baseline['41']);
    expect(extruded['16'].translation[1]).toBe(-.6); expect(extruded['46'].translation[1]).toBe(.6);
    expect(getTeachingCase('deepbite').variants[1].answer).toMatch(/not simulated/);
  });

  it('reduces anterior open-bite separation through opposing upper/lower displacement only', () => {
    const start = createTeachingCase(base, 'openbite').transforms, half = sampleCaseDemonstration('openbite', 'anterior-extrusion', .5);
    expect(start['11'].translation[1]).toBe(1.6); expect(start['41'].translation[1]).toBe(-1.6);
    expect(half['11'].translation[1]).toBe(.8); expect(half['41'].translation[1]).toBe(-.8);
    expect(at(half, '16')).toEqual(emptyPose()); expect(at(half, '46')).toEqual(emptyPose());
  });

  it('changes only the left upper posterior segment in the dental crossbite illustration', () => {
    const half = sampleCaseDemonstration('posterior-crossbite', 'dental-uprighting', .6);
    expect(Object.keys(half)).toEqual(['24', '25', '26', '27']);
    expect(half['26'].translation).toEqual([0, 0, 0]); expect(half['26'].rotation[2]).toBe(-7);
    expect(getTeachingCase('posterior-crossbite').assumptions.join(' ')).toMatch(/maxilla and palate do not widen/);
  });

  it('uses extraction space differently when posterior teeth are held or allowed to contribute', () => {
    const { model, transforms } = createTeachingCase(base, 'anchorage-space-closure');
    const held = sampleCaseDemonstration('anchorage-space-closure', 'posterior-held', 1), shared = sampleCaseDemonstration('anchorage-space-closure', 'shared-space-use', 1);
    expect(at(held, '16')).toEqual(emptyPose()); expect(shared['16'].translation[2]).toBe(2);
    expect(at(held, '11').translation[2]).toBe(0); expect(shared['11'].translation[2]).toBe(2);
    for (const endpoint of [held, shared]) expect(centreDistance(model, endpoint, '13', '15')!).toBeLessThan(centreDistance(model, transforms, '13', '15')!);
    expect('14' in shared || '24' in shared).toBe(false);
  });

  it('sequences finishing domains and keeps removable retention passive', () => {
    const aligned = sampleCaseDemonstration('occlusal-finishing', 'staged-refinement', .35), levelled = sampleCaseDemonstration('occlusal-finishing', 'staged-refinement', .7);
    expect(Object.keys(aligned).sort()).toEqual(['16', '46']); expect(aligned['16'].translation[1]).toBe(.7);
    expect(levelled['16'].translation).toEqual([0, 0, 0]); expect(levelled['16'].rotation[2]).toBe(6);
    const retention = getTeachingCase('removable-retention').variants[0];
    expect(retention.removableRetainer).toBe(true); expect(retention.appliance.preset).toBe('none');
    for (const progress of [0, .25, .5, 1]) expect(sampleCaseDemonstration('removable-retention', retention.id, progress)).toEqual({});
  });
});
