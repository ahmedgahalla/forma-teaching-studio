import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { Command } from './commands';

export type Vec3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export type MovementDirection =
  'buccal' | 'lingual' | 'mesial' | 'distal' | 'intrude' | 'extrude' | Axis;

export type Tooth = {
  id: string;
  name: string;
  position: Vec3;
  buccal: Vec3;
  mesial: Vec3;
  /** Unit direction from root toward the biting surface, in the original case frame. */
  occlusal?: Vec3;
  calibrated: boolean;
  geometry?: unknown;
};

/** Millimetres and degrees, relative to the tooth's original pose. */
export type Pose = { translation: Vec3; rotation: Vec3 };
export type Transforms = Record<string, Pose>;

export function emptyPose(): Pose {
  return { translation: [0, 0, 0], rotation: [0, 0, 0] };
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(item => typeof item === 'number' && Number.isFinite(item))
  );
}

/** Validate poses restored from untrusted JSON before they enter the renderer. */
export function isPose(value: unknown): value is Pose {
  if (typeof value !== 'object' || value === null) return false;
  const pose = value as Partial<Pose>;
  return isVec3(pose.translation) && isVec3(pose.rotation);
}

function requirePose(pose: Pose): void {
  if (!isPose(pose))
    throw new Error('A pose must contain three finite translation and rotation values.');
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Movement values must be finite numbers.');
  return value;
}

function scaledUnit(vector: Vec3, amount: number): Vec3 {
  if (!isVec3(vector))
    throw new Error('This tooth has an invalid anatomical direction. Use X, Y, or Z.');
  const length = Math.hypot(...vector);
  if (!Number.isFinite(length) || length === 0) {
    throw new Error('This tooth has an invalid anatomical direction. Use X, Y, or Z.');
  }
  return vector.map(component => finite((component / length) * amount) || 0) as Vec3;
}

/** Normalize legacy frames, but never accept zero, skew, or nonfinite anatomical axes. */
export function anatomicalFrame(tooth: Tooth): { buccal: Vec3; mesial: Vec3; occlusal: Vec3 } {
  if (!tooth.calibrated) {
    throw new Error(
      'Anatomical movement requires a calibrated tooth frame. Use X, Y, or Z for this import.',
    );
  }
  const buccal = scaledUnit(tooth.buccal, 1);
  const mesial = scaledUnit(tooth.mesial, 1);
  // Saved v1 upper-only demos used +Y for extrusion; retain their convention.
  const occlusal = scaledUnit(tooth.occlusal ?? [0, 1, 0], 1);
  const dot = (a: Vec3, b: Vec3) => a.reduce((sum, component, i) => sum + component * b[i], 0);
  if (
    [dot(buccal, mesial), dot(buccal, occlusal), dot(mesial, occlusal)].some(
      value => Math.abs(value) > 0.001,
    )
  ) {
    throw new Error(
      'The calibrated anatomical axes must be perpendicular. Recalibrate this tooth or use X, Y, or Z.',
    );
  }
  return { buccal, mesial, occlusal };
}

/** Directions use the fixed case frame, not the tooth's current rotated frame. */
export function resolveMovement(tooth: Tooth, direction: MovementDirection, amount: number): Vec3 {
  finite(amount);
  if (direction === 'x') return [amount, 0, 0];
  if (direction === 'y') return [0, amount, 0];
  if (direction === 'z') return [0, 0, amount];
  const frame = anatomicalFrame(tooth);
  switch (direction) {
    case 'buccal':
      return scaledUnit(frame.buccal, amount);
    case 'lingual':
      return scaledUnit(frame.buccal, -amount);
    case 'mesial':
      return scaledUnit(frame.mesial, amount);
    case 'distal':
      return scaledUnit(frame.mesial, -amount);
    case 'intrude':
      return scaledUnit(frame.occlusal, -amount);
    case 'extrude':
      return scaledUnit(frame.occlusal, amount);
    default:
      throw new Error('Unsupported movement direction.');
  }
}

/** Pure helpers let history store complete before/after poses for exact undo. */
export function addMovement(pose: Pose, delta: Vec3): Pose {
  requirePose(pose);
  if (!isVec3(delta)) throw new Error('Movement must contain three finite values.');
  return {
    translation: pose.translation.map((value, i) =>
      finite(finite(value) + finite(delta[i])),
    ) as Vec3,
    rotation: [...pose.rotation],
  };
}

export function addRotation(pose: Pose, axis: Axis, amount: number): Pose {
  const index = { x: 0, y: 1, z: 2 }[axis];
  if (index === undefined) throw new Error('Rotation axis must be X, Y, or Z.');
  const vector: Vec3 = [0, 0, 0];
  vector[index] = 1;
  return composeRotation(pose, vector, amount);
}

/** Premultiplication applies each increment about a fixed case-frame axis. */
function composeRotation(pose: Pose, axis: Vec3, amount: number): Pose {
  requirePose(pose);
  finite(amount);
  const current = new Quaternion().setFromEuler(
    new Euler(...(pose.rotation.map(MathUtils.degToRad) as Vec3), 'XYZ'),
  );
  const increment = new Quaternion().setFromAxisAngle(
    new Vector3(...axis),
    MathUtils.degToRad(amount),
  );
  current.premultiply(increment).normalize();
  const euler = new Euler().setFromQuaternion(current, 'XYZ');
  return {
    translation: [...pose.translation],
    rotation: [euler.x, euler.y, euler.z].map(
      value => finite(MathUtils.radToDeg(value)) || 0,
    ) as Vec3,
  };
}

/**
 * Tip = buccolingual axis, torque = mesiodistal axis, rotate = long axis.
 * Positive degrees follow the right-hand rule about the named positive axis.
 * Axes stay in the ORIGINAL case frame; rotations compose in command order.
 * The pivot is the model origin, not an estimated center of resistance.
 * These are geometric transforms, not predicted movement under brace forces.
 */
export function addOrthodonticRotation(
  pose: Pose,
  tooth: Tooth,
  movement: 'tip' | 'torque' | 'rotate',
  amount: number,
): Pose {
  const frame = anatomicalFrame(tooth);
  const axis =
    movement === 'tip'
      ? frame.buccal
      : movement === 'torque'
        ? frame.mesial
        : movement === 'rotate'
          ? frame.occlusal
          : null;
  if (!axis) throw new Error('Unsupported orthodontic rotation.');
  return composeRotation(pose, axis, amount);
}

/** Apply a whole selection as one immutable transaction; any invalid tooth aborts it. */
export function applyDentalCommand(
  transforms: Transforms,
  teeth: readonly Tooth[],
  command: Command,
): Transforms {
  if (
    !['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(command.type)
  )
    return transforms;
  if (!('teeth' in command) && !('tooth' in command)) return transforms;
  const ids = [...new Set('teeth' in command ? command.teeth : [command.tooth])];
  if (!ids.length) throw new Error('Select at least one tooth.');
  if ('amount' in command) {
    const limit = command.type === 'move' || command.type === 'move_group' ? 10 : 180;
    if (!Number.isFinite(command.amount) || !command.amount || Math.abs(command.amount) > limit) {
      throw new Error(`Enter a finite nonzero amount between -${limit} and ${limit}.`);
    }
  }
  const updated: Transforms = { ...transforms };
  for (const id of ids) {
    const tooth = teeth.find(item => item.id === id);
    if (!tooth) throw new Error(`Tooth ${id} is not present in this case.`);
    const pose = transforms[id] ?? emptyPose();
    switch (command.type) {
      case 'move':
      case 'move_group':
        updated[id] = addMovement(pose, resolveMovement(tooth, command.direction, command.amount));
        break;
      case 'rotate':
      case 'rotate_group':
        updated[id] = addRotation(pose, command.axis, command.amount);
        break;
      case 'orthodontic':
        updated[id] = addOrthodonticRotation(pose, tooth, command.movement, command.amount);
        break;
      case 'reset':
        updated[id] = emptyPose();
        break;
    }
  }
  return updated;
}
