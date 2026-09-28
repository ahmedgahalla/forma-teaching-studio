import { DoubleSide, Group, MathUtils, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import type { DentalTooth } from './geometry';
import { anatomicalFrame, type Vec3 } from './model';
import { MECHANICS_LIMITS as LIMIT } from './mechanics/presets';

/** Bonding-base and slot distances match the existing schematic appliance kit. */
const BASE_CLEARANCE = 0.28,
  SLOT_FROM_BASE = 0.67;

function surfacePoint(tooth: DentalTooth, through: Vector3, outward: Vector3) {
  tooth.geometry.computeBoundingBox();
  const reach = tooth.geometry.boundingBox!.getSize(new Vector3()).length() + 1;
  const material = new MeshBasicMaterial({ side: DoubleSide });
  try {
    const probe = new Mesh(tooth.geometry, material);
    probe.updateMatrixWorld(true);
    const origin = through.clone().addScaledVector(outward, reach);
    const hit = new Raycaster(origin, outward.clone().negate()).intersectObject(probe, false)[0];
    if (!hit) throw new Error(`Tooth ${tooth.id} has no buccal surface at this bracket location.`);
    return hit.point;
  } finally {
    material.dispose();
  }
}

/** Slot centre in the tooth's original local frame; unchanged by reference tooth poses. */
export function bracketSlotLocal(tooth: DentalTooth): Vec3 {
  const outward = new Vector3(...anatomicalFrame(tooth).buccal);
  const base = tooth.bracketPosition
    ? new Vector3(...tooth.bracketPosition)
    : surfacePoint(tooth, new Vector3(), outward).addScaledVector(outward, BASE_CLEARANCE);
  const slot = base.addScaledVector(outward, SLOT_FROM_BASE).toArray() as Vec3;
  if (slot.some(value => !Number.isFinite(value) || Math.abs(value) > LIMIT.localPointMm))
    throw new Error('The bracket slot is outside the mechanical attachment domain.');
  return slot;
}

/** Signed mesial and occlusal mm from the authored bonding site, projected onto its crown. */
export function bracketPlacementLocal(
  tooth: DentalTooth,
  mesialMm: number,
  occlusalMm: number,
): Vec3 {
  if (
    [mesialMm, occlusalMm].some(
      value => !Number.isFinite(value) || Math.abs(value) > LIMIT.bracketOffsetMm,
    )
  )
    throw new Error(`Bracket position offsets must be within ${LIMIT.bracketOffsetMm} mm.`);
  const neutral = bracketSlotLocal(tooth);
  if (!mesialMm && !occlusalMm) return neutral;
  const frame = anatomicalFrame(tooth),
    outward = new Vector3(...frame.buccal);
  const through = new Vector3(...neutral)
    .addScaledVector(new Vector3(...frame.mesial), mesialMm)
    .addScaledVector(new Vector3(...frame.occlusal), occlusalMm);
  return surfacePoint(tooth, through, outward)
    .addScaledVector(outward, BASE_CLEARANCE + SLOT_FROM_BASE)
    .toArray() as Vec3;
}

export function bracketPlacementOffsets(tooth: DentalTooth, local: Vec3) {
  const frame = anatomicalFrame(tooth);
  const delta = new Vector3(...local).sub(new Vector3(...bracketSlotLocal(tooth)));
  return {
    mesialMm: delta.dot(new Vector3(...frame.mesial)),
    occlusalMm: delta.dot(new Vector3(...frame.occlusal)),
  };
}

/** Capture once when the bracket is built; updates preserve the slot centre and allocate nothing. */
export function createBracketPlacementUpdater(bracket: Group) {
  const basePosition = bracket.position.clone(),
    baseRotation = bracket.quaternion.clone();
  const slotOffset = new Vector3(0, 0, SLOT_FROM_BASE).applyQuaternion(baseRotation);
  return (local?: Vec3, angleDeg = 0) => {
    bracket.quaternion.copy(baseRotation);
    bracket.rotateZ(MathUtils.degToRad(angleDeg));
    if (local) bracket.position.fromArray(local).sub(slotOffset);
    else bracket.position.copy(basePosition);
  };
}
