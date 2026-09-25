import { describe, expect, it } from 'vitest';
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { applyDentalCommand, emptyPose, type Pose, type Tooth, type Vec3 } from './model';
import {
  historyReducer,
  interpolateTransforms,
  stageTransforms,
  validateSession,
  validTransforms,
  type CaseSession,
  type Plan,
} from './planning';

const pose = (translation: Vec3, rotation: Vec3 = [0, 0, 0]): Pose => ({ translation, rotation });
const quaternion = (p: Pose) =>
  new Quaternion().setFromEuler(new Euler(...(p.rotation.map(MathUtils.degToRad) as Vec3)));

describe('whole-operation history', () => {
  const teeth: Tooth[] = ['11', '21'].map(id => ({
    id,
    name: id,
    position: [0, 0, 0],
    buccal: [0, 0, 1],
    mesial: [1, 0, 0],
    occlusal: [0, -1, 0],
    calibrated: true,
  }));

  it('undoes and redoes a multi-tooth command as one snapshot with its label intact', () => {
    const original: Plan = { current: { '11': pose([1, 0, 0]) }, past: [], future: [] };
    const moved = applyDentalCommand(original.current, teeth, {
      type: 'move_group',
      teeth: ['11', '21'],
      direction: 'buccal',
      amount: 0.5,
    });
    const committed = historyReducer(original, {
      type: 'commit',
      value: moved,
      label: 'Move both incisors',
    });
    expect(committed.current['11'].translation).toEqual([1, 0, 0.5]);
    expect(committed.current['21'].translation).toEqual([0, 0, 0.5]);
    expect(committed.past).toEqual([{ value: original.current, label: 'Move both incisors' }]);
    const undone = historyReducer(committed, { type: 'undo' });
    expect(undone.current).toEqual(original.current);
    expect(undone.future).toEqual([{ value: moved, label: 'Move both incisors' }]);
    expect(historyReducer(undone, { type: 'redo' })).toEqual(committed);
    expect(original).toEqual({ current: { '11': pose([1, 0, 0]) }, past: [], future: [] });
  });

  it('keeps redo order across several undos and discards only the old branch on a new commit', () => {
    const start: Plan = { current: {}, past: [], future: [] };
    const a = historyReducer(start, {
      type: 'commit',
      value: { '11': pose([1, 0, 0]) },
      label: 'A',
    });
    const b = historyReducer(a, { type: 'commit', value: { '11': pose([2, 0, 0]) }, label: 'B' });
    const c = historyReducer(b, { type: 'commit', value: { '11': pose([3, 0, 0]) }, label: 'C' });
    const twiceUndone = historyReducer(historyReducer(c, { type: 'undo' }), { type: 'undo' });
    expect(twiceUndone.current).toEqual(a.current);
    const redone = historyReducer(twiceUndone, { type: 'redo' });
    expect(redone.current).toEqual(b.current);
    expect(historyReducer(redone, { type: 'redo' })).toEqual(c);
    const branch = historyReducer(twiceUndone, {
      type: 'commit',
      value: { '21': pose([0, 1, 0]) },
      label: 'New branch',
    });
    expect(branch.future).toEqual([]);
    expect(historyReducer(branch, { type: 'redo' })).toBe(branch);
    expect(historyReducer(branch, { type: 'undo' }).current).toEqual(a.current);
    expect(twiceUndone.future.map(entry => entry.label)).toEqual(['C', 'B']);
  });

  it('loads saved histories and handles empty undo/redo without inventing entries', () => {
    const start: Plan = { current: {}, past: [], future: [] };
    expect(historyReducer(start, { type: 'undo' })).toBe(start);
    expect(historyReducer(start, { type: 'redo' })).toBe(start);
    const past = [{ value: {}, label: 'Move' }];
    const future = [{ value: { '11': pose([2, 0, 0]) }, label: 'Rotate' }];
    const loaded = historyReducer(start, {
      type: 'load',
      value: { '11': pose([1, 0, 0]) },
      past,
      future,
    });
    expect(loaded.past).toEqual(past);
    expect(historyReducer(loaded, { type: 'redo' }).current).toEqual(future[0].value);
    expect(historyReducer(loaded, { type: 'load', value: {} })).toEqual(start);
  });
});

describe('checkpoint paths and quaternion stage previews', () => {
  it('starts from a nonzero class baseline and visits subsequent checkpoints without accumulating it', () => {
    const original = { '11': pose([3, 2, 1], [0, 0, 20]) },
      final = { '11': pose([9, 6, 1], [0, 0, 80]) };
    const checkpoints = [
      { id: 'middle', name: 'Middle', transforms: { '11': pose([5, 4, 1], [0, 0, 40]) } },
    ];
    const before = JSON.stringify({ original, final, checkpoints });
    expect(stageTransforms(final, checkpoints, 0, 4, original)).toEqual(original);
    const halfFirst = stageTransforms(final, checkpoints, 1, 4, original)['11'];
    expect(halfFirst.translation).toEqual([4, 3, 1]);
    expect(halfFirst.rotation[2]).toBeCloseTo(30, 10);
    expect(stageTransforms(final, checkpoints, 2, 4, original)).toEqual(checkpoints[0].transforms);
    expect(stageTransforms(final, checkpoints, 3, 4, original)['11'].translation).toEqual([
      7, 5, 1,
    ]);
    expect(stageTransforms(final, checkpoints, 4, 4, original)).toEqual(final);
    expect(JSON.stringify({ original, final, checkpoints })).toBe(before);
  });
  it('retains identity-start compatibility when an original arrangement is omitted', () => {
    const final = { '11': pose([4, 2, 0], [0, 0, 40]) };
    expect(stageTransforms(final, [], 0, 2)).toEqual({});
    expect(stageTransforms(final, [], 1, 2)).toEqual(stageTransforms(final, [], 1, 2, {}));
    expect(stageTransforms(final, [], 1, 2)['11'].translation).toEqual([2, 1, 0]);
  });
  it('visits every captured checkpoint in order and uses equal-duration segments', () => {
    const checkpoints = [
      { id: 'a', name: 'A', transforms: { '11': pose([4, 0, 0]) } },
      { id: 'b', name: 'B', transforms: { '11': pose([4, 6, 0]) } },
    ];
    const final = { '11': pose([10, 8, 0]) };
    expect(stageTransforms(final, checkpoints, 0, 6)).toEqual({});
    expect(stageTransforms(final, checkpoints, 1, 6)['11'].translation).toEqual([2, 0, 0]);
    expect(stageTransforms(final, checkpoints, 2, 6)).toEqual(checkpoints[0].transforms);
    expect(stageTransforms(final, checkpoints, 3, 6)['11'].translation).toEqual([4, 3, 0]);
    expect(stageTransforms(final, checkpoints, 4, 6)).toEqual(checkpoints[1].transforms);
    expect(stageTransforms(final, checkpoints, 5, 6)['11'].translation).toEqual([7, 7, 0]);
    expect(stageTransforms(final, checkpoints, 6, 6)).toEqual(final);
  });

  it('interpolates missing poses from or toward identity without mutating endpoints', () => {
    const from = { '11': pose([4, 2, 0]) };
    const to = { '21': pose([0, 4, 2]) };
    const saved = JSON.stringify({ from, to });
    expect(interpolateTransforms(from, to, 0)).toEqual(from);
    expect(interpolateTransforms(from, to, 1)).toEqual(to);
    const halfway = interpolateTransforms(from, to, 0.5);
    expect(halfway['11'].translation).toEqual([2, 1, 0]);
    expect(halfway['21'].translation).toEqual([0, 2, 1]);
    expect(stageTransforms(to, [], 5, 10)['21'].translation).toEqual([0, 2, 1]);
    expect(JSON.stringify({ from, to })).toBe(saved);
  });

  it('takes the shortest orientation path across the Euler wrap boundary', () => {
    const result = interpolateTransforms(
      { '11': pose([0, 0, 0], [0, 0, 170]) },
      { '11': pose([0, 0, 0], [0, 0, -170]) },
      0.5,
    );
    const direction = new Vector3(1, 0, 0).applyQuaternion(quaternion(result['11']));
    expect(direction.x).toBeCloseTo(-1, 12);
    expect(direction.y).toBeCloseTo(0, 12);
    expect(direction.z).toBeCloseTo(0, 12);
  });

  it('interpolates combined rotations as orientations rather than linear Euler components', () => {
    const a = pose([0, 0, 0], [90, 0, 0]),
      b = pose([2, 4, 6], [0, 90, 0]);
    const result = interpolateTransforms({ '11': a }, { '11': b }, 0.5)['11'];
    const expected = new Quaternion(1 / Math.sqrt(6), 1 / Math.sqrt(6), 0, 2 / Math.sqrt(6));
    expect(Math.abs(quaternion(result).dot(expected))).toBeCloseTo(1, 12);
    expect(result.translation).toEqual([1, 2, 3]);
    const eulerAverage = quaternion(pose([0, 0, 0], [45, 45, 0]));
    expect(Math.abs(quaternion(result).dot(eulerAverage))).toBeLessThan(0.99);
  });

  it.each([-1, 1.1, NaN, Infinity])('rejects an invalid interpolation fraction %s', fraction => {
    expect(() => interpolateTransforms({}, {}, fraction)).toThrow();
  });

  it.each([
    [0, 1],
    [0, 2.5],
    [-1, 10],
    [11, 10],
    [NaN, 10],
    [Infinity, 10],
  ])('rejects invalid stage %s and count %s', (stage, count) => {
    expect(() => stageTransforms({}, [], stage, count)).toThrow();
  });
});

describe('restored session validation', () => {
  const ids = new Set(['11', '21']);
  const valid = (): CaseSession => ({
    stages: 10,
    checkpoints: [{ id: 'first', name: 'First', transforms: { '11': emptyPose() } }],
    past: [{ value: {}, label: 'First move' }],
    future: [],
    braces: true,
    roots: false,
    bracketStyle: 'metal',
    ligatureColor: '#57a6e3',
  });

  it('accepts complete sessions, legacy cases without a session, and empty transform maps', () => {
    expect(validateSession(undefined, ids)).toBeUndefined();
    expect(validateSession(valid(), ids)).toEqual(valid());
    expect(
      validateSession({ ...valid(), bracketStyle: 'ceramic', ligatureColor: '#AABBCC' }, ids)
        ?.bracketStyle,
    ).toBe('ceramic');
    expect(validTransforms({}, ids)).toBe(true);
  });

  it('restores an older serialized session without inventing attachment visibility', () => {
    const olderSession = JSON.parse(JSON.stringify(valid()));
    expect(Object.hasOwn(olderSession, 'attachments')).toBe(false);
    const restored = validateSession(olderSession, ids)!;
    expect(restored.attachments).toBeUndefined();
    expect(Object.hasOwn(restored, 'attachments')).toBe(false);
    expect(restored).toEqual(olderSession);
  });

  it.each([true, false])(
    'preserves attachment visibility %s through a serialized session',
    attachments => {
      const encoded = JSON.stringify({ ...valid(), attachments });
      const restored = validateSession(JSON.parse(encoded), ids)!;
      expect(restored.attachments).toBe(attachments);
      expect(JSON.stringify(restored)).toBe(encoded);
      expect(restored.braces).toBe(true);
      expect(restored.roots).toBe(false);
    },
  );

  it.each([null, 0, 1, 'true', 'false', [], {}])(
    'rejects non-boolean saved attachment visibility %j',
    attachments => {
      const serialized = JSON.parse(JSON.stringify({ ...valid(), attachments }));
      expect(() => validateSession(serialized, ids)).toThrow(/attachment visibility/);
    },
  );

  it('keeps older serialized sessions without appliance display settings backward compatible', () => {
    const olderSession = JSON.parse(JSON.stringify(valid()));
    const restored = validateSession(olderSession, ids)!;
    expect(Object.hasOwn(restored, 'applianceDisplay')).toBe(false);
    expect(restored.applianceDisplay).toBeUndefined();
    expect(JSON.stringify(restored)).toBe(JSON.stringify(olderSession));
  });

  it.each([
    'none',
    'brackets',
    'braces',
    'expander-bands',
    'palatal-expander',
    'retainer',
  ] as const)('restores the %s display without changing poses or appliance visibility', preset => {
    const original = {
      ...valid(),
      braces: false,
      applianceDisplay: { preset, progress: 0.375, palate: true },
    };
    const encoded = JSON.stringify(original),
      decoded = JSON.parse(encoded);
    const restored = validateSession(decoded, ids)!;
    expect(restored.applianceDisplay).toEqual(original.applianceDisplay);
    expect(restored.braces).toBe(false);
    expect(restored.checkpoints).toEqual(original.checkpoints);
    expect(restored.past).toEqual(original.past);
    expect(JSON.stringify(restored)).toBe(encoded);
    expect(JSON.stringify(decoded)).toBe(encoded);
    expect(restored.applianceDisplay).not.toBe(decoded.applianceDisplay);
    restored.applianceDisplay!.progress = 1;
    expect(decoded.applianceDisplay.progress).toBe(0.375);
  });

  it.each([
    null,
    [],
    {},
    { preset: 'unknown', progress: 0, palate: false },
    { preset: 'braces', progress: -0.01, palate: false },
    { preset: 'braces', progress: 1.01, palate: false },
    { preset: 'braces', progress: '0.5', palate: false },
    { preset: 'braces', progress: null, palate: false },
    { preset: 'braces', progress: 0, palate: 'false' },
    { preset: 'braces', progress: 0 },
    { preset: 'braces', progress: 0, palate: false, arrows: true },
  ])('rejects malformed persisted appliance settings %j', applianceDisplay => {
    const serialized = JSON.parse(JSON.stringify({ ...valid(), applianceDisplay }));
    expect(() => validateSession(serialized, ids)).toThrow();
  });

  it.each([NaN, Infinity, -Infinity])(
    'rejects nonfinite appliance progress %s before serialization',
    progress => {
      expect(() =>
        validateSession(
          { ...valid(), applianceDisplay: { preset: 'braces', progress, palate: false } },
          ids,
        ),
      ).toThrow(/progress/);
    },
  );

  it.each([
    null,
    [],
    { '31': emptyPose() },
    { '11': { translation: [0, 0], rotation: [0, 0, 0] } },
    { '11': pose([0, NaN, 0]) },
    { '11': pose([0, Infinity, 0]) },
    { '11': pose([100001, 0, 0]) },
  ])('rejects malformed or unrecognized transforms: %j', value => {
    expect(validTransforms(value, ids)).toBe(false);
  });

  it.each([
    ['stages', 1],
    ['stages', 51],
    ['stages', 3.5],
    ['braces', 'true'],
    ['roots', null],
    ['bracketStyle', 'plastic'],
    ['ligatureColor', '#fff'],
    ['ligatureColor', 'red'],
    ['past', [{ value: { '31': emptyPose() }, label: 'Bad tooth' }]],
    ['future', [{ value: {}, label: 'x'.repeat(300) }]],
    ['past', Array(5001).fill({ value: {}, label: 'Move' })],
    [
      'checkpoints',
      Array.from({ length: 21 }, (_, i) => ({ id: String(i), name: 'Stage', transforms: {} })),
    ],
    ['checkpoints', [{ id: 'a', name: 'x'.repeat(61), transforms: {} }]],
    ['checkpoints', [{ id: 'a', name: 'A', transforms: { '31': emptyPose() } }]],
    [
      'checkpoints',
      [
        { id: 'a', name: 'A', transforms: {} },
        { id: 'a', name: 'B', transforms: {} },
      ],
    ],
  ])('rejects invalid saved %s', (field, value) => {
    expect(() => validateSession({ ...valid(), [field as string]: value }, ids)).toThrow();
  });
});
