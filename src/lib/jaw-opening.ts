import { Matrix4, Quaternion, Vector3 } from 'three';
import metadata from '../../public/models/forma-atlas-v1.json';

// Claude's Atlas model.js setJaw: rotate the mandible around the authored hinge.
// These display transforms never alter tooth poses or mechanics reference data.
const hinge = new Vector3().fromArray(metadata.jaw.hingePoint);
const rotation = new Quaternion().setFromAxisAngle(
  new Vector3().fromArray(metadata.jaw.hingeAxis).normalize(),
  (metadata.jaw.maxOpenDeg * Math.PI) / 180,
);
const inverseRotation = rotation.clone().invert();
const matrix = new Matrix4().makeRotationFromQuaternion(rotation);
matrix.setPosition(hinge.clone().sub(hinge.clone().applyQuaternion(rotation)));
const inverseMatrix = matrix.clone().invert();

/** Mutates the supplied display point; apply lower-arch separation afterwards. */
export function applyJawPoint(point: Vector3, jawOpen = false) {
  return jawOpen ? point.applyMatrix4(matrix) : point;
}

/** Remove lower-arch separation before recovering a canonical case-space point. */
export function inverseJawPoint(point: Vector3, jawOpen = false) {
  return jawOpen ? point.applyMatrix4(inverseMatrix) : point;
}

export function applyJawDirection(direction: Vector3, jawOpen = false) {
  return jawOpen ? direction.applyQuaternion(rotation) : direction;
}

export function applyJawQuaternion(quaternion: Quaternion, jawOpen = false) {
  return jawOpen ? quaternion.premultiply(rotation) : quaternion;
}

export function inverseJawQuaternion(quaternion: Quaternion, jawOpen = false) {
  return jawOpen ? quaternion.premultiply(inverseRotation) : quaternion;
}

export function applyJawMatrix(display: Matrix4, jawOpen = false) {
  return jawOpen ? display.premultiply(matrix) : display;
}
