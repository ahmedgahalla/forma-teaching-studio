import {
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  Vector3,
} from 'three';
import { anatomicalFrame, type Vec3 } from './model';
import type { DentalCase, DentalTooth } from './geometry';

export const ATLAS_ASSET_URL = '/models/forma-atlas-v1.glb';
export const ATLAS_METADATA_URL = '/models/forma-atlas-v1.json';
export const ATLAS_ASSET_ID = 'claude-atlas-v1' as const;
const SOURCE_IDS = ['1', '2', '3', '4'].flatMap(q =>
  Array.from({ length: 8 }, (_, i) => `${q}${i + 1}`),
);
export const ATLAS_TEACHING_IDS = SOURCE_IDS.filter(id => !id.endsWith('8'));
type AtlasTooth = { node: string; buccalDir: Vec3; mesialDir: Vec3; apicalAxis: Vec3 };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid atlas metadata.');
  return value as Record<string, unknown>;
}
function direction(value: unknown): Vec3 {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1.001)
  )
    throw new Error('Invalid atlas anatomical direction.');
  return [...value] as Vec3;
}
export function validateAtlasMetadata(raw: unknown): Record<string, AtlasTooth> {
  const value = record(raw),
    teeth = record(value.teeth);
  if (
    value.version !== 1 ||
    value.units !== 'mm' ||
    Object.keys(teeth).length !== 32 ||
    record(value.arches).upper !== 'upper_jaw' ||
    record(value.arches).lower !== 'lower_jaw' ||
    record(value.gums).upper !== 'gum_upper' ||
    record(value.gums).lower !== 'gum_lower'
  )
    throw new Error('The atlas must contain 32 identified teeth and two arches in millimetres.');
  return Object.fromEntries(
    SOURCE_IDS.map(id => {
      const tooth = record(teeth[id]);
      if (
        tooth.node !== `tooth_${id}` ||
        tooth.fdi !== id ||
        tooth.arch !== (Number(id[0]) < 3 ? 'upper' : 'lower')
      )
        throw new Error(`Invalid atlas tooth ${id}.`);
      const result = {
        node: tooth.node,
        buccalDir: direction(tooth.buccalDir),
        mesialDir: direction(tooth.mesialDir),
        apicalAxis: direction(tooth.apicalAxis),
      };
      anatomicalFrame({
        id,
        name: id,
        position: [0, 0, 0],
        calibrated: true,
        buccal: result.buccalDir,
        mesial: result.mesialDir,
        occlusal: result.apicalAxis.map(n => -n) as Vec3,
      });
      return [id, result];
    }),
  );
}

/** Preserve the producer's surfaces and data; only convert world coordinates to Forma's crown pivot. */
export function dentalCaseFromAtlas(scene: Object3D, raw: unknown): DentalCase {
  const metadata = validateAtlasMetadata(raw),
    owned: BufferGeometry[] = [];
  const nodes = new Map<string, Object3D>();
  scene.updateMatrixWorld(true);
  scene.traverse(node => {
    if (!node.name) return;
    if (nodes.has(node.name)) throw new Error(`Duplicate atlas node: ${node.name}.`);
    nodes.set(node.name, node);
  });
  const meshFor = (name: string, tissue: string) => {
    const node = nodes.get(name),
      matches: Mesh[] = [];
    if (!node) throw new Error(`Missing atlas node: ${name}.`);
    node.traverse(child => {
      const mesh = child as Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === tissue)
        matches.push(mesh);
    });
    if (matches.length !== 1) throw new Error(`The atlas needs one ${tissue} mesh for ${name}.`);
    return matches[0];
  };
  const take = (mesh: Mesh, maximum: number) => {
    const geometry = mesh.geometry.clone();
    owned.push(geometry);
    const position = geometry.getAttribute('position');
    if (
      !position ||
      !(position.array instanceof Float32Array) ||
      position.count < 3 ||
      position.count > 600_000
    )
      throw new Error('The atlas requires its unquantized source geometry.');
    for (const [name, size] of [
      ['normal', 3],
      ['color', 3],
      ['color_1', 4],
      ['uv', 2],
    ] as const) {
      const attribute = geometry.getAttribute(name);
      if (!attribute || attribute.count !== position.count || attribute.itemSize !== size)
        throw new Error(`Atlas surface data is missing: ${name}.`);
      for (let i = 0; i < attribute.count; i++)
        for (let c = 0; c < size; c++)
          if (!Number.isFinite(attribute.getComponent(i, c)))
            throw new Error(`Invalid atlas attribute: ${name}.`);
    }
    if (
      !geometry.index ||
      geometry.index.count % 3 ||
      Array.from(geometry.index.array).some(i => i < 0 || i >= position.count)
    )
      throw new Error('Invalid atlas triangles.');
    geometry.applyMatrix4(mesh.matrixWorld);
    if (!Array.from(position.array).every(Number.isFinite))
      throw new Error('Invalid atlas coordinates.');
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const extent = geometry.boundingBox!.getSize(new Vector3()).length();
    if (extent < 0.1 || extent > maximum) throw new Error('Check atlas millimetre dimensions.');
    geometry.setAttribute('dentalData', geometry.getAttribute('color_1'));
    return geometry;
  };
  const probeMaterial = new MeshBasicMaterial({ side: DoubleSide });
  try {
    for (const id of SOURCE_IDS) {
      meshFor(metadata[id].node, 'enamel');
      meshFor(metadata[id].node, 'cementum');
    }
    // The complete 32-tooth source remains bundled. Current authored cases use the established 28-tooth set.
    const teeth = ATLAS_TEACHING_IDS.map(id => {
      const info = metadata[id],
        crown = meshFor(info.node, 'enamel');
      const geometry = take(crown, 60),
        rootGeometry = take(meshFor(info.node, 'cementum'), 60);
      const pivot = geometry.boundingBox!.getCenter(new Vector3()),
        position = pivot.toArray() as Vec3;
      for (const part of [geometry, rootGeometry]) {
        part.translate(-pivot.x, -pivot.y, -pivot.z);
        part.computeBoundingBox();
        part.computeBoundingSphere();
      }
      const buccal = new Vector3(...info.buccalDir).normalize();
      const probe = new Mesh(geometry, probeMaterial),
        reach = geometry.boundingBox!.getSize(new Vector3()).length() + 1;
      probe.updateMatrixWorld(true);
      const hit = new Raycaster(
        buccal.clone().multiplyScalar(reach),
        buccal.clone().negate(),
      ).intersectObject(probe, false)[0];
      if (!hit) throw new Error(`The atlas crown has no buccal attachment surface: ${id}.`);
      const name = nodes.get(info.node)!.userData.name;
      return {
        id,
        name: typeof name === 'string' ? name.slice(0, 120) : `Tooth ${id}`,
        position,
        buccal: info.buccalDir,
        mesial: info.mesialDir,
        occlusal: info.apicalAxis.map(n => -n) as Vec3,
        calibrated: true,
        geometry,
        rootGeometry,
        bracketPosition: hit.point.addScaledVector(buccal, 0.28).toArray() as Vec3,
      } satisfies DentalTooth;
    });
    const gums = (['upper', 'lower'] as const).map(arch => ({
      id: `gum_${arch}`,
      arch,
      position: [0, 0, 0] as Vec3,
      geometry: take(meshFor(`gum_${arch}`, 'gingiva'), 200),
    }));
    return { name: 'Forma dentition atlas', demo: true, asset: ATLAS_ASSET_ID, teeth, gums };
  } catch (error) {
    owned.forEach(geometry => geometry.dispose());
    throw error;
  } finally {
    probeMaterial.dispose();
  }
}
