import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DentalTooth } from './geometry';
import { anatomicalFrame, type Vec3 } from './model';

/** Schematic fixed appliance. Dimensions are display dimensions, not a bracket prescription. */
export function createApplianceKit() {
  const metal = new THREE.MeshStandardMaterial({
    color: '#bdc3c9',
    metalness: 0.9,
    roughness: 0.28,
  });
  const wire = new THREE.MeshStandardMaterial({
    color: '#d2d6da',
    metalness: 0.94,
    roughness: 0.21,
  });
  const ceramic = new THREE.MeshPhysicalMaterial({
    color: '#ede9df',
    metalness: 0,
    roughness: 0.31,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
  });
  const tie = new THREE.MeshStandardMaterial({ color: '#21a59a', roughness: 0.66 });
  const slot = new THREE.MeshStandardMaterial({
    color: '#656d74',
    metalness: 0.85,
    roughness: 0.36,
  });
  const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const baseGeometry = new RoundedBoxGeometry(3.6, 3.2, 0.55, 3, 0.2);
  // A narrow neck under a rounded cap makes the ligature undercut visible.
  // Merge shared parts to keep one mesh per wing and the existing seven-child bracket contract.
  const neck = new RoundedBoxGeometry(0.78, 0.56, 0.66, 2, 0.12);
  neck.translate(0, 0, -0.05);
  const cap = new RoundedBoxGeometry(1.24, 0.9, 0.36, 2, 0.13);
  cap.translate(0, 0, 0.28);
  const wingGeometry = mergeGeometries([neck, cap]);
  neck.dispose();
  cap.dispose();
  const slotGeometry = new RoundedBoxGeometry(2.9, 0.42, 0.16, 2, 0.05);
  const tieShape = new THREE.Shape();
  tieShape.absellipse(0, 0, 1.65, 1.23, 0, Math.PI * 2, false, 0);
  const tieCurve = new THREE.CatmullRomCurve3(
    tieShape.getPoints(56).map(p => new THREE.Vector3(p.x, p.y, 0.7)),
    true,
  );
  const tieGeometry = new THREE.TubeGeometry(tieCurve, 56, 0.15, 12, true);
  const groups: THREE.Group[] = [];
  function bracket(tooth: DentalTooth) {
    if (!tooth.calibrated) return null;
    const frame = anatomicalFrame(tooth),
      outward = new THREE.Vector3(...frame.buccal),
      up = new THREE.Vector3(...frame.occlusal);
    const right = new THREE.Vector3().crossVectors(up, outward).normalize();
    const position = tooth.bracketPosition
      ? new THREE.Vector3(...tooth.bracketPosition)
      : (() => {
          tooth.geometry.computeBoundingBox();
          const radius = tooth.geometry.boundingBox!.getSize(new THREE.Vector3()).length();
          const probe = new THREE.Mesh(tooth.geometry, probeMaterial);
          probe.updateMatrixWorld(true);
          const ray = new THREE.Raycaster(
            outward.clone().multiplyScalar(radius + 1),
            outward.clone().negate(),
          );
          const hit = ray.intersectObject(probe, false)[0];
          return hit ? hit.point.addScaledVector(outward, 0.28) : null;
        })();
    if (!position) return null;
    const group = new THREE.Group();
    group.position.copy(position);
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, outward));
    const base = new THREE.Mesh(baseGeometry, metal);
    base.castShadow = true;
    group.add(base);
    for (const x of [-0.95, 0.95])
      for (const y of [-0.85, 0.85]) {
        const wing = new THREE.Mesh(wingGeometry, metal);
        wing.position.set(x, y, 0.5);
        wing.castShadow = true;
        group.add(wing);
      }
    const groove = new THREE.Mesh(slotGeometry, slot);
    groove.position.z = 0.47;
    group.add(groove);
    const ligature = new THREE.Mesh(tieGeometry, tie);
    group.add(ligature);
    group.userData.anchor = position.clone().addScaledVector(outward, 0.67);
    groups.push(group);
    return group;
  }
  return {
    bracket,
    update(style: 'metal' | 'ceramic', color: string) {
      tie.color.set(color);
      groups.forEach(g =>
        g.children.slice(0, 5).forEach(child => {
          (child as THREE.Mesh).material = style === 'metal' ? metal : ceramic;
        }),
      );
    },
    wireMaterial: wire,
    dispose() {
      [metal, wire, ceramic, tie, slot, probeMaterial].forEach(m => m.dispose());
      [baseGeometry, wingGeometry, slotGeometry, tieGeometry].forEach(g => g.dispose());
    },
  };
}

export function orderedArchIds(ids: string[], arch: 'upper' | 'lower') {
  const first = arch === 'upper' ? '1' : '4',
    second = arch === 'upper' ? '2' : '3';
  return [
    ...ids.filter(id => id[0] === first).sort((a, b) => b.localeCompare(a)),
    ...ids.filter(id => id[0] === second).sort(),
  ];
}
export function toothArch(id: string): 'upper' | 'lower' {
  return Number(id[0]) <= 2 ? 'upper' : 'lower';
}
export type Landmark = { tooth: string; local: Vec3 };
