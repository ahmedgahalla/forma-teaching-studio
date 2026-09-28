import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { anatomicalFrame, type Tooth, type Vec3, type Transforms } from './model';
import { createOrthodonticDemo } from './demo';
import { getTeachingAssetCase } from './anatomy-assets';
import { validateSession, type CaseSession } from './planning';
import { validateAttachment, type AttachmentSpec } from './attachments';
import { validateRootAnatomy } from './root-anatomy';
import { validateMechanicsExperiment } from './mechanics/state';
import {
  hasAtlasSurfaceData,
  makeGeometry,
  serialGeometry,
  serializedMeshSize,
  validMesh,
  type SerializedGeometry,
} from './case-geometry';

export type DentalTooth = Tooth & {
  geometry: THREE.BufferGeometry;
  rootGeometry?: THREE.BufferGeometry;
  rootAnatomy?: import('./root-anatomy').RootAnatomy;
  bracketPosition?: Vec3;
  attachment?: AttachmentSpec;
};
export type Gum = {
  id: string;
  geometry: THREE.BufferGeometry;
  position: Vec3;
  arch?: 'upper' | 'lower';
};
export type DentalCase = {
  name: string;
  demo: boolean;
  asset?: 'claude-atlas-v1';
  teeth: DentalTooth[];
  gums: Gum[];
};
const names = [
  'Central incisor',
  'Lateral incisor',
  'Canine',
  'First premolar',
  'Second premolar',
  'First molar',
  'Second molar',
];
function toothName(id: string) {
  return names[Number(id[1]) - 1] || 'Third molar';
}

export function createDemo(): DentalCase {
  return getTeachingAssetCase() || createOrthodonticDemo();
}

export async function importSTLs(files: File[], scale: number): Promise<DentalCase> {
  if (!files.length || files.length > 36) throw new Error('Choose 1–36 individual STL files.');
  if (![1, 10, 25.4, 1000].includes(scale)) throw new Error('Choose a supported import unit.');
  if (files.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024)
    throw new Error('Keep the total STL upload below 100 MB.');
  const teeth: DentalTooth[] = [],
    gums: Gum[] = [],
    ids = new Set<string>();
  let totalVertices = 0;
  try {
    for (const file of files) {
      if (!/\.stl$/i.test(file.name)) throw new Error(`${file.name}: choose STL files only.`);
      const id = file.name.match(/(?:^|[^0-9])([1-4][1-8])(?:[^0-9]|$)/)?.[1];
      const isGum = /gum|gingiva|gingival/i.test(file.name);
      if (!id && !isGum)
        throw new Error(
          `${file.name}: name each tooth by its FDI number, for example 11.stl, or name a gum file upper_gum.stl.`,
        );
      if (isGum && gums.length >= 4) throw new Error('Choose at most 4 gum models.');
      const key = isGum ? file.name : id!;
      if (ids.has(key)) throw new Error(`Duplicate model ${key}. Choose one file per tooth.`);
      ids.add(key);
      const data = await file.arrayBuffer();
      // Binary triangle count is checked before the loader allocates geometry.
      if (data.byteLength >= 84) {
        const count = new DataView(data).getUint32(80, true);
        if (84 + count * 50 === data.byteLength && count > 1_000_000)
          throw new Error(`${file.name}: mesh exceeds 1 million triangles.`);
      }
      const geometry = new STLLoader().parse(data);
      const positions = geometry.getAttribute('position');
      totalVertices += positions?.count || 0;
      if (
        !positions ||
        positions.count < 3 ||
        positions.count % 3 ||
        totalVertices > 6_000_000 ||
        !Array.from(positions.array).every(Number.isFinite)
      ) {
        geometry.dispose();
        throw new Error(`${file.name}: invalid or overly large triangle mesh.`);
      }
      geometry.scale(scale, scale, scale);
      geometry.computeBoundingBox();
      const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
      const extent = geometry.boundingBox!.getSize(new THREE.Vector3()).length();
      if (
        !Number.isFinite(extent) ||
        !center.toArray().every(Number.isFinite) ||
        extent <= 0.001 ||
        extent > 2000
      ) {
        geometry.dispose();
        throw new Error(`${file.name}: check the selected units and mesh dimensions.`);
      }
      geometry.translate(-center.x, -center.y, -center.z);
      geometry.computeVertexNormals();
      const position = center.toArray() as Vec3;
      if (isGum)
        gums.push({
          id: file.name,
          geometry,
          position,
          arch: /lower|mandib/i.test(file.name)
            ? 'lower'
            : /upper|maxill/i.test(file.name)
              ? 'upper'
              : undefined,
        });
      else
        teeth.push({
          id: id!,
          name: toothName(id!),
          geometry,
          position,
          buccal: [0, 0, 1],
          mesial: [1, 0, 0],
          calibrated: false,
        });
    }
    if (!teeth.length) throw new Error('Include at least one numbered tooth STL.');
    return {
      name: 'Imported arch',
      demo: false,
      teeth: teeth.sort((a, b) => a.id.localeCompare(b.id)),
      gums,
    };
  } catch (error) {
    teeth.forEach(t => t.geometry.dispose());
    gums.forEach(g => g.geometry.dispose());
    throw error;
  }
}

export function download(name: string, data: BlobPart, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function saveCase(model: DentalCase, transforms: Transforms, session?: CaseSession) {
  const encode = (t: DentalTooth | Gum) => {
    const tooth = t as DentalTooth;
    return {
      ...t,
      geometry: undefined,
      rootGeometry: undefined,
      ...serialGeometry(t.geometry),
      root: tooth.rootGeometry ? serialGeometry(tooth.rootGeometry) : undefined,
    };
  };
  const version =
    model.asset ||
    session?.mechanics ||
    session?.lectureSetup ||
    model.teeth.some(tooth => tooth.rootAnatomy)
      ? 3
      : 2;
  const contents = new Blob(
    [
      JSON.stringify({
        version,
        units: 'mm',
        model: { ...model, teeth: model.teeth.map(encode), gums: model.gums.map(encode) },
        transforms,
        session,
      }),
    ],
    { type: 'application/json' },
  );
  if (contents.size > 100 * 1024 * 1024)
    throw new Error('Saved case exceeds 100 MB. Use smaller meshes before saving.');
  download('forma-case.json', contents);
}
const finiteVec = (v: unknown): v is Vec3 =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e5);
export async function loadCase(
  file: File,
): Promise<{ model: DentalCase; transforms: Transforms; session?: CaseSession }> {
  if (file.size > 100 * 1024 * 1024) throw new Error('Case file must be under 100 MB.');
  const data = JSON.parse(await file.text());
  if (
    !data ||
    ![1, 2, 3].includes(data.version) ||
    data.units !== 'mm' ||
    !data.model ||
    !Array.isArray(data.model.teeth) ||
    !Array.isArray(data.model.gums) ||
    !data.transforms ||
    typeof data.transforms !== 'object' ||
    Array.isArray(data.transforms)
  )
    throw new Error('This is not a supported teaching case.');
  if (typeof data.model.name !== 'string') throw new Error('Invalid case name.');
  if (data.model.asset !== undefined && data.model.asset !== 'claude-atlas-v1')
    throw new Error('Invalid case anatomy asset.');
  if (!data.model.teeth.length || data.model.teeth.length > 32 || data.model.gums.length > 4)
    throw new Error('Invalid number of models.');
  const ids = new Set<string>();
  let count = 0;
  for (const t of [...data.model.teeth, ...data.model.gums]) {
    if (typeof t.id !== 'string' || !finiteVec(t.position) || !validMesh(t))
      throw new Error('Invalid mesh in case.');
    if (t.name !== undefined && typeof t.name !== 'string') throw new Error('Invalid mesh name.');
    if (t.root !== undefined && !validMesh(t.root)) throw new Error('Invalid root mesh.');
    if (data.model.asset && (!hasAtlasSurfaceData(t) || (t.root && !hasAtlasSurfaceData(t.root))))
      throw new Error(
        'The saved atlas is missing its surface color, tissue data or UV coordinates.',
      );
    count += serializedMeshSize(t) + (t.root ? serializedMeshSize(t.root) : 0);
    if (count > 18_000_000) throw new Error('Case mesh is too large.');
  }
  for (const t of data.model.teeth) {
    if (
      !/^[1-4][1-8]$/.test(t.id) ||
      ids.has(t.id) ||
      typeof t.name !== 'string' ||
      !finiteVec(t.buccal) ||
      !finiteVec(t.mesial) ||
      typeof t.calibrated !== 'boolean'
    )
      throw new Error('Invalid tooth metadata.');
    if (
      (t.occlusal !== undefined && !finiteVec(t.occlusal)) ||
      (t.bracketPosition !== undefined && !finiteVec(t.bracketPosition))
    )
      throw new Error('Invalid tooth metadata.');
    if (t.attachment !== undefined) {
      t.attachment = validateAttachment(t.attachment);
      if (!t.calibrated) throw new Error('An attachment requires a calibrated tooth.');
    }
    if (t.calibrated) anatomicalFrame(t);
    if (t.rootAnatomy !== undefined) {
      if (!t.root) throw new Error('Root anatomy metadata requires its registered root mesh.');
      t.rootAnatomy = validateRootAnatomy(t.rootAnatomy, t.occlusal);
    }
    ids.add(t.id);
  }
  for (const gum of data.model.gums)
    if (gum.arch !== undefined && !['upper', 'lower'].includes(gum.arch))
      throw new Error('Invalid gum arch.');
  for (const [id, pose] of Object.entries(data.transforms) as [
    string,
    { translation: unknown; rotation: unknown },
  ][])
    if (!ids.has(id) || !pose || !finiteVec(pose.translation) || !finiteVec(pose.rotation))
      throw new Error('Invalid movement data.');
  const session = validateSession(data.session, ids);
  const decode = (t: Record<string, unknown>) => {
    const {
      vertices,
      normals,
      indices,
      attributes,
      root,
      geometry: _oldGeometry,
      rootGeometry: _oldRoot,
      ...rest
    } = t;
    return {
      ...rest,
      geometry: makeGeometry({
        vertices: vertices as number[],
        normals: normals as number[],
        indices: indices as number[],
        attributes: attributes as SerializedGeometry['attributes'],
      }),
      ...(root ? { rootGeometry: makeGeometry(root as SerializedGeometry) } : {}),
    };
  };
  const model: DentalCase = {
    name: String(data.model.name).slice(0, 80),
    demo: Boolean(data.model.demo),
    ...(data.model.asset ? { asset: data.model.asset as 'claude-atlas-v1' } : {}),
    teeth: data.model.teeth.map(decode),
    gums: data.model.gums.map(decode),
  };
  if (session?.mechanics !== undefined)
    session.mechanics = validateMechanicsExperiment(session.mechanics, model);
  return { model, transforms: data.transforms, session };
}
