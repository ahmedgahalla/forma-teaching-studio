import { Box3, Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { DentalCase, DentalTooth } from './geometry';
import type { Command } from './commands';
import { validateCommand } from './commands';
import {
  addMovement,
  anatomicalFrame,
  applyDentalCommand,
  emptyPose,
  isPose,
  type Axis,
  type Pose,
  type Transforms,
  type Vec3,
} from './model';
import { findSurfaceIntersections, toothMatrix, type SurfaceIntersection } from './analysis';

export type PoseCommand = Extract<
  Command,
  { type: 'move' | 'move_group' | 'rotate' | 'rotate_group' | 'orthodontic' | 'reset' }
>;
export type TryEdit =
  | { type: 'dental'; command: PoseCommand }
  | { type: 'segment-translate'; teeth: string[]; axis: Axis; amount: number }
  | { type: 'segment-rotate'; teeth: string[]; axis: Axis; amount: number }
  | { type: 'close-gap'; teeth: [string, string]; rule: 'equal' | 'first' | 'second'; gap: number }
  | { type: 'change-width'; teeth: [string, string]; amount: number }
  | { type: 'fit-arch'; teeth: string[]; arch: 'upper' | 'lower' }
  | { type: 'poses'; poses: Transforms; label: string };
export type TryAction =
  | { type: 'enter' | 'exit' | 'apply' | 'cancel' | 'preview-original' }
  | { type: 'preview'; edit: TryEdit }
  | { type: 'revise'; amount: number; unit?: 'mm' | 'degrees' }
  | { type: 'revise'; factor: number }
  | { type: 'lock'; teeth: string[]; locked: boolean }
  | { type: 'unrestricted'; enabled: boolean }
  | { type: 'set-arch'; arch: 'upper' | 'lower'; width: number; depth: number }
  | {
      type: 'save-snapshot' | 'preview-snapshot' | 'delete-snapshot' | 'delete-group';
      name: string;
    }
  | { type: 'compare-snapshot'; name: string | null }
  | { type: 'save-group'; name: string; teeth: string[] };
type ArchTarget = { width: number; depth: number };
type TrySnapshot = { name: string; transforms: Transforms };
type TryGroup = { name: string; teeth: string[] };
type TryCollisionReport = {
  baseline: SurfaceIntersection[];
  crossings: (SurfaceIntersection & { sample: number; t: number })[];
  endpoint: SurfaceIntersection[];
  samples: number;
  sampleLimitReached: boolean;
  approximation: string;
};
type Motion =
  | { type: 'linear' }
  | { type: 'rigid'; centroid: Vec3; centres: Record<string, Vec3>; axis: Axis; amount: number };
export type TryPreview = {
  from: Transforms;
  to: Transforms;
  currentAtPreview: Transforms;
  label: string;
  affectedIds: string[];
  edit: TryEdit;
  baseEdit: TryEdit;
  motion: Motion;
  revisionOfLast: boolean;
  collision: TryCollisionReport;
};
export type TrySession = {
  active: boolean;
  lockedIds: string[];
  unrestricted: boolean;
  archTargets: Record<'upper' | 'lower', ArchTarget>;
  snapshots: TrySnapshot[];
  groups: TryGroup[];
  comparisonName: string | null;
  original?: Transforms;
};
export type TryState = TrySession & {
  active: boolean;
  current: Transforms;
  original: Transforms;
  pending: TryPreview | null;
  lastEdit: TryPreview | null;
};
export const TRY_MAX_PATH_SAMPLES = 33;
export const TRY_LIMITS = {
  movement: 10,
  rotation: 180,
  span: 10,
  gap: 10,
  width: { min: 10, max: 120 },
  depth: { min: 5, max: 80 },
  snapshots: 10,
  groups: 10,
} as const;
const TRY_COLLISION_LIMITATION =
  'Bounded sampled crown-surface checks; crossings between samples, enclosed volumes, roots, gums, and biological limits are not assessed.';
const clone = <T>(value: T): T => structuredClone(value);
const vector = (value: Vec3) => new Vector3(...value);
const quaternion = (pose: Pose) =>
  new Quaternion().setFromEuler(
    new Euler(...(pose.rotation.map(MathUtils.degToRad) as Vec3), 'XYZ'),
  );
const rotation = (q: Quaternion): Vec3 => {
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z].map(MathUtils.radToDeg) as Vec3;
};
const centre = (tooth: DentalTooth, poses: Transforms) =>
  vector(tooth.position).add(vector((poses[tooth.id] || emptyPose()).translation));
const axisVector = (axis: Axis) =>
  new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
const archOf = (id: string) => (/^[12]/.test(id) ? 'upper' : 'lower');
const pairKey = (pair: SurfaceIntersection) => [pair.a, pair.b].sort().join('/');

export function createTryState(current: Transforms = {}, original: Transforms = {}): TryState {
  return {
    active: true,
    current: clone(current),
    original: clone(original),
    lockedIds: [],
    unrestricted: false,
    pending: null,
    lastEdit: null,
    archTargets: { upper: { width: 54, depth: 34 }, lower: { width: 49.6, depth: 32 } },
    snapshots: [],
    groups: [],
    comparisonName: null,
  };
}
export function assertTryUnlocked(state: Pick<TryState, 'lockedIds'>, ids: readonly string[]) {
  const locked = ids.filter(id => state.lockedIds.includes(id));
  if (locked.length)
    throw new Error(
      `Unlock ${locked.join(', ')} before changing its pose. Locks also apply in unrestricted mode.`,
    );
}
/** Full-arrangement restoration: omitted poses mean source/zero, as in Transforms. */
export function assertTryRestoreUnlocked(
  state: Pick<TryState, 'lockedIds' | 'current'>,
  target: Transforms,
) {
  const changed = state.lockedIds.filter(
    id =>
      !samePoses({ [id]: state.current[id] || emptyPose() }, { [id]: target[id] || emptyPose() }),
  );
  assertTryUnlocked(state, changed);
}
function samePoses(a: Transforms, b: Transforms) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(id => {
    const p = a[id] || emptyPose(),
      q = b[id] || emptyPose();
    return (
      p.translation.every((v, i) => Math.abs(v - q.translation[i]) < 1e-9) &&
      quaternion(p).angleTo(quaternion(q)) < 1e-7
    );
  });
}
function requireTargets(model: DentalCase, ids: readonly string[]) {
  if (!ids.length || ids.length > 32 || new Set(ids).size !== ids.length)
    throw new Error('Choose 1–32 distinct teeth.');
  return ids.map(id => {
    const tooth = model.teeth.find(t => t.id === id);
    if (!tooth) throw new Error(`Tooth ${id} is not present in this case.`);
    return tooth;
  });
}
function editIds(edit: TryEdit): string[] {
  if (edit.type === 'dental')
    return 'teeth' in edit.command ? [...edit.command.teeth] : [edit.command.tooth];
  return edit.type === 'poses' ? Object.keys(edit.poses) : [...edit.teeth];
}
function movingIds(edit: TryEdit): string[] {
  return edit.type === 'close-gap' && edit.rule !== 'equal'
    ? [edit.teeth[edit.rule === 'first' ? 0 : 1]]
    : editIds(edit);
}
function amount(value: number, limit: number) {
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > limit)
    throw new Error(`Use a finite nonzero amount between -${limit} and ${limit}.`);
  return value;
}

/** Signed projected crown gap along the CURRENT centre-to-centre direction. */
export function projectedCrownGap(
  model: DentalCase,
  transforms: Transforms,
  ids: readonly string[],
): number {
  if (ids.length !== 2) throw new Error('Choose exactly two teeth for a gap.');
  const [a, b] = requireTargets(model, ids),
    direction = centre(b, transforms).sub(centre(a, transforms));
  if (direction.length() < 1e-6)
    throw new Error('The tooth centres coincide; the gap direction is undefined.');
  direction.normalize();
  const extent = (tooth: DentalTooth) => {
    const points = tooth.geometry.getAttribute('position'),
      matrix = toothMatrix(tooth, transforms),
      point = new Vector3();
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < points.count; i++) {
      const d = point.fromBufferAttribute(points, i).applyMatrix4(matrix).dot(direction);
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max))
      throw new Error('The crown has invalid geometry.');
    return [min, max];
  };
  return extent(b)[0] - extent(a)[1];
}

function archPoint(target: ArchTarget, theta: number, y: number): Vec3 {
  return [(target.width / 2) * Math.sin(theta), y, -12 + target.depth * Math.cos(theta)];
}
/** Full reference ellipse; fitting changes only case X/Z, leaving each tooth's Y/orientation intact. */
export function archCurvePoints(
  model: DentalCase,
  state: Pick<TryState, 'archTargets'>,
  arch: 'upper' | 'lower',
): Vec3[] {
  const teeth = model.teeth.filter(t => archOf(t.id) === arch),
    y = teeth.length ? teeth.reduce((sum, t) => sum + t.position[1], 0) / teeth.length : 0;
  return Array.from({ length: 129 }, (_, i) =>
    archPoint(state.archTargets[arch], (i / 128) * Math.PI * 2, y),
  );
}
function closestEllipse(point: Vector3, target: ArchTarget): Vector3 {
  const steps = 256,
    step = (Math.PI * 2) / steps,
    distance = (theta: number) =>
      vector(archPoint(target, theta, point.y)).distanceToSquared(point);
  let best = 0;
  for (let i = 1; i < steps; i++) if (distance(i * step) < distance(best)) best = i * step;
  // Refine the globally nearest sampled basin; handles interior and exterior points.
  let low = best - step,
    high = best + step;
  for (let i = 0; i < 40; i++) {
    const left = low + (high - low) / 3,
      right = high - (high - low) / 3;
    if (distance(left) < distance(right)) high = right;
    else low = left;
  }
  return vector(archPoint(target, (low + high) / 2, point.y));
}

function editPoses(
  model: DentalCase,
  state: TryState,
  from: Transforms,
  edit: TryEdit,
): { to: Transforms; motion: Motion; label: string } {
  const ids = editIds(edit),
    teeth = requireTargets(model, ids);
  assertTryUnlocked(state, movingIds(edit));
  let to = clone(from),
    motion: Motion = { type: 'linear' },
    label: string;
  if (edit.type === 'dental') {
    const command = edit.command;
    if (command.type === 'reset')
      for (const id of command.teeth) {
        const original = state.original?.[id];
        if (original) to[id] = clone(original);
        else delete to[id];
      }
    else to = applyDentalCommand(from, model.teeth, command);
    const change =
      command.type === 'move' || command.type === 'move_group'
        ? `${command.direction} ${command.amount} mm per tooth`
        : command.type === 'rotate' || command.type === 'rotate_group'
          ? `case ${command.axis.toUpperCase()} rotation ${command.amount}° per tooth`
          : command.type === 'orthodontic'
            ? `${command.movement} ${command.amount}° per tooth`
            : 'restore original poses';
    label = `${ids.join(', ')} · ${change}`;
  } else if (edit.type === 'poses') {
    for (const id of ids) to[id] = clone(edit.poses[id]);
    label = edit.label;
  } else if (edit.type === 'segment-translate') {
    const delta = axisVector(edit.axis).multiplyScalar(amount(edit.amount, 10)).toArray() as Vec3;
    teeth.forEach(tooth => {
      to[tooth.id] = addMovement(from[tooth.id] || emptyPose(), delta);
    });
    label = `Segment ${edit.axis.toUpperCase()} ${edit.amount} mm`;
  } else if (edit.type === 'segment-rotate') {
    amount(edit.amount, 180);
    const pivot = teeth
      .reduce((sum, tooth) => sum.add(centre(tooth, from)), new Vector3())
      .divideScalar(teeth.length);
    motion = {
      type: 'rigid',
      centroid: pivot.toArray() as Vec3,
      centres: Object.fromEntries(
        teeth.map(tooth => [tooth.id, centre(tooth, from).toArray() as Vec3]),
      ),
      axis: edit.axis,
      amount: edit.amount,
    };
    const q = new Quaternion().setFromAxisAngle(
      axisVector(edit.axis),
      MathUtils.degToRad(edit.amount),
    );
    teeth.forEach(tooth => {
      const pose = from[tooth.id] || emptyPose(),
        target = centre(tooth, from).sub(pivot).applyQuaternion(q).add(pivot);
      to[tooth.id] = {
        translation: target.sub(vector(tooth.position)).toArray() as Vec3,
        rotation: rotation(quaternion(pose).premultiply(q)),
      };
    });
    label = `Rigid segment ${edit.axis.toUpperCase()} ${edit.amount}°`;
  } else if (edit.type === 'close-gap' || edit.type === 'change-width') {
    if (ids.length !== 2) throw new Error('Choose exactly two teeth.');
    const [a, b] = teeth,
      direction = centre(b, from).sub(centre(a, from)),
      span = direction.length();
    if (span < 1e-6) throw new Error('The tooth centres coincide; a direction cannot be defined.');
    direction.normalize();
    let first: number, second: number;
    if (edit.type === 'close-gap') {
      const currentGap = projectedCrownGap(model, from, ids);
      if (currentGap < -1e-5)
        throw new Error('The projected crowns already overlap; gap closure is undefined.');
      if (
        !Number.isFinite(edit.gap) ||
        edit.gap < 0 ||
        edit.gap > 10 ||
        edit.gap >= currentGap - 1e-7
      )
        throw new Error(
          'The target gap must be nonnegative and smaller than the measured projected gap.',
        );
      const change = currentGap - edit.gap;
      if (change > 10) throw new Error('Gap closure is limited to 10 mm per preview.');
      first = edit.rule === 'second' ? 0 : edit.rule === 'first' ? change : change / 2;
      second = edit.rule === 'first' ? 0 : edit.rule === 'second' ? -change : -change / 2;
      label = `Projected gap ${currentGap.toFixed(2)} → ${edit.gap} mm · ${edit.rule}`;
    } else {
      amount(edit.amount, 10);
      if (span + edit.amount < 0.1) throw new Error('The new centre span must be at least 0.1 mm.');
      first = -edit.amount / 2;
      second = edit.amount / 2;
      label = `Centre span ${span.toFixed(2)} → ${(span + edit.amount).toFixed(2)} mm`;
    }
    to[a.id] = addMovement(
      from[a.id] || emptyPose(),
      direction.clone().multiplyScalar(first).toArray() as Vec3,
    );
    to[b.id] = addMovement(
      from[b.id] || emptyPose(),
      direction.clone().multiplyScalar(second).toArray() as Vec3,
    );
  } else {
    if (!model.demo || teeth.some(tooth => !tooth.calibrated || archOf(tooth.id) !== edit.arch))
      throw new Error('Curve fitting requires calibrated synthetic teeth from one named arch.');
    teeth.forEach(tooth => {
      anatomicalFrame(tooth);
      const target = closestEllipse(centre(tooth, from), state.archTargets[edit.arch]);
      to[tooth.id] = {
        ...clone(from[tooth.id] || emptyPose()),
        translation: target.sub(vector(tooth.position)).toArray() as Vec3,
      };
    });
    label = `Fit selected ${edit.arch} teeth to ${state.archTargets[edit.arch].width} × ${state.archTargets[edit.arch].depth} mm reference ellipse`;
  }
  for (const tooth of teeth) {
    const pose = to[tooth.id] || emptyPose();
    if (!isPose(pose)) throw new Error('Preview poses must contain finite coordinates.');
    if (
      vector(pose.translation).distanceTo(vector((from[tooth.id] || emptyPose()).translation)) > 60
    )
      throw new Error('A preview may move each tooth at most 60 mm.');
  }
  return { to: clone(to), motion, label };
}

/** Scrub the very same motion sampled by the collision preview. */
export function previewPose(
  preview: Pick<TryPreview, 'from' | 'to' | 'affectedIds' | 'motion'>,
  t: number,
): Transforms {
  if (!Number.isFinite(t) || t < 0 || t > 1)
    throw new Error('Preview progress must be between zero and one.');
  if (t === 0) return clone(preview.from);
  if (t === 1) return clone(preview.to);
  const result = clone(preview.from),
    motion = preview.motion;
  for (const id of preview.affectedIds) {
    const from = preview.from[id] || emptyPose(),
      to = preview.to[id] || emptyPose();
    if (motion.type === 'rigid') {
      const q = new Quaternion().setFromAxisAngle(
          axisVector(motion.axis),
          MathUtils.degToRad(motion.amount * t),
        ),
        original = vector(motion.centres[id]);
      const displacement = original
        .clone()
        .sub(vector(motion.centroid))
        .applyQuaternion(q)
        .add(vector(motion.centroid))
        .sub(original);
      result[id] = {
        translation: vector(from.translation).add(displacement).toArray() as Vec3,
        rotation: rotation(quaternion(from).premultiply(q)),
      };
    } else
      result[id] = {
        translation: vector(from.translation).lerp(vector(to.translation), t).toArray() as Vec3,
        rotation: rotation(quaternion(from).slerp(quaternion(to), t)),
      };
  }
  return result;
}

function collisionReport(
  model: DentalCase,
  preview: Omit<TryPreview, 'collision'>,
): TryCollisionReport {
  let travel = 0,
    angle = 0;
  const moved = new Set(preview.affectedIds);
  for (const tooth of model.teeth.filter(t => moved.has(t.id))) {
    tooth.geometry.computeBoundingSphere();
    const radius = tooth.geometry.boundingSphere!.radius;
    const from = preview.from[tooth.id] || emptyPose(),
      to = preview.to[tooth.id] || emptyPose(),
      turn = quaternion(from).angleTo(quaternion(to));
    let distance = vector(from.translation).distanceTo(vector(to.translation));
    if (preview.motion.type === 'rigid')
      distance =
        vector(preview.motion.centres[tooth.id]).distanceTo(vector(preview.motion.centroid)) *
        Math.abs(MathUtils.degToRad(preview.motion.amount));
    travel = Math.max(travel, distance + radius * turn);
    angle = Math.max(angle, MathUtils.radToDeg(turn));
  }
  const wanted = Math.max(8, Math.ceil(travel / 0.5), Math.ceil(angle / 6)),
    intervals = Math.min(TRY_MAX_PATH_SAMPLES - 1, wanted);
  const samples = Array.from({ length: intervals + 1 }, (_, i) =>
    previewPose(preview, i / intervals),
  );
  // Preview-time swept boxes cull stationary pairs. No collision work is done during scrubbing.
  const boxes = new Map(
    model.teeth.map(tooth => {
      tooth.geometry.computeBoundingBox();
      const box = new Box3();
      for (const poses of moved.has(tooth.id) ? samples : [preview.from])
        box.union(tooth.geometry.boundingBox!.clone().applyMatrix4(toothMatrix(tooth, poses)));
      return [tooth.id, box] as const;
    }),
  );
  const candidates: DentalTooth[][] = [];
  for (let a = 0; a < model.teeth.length; a++)
    for (let b = a + 1; b < model.teeth.length; b++) {
      const first = model.teeth[a],
        second = model.teeth[b];
      if (
        (moved.has(first.id) || moved.has(second.id)) &&
        boxes.get(first.id)!.intersectsBox(boxes.get(second.id)!)
      )
        candidates.push([first, second]);
    }
  const at = (poses: Transforms) =>
    candidates.flatMap(teeth => findSurfaceIntersections({ ...model, teeth, gums: [] }, poses));
  const baseline = at(preview.from),
    baselineKeys = new Set(baseline.map(pairKey)),
    seen = new Set<string>(),
    separated = new Set<string>();
  const crossings: TryCollisionReport['crossings'] = [];
  let endpoint: SurfaceIntersection[] = [];
  for (let i = 1; i < samples.length; i++) {
    const hits = at(samples[i]),
      keys = new Set(hits.map(pairKey));
    baselineKeys.forEach(key => {
      if (!keys.has(key)) separated.add(key);
    });
    for (const pair of hits) {
      const key = pairKey(pair);
      if ((!baselineKeys.has(key) || separated.has(key)) && !seen.has(key)) {
        crossings.push({ ...pair, sample: i, t: i / intervals });
        seen.add(key);
      }
    }
    if (i === samples.length - 1) endpoint = hits;
  }
  return {
    baseline,
    crossings,
    endpoint,
    samples: samples.length,
    sampleLimitReached: wanted > intervals,
    approximation: TRY_COLLISION_LIMITATION,
  };
}

function makePreview(
  model: DentalCase,
  state: TryState,
  edit: TryEdit,
  from = state.current,
  baseEdit = edit,
  revisionOfLast = false,
): TryPreview {
  const { to, motion, label } = editPoses(model, state, from, edit);
  const preview = {
    from: clone(from),
    to,
    currentAtPreview: clone(state.current),
    label,
    affectedIds: movingIds(edit),
    edit: clone(edit),
    baseEdit: clone(baseEdit),
    motion,
    revisionOfLast,
  };
  if (samePoses(from, to)) throw new Error('This edit would not change any tooth pose.');
  return { ...preview, collision: collisionReport(model, preview) };
}
function revised(
  edit: TryEdit,
  action: Extract<TryAction, { type: 'revise' }>,
  baseEdit: TryEdit,
): TryEdit {
  const unit =
    edit.type === 'segment-rotate' ||
    (edit.type === 'dental' &&
      ['rotate', 'rotate_group', 'orthodontic'].includes(edit.command.type))
      ? 'degrees'
      : 'mm';
  if ('unit' in action && action.unit !== unit)
    throw new Error(`The last numeric edit uses ${unit}, not ${action.unit}.`);
  const value = (source: number) => ('amount' in action ? action.amount : source * action.factor);
  if (
    edit.type === 'dental' &&
    baseEdit.type === 'dental' &&
    'amount' in edit.command &&
    'amount' in baseEdit.command
  )
    return { ...clone(edit), command: { ...edit.command, amount: value(baseEdit.command.amount) } };
  if (
    (edit.type === 'segment-translate' ||
      edit.type === 'segment-rotate' ||
      edit.type === 'change-width') &&
    'amount' in baseEdit
  )
    return { ...clone(edit), amount: value(baseEdit.amount) };
  throw new Error('The last edit has no single numeric movement amount to revise.');
}

/** All failures are atomic; only Apply commits a candidate to current. */
export function transitionTryMode(
  model: DentalCase,
  state: TryState,
  rawAction: TryAction,
): TryState {
  const action = validateTryAction(
    rawAction,
    model.teeth.map(t => t.id),
  );
  if (action.type === 'enter')
    return {
      ...state,
      active: true,
      lastEdit:
        state.lastEdit && samePoses(state.current, state.lastEdit.to) ? state.lastEdit : null,
    };
  if (action.type === 'exit') {
    if (state.pending)
      throw new Error('Apply or cancel the pending preview before leaving Try Mode.');
    return { ...state, active: false };
  }
  if (action.type === 'cancel') return { ...state, pending: null };
  if (action.type === 'lock')
    return {
      ...state,
      lockedIds: action.locked
        ? [...new Set([...state.lockedIds, ...action.teeth])]
        : state.lockedIds.filter(id => !action.teeth.includes(id)),
    };
  if (action.type === 'unrestricted') return { ...state, unrestricted: action.enabled };
  if (action.type === 'set-arch')
    return {
      ...state,
      archTargets: {
        ...state.archTargets,
        [action.arch]: { width: action.width, depth: action.depth },
      },
    };
  if (action.type === 'save-snapshot') {
    if (state.pending)
      throw new Error('Apply or cancel the pending preview before saving an arrangement.');
    const snapshots = state.snapshots.filter(
      item => item.name.toLowerCase() !== action.name.toLowerCase(),
    );
    if (snapshots.length >= 10) throw new Error('Keep at most 10 comparison snapshots.');
    return {
      ...state,
      snapshots: [...snapshots, { name: action.name, transforms: clone(state.current) }],
    };
  }
  if (action.type === 'delete-snapshot')
    return {
      ...state,
      snapshots: state.snapshots.filter(
        item => item.name.toLowerCase() !== action.name.toLowerCase(),
      ),
      comparisonName:
        state.comparisonName?.toLowerCase() === action.name.toLowerCase()
          ? null
          : state.comparisonName,
    };
  if (action.type === 'compare-snapshot') {
    const snapshot =
      action.name === null
        ? null
        : state.snapshots.find(item => item.name.toLowerCase() === action.name!.toLowerCase());
    if (action.name !== null && !snapshot)
      throw new Error(`Comparison snapshot “${action.name}” was not found.`);
    return { ...state, comparisonName: snapshot?.name || null };
  }
  if (action.type === 'save-group') {
    const groups = state.groups.filter(
      item => item.name.toLowerCase() !== action.name.toLowerCase(),
    );
    if (groups.length >= 10) throw new Error('Keep at most 10 custom groups.');
    return { ...state, groups: [...groups, { name: action.name, teeth: [...action.teeth] }] };
  }
  if (action.type === 'delete-group')
    return {
      ...state,
      groups: state.groups.filter(item => item.name.toLowerCase() !== action.name.toLowerCase()),
    };
  if (!state.active) throw new Error('Enter Try Mode to preview or apply an edit.');
  if (action.type === 'apply') {
    const preview = state.pending;
    if (!preview) throw new Error('Create a preview first.');
    assertTryUnlocked(state, preview.affectedIds);
    if (!samePoses(state.current, preview.currentAtPreview))
      throw new Error('The committed poses changed; rebuild the preview first.');
    if (
      !state.unrestricted &&
      (preview.collision.crossings.length || preview.collision.sampleLimitReached)
    )
      throw new Error(
        preview.collision.crossings.length
          ? 'The sampled path crosses another crown. Cancel or explicitly enable unrestricted mode.'
          : 'The path exceeded the sampling budget. Reduce the edit or explicitly enable unrestricted mode.',
      );
    return { ...state, current: clone(preview.to), pending: null, lastEdit: preview };
  }
  if (action.type === 'preview') {
    if (state.pending)
      throw new Error(
        'Apply or cancel the pending preview before starting another edit. Use Revise to replace its numeric amount.',
      );
    return { ...state, pending: makePreview(model, state, action.edit) };
  }
  if (action.type === 'revise') {
    const last = state.pending || state.lastEdit;
    if (!last) throw new Error('There is no last edit to revise.');
    if (!samePoses(state.current, state.pending ? last.currentAtPreview : last.to))
      throw new Error('The case changed after that edit; create a new preview.');
    return {
      ...state,
      pending: makePreview(
        model,
        state,
        revised(last.edit, action, last.baseEdit),
        last.from,
        last.baseEdit,
        true,
      ),
    };
  }
  if (action.type !== 'preview-original' && action.type !== 'preview-snapshot')
    throw new Error('Unsupported Try Mode action.');
  if (state.pending)
    throw new Error('Apply or cancel the pending preview before restoring a snapshot.');
  const snapshotName = 'name' in action ? action.name : '';
  const snapshot =
    action.type === 'preview-original'
      ? state.original || {}
      : state.snapshots.find(item => item.name.toLowerCase() === snapshotName.toLowerCase())
          ?.transforms;
  if (!snapshot) throw new Error(`Comparison snapshot “${snapshotName}” was not found.`);
  const changed = model.teeth.filter(
    tooth =>
      !samePoses(
        { [tooth.id]: state.current[tooth.id] || emptyPose() },
        { [tooth.id]: snapshot[tooth.id] || emptyPose() },
      ),
  );
  if (!changed.length) throw new Error('This snapshot already matches the committed arrangement.');
  const poses = Object.fromEntries(
    changed.map(tooth => [tooth.id, clone(snapshot[tooth.id] || emptyPose())]),
  );
  return {
    ...state,
    pending: makePreview(model, state, {
      type: 'poses',
      poses,
      label:
        action.type === 'preview-original' ? 'Restore original poses' : `Restore ${snapshotName}`,
    }),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: string[]) {
  if (Object.keys(value).length !== required.length || required.some(key => !(key in value)))
    throw new Error('Unexpected or missing Try Mode fields.');
}
function ids(value: unknown, available: readonly string[]) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 32 ||
    value.some(id => typeof id !== 'string' || !available.includes(id)) ||
    new Set(value).size !== value.length
  )
    throw new Error('Choose distinct available tooth IDs.');
  return [...value] as string[];
}
function name(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 60 ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new Error('Use a name containing 1–60 visible characters.');
  return value.trim();
}
function snapshotName(value: unknown) {
  const label = name(value);
  if (label.toLowerCase() === 'original')
    throw new Error(
      '“Original” is reserved for the built-in comparison. Choose another arrangement name.',
    );
  return label;
}
function poses(value: unknown, available: readonly string[]): Transforms {
  const source = object(value),
    output: Transforms = {};
  if (Object.keys(source).length > 32) throw new Error('Too many tooth poses.');
  for (const [id, pose] of Object.entries(source)) {
    if (
      !available.includes(id) ||
      !isPose(pose) ||
      Object.keys(pose).length !== 2 ||
      [...pose.translation, ...pose.rotation].some(v => Math.abs(v) > 1e5)
    )
      throw new Error('Invalid saved tooth pose.');
    output[id] = clone(pose);
  }
  return output;
}
function archTarget(value: unknown): ArchTarget {
  const target = object(value);
  keys(target, ['width', 'depth']);
  if (
    typeof target.width !== 'number' ||
    !Number.isFinite(target.width) ||
    target.width < 10 ||
    target.width > 120 ||
    typeof target.depth !== 'number' ||
    !Number.isFinite(target.depth) ||
    target.depth < 5 ||
    target.depth > 80
  )
    throw new Error('Ellipse width must be 10–120 mm and depth 5–80 mm.');
  return { width: target.width, depth: target.depth };
}
export function validateTryAction(value: unknown, availableIds: readonly string[]): TryAction {
  const action = object(value),
    type = action.type;
  const require = (...fields: string[]) => keys(action, ['type', ...fields]);
  if (['enter', 'exit', 'apply', 'cancel', 'preview-original'].includes(type as string)) {
    require();
    return { type } as TryAction;
  }
  if (type === 'revise') {
    require(
      ...('amount' in action ? ['amount', ...('unit' in action ? ['unit'] : [])] : ['factor']),
    );
    if ('amount' in action) {
      amount(action.amount as number, 180);
      if ('unit' in action && action.unit !== 'mm' && action.unit !== 'degrees')
        throw new Error('Revision units must be mm or degrees.');
    } else if (
      typeof action.factor !== 'number' ||
      !Number.isFinite(action.factor) ||
      action.factor <= 0 ||
      action.factor > 2
    )
      throw new Error('Revision factor must be above zero and at most two.');
    return clone(action) as TryAction;
  }
  if (type === 'lock') {
    require('teeth', 'locked');
    if (typeof action.locked !== 'boolean') throw new Error('Lock state must be boolean.');
    return { type, teeth: ids(action.teeth, availableIds), locked: action.locked };
  }
  if (type === 'unrestricted') {
    require('enabled');
    if (typeof action.enabled !== 'boolean') throw new Error('Unrestricted state must be boolean.');
    return { type, enabled: action.enabled };
  }
  if (type === 'set-arch') {
    require('arch', 'width', 'depth');
    if (action.arch !== 'upper' && action.arch !== 'lower')
      throw new Error('Name the upper or lower arch.');
    return { type, arch: action.arch, ...archTarget({ width: action.width, depth: action.depth }) };
  }
  if (type === 'compare-snapshot') {
    require('name');
    return { type, name: action.name === null ? null : name(action.name) };
  }
  if (
    ['save-snapshot', 'preview-snapshot', 'delete-snapshot', 'delete-group', 'save-group'].includes(
      type as string,
    )
  ) {
    require(...(type === 'save-group' ? ['name', 'teeth'] : ['name']));
    return {
      type,
      name: (type === 'save-group' || type === 'delete-group' ? name : snapshotName)(action.name),
      ...(type === 'save-group' ? { teeth: ids(action.teeth, availableIds) } : {}),
    } as TryAction;
  }
  if (type !== 'preview') throw new Error('Unsupported Try Mode action.');
  require('edit');
  const edit = object(action.edit),
    requireEdit = (...fields: string[]) => keys(edit, ['type', ...fields]);
  let result: TryEdit;
  if (edit.type === 'dental') {
    requireEdit('command');
    const command = validateCommand(edit.command, null, availableIds);
    if (
      !['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
        command.type,
      )
    )
      throw new Error('Try Mode previews accept only pose commands.');
    result = { type: 'dental', command: command as PoseCommand };
  } else if (edit.type === 'poses') {
    requireEdit('poses', 'label');
    result = { type: 'poses', poses: poses(edit.poses, availableIds), label: name(edit.label) };
    if (!Object.keys(result.poses).length) throw new Error('Supply at least one pose.');
  } else if (edit.type === 'segment-translate' || edit.type === 'segment-rotate') {
    requireEdit('teeth', 'axis', 'amount');
    if (!['x', 'y', 'z'].includes(edit.axis as string))
      throw new Error('Name a case X, Y, or Z axis.');
    amount(edit.amount as number, edit.type === 'segment-rotate' ? 180 : 10);
    result = {
      type: edit.type,
      teeth: ids(edit.teeth, availableIds),
      axis: edit.axis as Axis,
      amount: edit.amount as number,
    };
  } else if (edit.type === 'close-gap') {
    requireEdit('teeth', 'rule', 'gap');
    const teeth = ids(edit.teeth, availableIds);
    if (
      teeth.length !== 2 ||
      !['equal', 'first', 'second'].includes(edit.rule as string) ||
      typeof edit.gap !== 'number' ||
      !Number.isFinite(edit.gap) ||
      edit.gap < 0 ||
      edit.gap > 10
    )
      throw new Error(
        'Gap closure requires two teeth, an explicit distribution rule, and a 0–10 mm target gap.',
      );
    result = {
      type: edit.type,
      teeth: teeth as [string, string],
      rule: edit.rule as 'equal' | 'first' | 'second',
      gap: edit.gap,
    };
  } else if (edit.type === 'change-width') {
    requireEdit('teeth', 'amount');
    const teeth = ids(edit.teeth, availableIds);
    if (teeth.length !== 2) throw new Error('Centre-span change requires exactly two teeth.');
    result = {
      type: edit.type,
      teeth: teeth as [string, string],
      amount: amount(edit.amount as number, 10),
    };
  } else if (edit.type === 'fit-arch') {
    requireEdit('teeth', 'arch');
    if (edit.arch !== 'upper' && edit.arch !== 'lower')
      throw new Error('Name the upper or lower arch.');
    result = { type: edit.type, teeth: ids(edit.teeth, availableIds), arch: edit.arch };
  } else throw new Error('Unsupported Try Mode edit.');
  return { type: 'preview', edit: result };
}

/** Persistence intentionally excludes pending geometry work and stale last-edit previews. */
export function serializeTrySession(state: TryState): TrySession {
  return clone({
    active: state.active,
    original: state.original || {},
    lockedIds: state.lockedIds,
    unrestricted: state.unrestricted,
    archTargets: state.archTargets,
    snapshots: state.snapshots,
    groups: state.groups,
    comparisonName: state.comparisonName,
  });
}
export function validateTrySession(value: unknown, availableIds: readonly string[]): TrySession {
  const session = object(value);
  keys(session, [
    'active',
    'lockedIds',
    'unrestricted',
    'archTargets',
    'snapshots',
    'groups',
    'comparisonName',
    ...(Object.hasOwn(session, 'original') ? ['original'] : []),
  ]);
  const original = Object.hasOwn(session, 'original') ? poses(session.original, availableIds) : {};
  const lockedIds =
    Array.isArray(session.lockedIds) && session.lockedIds.length === 0
      ? []
      : ids(session.lockedIds, availableIds);
  if (typeof session.unrestricted !== 'boolean' || typeof session.active !== 'boolean')
    throw new Error('Invalid Try Mode state.');
  const targets = object(session.archTargets);
  keys(targets, ['upper', 'lower']);
  if (
    !Array.isArray(session.snapshots) ||
    session.snapshots.length > 10 ||
    !Array.isArray(session.groups) ||
    session.groups.length > 10
  )
    throw new Error('Keep at most ten snapshots and ten groups.');
  const snapshots = session.snapshots.map(raw => {
    const item = object(raw);
    keys(item, ['name', 'transforms']);
    return { name: snapshotName(item.name), transforms: poses(item.transforms, availableIds) };
  });
  const groups = session.groups.map(raw => {
    const item = object(raw);
    keys(item, ['name', 'teeth']);
    return { name: name(item.name), teeth: ids(item.teeth, availableIds) };
  });
  for (const collection of [snapshots, groups])
    if (new Set(collection.map(item => item.name.toLowerCase())).size !== collection.length)
      throw new Error('Saved names must be unique.');
  const comparisonName = session.comparisonName === null ? null : name(session.comparisonName);
  if (comparisonName !== null && !snapshots.some(item => item.name === comparisonName))
    throw new Error('The comparison snapshot does not exist.');
  return {
    active: session.active,
    original,
    lockedIds,
    unrestricted: session.unrestricted,
    archTargets: { upper: archTarget(targets.upper), lower: archTarget(targets.lower) },
    snapshots,
    groups,
    comparisonName,
  };
}
