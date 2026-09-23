import { BufferGeometry, Mesh, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { anatomicalFrame, type Vec3 } from './model';
import type { DentalCase, DentalTooth, Gum } from './geometry';

export const TEACHING_ASSET_URL = '/models/forma-teaching-v1.glb';
export const TEACHING_METADATA_URL = '/models/forma-teaching-v1.json';
const IDS = ['1', '2', '3', '4'].flatMap(quadrant => Array.from({ length: 7 }, (_, i) => `${quadrant}${i + 1}`));
type ToothMetadata = Omit<DentalTooth, 'geometry' | 'rootGeometry' | 'attachment'> & { crownMesh: string; rootMesh: string };
type GumMetadata = Omit<Gum, 'geometry'> & { mesh: string };
export type AnatomyMetadata = { version: 1; name: string; units: 'mm'; teeth: ToothMetadata[]; gums: GumMetadata[] };

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid teaching asset metadata.');
  return value as Record<string, unknown>;
};
const vector = (value: unknown): Vec3 => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 250)) throw new Error('Invalid teaching asset coordinates.');
  return [...value] as Vec3;
};
const text = (value: unknown): string => {
  if (typeof value !== 'string' || !value.length || value.length > 120) throw new Error('Invalid teaching asset name.');
  return value;
};

/** This schema is for the bundled synthetic asset, never for inferred patient anatomy. */
export function validateAnatomyMetadata(raw: unknown): AnatomyMetadata {
  const value = record(raw);
  if (value.version !== 1 || value.units !== 'mm' || !Array.isArray(value.teeth) || value.teeth.length !== 28 || !Array.isArray(value.gums) || value.gums.length !== 2) throw new Error('The teaching asset must contain 28 teeth and two gingival meshes in millimetres.');
  const teeth = value.teeth.map(item => {
    const t = record(item), id = text(t.id);
    if (!IDS.includes(id) || t.calibrated !== true) throw new Error('The teaching asset has an invalid tooth identifier or frame.');
    const tooth: ToothMetadata = { id, name: text(t.name), calibrated: true, position: vector(t.position), buccal: vector(t.buccal), mesial: vector(t.mesial), occlusal: vector(t.occlusal), bracketPosition: vector(t.bracketPosition), crownMesh: text(t.crownMesh), rootMesh: text(t.rootMesh) };
    anatomicalFrame(tooth);
    return tooth;
  });
  if (new Set(teeth.map(t => t.id)).size !== 28 || new Set(teeth.flatMap(t => [t.crownMesh, t.rootMesh])).size !== 56) throw new Error('Teaching asset tooth and mesh names must be unique.');
  const gums = value.gums.map(item => {
    const g = record(item);
    if (g.arch !== 'upper' && g.arch !== 'lower') throw new Error('The gingival arch must be specified.');
    return { id: text(g.id), arch: g.arch, position: vector(g.position), mesh: text(g.mesh) } as GumMetadata;
  });
  if (new Set(gums.map(g => g.arch)).size !== 2 || new Set([...teeth.flatMap(t => [t.crownMesh, t.rootMesh]), ...gums.map(g => g.mesh)]).size !== 58) throw new Error('Teaching asset arch and mesh names must be unique.');
  return { version: 1, name: text(value.name), units: 'mm', teeth, gums };
}

/** Apply GLB world transforms once, then restore the supplied tooth pivot in mm. */
export function dentalCaseFromAsset(scene: Object3D, raw: unknown): DentalCase {
  const metadata = validateAnatomyMetadata(raw), meshes = new Map<string, Mesh>(), owned: BufferGeometry[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!(object as Mesh).isMesh) return;
    if (meshes.has(object.name)) throw new Error(`Duplicate anatomy mesh: ${object.name}.`);
    meshes.set(object.name, object as Mesh);
  });
  const take = (name: string, position: Vec3, maxExtent: number) => {
    const source = meshes.get(name);
    if (!source || source.type !== 'Mesh') throw new Error(`Missing anatomy mesh: ${name}.`);
    const geometry = source.geometry.clone(); owned.push(geometry);
    geometry.applyMatrix4(source.matrixWorld); geometry.translate(-position[0], -position[1], -position[2]);
    const vertices = geometry.getAttribute('position');
    if (!vertices || vertices.count < 3 || vertices.count > 600_000 || !Array.from(vertices.array).every(Number.isFinite)) throw new Error(`Invalid anatomy vertices: ${name}.`);
    if (geometry.index && (geometry.index.count % 3 || Array.from(geometry.index.array).some(i => !Number.isInteger(i) || i < 0 || i >= vertices.count))) throw new Error(`Invalid anatomy triangles: ${name}.`);
    if (!geometry.index && vertices.count % 3) throw new Error(`Invalid anatomy triangles: ${name}.`);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const extent = geometry.boundingBox!.getSize(new Vector3()).length();
    if (!Number.isFinite(extent) || extent < .1 || extent > maxExtent) throw new Error(`Check anatomy units: ${name}.`);
    geometry.computeVertexNormals();
    return geometry;
  };
  try {
    return {
      name: metadata.name, demo: true,
      teeth: metadata.teeth.map(({ crownMesh, rootMesh, ...tooth }) => ({ ...tooth, geometry: take(crownMesh, tooth.position, 60), rootGeometry: take(rootMesh, tooth.position, 60) })),
      gums: metadata.gums.map(({ mesh, ...gum }) => ({ ...gum, geometry: take(mesh, gum.position, 200) })),
    };
  } catch (error) { owned.forEach(geometry => geometry.dispose()); throw error; }
}

let prepared: DentalCase | undefined;
let loading: Promise<void> | undefined;
export function getTeachingAssetCase(): DentalCase | undefined {
  if (!prepared) return undefined;
  return { ...prepared, teeth: prepared.teeth.map(({ geometry, rootGeometry, ...metadata }) => ({ ...structuredClone(metadata), geometry, rootGeometry })), gums: prepared.gums.map(gum => ({ ...gum, position: [...gum.position] as Vec3 })) };
}

export function loadTeachingAsset(): Promise<void> {
  if (prepared) return Promise.resolve();
  if (!loading) loading = (async () => {
    const signal = AbortSignal.timeout(15000);
    const [metadataResponse, modelResponse] = await Promise.all([fetch(TEACHING_METADATA_URL, { signal }), fetch(TEACHING_ASSET_URL, { signal })]);
    if (!metadataResponse.ok || !modelResponse.ok) throw new Error('The refined teaching model could not be downloaded.');
    const [raw, bytes] = await Promise.all([metadataResponse.json(), modelResponse.arrayBuffer()]);
    if (bytes.byteLength > 30 * 1024 * 1024) throw new Error('The teaching model exceeds the display asset budget.');
    const gltf = await new GLTFLoader().parseAsync(bytes, '/models/');
    try { prepared = dentalCaseFromAsset(gltf.scene, raw); }
    finally { gltf.scene.traverse(object => { const mesh = object as Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach(material => material.dispose()); } }); }
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}
