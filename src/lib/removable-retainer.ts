import * as THREE from 'three';
import type { DentalCase, DentalTooth } from './geometry';
import { anatomicalFrame, type Transforms } from './model';
import { orderedArchIds, toothArch } from './appliances';
import { toothMatrix } from './analysis';

type Options = {
  visible: boolean;
  arch?: 'both' | 'upper' | 'lower';
  opening?: number;
  cutaway?: boolean;
};
type Vertex = { point: THREE.Vector3; normal: THREE.Vector3 };

/** A trimmed, offset crown envelope for display, not a manufacturable retainer. */
function pocket(tooth: DentalTooth) {
  const frame = anatomicalFrame(tooth),
    axis = new THREE.Vector3(...frame.occlusal),
    buccal = new THREE.Vector3(...frame.buccal);
  const source = tooth.geometry,
    positions = source.getAttribute('position'),
    normals = source.getAttribute('normal');
  let cervical = Infinity;
  for (let i = 0; i < positions.count; i++)
    cervical = Math.min(cervical, new THREE.Vector3().fromBufferAttribute(positions, i).dot(axis));
  cervical += 0.65;
  const surface: number[] = [],
    surfaceNormals: number[] = [],
    margin: number[] = [],
    ring: THREE.Vector3[] = [];
  const read = (index: number): Vertex => ({
    point: new THREE.Vector3().fromBufferAttribute(positions, index),
    normal: new THREE.Vector3().fromBufferAttribute(normals, index).normalize(),
  });
  const offset = (vertex: Vertex) => vertex.point.clone().addScaledVector(vertex.normal, 0.23);
  const index = source.index,
    count = index?.count ?? positions.count;
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(j => read(index ? index.getX(i + j) : i + j)),
      clipped: Vertex[] = [],
      crossings: Vertex[] = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j],
        b = triangle[(j + 1) % 3],
        da = a.point.dot(axis) - cervical,
        db = b.point.dot(axis) - cervical;
      if (da >= 0) clipped.push(a);
      if (da >= 0 !== db >= 0) {
        const fraction = da / (da - db),
          cut = {
            point: a.point.clone().lerp(b.point, fraction),
            normal: a.normal.clone().lerp(b.normal, fraction).normalize(),
          };
        clipped.push(cut);
        crossings.push(cut);
      }
    }
    for (let j = 1; j < clipped.length - 1; j++)
      for (const vertex of [clipped[0], clipped[j], clipped[j + 1]]) {
        surface.push(...offset(vertex).toArray());
        surfaceNormals.push(...vertex.normal.toArray());
      }
    if (crossings.length === 2) {
      const a = offset(crossings[0]),
        b = offset(crossings[1]);
      margin.push(...a.toArray(), ...b.toArray());
      ring.push(a, b);
    }
  }
  if (!surface.length || !ring.length)
    throw new Error(`The clear-retainer illustration cannot follow crown ${tooth.id}.`);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(surfaceNormals, 3));
  const edge = new THREE.BufferGeometry();
  edge.setAttribute('position', new THREE.Float32BufferAttribute(margin, 3));
  const sorted = ring.sort((a, b) => a.dot(buccal) - b.dot(buccal));
  return { geometry, edge, inner: sorted[0].clone(), outer: sorted[sorted.length - 1].clone() };
}

/**
 * Transparent removable-retainer illustration, distinct from a fixed lingual wire.
 * Each trimmed crown envelope follows its displayed crown. Connecting cervical
 * ribbons are schematic; no offset/undercut/fit or manufacturing solver is implied.
 * Source meshes are borrowed read-only. All generated resources belong to this kit.
 */
export function createRemovableRetainer(model: DentalCase) {
  const group = new THREE.Group();
  group.name = 'schematic-removable-retainer';
  group.visible = false;
  group.userData = { schematic: true, removable: true, manufacturing: false };
  const surfaces = new THREE.MeshPhysicalMaterial({
    color: '#9cdeeb',
    transparent: true,
    opacity: 0.21,
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    transmission: 0.12,
    thickness: 0.25,
    ior: 1.46,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const edges = new THREE.LineBasicMaterial({
    color: '#96e0ee',
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const geometries: THREE.BufferGeometry[] = [],
    teeth = new Map<
      string,
      { tooth: DentalTooth; group: THREE.Group; inner: THREE.Vector3; outer: THREE.Vector3 }
    >();
  const arches: {
    group: THREE.Group;
    arch: 'upper' | 'lower';
    ids: string[];
    bridge: THREE.BufferGeometry;
    border: THREE.BufferGeometry;
  }[] = [];
  let built = false,
    disposed = false;
  function build() {
    for (const arch of ['upper', 'lower'] as const) {
      const archGroup = new THREE.Group();
      archGroup.name = `clear-retainer-${arch}`;
      group.add(archGroup);
      const ids = orderedArchIds(
        model.teeth.filter(tooth => toothArch(tooth.id) === arch).map(tooth => tooth.id),
        arch,
      );
      for (const id of ids) {
        const tooth = model.teeth.find(item => item.id === id)!,
          shape = pocket(tooth),
          local = new THREE.Group();
        local.name = `retainer-crown-${id}`;
        local.matrixAutoUpdate = false;
        const shell = new THREE.Mesh(shape.geometry, surfaces),
          edge = new THREE.LineSegments(shape.edge, edges);
        shell.renderOrder = 6;
        edge.renderOrder = 7;
        shell.name = `clear-pocket-${id}`;
        edge.name = `clear-margin-${id}`;
        local.add(shell, edge);
        archGroup.add(local);
        geometries.push(shape.geometry, shape.edge);
        teeth.set(id, { tooth, group: local, inner: shape.inner, outer: shape.outer });
      }
      const joins = Math.max(0, ids.length - 1),
        bridge = new THREE.BufferGeometry(),
        border = new THREE.BufferGeometry();
      bridge.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array(joins * 18), 3),
      );
      border.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array(joins * 12), 3),
      );
      const joined = new THREE.Mesh(bridge, surfaces),
        trim = new THREE.LineSegments(border, edges);
      joined.name = `clear-joins-${arch}`;
      trim.name = `clear-border-${arch}`;
      joined.renderOrder = 6;
      trim.renderOrder = 7;
      archGroup.add(joined, trim);
      geometries.push(bridge, border);
      arches.push({ group: archGroup, arch, ids, bridge, border });
    }
    built = true;
  }
  function update(transforms: Transforms, options: Options) {
    if (disposed) return;
    group.visible = model.demo && options.visible && !options.cutaway;
    if (!group.visible) return;
    if (!built) build();
    const opening = options.opening ?? 0;
    for (const item of teeth.values()) {
      item.group.matrix.copy(toothMatrix(item.tooth, transforms));
      if (toothArch(item.tooth.id) === 'lower') item.group.matrix.elements[13] -= opening;
    }
    for (const arch of arches) {
      arch.group.visible = !options.arch || options.arch === 'both' || options.arch === arch.arch;
      const positions = arch.bridge.getAttribute('position'),
        border = arch.border.getAttribute('position');
      for (let i = 0; i < arch.ids.length - 1; i++) {
        const a = teeth.get(arch.ids[i])!,
          b = teeth.get(arch.ids[i + 1])!;
        const outerA = a.outer.clone().applyMatrix4(a.group.matrix),
          innerA = a.inner.clone().applyMatrix4(a.group.matrix),
          outerB = b.outer.clone().applyMatrix4(b.group.matrix),
          innerB = b.inner.clone().applyMatrix4(b.group.matrix);
        [outerA, innerA, outerB, outerB, innerA, innerB].forEach((point, j) =>
          positions.setXYZ(i * 6 + j, point.x, point.y, point.z),
        );
        [outerA, outerB, innerA, innerB].forEach((point, j) =>
          border.setXYZ(i * 4 + j, point.x, point.y, point.z),
        );
      }
      positions.needsUpdate = true;
      border.needsUpdate = true;
      arch.bridge.computeVertexNormals();
      arch.bridge.computeBoundingSphere();
      arch.border.computeBoundingSphere();
    }
    group.updateMatrixWorld(true);
  }
  return {
    group,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.visible = false;
      group.clear();
      geometries.forEach(geometry => geometry.dispose());
      surfaces.dispose();
      edges.dispose();
      teeth.clear();
      arches.length = 0;
    },
  };
}
