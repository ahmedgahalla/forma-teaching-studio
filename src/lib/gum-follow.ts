import {
  BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { DentalTooth, Gum } from './geometry';
import { gumInfluences } from './gum-influences';
import { createGumNormalUpdater } from './gum-normals';
import { inverseJawPoint, inverseJawQuaternion } from './jaw-opening';

/** Deform only a viewer-owned copy. Poses are the displayed poses, including any response magnification. */
export function createGumFollower(
  gum: Gum,
  teeth: DentalTooth[],
  geometry: BufferGeometry,
  groups: ReadonlyMap<string, Object3D>,
) {
  if (!geometry.index)
    geometry.setIndex(
      new BufferAttribute(
        Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i),
        1,
      ),
    );
  const { indices, weights, vertices } = gumInfluences(gum, teeth);
  const position = geometry.getAttribute('position'),
    normal = geometry.getAttribute('normal');
  const rest = new Float32Array(position.array),
    normals = createGumNormalUpdater(geometry);
  const marked = new Uint8Array(position.count),
    changedVertices = new Uint32Array(position.count);
  const matrices = teeth.map(() => new Matrix4()),
    previous = new Float64Array(teeth.length * 7).fill(NaN);
  const point = new Vector3(),
    moved = new Vector3(),
    unit = new Vector3(1, 1, 1);
  const pose = new Float64Array(7);
  const rotation = new Quaternion();
  return (opening: number, jawOpen = false) => {
    let changed = false,
      count = 0,
      atRest = true;
    for (let t = 0; t < teeth.length; t++) {
      const tooth = teeth[t],
        group = groups.get(tooth.id)!;
      point.copy(group.position);
      rotation.copy(group.quaternion);
      if (gum.arch === 'lower') {
        point.y += opening;
        inverseJawPoint(point, jawOpen);
        inverseJawQuaternion(rotation, jawOpen);
      }
      pose[0] = point.x - tooth.position[0];
      pose[1] = point.y - tooth.position[1];
      pose[2] = point.z - tooth.position[2];
      pose[3] = rotation.x;
      pose[4] = rotation.y;
      pose[5] = rotation.z;
      pose[6] = rotation.w;
      let toothChanged = false;
      for (let c = 0; c < 7; c++) {
        if (Math.abs(pose[c]) < 1e-12) pose[c] = 0;
        if (c === 6 && Math.abs(pose[c] - 1) < 1e-12) pose[c] = 1;
        if (pose[c] !== previous[t * 7 + c]) toothChanged = true;
        previous[t * 7 + c] = pose[c];
        if (pose[c] !== (c === 6 ? 1 : 0)) atRest = false;
      }
      if (toothChanged) {
        changed = true;
        for (let i = 0; i < vertices[t].length; i++) {
          const vertex = vertices[t][i];
          if (!marked[vertex]) {
            marked[vertex] = 1;
            changedVertices[count++] = vertex;
          }
        }
      }
      point.set(
        tooth.position[0] + pose[0],
        tooth.position[1] + pose[1],
        tooth.position[2] + pose[2],
      );
      const matrix = matrices[t].compose(point, rotation, unit),
        e = matrix.elements;
      const [x, y, z] = tooth.position;
      e[12] -= e[0] * x + e[4] * y + e[8] * z;
      e[13] -= e[1] * x + e[5] * y + e[9] * z;
      e[14] -= e[2] * x + e[6] * y + e[10] * z;
    }
    if (!changed) return false;
    if (atRest) {
      position.array.set(rest);
      normals.reset();
    } else {
      for (let i = 0; i < count; i++) {
        const vertex = changedVertices[i];
        const offset = vertex * 3;
        point.fromArray(rest, offset);
        point.x += gum.position[0];
        point.y += gum.position[1];
        point.z += gum.position[2];
        let x = rest[offset],
          y = rest[offset + 1],
          z = rest[offset + 2];
        for (let slot = 0; slot < 3; slot++) {
          const weight = weights[offset + slot];
          if (!weight) continue;
          moved
            .copy(point)
            .applyMatrix4(matrices[indices[offset + slot]])
            .sub(point);
          x += moved.x * weight;
          y += moved.y * weight;
          z += moved.z * weight;
        }
        position.setXYZ(vertex, x, y, z);
      }
      normals.update(changedVertices, count);
    }
    for (let i = 0; i < count; i++) marked[changedVertices[i]] = 0;
    position.needsUpdate = true;
    normal.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return true;
  };
}
