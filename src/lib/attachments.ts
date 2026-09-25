import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { anatomicalFrame } from './model';
import type { DentalTooth } from './geometry';

/** Teaching geometry only. These dimensions are software limits, not a prescription. */
export type AttachmentSpec = {
  shape: 'rectangle' | 'ellipsoid' | 'beveled';
  width: number;
  height: number;
  depth: number;
  offsetMesial: number;
  offsetOcclusal: number;
  /** Right-hand rotation about the original buccal axis, in degrees. */
  rotation: number;
};

export function validateAttachment(value: unknown): AttachmentSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid attachment settings.');
  const spec = value as AttachmentSpec;
  if (!['rectangle', 'ellipsoid', 'beveled'].includes(spec.shape))
    throw new Error('Choose a rectangular, ellipsoid, or beveled attachment.');
  for (const key of ['width', 'height', 'depth'] as const) {
    if (
      typeof spec[key] !== 'number' ||
      !Number.isFinite(spec[key]) ||
      spec[key] < 0.2 ||
      spec[key] > 6
    )
      throw new Error('Attachment dimensions must be between 0.2 and 6 mm.');
  }
  for (const key of ['offsetMesial', 'offsetOcclusal'] as const) {
    if (typeof spec[key] !== 'number' || !Number.isFinite(spec[key]) || Math.abs(spec[key]) > 5)
      throw new Error('Attachment offsets must be between −5 and 5 mm.');
  }
  if (
    typeof spec.rotation !== 'number' ||
    !Number.isFinite(spec.rotation) ||
    Math.abs(spec.rotation) > 180
  )
    throw new Error('Attachment rotation must be between −180 and 180 degrees.');
  return {
    shape: spec.shape,
    width: spec.width,
    height: spec.height,
    depth: spec.depth,
    offsetMesial: spec.offsetMesial,
    offsetOcclusal: spec.offsetOcclusal,
    rotation: spec.rotation,
  };
}

function ellipsoid(width: number, height: number, depth: number): THREE.BufferGeometry {
  const sides = 32,
    rings = 16,
    positions: number[] = [],
    indices: number[] = [];
  for (let j = 0; j < rings; j++) {
    const angle = ((j / rings) * Math.PI) / 2,
      radius = Math.cos(angle);
    for (let k = 0; k < sides; k++) {
      const theta = (k / sides) * Math.PI * 2;
      positions.push(
        (width / 2) * radius * Math.cos(theta),
        (height / 2) * radius * Math.sin(theta),
        depth * Math.sin(angle),
      );
    }
    if (j)
      for (let k = 0; k < sides; k++) {
        const previous = (j - 1) * sides,
          current = j * sides,
          next = (k + 1) % sides;
        indices.push(
          previous + k,
          previous + next,
          current + k,
          previous + next,
          current + next,
          current + k,
        );
      }
  }
  const top = positions.length / 3;
  positions.push(0, 0, depth);
  const bottom = positions.length / 3;
  positions.push(0, 0, 0);
  for (let k = 0; k < sides; k++) {
    const next = (k + 1) % sides;
    indices.push((rings - 1) * sides + k, (rings - 1) * sides + next, top);
    indices.push(bottom, next, k);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Closed attachment mesh in the crown's ORIGINAL local frame. Parent it under the
 * tooth group so its pose follows the crown exactly. The caller owns/disposes it.
 * The base is planar and embedded 0.03 mm at its centre; no bonding simulation,
 * mesh union, force calculation, or manufacturing-ready surface is implied.
 */
export function createAttachmentGeometry(
  tooth: DentalTooth,
  value: AttachmentSpec,
): THREE.BufferGeometry {
  const spec = validateAttachment(value);
  if (!tooth.calibrated)
    throw new Error(`Calibrate tooth ${tooth.id} before placing an attachment.`);
  const frame = anatomicalFrame(tooth),
    buccal = new THREE.Vector3(...frame.buccal),
    occlusal = new THREE.Vector3(...frame.occlusal);
  const right = new THREE.Vector3().crossVectors(occlusal, buccal).normalize();
  const offset = new THREE.Vector3(...frame.mesial)
    .multiplyScalar(spec.offsetMesial)
    .addScaledVector(occlusal, spec.offsetOcclusal);
  tooth.geometry.computeBoundingBox();
  const box = tooth.geometry.boundingBox!;
  const reach =
    box.getSize(new THREE.Vector3()).length() + box.getCenter(new THREE.Vector3()).length() + 1;
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  let surface: THREE.Vector3 | undefined;
  try {
    const probe = new THREE.Mesh(tooth.geometry, material);
    probe.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(
      offset.clone().addScaledVector(buccal, reach),
      buccal.clone().negate(),
    );
    surface = ray.intersectObject(probe, false)[0]?.point;
  } finally {
    material.dispose();
  }
  if (!surface)
    throw new Error(
      `Attachment position misses tooth ${tooth.id}. Reduce the mesial or occlusal offset.`,
    );
  const geometry =
    spec.shape === 'ellipsoid'
      ? ellipsoid(spec.width, spec.height, spec.depth)
      : spec.shape === 'beveled'
        ? new RoundedBoxGeometry(
            spec.width,
            spec.height,
            spec.depth,
            2,
            Math.min(spec.width, spec.height, spec.depth) * 0.18,
          )
        : new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
  if (spec.shape !== 'ellipsoid') geometry.translate(0, 0, spec.depth / 2);
  geometry.translate(0, 0, -0.03);
  geometry.rotateZ(THREE.MathUtils.degToRad(spec.rotation));
  geometry.applyMatrix4(
    new THREE.Matrix4().makeBasis(right, occlusal, buccal).setPosition(surface),
  );
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
