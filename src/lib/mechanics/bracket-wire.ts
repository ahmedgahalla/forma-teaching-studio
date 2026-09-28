import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { Vec3 } from '../model';
import type { MechanicsConfig, MechanicsTooth } from './types';
import { add, norm, scale, sub } from './math';
import { MECHANICS_LIMITS as LIMIT } from './presets';

export function validateBracketAngles(config: MechanicsConfig, ids: readonly string[]) {
  const angles = config.bracketAngles;
  if (angles === undefined) return;
  if (
    !angles ||
    typeof angles !== 'object' ||
    Array.isArray(angles) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(angles))
  )
    throw new Error('Invalid bracket angles.');
  for (const [id, angle] of Object.entries(angles))
    if (
      !ids.includes(id) ||
      !Object.hasOwn(config.brackets, id) ||
      typeof angle !== 'number' ||
      !Number.isFinite(angle) ||
      Math.abs(angle) > LIMIT.bracketAngleDeg
    )
      throw new Error('Bracket angles require installed teeth and values within 10 degrees.');
}

export function setBracketAngle(config: MechanicsConfig, id: string, angle = 0) {
  if (angle) (config.bracketAngles ??= {})[id] = angle;
  else if (config.bracketAngles) {
    delete config.bracketAngles[id];
    if (!Object.keys(config.bracketAngles).length) delete config.bracketAngles;
  }
}

/** A changed bond site/slope loads only an engaged wire, against the immutable neutral slots. */
export function hasBracketWireActivation(
  config: MechanicsConfig,
  teeth: readonly Pick<MechanicsTooth, 'id' | 'bracketLocal'>[],
) {
  return config.wires.some(wire =>
    wire.teeth.some(id => {
      const neutral = teeth.find(tooth => tooth.id === id)!.bracketLocal;
      return !!config.bracketAngles?.[id] || norm(sub(config.brackets[id], neutral)) > 1e-10;
    }),
  );
}

/** Shared solve eligibility for the runtime and controls that refresh an existing response. */
export function hasMechanicsActivation(
  config: MechanicsConfig,
  teeth: readonly Pick<MechanicsTooth, 'id' | 'bracketLocal'>[],
) {
  return (
    config.wires.some(wire => wire.expansionMm !== 0 || wire.torqueDeg !== 0) ||
    hasBracketWireActivation(config, teeth) ||
    config.elastics.some(elastic => elastic.law.kind === 'spring' || elastic.law.forceN > 0) ||
    config.expanders.some(expander => expander.activationMm > 0)
  );
}

export function wireBracketReference(
  wire: MechanicsConfig['wires'][number],
  teeth: readonly MechanicsTooth[],
  current: readonly Vec3[],
) {
  const neutral = wire.teeth.map(id => {
    const tooth = teeth.find(item => item.id === id)!;
    const rotation = new Quaternion().setFromEuler(
      new Euler(...(tooth.rotation.map(MathUtils.degToRad) as Vec3)),
    );
    return add(
      tooth.position,
      new Vector3(...tooth.bracketLocal).applyQuaternion(rotation).toArray() as Vec3,
    );
  });
  const xs = neutral.map(point => point[0]),
    span = Math.max(...xs) - Math.min(...xs);
  const middle = (Math.max(...xs) + Math.min(...xs)) / 2;
  if (wire.expansionMm && span < 1)
    throw new Error(
      'Transverse wire expansion requires a span across at least 1 mm of the case X axis.',
    );
  const offsets = neutral.map((point, index) =>
    add(sub(point, current[index]), [
      span ? ((point[0] - middle) / span) * wire.expansionMm : 0,
      0,
      0,
    ]),
  );
  return { points: neutral, offsets };
}

/** Small-angle opposite end-slope target, about the posed outward buccal axis. */
export function bracketSlopeTarget(tooth: MechanicsTooth, config: MechanicsConfig): Vec3 {
  return scale(tooth.buccal, -MathUtils.degToRad(config.bracketAngles?.[tooth.id] ?? 0));
}
