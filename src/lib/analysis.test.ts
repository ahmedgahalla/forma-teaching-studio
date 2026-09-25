import { describe, expect, it } from 'vitest';
import { BoxGeometry, Euler, MathUtils, Quaternion, Vector3 } from 'three';
import {
  archSpans,
  centreDistance,
  findSurfaceIntersections,
  movementRows,
  toothMatrix,
} from './analysis';
import { emptyPose, type Transforms, type Vec3 } from './model';
import type { DentalCase, DentalTooth } from './geometry';

const tooth = (id: string, position: Vec3, size: Vec3 = [2, 2, 2]): DentalTooth => ({
  id,
  name: id,
  position,
  geometry: new BoxGeometry(...size),
  buccal: [0, 0, 1],
  mesial: [1, 0, 0],
  occlusal: [0, -1, 0],
  calibrated: true,
});
const model = (...teeth: DentalTooth[]): DentalCase => ({
  name: 'Test case',
  demo: false,
  teeth,
  gums: [],
});

describe('surface intersection at transformed tooth poses', () => {
  it('ignores separated meshes and detects true triangle-surface intersections', () => {
    const dental = model(tooth('11', [0, 0, 0]), tooth('21', [2.5, 0, 0]));
    expect(findSurfaceIntersections(dental, {})).toEqual([]);
    expect(
      findSurfaceIntersections(dental, {
        '21': { translation: [-1, 0.2, 0.1], rotation: [0, 0, 0] },
      }),
    ).toEqual([{ a: '11', b: '21' }]);
    expect(findSurfaceIntersections(dental, {})).toEqual([]);
  });

  it('uses narrow-phase surfaces to reject overlapping axis-aligned bounding boxes', () => {
    // Parallel thin boxes are separated along their perpendicular direction even
    // though rotating them 45 degrees makes their world AABBs overlap strongly.
    const dental = model(
      tooth('11', [0, 0, 0], [4, 0.2, 0.2]),
      tooth('21', [-0.5, 0.5, 0], [4, 0.2, 0.2]),
    );
    const transforms: Transforms = {
      '11': { translation: [0, 0, 0], rotation: [0, 0, 45] },
      '21': { translation: [0, 0, 0], rotation: [0, 0, 45] },
    };
    expect(findSurfaceIntersections(dental, transforms)).toEqual([]);
  });

  it('accounts for rotation, original position and relative transforms of both objects', () => {
    const dental = model(
      tooth('11', [10, 3, 2], [4, 0.3, 0.3]),
      tooth('21', [10, 4.3, 2], [0.8, 0.8, 0.8]),
    );
    expect(findSurfaceIntersections(dental, {})).toEqual([]);
    const initial: Transforms = { '11': { translation: [0, 0, 0], rotation: [0, 0, 90] } };
    expect(findSurfaceIntersections(dental, initial)).toEqual([{ a: '11', b: '21' }]);
    const together: Transforms = {
      '11': { translation: [50, -30, 11], rotation: [0, 0, 90] },
      '21': { translation: [50, -30, 11], rotation: [0, 0, 0] },
    };
    expect(findSurfaceIntersections(dental, together)).toEqual([{ a: '11', b: '21' }]);
    expect(
      findSurfaceIntersections(dental, {
        ...together,
        '21': { translation: [50, -30, 15], rotation: [0, 0, 0] },
      }),
    ).toEqual([]);
  });

  it('does not mislabel complete containment as a triangle-surface intersection', () => {
    expect(
      findSurfaceIntersections(
        model(tooth('11', [0, 0, 0], [4, 4, 4]), tooth('21', [0, 0, 0], [0.5, 0.5, 0.5])),
        {},
      ),
    ).toEqual([]);
  });

  it('does not change input poses, tooth positions, mesh vertices or mesh indices', () => {
    const dental = model(tooth('11', [0, 0, 0]), tooth('21', [0.6, 0.5, 0.4]));
    const transforms: Transforms = {
      '11': { translation: [0.1, 0.2, 0.3], rotation: [10, 20, 30] },
    };
    const before = JSON.stringify({
      transforms,
      positions: dental.teeth.map(t => t.position),
      vertices: dental.teeth.map(t => Array.from(t.geometry.getAttribute('position').array)),
      indices: dental.teeth.map(t => Array.from(t.geometry.index!.array)),
    });
    findSurfaceIntersections(dental, transforms);
    findSurfaceIntersections(dental, transforms);
    const after = JSON.stringify({
      transforms,
      positions: dental.teeth.map(t => t.position),
      vertices: dental.teeth.map(t => Array.from(t.geometry.getAttribute('position').array)),
      indices: dental.teeth.map(t => Array.from(t.geometry.index!.array)),
    });
    expect(after).toBe(before);
  });

  it('handles empty/single-tooth cases and never emits duplicate pairs', () => {
    expect(findSurfaceIntersections(model(), {})).toEqual([]);
    expect(findSurfaceIntersections(model(tooth('11', [0, 0, 0])), {})).toEqual([]);
    const overlaps = findSurfaceIntersections(
      model(tooth('11', [0, 0, 0]), tooth('12', [0.4, 0.3, 0.2]), tooth('21', [0.8, 0.6, 0.4])),
      {},
    );
    expect(overlaps).toEqual([
      { a: '11', b: '12' },
      { a: '11', b: '21' },
      { a: '12', b: '21' },
    ]);
  });

  it('builds a pose matrix that rotates about each model centre, then translates', () => {
    const t = tooth('11', [10, 20, 30]);
    const transforms: Transforms = { '11': { translation: [1, 2, 3], rotation: [0, 0, 90] } };
    const point = new Vector3(1, 0, 0).applyMatrix4(toothMatrix(t, transforms));
    expect(point.x).toBeCloseTo(11, 12);
    expect(point.y).toBeCloseTo(23, 12);
    expect(point.z).toBeCloseTo(33, 12);
  });
});

describe('millimetre centre measurements and movement summaries', () => {
  it('measures movement from the saved translated and obliquely rotated class baseline', () => {
    const dental = model(tooth('11', [100, 200, 300]), tooth('21', [0, 0, 0]));
    const original: Transforms = { '11': { translation: [8, -2, 5], rotation: [20, -30, 40] } };
    const initial = new Quaternion().setFromEuler(
      new Euler(...(original['11'].rotation.map(MathUtils.degToRad) as Vec3)),
    );
    const rotation = new Euler().setFromQuaternion(
      new Quaternion()
        .setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(35))
        .multiply(initial),
    );
    const current: Transforms = {
      '11': {
        translation: [11, 2, 17],
        rotation: [rotation.x, rotation.y, rotation.z].map(MathUtils.radToDeg) as Vec3,
      },
    };
    const before = JSON.stringify({ original, current });
    const row = movementRows(dental, current, original)[0];
    expect(row).toMatchObject({ x: 3, y: 4, z: 12, displacement: 13 });
    expect(row.orientationChange).toBeCloseTo(35, 10);
    expect(movementRows(dental, original, original)[0].displacement).toBe(0);
    expect(movementRows(dental, original, original)[0].orientationChange).toBeLessThan(0.00001);
    expect(movementRows(dental, current, original)[1]).toMatchObject({
      x: 0,
      y: 0,
      z: 0,
      displacement: 0,
      orientationChange: 0,
    });
    expect(JSON.stringify({ original, current })).toBe(before);
  });

  it('uses the shortest baseline-relative quaternion angle across the Euler wrap', () => {
    const dental = model(tooth('11', [0, 0, 0]));
    const original: Transforms = { '11': { translation: [1, 2, 3], rotation: [0, 0, 170] } };
    const current: Transforms = { '11': { translation: [1, 2, 3], rotation: [0, 0, -170] } };
    expect(movementRows(dental, current, original)[0].orientationChange).toBeCloseTo(20, 10);
    expect(movementRows(dental, current)[0].orientationChange).toBeCloseTo(170, 10);
    expect(movementRows(dental, current)).toEqual(movementRows(dental, current, {}));
  });

  it('reports the saved class baseline as the initial span rather than the source mesh arrangement', () => {
    const dental = model(tooth('13', [-10, 0, 0]), tooth('23', [10, 0, 0]));
    const original: Transforms = {
      '13': { translation: [-3, 5, 1], rotation: [20, 30, 40] },
      '23': { translation: [3, 5, 1], rotation: [0, 40, 0] },
    };
    const current: Transforms = {
      '13': { translation: [-4, 5, 1], rotation: [0, 0, 0] },
      '23': { translation: [4, 5, 1], rotation: [0, 0, 0] },
    };
    expect(archSpans(dental, current, original)[0]).toMatchObject({ initial: 26, final: 28 });
    expect(archSpans(dental, original, original)[0]).toMatchObject({ initial: 26, final: 26 });
    expect(archSpans(dental, current)[0]).toMatchObject({ initial: 20, final: 28 });
    expect(archSpans(dental, current)).toEqual(archSpans(dental, current, {}));
  });

  it('measures world-space model centres with translations and ignores local rotation', () => {
    const dental = model(tooth('13', [0, 0, 0]), tooth('23', [3, 4, 0]));
    expect(centreDistance(dental, {}, '13', '23')).toBe(5);
    expect(
      centreDistance(
        dental,
        { '13': { translation: [3, 0, 0], rotation: [65, 32, 11] } },
        '13',
        '23',
      ),
    ).toBe(4);
    expect(centreDistance(dental, {}, '13', '33')).toBeNull();
    expect(centreDistance(dental, {}, '13', '13')).toBe(0);
  });

  it('reports only arch pairs present in the case with initial and final distances', () => {
    const dental = model(
      tooth('13', [-12, 0, 0]),
      tooth('23', [12, 0, 0]),
      tooth('16', [-20, 0, 0]),
      tooth('26', [20, 0, 0]),
      tooth('43', [-10, 4, 0]),
    );
    const spans = archSpans(dental, {
      '13': { translation: [-1, 0, 0], rotation: [0, 0, 0] },
      '23': { translation: [1, 0, 0], rotation: [0, 0, 0] },
    });
    expect(spans).toEqual([
      { name: 'Upper canine centres', a: '13', b: '23', initial: 24, final: 26 },
      { name: 'Upper first-molar centres', a: '16', b: '26', initial: 40, final: 40 },
    ]);
    expect(archSpans(model(tooth('11', [0, 0, 0])), {})).toEqual([]);
  });

  it('reports displacement magnitude and geometric orientation change rather than sum of Euler angles', () => {
    const dental = model(tooth('11', [10, 20, 30]), tooth('21', [0, 0, 0]));
    const rows = movementRows(dental, {
      '11': { translation: [3, 4, 12], rotation: [0, 0, 270] },
      '21': emptyPose(),
    });
    expect(rows[0]).toMatchObject({ id: '11', x: 3, y: 4, z: 12, displacement: 13 });
    expect(rows[0].orientationChange).toBeCloseTo(90, 10);
    expect(rows[1].displacement).toBe(0);
    expect(rows[1].orientationChange).toBe(0);
    const mixed = movementRows(dental, {
      '11': { translation: [0, 0, 0], rotation: [90, 90, 0] },
    })[0];
    // Quarter-turns around X and Y compose to 120 degrees, not 180 degrees.
    expect(mixed.orientationChange).toBeCloseTo(120, 10);
  });
});
