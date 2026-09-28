import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Group, MathUtils, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAsset } from './anatomy-assets';
import { findSurfaceIntersections, toothMatrix } from './analysis';
import { loadCase, saveCase, type DentalCase, type DentalTooth } from './geometry';
import {
  DENTAL_ARRANGEMENTS,
  createDentalArrangement,
  type DentalArrangement,
} from './dental-arrangements';
import { CASE_REFERENCE_SHIFT } from './teaching-cases';
import { createGumFollower } from './gum-follow';
import { createMechanicsExperiment } from './mechanics/state';
import type { Vec3 } from './model';

let base: DentalCase;
const arrangements = new Map<string, DentalArrangement>();
beforeAll(async () => {
  const bytes = readFileSync('public/models/forma-teaching-v1.glb');
  const asset = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  base = dentalCaseFromAsset(
    asset.scene,
    JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8')),
  );
  for (const definition of DENTAL_ARRANGEMENTS)
    arrangements.set(definition.id, createDentalArrangement(base, definition.id));
});

/** Average the most incisal tenth of the actual mesh, independent of display pivots. */
function incisalPoint(tooth: DentalTooth) {
  const axis = new Vector3(...tooth.occlusal!),
    p = tooth.geometry.getAttribute('position'),
    v = new Vector3();
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const z = v.fromBufferAttribute(p, i).dot(axis);
    min = Math.min(min, z);
    max = Math.max(max, z);
  }
  const point = new Vector3();
  let count = 0;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (v.dot(axis) >= max - 0.1 * (max - min)) {
      point.add(v);
      count++;
    }
  }
  return point.divideScalar(count);
}
function incisorRelationship(arrangement: DentalArrangement) {
  const upper = arrangement.model.teeth.find(t => t.id === '11')!,
    lower = arrangement.model.teeth.find(t => t.id === '41')!;
  const u = incisalPoint(upper).applyMatrix4(toothMatrix(upper, arrangement.transforms)),
    l = incisalPoint(lower).applyMatrix4(toothMatrix(lower, arrangement.transforms));
  return { projection: u.z - l.z, overlap: l.y - u.y };
}

describe('authored dental Angle-class arrangements', () => {
  it('keeps each rigidly registered gum at rest instead of applying its arch shift twice', () => {
    const { model, transforms } = arrangements.get('dental-class-iii')!;
    const groups = new Map(
      model.teeth.map(tooth => {
        const group = new Group();
        group.position
          .fromArray(tooth.position)
          .add(new Vector3(...transforms[tooth.id].translation));
        return [tooth.id, group];
      }),
    );
    for (const gum of model.gums) {
      const geometry = gum.geometry.clone();
      try {
        const teeth = model.teeth.filter(
          tooth => Number(tooth.id[0]) < 3 === (gum.arch === 'upper'),
        );
        const follow = createGumFollower(gum, teeth, geometry, groups);
        const matchesRest = (name: string) =>
          geometry
            .getAttribute(name)
            .array.every((value, i) => value === gum.geometry.getAttribute(name).array[i]);
        follow(0);
        expect(matchesRest('position')).toBe(true);
        expect(matchesRest('normal')).toBe(true);
        const group = groups.get(teeth[0].id)!;
        group.position.x += 1;
        follow(0);
        expect(matchesRest('position')).toBe(false);
        group.position.fromArray(teeth[0].position);
        follow(0);
        expect(matchesRest('position')).toBe(true);
        expect(matchesRest('normal')).toBe(true);
      } finally {
        geometry.dispose();
      }
    }
  });
  it('provides four source-linked dental examples without claiming skeletal diagnosis', () => {
    expect(DENTAL_ARRANGEMENTS.map(item => item.id)).toEqual([
      'dental-class-i',
      'dental-class-ii-division-1',
      'dental-class-ii-division-2',
      'dental-class-iii',
    ]);
    for (const item of DENTAL_ARRANGEMENTS) {
      expect(item.sources.every(source => source.url.startsWith('https://'))).toBe(true);
      expect(item.assumptions.join(' ')).toMatch(/does not establish a skeletal class/);
      expect(item.assumptions.join(' ')).toMatch(/not diagnostic thresholds/);
    }
  });
  it('preserves every displayed tooth matrix when rigid arch shifts move into the neutral origins', () => {
    for (const { model, transforms } of arrangements.values())
      for (const tooth of model.teeth) {
        const source = base.teeth.find(item => item.id === tooth.id)!;
        const arch = Number(tooth.id[0]) < 3 ? 'upper' : 'lower';
        const gumShift =
          model.gums.find(gum => gum.arch === arch)!.position[2] -
          base.gums.find(gum => gum.arch === arch)!.position[2];
        const position: Vec3 = [...source.position];
        position[1] += arch === 'upper' ? -CASE_REFERENCE_SHIFT : CASE_REFERENCE_SHIFT;
        const pose = transforms[tooth.id];
        const prior = toothMatrix(
          { ...source, position },
          {
            [tooth.id]: {
              rotation: pose.rotation,
              translation: [
                pose.translation[0],
                pose.translation[1],
                pose.translation[2] + gumShift,
              ],
            },
          },
        );
        toothMatrix(tooth, transforms).elements.forEach((value, i) =>
          expect(value).toBeCloseTo(prior.elements[i], 12),
        );
      }
  });
  it('round-trips registered origins and individual poses through the existing save format and mechanics reference', async () => {
    const { model, transforms } = arrangements.get('dental-class-ii-division-2')!;
    const before = createMechanicsExperiment(model, transforms);
    let blob!: Blob;
    vi.useFakeTimers();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(value => {
      blob = value as Blob;
      return 'blob:arrangement';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('document', { createElement: () => ({ click() {} }) });
    let restored: DentalCase | undefined;
    try {
      saveCase(model, transforms);
      const saved = await loadCase(new File([blob], 'arrangement.json'));
      restored = saved.model;
      expect(saved.transforms).toEqual(transforms);
      expect(restored.teeth.map(tooth => tooth.position)).toEqual(
        model.teeth.map(tooth => tooth.position),
      );
      expect(restored.gums.map(gum => gum.position)).toEqual(model.gums.map(gum => gum.position));
      expect(createMechanicsExperiment(restored, saved.transforms).reference).toEqual(
        before.reference,
      );
      const groups = new Map(
        restored.teeth.map(tooth => {
          const group = new Group(),
            pose = saved.transforms[tooth.id];
          group.position.fromArray(tooth.position).add(new Vector3(...pose.translation));
          group.rotation.set(...(pose.rotation.map(MathUtils.degToRad) as Vec3));
          tooth.geometry.boundingBox = null;
          if (tooth.rootGeometry) tooth.rootGeometry.boundingBox = null;
          return [tooth.id, group];
        }),
      );
      for (const gum of restored.gums) {
        gum.geometry.boundingBox = null;
        const geometry = gum.geometry.clone();
        try {
          const teeth = restored.teeth.filter(
            tooth => Number(tooth.id[0]) < 3 === (gum.arch === 'upper'),
          );
          createGumFollower(gum, teeth, geometry, groups)(0);
          expect(geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);
        } finally {
          geometry.dispose();
        }
      }
    } finally {
      for (const tooth of restored?.teeth || []) {
        tooth.geometry.dispose();
        tooth.rootGeometry?.dispose();
      }
      restored?.gums.forEach(gum => gum.geometry.dispose());
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
  it('reuses all 28 linked crowns and roots and applies the reference registration only once', () => {
    for (const { model, transforms, selectedIds } of arrangements.values()) {
      expect(model.teeth).toHaveLength(28);
      expect(model.gums).toHaveLength(2);
      expect(Object.keys(transforms)).toHaveLength(28);
      expect(selectedIds.every(id => model.teeth.some(tooth => tooth.id === id))).toBe(true);
      for (const tooth of model.teeth) {
        const source = base.teeth.find(item => item.id === tooth.id)!;
        expect(tooth.geometry).toBe(source.geometry);
        expect(tooth.rootGeometry).toBe(source.rootGeometry);
        expect(tooth.rootAnatomy).toEqual(source.rootAnatomy);
        expect(tooth.position[1] - source.position[1]).toBeCloseTo(
          Number(tooth.id[0]) < 3 ? -CASE_REFERENCE_SHIFT : CASE_REFERENCE_SHIFT,
          8,
        );
        expect(tooth.buccal).toEqual(source.buccal);
        expect(tooth.bracketPosition).toEqual(source.bracketPosition);
        expect(
          [...transforms[tooth.id].translation, ...transforms[tooth.id].rotation].every(
            Number.isFinite,
          ),
        ).toBe(true);
      }
      for (const gum of model.gums) {
        const source = base.gums.find(item => item.id === gum.id)!;
        const example = gum.arch === 'upper' ? '16' : '46';
        const tooth = model.teeth.find(item => item.id === example)!;
        const sourceTooth = base.teeth.find(item => item.id === example)!;
        expect(gum.geometry).toBe(source.geometry);
        expect(gum.position[2] - source.position[2]).toBeCloseTo(
          tooth.position[2] - sourceTooth.position[2],
          8,
        );
        expect(transforms[example].translation).toEqual([0, 0, 0]);
      }
    }
  });
  it('moves the molar sagittal relation in opposite directions and shares it between both Class II divisions', () => {
    const relation = (id: string) => {
      const { model } = arrangements.get(id)!;
      return (
        model.teeth.find(tooth => tooth.id === '16')!.position[2] -
        model.teeth.find(tooth => tooth.id === '46')!.position[2]
      );
    };
    const classI = relation('dental-class-i');
    expect(relation('dental-class-ii-division-1') - classI).toBeCloseTo(3, 8);
    expect(relation('dental-class-ii-division-2')).toBe(relation('dental-class-ii-division-1'));
    expect(relation('dental-class-iii') - classI).toBeCloseTo(-3, 8);
    for (const { transforms } of arrangements.values()) {
      expect(transforms['16']).toEqual(transforms['26']);
      expect(transforms['36']).toEqual(transforms['46']);
      expect(transforms['16'].rotation).toEqual([0, 0, 0]);
      expect(transforms['46'].rotation).toEqual([0, 0, 0]);
    }
  });
  it('shows actual increased projection, contrasting central/lateral inclination and reverse projection', () => {
    const first = arrangements.get('dental-class-i')!,
      division1 = arrangements.get('dental-class-ii-division-1')!,
      division2 = arrangements.get('dental-class-ii-division-2')!,
      third = arrangements.get('dental-class-iii')!;
    expect(incisorRelationship(first).projection).toBeGreaterThan(0);
    expect(incisorRelationship(division1).projection).toBeGreaterThan(
      incisorRelationship(first).projection + 3,
    );
    expect(incisorRelationship(division2).projection).toBeLessThan(
      incisorRelationship(division1).projection - 2,
    );
    expect(incisorRelationship(division2).overlap).toBeGreaterThan(
      incisorRelationship(first).overlap + 0.5,
    );
    expect(incisorRelationship(third).projection).toBeLessThan(-1);
    const inclination = (arrangement: DentalArrangement, id: string) => {
      const tooth = arrangement.model.teeth.find(t => t.id === id)!;
      return new Vector3(...tooth.occlusal!).transformDirection(
        toothMatrix(tooth, arrangement.transforms),
      ).z;
    };
    expect(inclination(division1, '11')).toBeGreaterThan(0.15);
    expect(inclination(division2, '11')).toBeLessThan(-0.2);
    expect(inclination(division2, '12')).toBeGreaterThan(0.1);
  });
  it('reports the actual static crown and root audit, with no crossings on the shipped anatomy', () => {
    for (const arrangement of arrangements.values()) {
      const { model, transforms, baselineCrossings } = arrangement;
      expect(baselineCrossings.crowns).toEqual(findSurfaceIntersections(model, transforms));
      expect(baselineCrossings.roots).toEqual(
        findSurfaceIntersections(
          {
            ...model,
            teeth: model.teeth.map(tooth => ({ ...tooth, geometry: tooth.rootGeometry! })),
          },
          transforms,
        ),
      );
      expect(baselineCrossings).toEqual({ crowns: [], roots: [] });
      expect(arrangement.auditNote).toMatch(/paths are not assessed/);
    }
  });
  it('exposes crossings when supplied synthetic tooth surfaces actually overlap', () => {
    const reference = base.teeth.find(tooth => tooth.id === '21')!;
    const overlapped = {
      ...base,
      teeth: base.teeth.map(tooth =>
        tooth.id === '11'
          ? {
              ...tooth,
              geometry: reference.geometry,
              rootGeometry: reference.rootGeometry,
              position: [...reference.position] as [number, number, number],
            }
          : tooth,
      ),
    };
    const result = createDentalArrangement(overlapped, 'dental-class-i');
    expect(result.baselineCrossings.crowns).toContainEqual({ a: '11', b: '21' });
    expect(result.baselineCrossings.roots).toContainEqual({ a: '11', b: '21' });
  });
  it('does not alter source buffers or metadata, and repeated selection does not accumulate poses', () => {
    const tooth = base.teeth.find(item => item.id === '16')!;
    const before = [tooth.geometry, tooth.rootGeometry!].map(geometry => ({
      p: [...geometry.getAttribute('position').array],
      n: [...geometry.getAttribute('normal').array],
      i: [...geometry.index!.array],
    }));
    const metadata = JSON.stringify(
      base.teeth.map(({ geometry: _geometry, rootGeometry: _rootGeometry, ...data }) => data),
    );
    const first = createDentalArrangement(base, 'dental-class-ii-division-2');
    first.model.teeth[0].position[0] += 10;
    first.model.teeth[0].buccal[0] = 999;
    first.model.gums[0].position[0] += 20;
    first.transforms['11'].translation[2] = 300;
    const second = createDentalArrangement(base, 'dental-class-ii-division-2');
    expect(second.transforms).toEqual(arrangements.get('dental-class-ii-division-2')!.transforms);
    expect(
      JSON.stringify(
        base.teeth.map(({ geometry: _geometry, rootGeometry: _rootGeometry, ...data }) => data),
      ),
    ).toBe(metadata);
    [tooth.geometry, tooth.rootGeometry!].forEach((geometry, i) => {
      expect([...geometry.getAttribute('position').array]).toEqual(before[i].p);
      expect([...geometry.getAttribute('normal').array]).toEqual(before[i].n);
      expect([...geometry.index!.array]).toEqual(before[i].i);
    });
  });
  it('rejects unknown arrangements and imported or incomplete anatomy', () => {
    expect(() => createDentalArrangement(base, 'skeletal-class-ii')).toThrow(/supported dental/);
    expect(() => createDentalArrangement({ ...base, demo: false }, 'dental-class-i')).toThrow(
      /synthetic/,
    );
    expect(() =>
      createDentalArrangement({ ...base, teeth: base.teeth.slice(1) }, 'dental-class-i'),
    ).toThrow(/28-tooth/);
  });
});
