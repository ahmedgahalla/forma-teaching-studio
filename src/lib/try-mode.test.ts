import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, MathUtils, Quaternion, Vector3 } from 'three';
import type { DentalCase } from './geometry';
import { createOrthodonticDemo } from './demo';
import { emptyPose, type Pose, type Transforms, type Vec3 } from './model';
import { toothMatrix } from './analysis';
import { archCurvePoints, assertTryRestoreUnlocked, assertTryUnlocked, createTryState, previewPose, projectedCrownGap, serializeTrySession, transitionTryMode, TRY_MAX_PATH_SAMPLES, validateTryAction, validateTrySession, type TryEdit, type TryState } from './try-mode';

const geometry: BoxGeometry[] = [];
function model(positions: Record<string, Vec3>, size: Vec3 = [1, 1, 1]): DentalCase {
  return { name: 'Synthetic geometry fixture', demo: true, gums: [], teeth: Object.entries(positions).map(([id, position]) => {
    const shape = new BoxGeometry(...size); geometry.push(shape);
    return { id, name: id, position, geometry: shape, calibrated: true, buccal: [0, 0, 1], mesial: [1, 0, 0], occlusal: [0, Number(id[0]) <= 2 ? -1 : 1, 0] };
  }) };
}
afterEach(() => { geometry.splice(0).forEach(g => g.dispose()); });
const preview = (source: DentalCase, state: TryState, edit: TryEdit) => transitionTryMode(source, state, { type: 'preview', edit });
const position = (source: DentalCase, poses: Transforms, id: string) => new Vector3(...source.teeth.find(t => t.id === id)!.position).add(new Vector3(...(poses[id] || emptyPose()).translation));
const move = (tooth: string, amount: number): TryEdit => ({ type: 'dental', command: { type: 'move', tooth, direction: 'x', amount } });
const apply = (source: DentalCase, state: TryState) => transitionTryMode(source, state, { type: 'apply' });

describe('Try Mode transactions and locks', () => {
  it('does not commit a candidate until Apply and leaves the input state immutable', () => {
    const source = model({ '11': [0, 0, 0] }), initial = createTryState(), snapshot = structuredClone(initial);
    const pending = preview(source, initial, move('11', 2));
    expect(initial).toEqual(snapshot); expect(pending.current).toEqual({}); expect(pending.pending!.to['11'].translation).toEqual([2, 0, 0]);
    const committed = apply(source, pending); expect(committed.current['11'].translation).toEqual([2, 0, 0]); expect(committed.pending).toBeNull(); expect(committed.lastEdit).toBe(pending.pending);
    expect(transitionTryMode(source, pending, { type: 'cancel' }).current).toEqual({});
  });

  it('rejects a second preview instead of silently replacing the first edit', () => {
    const source = model({ '11': [0, 0, 0] }), pending = preview(source, createTryState(), move('11', 1)), before = structuredClone(pending);
    expect(() => preview(source, pending, move('11', 2))).toThrow(/Apply or cancel/); expect(pending).toEqual(before);
    expect(() => transitionTryMode(source, pending, { type: 'preview-original' })).toThrow(/Apply or cancel/);
    expect(() => transitionTryMode(source, pending, { type: 'save-snapshot', name: 'Uncommitted' })).toThrow(/Apply or cancel/); expect(pending.snapshots).toHaveLength(0);
  });

  const edits: TryEdit[] = [move('11', 1), { type: 'dental', command: { type: 'reset', teeth: ['11'] } },
    { type: 'segment-translate', teeth: ['11', '12'], axis: 'z', amount: 1 }, { type: 'segment-rotate', teeth: ['11', '12'], axis: 'y', amount: 5 },
    { type: 'change-width', teeth: ['11', '12'], amount: 1 }, { type: 'close-gap', teeth: ['11', '12'], rule: 'equal', gap: 1 },
    { type: 'fit-arch', teeth: ['11'], arch: 'upper' }, { type: 'poses', poses: { '11': { translation: [1, 0, 0], rotation: [0, 0, 0] } }, label: 'Handle' }];
  it.each(edits)('enforces locks atomically for $type, including unrestricted mode', edit => {
    const source = model({ '11': [0, 0, 0], '12': [4, 0, 0] }), state = { ...createTryState(), lockedIds: ['11'], unrestricted: true }, before = structuredClone(state);
    expect(() => preview(source, state, edit)).toThrow(/Unlock 11/); expect(state).toEqual(before);
  });

  it('rechecks locks at Apply and retains lock metadata after leaving Try Mode', () => {
    const source = model({ '11': [0, 0, 0] }), pending = preview(source, createTryState(), move('11', 2));
    const locked = transitionTryMode(source, pending, { type: 'lock', teeth: ['11'], locked: true }); expect(() => apply(source, locked)).toThrow(/Unlock/);
    expect(() => transitionTryMode(source, locked, { type: 'exit' })).toThrow(/Apply or cancel/);
    const exited = transitionTryMode(source, transitionTryMode(source, locked, { type: 'cancel' }), { type: 'exit' }); expect(exited.pending).toBeNull(); expect(exited.lockedIds).toEqual(['11']);
    expect(() => assertTryUnlocked(exited, ['11'])).toThrow(/Unlock/); expect(() => preview(source, exited, move('11', 1))).toThrow(/Enter Try Mode/);
  });

  it('rejects a stale candidate when committed poses changed outside the preview', () => {
    const source = model({ '11': [0, 0, 0] }), state = preview(source, createTryState(), move('11', 2));
    expect(() => apply(source, { ...state, current: { '11': { translation: [0, 1, 0], rotation: [0, 0, 0] } } })).toThrow(/changed/);
  });

  it('drops a stale last trajectory on re-entry after a direct pose edit', () => {
    const source = model({ '11': [0, 0, 0] }), applied = apply(source, preview(source, createTryState(), move('11', 1)));
    const exited = transitionTryMode(source, applied, { type: 'exit' });
    expect(transitionTryMode(source, exited, { type: 'enter' }).lastEdit).toBe(applied.lastEdit);
    const current: Transforms = { '11': { translation: [0, 2, 0], rotation: [0, 0, 0] } };
    const entered = transitionTryMode(source, { ...exited, current }, { type: 'enter' }); expect(entered.lastEdit).toBeNull(); expect(entered.current).toBe(current);
  });

  it('guards restored arrangements by physical pose changes, accepting equivalent Euler rotations', () => {
    const state = { lockedIds: ['11', '12'], current: { '11': { translation: [1, 0, 0], rotation: [0, 0, 0] } as Pose } };
    expect(() => assertTryRestoreUnlocked(state, { '11': { translation: [1, 0, 0], rotation: [0, 0, 360] }, '12': emptyPose() })).not.toThrow();
    expect(() => assertTryRestoreUnlocked(state, {})).toThrow(/Unlock 11/);
    expect(() => assertTryRestoreUnlocked(state, { ...state.current, '12': { translation: [0, 1, 0], rotation: [0, 0, 0] } })).toThrow(/Unlock 12/);
    expect(() => assertTryRestoreUnlocked(state, { ...state.current, '21': { translation: [5, 0, 0], rotation: [0, 0, 0] } })).not.toThrow();
  });
});

describe('rigid segments and per-tooth dental motion', () => {
  it('translates every segment member by the same fixed CASE-axis vector', () => {
    const source = model({ '11': [-4, 0, 0], '21': [4, 0, 0] }); source.teeth[0].buccal = [-1, 0, 0]; source.teeth[1].buccal = [1, 0, 0]; source.teeth.forEach(t => { t.mesial = [0, 0, 1]; });
    const segment = preview(source, createTryState(), { type: 'segment-translate', teeth: ['11', '21'], axis: 'x', amount: 1 }).pending!.to;
    expect(segment['11'].translation).toEqual([1, 0, 0]); expect(segment['21'].translation).toEqual([1, 0, 0]);
    const dental = preview(source, createTryState(), { type: 'dental', command: { type: 'move_group', teeth: ['11', '21'], direction: 'buccal', amount: 1 } }).pending!.to;
    expect(dental['11'].translation[0]).toBe(-1); expect(dental['21'].translation[0]).toBe(1);
  });

  it('rotates positions AND orientations about one centroid and preserves all pairwise distances while scrubbing', () => {
    const source = model({ '11': [-3, 0, 0], '12': [2, 1, 0], '13': [0, 0, 4], '21': [25, 0, 0] }, [.4, .5, .6]);
    const current: Transforms = { '11': { translation: [.4, .2, .1], rotation: [12, 8, 4] }, '12': { translation: [0, 0, 0], rotation: [3, -15, 0] } };
    const state = preview(source, createTryState(current), { type: 'segment-rotate', teeth: ['11', '12', '13'], axis: 'y', amount: 80 }), candidate = state.pending!;
    const pivot = ['11', '12', '13'].reduce((sum, id) => sum.add(position(source, current, id)), new Vector3()).divideScalar(3);
    for (const t of [.1, .25, .5, .75, 1]) {
      const poses = previewPose(candidate, t), q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(80 * t));
      for (const id of ['11', '12', '13']) {
        const tooth = source.teeth.find(item => item.id === id)!, originalPoint = new Vector3(.1, .2, .3).applyMatrix4(toothMatrix(tooth, current));
        const expected = originalPoint.clone().sub(pivot).applyQuaternion(q).add(pivot), actual = new Vector3(.1, .2, .3).applyMatrix4(toothMatrix(tooth, poses));
        expect(actual.distanceTo(expected)).toBeLessThan(1e-7);
      }
      for (const [a, b] of [['11', '12'], ['11', '13'], ['12', '13']]) expect(position(source, poses, a).distanceTo(position(source, poses, b))).toBeCloseTo(position(source, current, a).distanceTo(position(source, current, b)), 8);
      expect(poses['21']).toBeUndefined();
    }
  });
});

describe('explicit geometric objectives', () => {
  it.each(['equal', 'first', 'second'] as const)('closes the measured projected crown-surface gap with the %s distribution', rule => {
    const source = model({ '11': [0, 0, 0], '12': [6, 0, 0] }, [2, 2, 2]);
    const current = { '11': { translation: [0, 0, 0], rotation: [0, 0, 45] } as Pose }, before = projectedCrownGap(source, current, ['11', '12']);
    expect(before).toBeCloseTo(6 - Math.SQRT2 - 1, 6);
    const state = preview(source, createTryState(current), { type: 'close-gap', teeth: ['11', '12'], rule, gap: .3 }), target = state.pending!.to;
    expect(projectedCrownGap(source, target, ['11', '12'])).toBeCloseTo(.3, 6); expect(target['11'].rotation).toEqual([0, 0, 45]);
    const displacement = before - .3;
    expect(target['11'].translation[0]).toBeCloseTo(rule === 'second' ? 0 : rule === 'first' ? displacement : displacement / 2);
    expect(target['12'].translation[0]).toBeCloseTo(rule === 'first' ? 0 : rule === 'second' ? -displacement : -displacement / 2);
  });

  it('permits a locked stationary reference in one-sided gap closure but never a locked moving side', () => {
    const source = model({ '11': [0, 0, 0], '12': [5, 0, 0] });
    const state = preview(source, { ...createTryState(), lockedIds: ['12'] }, { type: 'close-gap', teeth: ['11', '12'], rule: 'first', gap: .2 });
    expect(state.pending!.affectedIds).toEqual(['11']); expect(apply(source, state).current['12'].translation).toEqual([0, 0, 0]);
    expect(() => preview(source, { ...createTryState(), lockedIds: ['11'] }, { type: 'close-gap', teeth: ['11', '12'], rule: 'first', gap: .2 })).toThrow(/Unlock/);
  });

  it('changes a selected pair’s centre span symmetrically along their current centre line', () => {
    const source = model({ '16': [-3, -4, 0], '26': [3, 4, 0] });
    const state = preview(source, createTryState(), { type: 'change-width', teeth: ['16', '26'], amount: 2 }), p = state.pending!.to;
    expect(position(source, p, '16').distanceTo(position(source, p, '26'))).toBeCloseTo(12);
    expect(position(source, p, '16').add(position(source, p, '26')).length()).toBeLessThan(1e-9);
    expect(p['16'].translation[1]).toBeCloseTo(-.8); expect(p['26'].translation[1]).toBeCloseTo(.8); expect(state.pending!.label).toContain('Centre span');
  });

  it('fails impossible gap/span objectives without partially moving either tooth', () => {
    const source = model({ '11': [0, 0, 0], '12': [.5, 0, 0] }), state = createTryState(), before = structuredClone(state);
    expect(() => preview(source, state, { type: 'close-gap', teeth: ['11', '12'], rule: 'equal', gap: 0 })).toThrow(/overlap/);
    expect(() => preview(source, state, { type: 'change-width', teeth: ['11', '12'], amount: -1 })).toThrow(/span/);
    expect(state).toEqual(before);
  });

  it('fits only the named synthetic arch to its independent ellipse, preserving Y and orientation', () => {
    const source = model({ '11': [30, 6, -12], '21': [-25, 7, 5], '31': [23, -5, -12] });
    let state = createTryState({ '11': { translation: [0, 1, 0], rotation: [5, 10, 15] } });
    state = transitionTryMode(source, state, { type: 'set-arch', arch: 'upper', width: 40, depth: 30 });
    expect(state.archTargets.lower).toEqual({ width: 49.6, depth: 32 });
    state = preview(source, state, { type: 'fit-arch', teeth: ['11', '21'], arch: 'upper' });
    const poses = state.pending!.to; expect(position(source, poses, '11').x).toBeCloseTo(20, 5); expect(position(source, poses, '11').y).toBe(7);
    expect(poses['11'].rotation).toEqual([5, 10, 15]); expect(poses['31']).toBeUndefined();
    const target = position(source, poses, '21'); expect((target.x / 20) ** 2 + ((target.z + 12) / 30) ** 2).toBeCloseTo(1, 7);
    const original = position(source, {}, '21'), nearestGrid = Math.min(...Array.from({ length: 4000 }, (_, i) => new Vector3(20 * Math.sin(i * Math.PI * 2 / 4000), 7, -12 + 30 * Math.cos(i * Math.PI * 2 / 4000)).distanceTo(original)));
    expect(target.distanceTo(original)).toBeLessThanOrEqual(nearestGrid + 1e-5);
    const points = archCurvePoints(source, state, 'upper'); expect(points).toHaveLength(129); points.forEach(point => expect((point[0] / 20) ** 2 + ((point[2] + 12) / 30) ** 2).toBeCloseTo(1));
    let lower = transitionTryMode(source, state, { type: 'cancel' }); lower = transitionTryMode(source, lower, { type: 'set-arch', arch: 'lower', width: 36, depth: 25 });
    lower = preview(source, lower, { type: 'fit-arch', teeth: ['31'], arch: 'lower' });
    expect(position(source, lower.pending!.to, '31').x).toBeCloseTo(18, 5); expect(position(source, lower.pending!.to, '31').y).toBe(-5);
    expect(lower.pending!.to['11']).toEqual(lower.current['11']); expect(lower.archTargets.upper).toEqual({ width: 40, depth: 30 });
  });

  it('rejects imported, uncalibrated, or mixed-arch fitting atomically', () => {
    const source = model({ '11': [25, 3, 0], '31': [22, -3, 0] }), edit: TryEdit = { type: 'fit-arch', teeth: ['11'], arch: 'upper' };
    expect(() => preview({ ...source, demo: false }, createTryState(), edit)).toThrow(/synthetic/);
    expect(() => preview(source, createTryState(), { ...edit, teeth: ['11', '31'] })).toThrow(/one named arch/);
    source.teeth[0].calibrated = false; expect(() => preview(source, createTryState(), edit)).toThrow(/calibrated/);
  });
});

describe('sampled path collisions', () => {
  it('uses the authored high-resolution crown meshes without rewriting source geometry', () => {
    const source = createOrthodonticDemo(), tooth = source.teeth.find(t => t.id === '11')!, vertices = [...tooth.geometry.getAttribute('position').array], indices = [...tooth.geometry.index!.array];
    try {
      const state = preview(source, createTryState(), move('11', 2));
      expect(state.pending!.collision.crossings.some(pair => [pair.a, pair.b].includes('21'))).toBe(true);
      expect(state.pending!.collision.samples).toBeLessThanOrEqual(TRY_MAX_PATH_SAMPLES);
      expect([...tooth.geometry.getAttribute('position').array]).toEqual(vertices); expect([...tooth.geometry.index!.array]).toEqual(indices);
      expect(state.current).toEqual({}); expect(() => apply(source, state)).toThrow(/crosses/);
    } finally { source.teeth.forEach(tooth => { tooth.geometry.dispose(); tooth.rootGeometry?.dispose(); }); source.gums.forEach(gum => gum.geometry.dispose()); }
  });

  it('detects a collision between clear start/end poses and blocks default Apply', () => {
    const source = model({ '11': [-3, 0, 0], '21': [0, 0, 0] }, [.8, .8, .8]), state = preview(source, createTryState(), move('11', 6)), report = state.pending!.collision;
    expect(report.baseline).toEqual([]); expect(report.endpoint).toEqual([]); expect(report.crossings).toHaveLength(1); expect(report.crossings[0].t).toBeGreaterThan(0); expect(report.crossings[0].t).toBeLessThan(1);
    expect(() => apply(source, state)).toThrow(/crosses/); expect(state.current).toEqual({});
    const unrestricted = transitionTryMode(source, state, { type: 'unrestricted', enabled: true }); expect(apply(source, unrestricted).current['11'].translation[0]).toBe(6);
  });

  it('checks a rigid rotation’s arc rather than a straight chord between centres', () => {
    const radius = 3 / Math.sqrt(2), source = model({ '11': [-3, 0, 0], '12': [3, 0, 0], '21': [-radius, 0, radius] }, [.55, .55, .55]);
    const state = preview(source, createTryState(), { type: 'segment-rotate', teeth: ['11', '12'], axis: 'y', amount: 90 }), candidate = state.pending!;
    expect(position(source, previewPose(candidate, .5), '11').distanceTo(new Vector3(-radius, 0, radius))).toBeLessThan(1e-8);
    expect(candidate.collision.baseline).toEqual([]); expect(candidate.collision.endpoint).toEqual([]); expect(candidate.collision.crossings.some(pair => [pair.a, pair.b].includes('21'))).toBe(true);
    expect(() => apply(source, state)).toThrow(/crosses/);
  });

  it('reports persistent baseline intersections separately without calling them newly clear or new crossings', () => {
    const source = model({ '11': [0, 0, 0], '21': [.5, 0, 0], '31': [30, 0, 0], '41': [30.5, 0, 0] }), state = preview(source, createTryState(), move('11', .1));
    expect(state.pending!.collision.baseline).toEqual([{ a: '11', b: '21' }]); expect(state.pending!.collision.crossings).toEqual([]);
    expect(state.pending!.collision.endpoint).toEqual([{ a: '11', b: '21' }]); expect(apply(source, state).current['11'].translation[0]).toBe(.1);
  });

  it('bounds collision work and requires explicit unrestricted mode when sampling resolution is exhausted', () => {
    const source = model({ '11': [0, 0, 0] }), state = preview(source, createTryState(), { type: 'poses', poses: { '11': { translation: [60, 0, 0], rotation: [0, 0, 0] } }, label: 'Long drag' });
    expect(state.pending!.collision.samples).toBe(TRY_MAX_PATH_SAMPLES); expect(state.pending!.collision.sampleLimitReached).toBe(true);
    expect(state.pending!.collision.approximation).toContain('between samples'); expect(() => apply(source, state)).toThrow(/sampling budget/);
    expect(apply(source, { ...state, unrestricted: true }).current['11'].translation[0]).toBe(60);
  });
});

describe('noncumulative revision and persistence', () => {
  it('treats a loaded arrangement as an independent original pose and restores it without mutating source axes', () => {
    const source = model({ '11': [0, 0, 0], '12': [8, 0, 0] });
    const original: Transforms = { '11': { translation: [0, 1, 1.5], rotation: [18, 0, 0] }, '12': { translation: [0, 0, 1.5], rotation: [-9, 0, 0] } };
    const supplied = structuredClone(original), sourceAxes = source.teeth.map(tooth => ({ position: [...tooth.position], buccal: [...tooth.buccal], mesial: [...tooth.mesial], occlusal: [...tooth.occlusal!] }));
    let state = createTryState(original, original);
    expect(state.current).toEqual(supplied); expect(state.original).toEqual(supplied); expect(state.current).not.toBe(state.original);
    original['11'].translation[2] = 100;
    expect(state.original).toEqual(supplied); expect(state.current).toEqual(supplied);
    expect(() => transitionTryMode(source, state, { type: 'preview-original' })).toThrow(/already matches/);
    state = apply(source, preview(source, state, move('11', 1)));
    const restored = transitionTryMode(source, { ...state, lockedIds: ['12'] }, { type: 'preview-original' });
    expect(restored.pending!.affectedIds).toEqual(['11']); expect(restored.pending!.to).toEqual(supplied);
    expect(apply(source, restored).current).toEqual(supplied); expect(state.original).toEqual(supplied);
    expect(() => transitionTryMode(source, { ...state, lockedIds: ['11'], unrestricted: true }, { type: 'preview-original' })).toThrow(/Unlock 11/);
    expect(source.teeth.map(tooth => ({ position: tooth.position, buccal: tooth.buccal, mesial: tooth.mesial, occlusal: tooth.occlusal }))).toEqual(sourceAxes);
  });

  it('resets only requested teeth to their loaded original, with omitted original teeth reset to zero', () => {
    const source = model({ '11': [0, 0, 0], '12': [8, 0, 0], '21': [16, 0, 0] });
    const original: Transforms = { '11': { translation: [0, 1, 1.5], rotation: [18, 0, 0] } };
    const current: Transforms = { '11': { translation: [0, 2, 1.5], rotation: [22, 0, 0] }, '12': { translation: [0, 1, 0], rotation: [3, 0, 0] }, '21': { translation: [0, 0, 2], rotation: [0, 5, 0] } };
    const state = createTryState(current, original);
    const reset = preview(source, state, { type: 'dental', command: { type: 'reset', teeth: ['11', '12'] } });
    expect(reset.pending!.to['11']).toEqual(original['11']); expect(reset.pending!.to['12']).toBeUndefined();
    expect(reset.pending!.to['21']).toEqual(current['21']); expect(apply(source, reset).original).toEqual(original);
    expect(state.current).toEqual(current); expect(state.original).toEqual(original);
    expect(() => preview(source, { ...state, lockedIds: ['11'], unrestricted: true }, { type: 'dental', command: { type: 'reset', teeth: ['11'] } })).toThrow(/Unlock/);
  });

  it('persists a detached original while keeping named snapshot restore independent', () => {
    const source = model({ '11': [0, 0, 0] }), original: Transforms = { '11': { translation: [0, 0, 1.5], rotation: [18, 0, 0] } };
    let state = createTryState(original, original);
    state = apply(source, preview(source, state, move('11', 1)));
    state = transitionTryMode(source, state, { type: 'save-snapshot', name: 'Alternative' });
    const saved = JSON.parse(JSON.stringify(serializeTrySession(state))), session = validateTrySession(saved, ['11']);
    expect(session.original).toEqual(original); expect(session.snapshots[0].transforms).toEqual(state.current);
    saved.original['11'].rotation[0] = 99; expect(session.original).toEqual(original); expect(state.original).toEqual(original);
    const loaded = { ...createTryState(state.current), ...session };
    const restored = apply(source, transitionTryMode(source, loaded, { type: 'preview-original' }));
    expect(restored.current).toEqual(original);
    const snapshot = transitionTryMode(source, restored, { type: 'preview-snapshot', name: 'Alternative' });
    expect(snapshot.pending!.to).toEqual(state.current); expect(snapshot.original).toEqual(original);
  });

  it('keeps the zero reference for legacy initialization and saved sessions without original', () => {
    const source = model({ '11': [0, 0, 0] }), current: Transforms = { '11': { translation: [0, 1, 2], rotation: [18, 0, 0] } };
    const initial = createTryState(current); expect(initial.original).toEqual({});
    const saved = serializeTrySession(initial); delete saved.original;
    const legacy = validateTrySession(saved, ['11']); expect(legacy.original).toEqual({});
    const loaded = { ...createTryState(current), ...legacy };
    const reset = apply(source, preview(source, loaded, { type: 'dental', command: { type: 'reset', teeth: ['11'] } }));
    expect(reset.current).toEqual({}); expect(reset.original).toEqual({});
  });

  it.each([null, [], { '99': emptyPose() }, { '11': { translation: [Infinity, 0, 0], rotation: [0, 0, 0] } }, { '11': { translation: [0, 0, 0], rotation: [0, 0, 0], extra: true } }, { '11': { translation: [100001, 0, 0], rotation: [0, 0, 0] } }])('rejects an invalid persisted original %#', original => {
    expect(() => validateTrySession({ ...serializeTrySession(createTryState()), original }, ['11'])).toThrow();
  });

  it('replaces the last edit from its starting state and bases repeated relative revision on the original amount', () => {
    const source = model({ '11': [0, 0, 0] }), original = { '11': { translation: [3, 0, 0], rotation: [0, 0, 0] } as Pose };
    let state = apply(source, preview(source, createTryState(original), move('11', 2))); expect(state.current['11'].translation[0]).toBe(5);
    state = transitionTryMode(source, state, { type: 'revise', amount: .5, unit: 'mm' }); expect(state.pending!.to['11'].translation[0]).toBe(3.5); expect(state.current['11'].translation[0]).toBe(5);
    state = transitionTryMode(source, state, { type: 'revise', factor: .5 }); expect(state.pending!.to['11'].translation[0]).toBe(4);
    state = transitionTryMode(source, state, { type: 'revise', factor: .5 }); expect(state.pending!.to['11'].translation[0]).toBe(4);
    state = apply(source, state); expect(state.current['11'].translation[0]).toBe(4);
    state = transitionTryMode(source, state, { type: 'revise', amount: 1.5 }); expect(state.pending!.to['11'].translation[0]).toBe(4.5);
  });

  it('rejects revision unit mismatch, objectives without one movement amount, and stale last edits', () => {
    const source = model({ '11': [0, 0, 0], '12': [5, 0, 0] }), rotation = preview(source, createTryState(), { type: 'segment-rotate', teeth: ['11'], axis: 'z', amount: 5 });
    expect(() => transitionTryMode(source, rotation, { type: 'revise', amount: 1, unit: 'mm' })).toThrow(/degrees/);
    const gap = preview(source, createTryState(), { type: 'close-gap', teeth: ['11', '12'], rule: 'equal', gap: 1 });
    expect(() => transitionTryMode(source, gap, { type: 'revise', factor: .5 })).toThrow(/no single/);
    const state = apply(source, preview(source, createTryState(), move('11', 1))); state.current = {};
    expect(() => transitionTryMode(source, state, { type: 'revise', amount: .5 })).toThrow(/changed/);
  });

  it('restores only changed poses so unchanged locked teeth remain valid references', () => {
    const source = model({ '11': [0, 0, 0], '12': [5, 0, 0] });
    const state = { ...createTryState({ '11': { translation: [0, 2, 0], rotation: [0, 0, 0] } }), lockedIds: ['12'] };
    const restored = transitionTryMode(source, state, { type: 'preview-original' });
    expect(restored.pending!.affectedIds).toEqual(['11']); expect(apply(source, restored).current['11'].translation).toEqual([0, 0, 0]);
    expect(() => transitionTryMode(source, { ...state, lockedIds: ['11'] }, { type: 'preview-original' })).toThrow(/Unlock/);
  });

  it('keeps named comparisons and custom groups bounded, detached, and serializable without pending previews', () => {
    const source = model({ '11': [0, 0, 0], '12': [5, 0, 0] }); let state = createTryState();
    state = transitionTryMode(source, state, { type: 'save-snapshot', name: 'Initial' }); state = transitionTryMode(source, state, { type: 'save-group', name: 'Front pair', teeth: ['11', '12'] });
    state = apply(source, preview(source, state, move('11', 1))); state = transitionTryMode(source, state, { type: 'save-snapshot', name: 'Moved' });
    state = transitionTryMode(source, state, { type: 'compare-snapshot', name: 'Initial' }); expect(state.current['11'].translation[0]).toBe(1); expect(state.pending).toBeNull(); expect(state.comparisonName).toBe('Initial');
    const serialized = JSON.parse(JSON.stringify(serializeTrySession(state))), restored = validateTrySession(serialized, ['11', '12']);
    expect(restored).toEqual(serializeTrySession(state)); expect(serialized.pending).toBeUndefined(); expect(serialized.lastEdit).toBeUndefined(); expect(serialized.current).toBeUndefined();
    serialized.snapshots[1].transforms['11'].translation[0] = 99; expect(state.snapshots[1].transforms['11'].translation[0]).toBe(1);
    const restore = transitionTryMode(source, state, { type: 'preview-snapshot', name: 'Initial' }); expect(restore.current['11'].translation[0]).toBe(1); expect(restore.pending!.to['11'].translation[0]).toBe(0);
    for (let i = 2; i < 10; i++) state = transitionTryMode(source, state, { type: 'save-snapshot', name: `Snapshot ${i}` });
    expect(() => transitionTryMode(source, state, { type: 'save-snapshot', name: 'Eleventh' })).toThrow(/10/);
    expect(transitionTryMode(source, state, { type: 'save-snapshot', name: 'Moved' }).snapshots).toHaveLength(10);
  });

  it.each([
    { type: 'preview', edit: { type: 'segment-translate', teeth: ['11'], axis: 'screen', amount: 1 } },
    { type: 'preview', edit: { type: 'segment-translate', teeth: ['11'], axis: 'x', amount: NaN } },
    { type: 'preview', edit: { type: 'poses', poses: { '99': emptyPose() }, label: 'Foreign' } },
    { type: 'preview', edit: { type: 'dental', command: { type: 'undo' } } },
    { type: 'preview', edit: { type: 'change-width', teeth: ['11', '11'], amount: 1 } },
    { type: 'lock', teeth: ['11'], locked: true, execute: 'script()' },
    { type: 'set-arch', arch: 'upper', width: 0, depth: 34 },
    { type: 'revise', amount: 1, factor: .5 },
  ])('strictly rejects invalid external actions %#', action => { expect(() => validateTryAction(action, ['11', '12'])).toThrow(); });

  it('rejects corrupted persistent groups, poses, comparison names, and metadata', () => {
    const session = serializeTrySession(createTryState());
    expect(() => validateTrySession({ ...session, pending: {} }, ['11'])).toThrow();
    expect(() => validateTrySession({ ...session, comparisonName: 'Missing' }, ['11'])).toThrow();
    expect(() => validateTrySession({ ...session, groups: [{ name: 'G', teeth: ['11', '99'] }] }, ['11'])).toThrow();
    expect(() => validateTrySession({ ...session, snapshots: [{ name: 'Bad', transforms: { '11': { translation: [Infinity, 0, 0], rotation: [0, 0, 0] } } }] }, ['11'])).toThrow();
  });

  it.each(['original', 'Original', ' ORIGINAL '])('reserves snapshot name %j while allowing the same custom group name', name => {
    const source = model({ '11': [0, 0, 0] }), state = createTryState(), session = serializeTrySession(state);
    expect(() => validateTryAction({ type: 'save-snapshot', name }, ['11'])).toThrow(/reserved/);
    expect(() => transitionTryMode(source, state, { type: 'save-snapshot', name })).toThrow(/reserved/); expect(state.snapshots).toHaveLength(0);
    expect(() => validateTrySession({ ...session, snapshots: [{ name, transforms: {} }] }, ['11'])).toThrow(/reserved/);
    const grouped = transitionTryMode(source, state, { type: 'save-group', name, teeth: ['11'] });
    expect(validateTrySession(serializeTrySession(grouped), ['11']).groups[0].name).toBe(name.trim());
  });
});
