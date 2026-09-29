import * as THREE from 'three';
import type { Vec3 } from './model';
import type { MechanicsExperiment, MechanicsTooth } from './mechanics/types';
import { toothArch } from './appliances';
import { applyJawPoint } from './jaw-opening';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Schematic head, collar and threaded core; sizes are for teaching visibility, not placement. */
export function createTadScrews(metal: THREE.Material, collarMaterial: THREE.Material) {
  const merge = (parts: THREE.BufferGeometry[]) => {
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    return geometry;
  };
  const body = new THREE.CylinderGeometry(0.4, 0.18, 4.6, 16).translate(0, -2.9, 0);
  const thread = merge(
    Array.from({ length: 8 }, (_, i) =>
      new THREE.TorusGeometry(0.44 - i * 0.027, 0.075, 6, 16)
        .rotateX(Math.PI / 2)
        .translate(0, -0.9 - i * 0.55, 0),
    ),
  );
  const head = merge([
    new THREE.CylinderGeometry(0.9, 0.9, 0.3, 6).translate(0, 0.4, 0),
    new THREE.CylinderGeometry(0.32, 0.32, 0.65, 16),
    new THREE.CylinderGeometry(0.75, 0.75, 0.2, 16).translate(0, -0.4, 0),
  ]);
  const collar = new THREE.CylinderGeometry(0.52, 0.52, 0.35, 16).translate(0, -0.65, 0);
  const geometry = [body, thread, head, collar];
  const names = ['body', 'thread', 'head', 'collar'];
  const pool: THREE.Mesh[][] = [];
  const up = new THREE.Vector3(0, 1, 0),
    orientation = new THREE.Quaternion();
  return {
    place(
      index: number,
      id: string,
      position: THREE.Vector3,
      direction: THREE.Vector3,
      parent: THREE.Group,
    ) {
      // Reuse the same bounded pool through replay, hidden arches and changing TAD IDs.
      const parts = (pool[index] ??= geometry.map((shape, i) => {
        const mesh = new THREE.Mesh(shape, i === 3 ? collarMaterial : metal);
        mesh.castShadow = true;
        return mesh;
      }));
      orientation.setFromUnitVectors(up, direction);
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.userData.tadId !== id) {
          part.name = `tad-${id}-${names[i]}`;
          part.userData.tadId = id;
        }
        part.position.copy(position);
        part.quaternion.copy(orientation);
        parent.add(part);
      }
    },
    dispose() {
      geometry.forEach(shape => shape.dispose());
      pool.length = 0;
    },
  };
}

/** Same anatomical owner controls screw visibility, its axis, and lower-jaw display motion. */
export function nearestTadTooth(position: Vec3, teeth: readonly MechanicsTooth[]) {
  const distance = (tooth: MechanicsTooth) =>
    (tooth.position[0] - position[0]) ** 2 +
    (tooth.position[1] - position[1]) ** 2 +
    (tooth.position[2] - position[2]) ** 2;
  return teeth.reduce((best, tooth) => (distance(tooth) < distance(best) ? tooth : best));
}

/** Conservative local screw envelope; evaluated only when fitting the camera. */
export function* displayedTadPoints(
  experiment: MechanicsExperiment,
  ids: string[],
  opening: number,
  jawOpen: boolean,
) {
  const point = new THREE.Vector3(),
    axis = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0),
    rotation = new THREE.Quaternion();
  for (const tad of experiment.config.tads) {
    const tooth = nearestTadTooth(tad.position, experiment.reference.teeth);
    if (!ids.includes(tooth.id)) continue;
    rotation.setFromUnitVectors(up, axis.fromArray(tooth.buccal).normalize());
    for (const x of [-0.9, 0.9])
      for (const y of [-5.2, 0.55])
        for (const z of [-0.9, 0.9]) {
          point.set(x, y, z).applyQuaternion(rotation);
          point.x += tad.position[0];
          point.y += tad.position[1];
          point.z += tad.position[2];
          if (toothArch(tooth.id) === 'lower') applyJawPoint(point, jawOpen).y -= opening;
          yield point;
        }
  }
}
