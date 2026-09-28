import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
  type BufferGeometry,
  type BufferAttribute,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAtlas } from '@/lib/atlas-assets';
import { primeAtlasGumBindings } from '@/lib/atlas-gum-bindings';
import { dentalSurface } from '@/lib/dental-surface';
import { mechanicsDisplayPoses } from '@/lib/mechanics-presentation';
import { sampleCaseDemonstration } from '@/lib/teaching-cases';
import type { DentalCase } from '@/lib/geometry';
import type { Transforms } from '@/lib/model';
import { createGumPresentation } from './gum-presentation';
import { createToothPoseUpdater } from './tooth-pose';

let model: DentalCase, gums: ReturnType<typeof createGumPresentation>;
const scene = new Scene(),
  material = new MeshBasicMaterial();
const groups = new Map<string, Group>(),
  ghosts = new Map<string, Group>();
let setPose: ReturnType<typeof createToothPoseUpdater>;
let hashes: string[], neckVertex: number, startupMs: number, primeMs: number;
const display = { gums: true, roots: false, opening: 0, arch: 'both', isolateSelection: false };
function hash(geometry: BufferGeometry) {
  const digest = createHash('sha256');
  for (const attr of [...Object.values(geometry.attributes), geometry.index!])
    digest.update(Buffer.from(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength));
  return digest.digest('hex');
}
function show(transforms: Transforms = {}, opening = 0) {
  for (const tooth of model.teeth)
    setPose(tooth, { transforms, opening, ghost: false, roots: false });
  gums.update({ ...display, opening });
}
function movedPoint(vertex = neckVertex) {
  const positions = gums.meshes[0].mesh.geometry.getAttribute('position');
  const rest = model.gums[0].geometry.getAttribute('position');
  return new Vector3()
    .fromBufferAttribute(positions, vertex)
    .sub(new Vector3().fromBufferAttribute(rest, vertex));
}
beforeAll(async () => {
  const bytes = readFileSync('public/models/forma-atlas-v1.glb');
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model = dentalCaseFromAtlas(
    gltf.scene,
    JSON.parse(readFileSync('public/models/forma-atlas-v1.json', 'utf8')),
  );
  const buffer = (file: string) => new Uint8Array(readFileSync(file)).buffer;
  const primeStart = performance.now();
  await primeAtlasGumBindings(model, buffer('public/models/forma-atlas-gums-v1.bin'), {
    asset: buffer('public/models/forma-atlas-v1.glb'),
    metadata: buffer('public/models/forma-atlas-v1.json'),
  });
  primeMs = performance.now() - primeStart;
  gltf.scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(value =>
      value.dispose(),
    );
  });
  for (const tooth of model.teeth) {
    const group = new Group();
    group.position.fromArray(tooth.position);
    groups.set(tooth.id, group);
    ghosts.set(tooth.id, new Group());
  }
  hashes = model.gums.map(gum => hash(gum.geometry));
  const start = performance.now();
  gums = createGumPresentation(model, groups, material, dentalSurface, scene);
  startupMs = performance.now() - start;
  setPose = createToothPoseUpdater(groups, ghosts, new Map(), new Map());
  const tooth = model.teeth.find(item => item.id === '11')!;
  const positions = tooth.geometry.getAttribute('position'),
    data = tooth.geometry.getAttribute('dentalData');
  const target = new Vector3(),
    point = new Vector3(),
    buccal = new Vector3(...tooth.buccal!);
  let mostBuccal = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    if (data.getZ(i) < 0.02 && point.dot(buccal) > mostBuccal) {
      mostBuccal = point.dot(buccal);
      target.copy(point);
    }
  }
  target.add(new Vector3(...tooth.position));
  const gumPositions = model.gums[0].geometry.getAttribute('position');
  let distance = Infinity;
  for (let i = 0; i < gumPositions.count; i++) {
    const next = point.fromBufferAttribute(gumPositions, i).distanceTo(target);
    if (next < distance) {
      distance = next;
      neckVertex = i;
    }
  }
  expect(distance).toBeLessThan(0.75);
}, 60_000);
beforeEach(() => show());
afterAll(() => {
  gums.meshes.forEach(({ mesh }) => mesh.geometry.dispose());
  model.gums.forEach(gum => gum.geometry.dispose());
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  material.dispose();
});

it('follows a moved incisor margin while holding the other arch, palate and arch base', () => {
  const tooth = model.teeth.find(item => item.id === '11')!,
    direction = new Vector3(...tooth.buccal!).normalize();
  const start = performance.now();
  show({
    '11': { translation: direction.clone().multiplyScalar(2).toArray(), rotation: [0, 0, 0] },
  });
  const updateMs = performance.now() - start;
  expect(movedPoint().dot(direction)).toBeGreaterThan(1.7);
  expect(movedPoint().length()).toBeLessThanOrEqual(2.00001);
  expect(hash(gums.meshes[1].mesh.geometry)).toBe(hashes[1]);
  const geometry = model.gums[0].geometry,
    data = geometry.getAttribute('dentalData'),
    positions = geometry.getAttribute('position');
  let anchored = 0;
  for (let i = 0; i < positions.count; i++) {
    if (data.getZ(i) >= 0.75 || positions.getY(i) >= geometry.boundingBox!.max.y - 2) {
      expect(movedPoint(i).lengthSq()).toBe(0);
      anchored++;
    }
  }
  expect(anchored).toBeGreaterThan(1000);
  console.info(
    `Atlas gingiva: prime ${primeMs.toFixed(1)} ms, prepare both arches ${startupMs.toFixed(1)} ms, changed upper arch ${updateMs.toFixed(1)} ms.`,
  );
});

it('retains baked attributes and source buffers, produces finite unit normals, and resets exactly', () => {
  show({ '11': { translation: [1, 0.5, 0], rotation: [5, 0, 8] } });
  const geometry = gums.meshes[0].mesh.geometry;
  expect(hash(geometry)).not.toBe(hashes[0]);
  for (const name of ['color', 'color_1', 'dentalData', 'uv'])
    expect(
      geometry
        .getAttribute(name)
        .array.every((value, i) => value === model.gums[0].geometry.getAttribute(name).array[i]),
    ).toBe(true);
  for (let i = 0; i < geometry.getAttribute('normal').count; i += 31)
    expect(
      new Vector3().fromBufferAttribute(geometry.getAttribute('normal'), i).length(),
    ).toBeCloseTo(1, 5);
  expect(geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);
  expect(model.gums.map(gum => hash(gum.geometry))).toEqual(hashes);
  show();
  expect(gums.meshes.map(({ mesh }) => hash(mesh.geometry))).toEqual(hashes);
});

it('uses absolute displayed poses without drift or repeated unchanged buffer uploads', () => {
  const transforms: Transforms = { '11': { translation: [1, 0, 0], rotation: [0, 0, 5] } };
  show(transforms);
  const geometry = gums.meshes[0].mesh.geometry,
    expected = hash(geometry);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const version = position.version;
  for (let i = 0; i < 10; i++) show(transforms);
  expect(position.version).toBe(version);
  expect(hash(geometry)).toBe(expected);
  show();
  show(transforms);
  expect(hash(geometry)).toBe(expected);
});

it('reuses influence bindings on another viewer and updates only changing frames', () => {
  const start = performance.now();
  const second = createGumPresentation(model, groups, material, dentalSurface, scene);
  const reuseMs = performance.now() - start;
  const timings: number[] = [];
  for (let i = 0; i < 24; i++) {
    const tick = performance.now();
    show({ '11': { translation: [i / 24, 0, 0], rotation: [0, 0, i / 4] } });
    timings.push(performance.now() - tick);
  }
  const position = gums.meshes[0].mesh.geometry.getAttribute('position') as BufferAttribute;
  const version = position.version;
  for (let i = 0; i < 24; i++) gums.update(display);
  expect(position.version).toBe(version);
  timings.sort((a, b) => a - b);
  console.info(
    `Atlas gingiva: cached second viewer ${reuseMs.toFixed(1)} ms, moving frames median ${timings[12].toFixed(1)} ms / p95 ${timings[22].toFixed(1)} ms.`,
  );
  second.meshes.forEach(({ mesh }) => {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  });
});

it('applies jaw opening once, including after a lower tooth move', () => {
  const transforms: Transforms = { '31': { translation: [0, 0, 1], rotation: [0, 0, 0] } };
  show(transforms);
  const geometry = gums.meshes[1].mesh.geometry,
    expected = hash(geometry);
  show(transforms, 12);
  expect(hash(geometry)).toBe(expected);
  expect(gums.meshes[1].mesh.position.y).toBe(model.gums[1].position[1] - 12);
  expect(gums.meshes[0].mesh.position.y).toBe(model.gums[0].position[1]);
  show({}, 12);
  expect(hash(geometry)).toBe(hashes[1]);
});

it('follows prepared and magnified mechanics display poses and catches up after hidden frames', () => {
  show(sampleCaseDemonstration('movement-types', 'translation', 1));
  expect(movedPoint().length()).toBeGreaterThan(0.1);
  const response: Transforms = { '11': { translation: [0.04, 0, 0], rotation: [0, 0, 0] } };
  show(mechanicsDisplayPoses({}, response, 1, 1));
  const small = movedPoint().length();
  show(mechanicsDisplayPoses({}, response, 1, 25));
  expect(movedPoint().length()).toBeCloseTo(small * 25, 4);
  for (const tooth of model.teeth)
    setPose(tooth, { transforms: response, opening: 0, roots: false, ghost: false });
  gums.update({ ...display, gums: false });
  expect(gums.meshes.every(({ mesh }) => !mesh.visible)).toBe(true);
  const position = gums.meshes[0].mesh.geometry.getAttribute('position') as BufferAttribute;
  const version = position.version;
  gums.update({ ...display, gums: false });
  expect(position.version).toBe(version);
  gums.update(display);
  expect(movedPoint().length()).toBeCloseTo(small, 5);
});
