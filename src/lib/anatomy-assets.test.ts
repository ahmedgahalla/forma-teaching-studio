import { describe, expect, it } from 'vitest';
import { BoxGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAsset, validateAnatomyMetadata } from './anatomy-assets';
import { createOrthodonticDemo } from './demo';
import { createTeachingAnatomy } from './teaching-anatomy';
import type { DentalTooth } from './geometry';

function fixture() {
  const scene = new Group(), material = new MeshBasicMaterial();
  const teeth = ['1', '2', '3', '4'].flatMap(q => Array.from({ length: 7 }, (_, i) => {
    const id = `${q}${i + 1}`, position = [i * 8, Number(q) * 15, 0];
    for (const prefix of ['crown', 'root']) {
      const mesh = new Mesh(new BoxGeometry(5, prefix === 'root' ? 12 : 8, 5), material);
      mesh.name = `${prefix}_${id}`; mesh.position.set(...position as [number, number, number]);
      if (prefix === 'root') mesh.position.y += 8;
      scene.add(mesh);
    }
    return { id, name: 'Synthetic tooth', position, buccal: [0, 0, 1], mesial: [1, 0, 0], occlusal: [0, 1, 0], bracketPosition: [0, 0, 2.5], calibrated: true, crownMesh: `crown_${id}`, rootMesh: `root_${id}` };
  }));
  const gums = ['upper', 'lower'].map(arch => {
    const mesh = new Mesh(new BoxGeometry(70, 10, 35), material); mesh.name = `gum_${arch}`; scene.add(mesh);
    return { id: `gum_${arch}`, arch, position: [0, 0, 0], mesh: mesh.name };
  });
  return { scene, metadata: { version: 1, name: 'Bundled synthetic model', units: 'mm', teeth, gums } };
}

describe('Blender anatomy asset contract', () => {
  it('loads the shipped Blender GLB with all linked teeth and source millimetre pivots', async () => {
    const bytes = readFileSync('public/models/forma-teaching-v1.glb');
    const scene = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const result = dentalCaseFromAsset(scene.scene, JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8')));
    const base = createOrthodonticDemo();
    expect(result.teeth).toHaveLength(28); expect(result.gums).toHaveLength(2);
    for (const tooth of result.teeth) {
      const original = base.teeth.find(t => t.id === tooth.id)!;
      expect(tooth.position).toEqual(original.position);
      expect(tooth.buccal).toEqual(original.buccal);
      expect(tooth.bracketPosition).toEqual(original.bracketPosition);
      expect(tooth.geometry.boundingBox!.min.distanceTo(original.geometry.boundingBox!.min)).toBeLessThan(.5);
      expect(tooth.geometry.boundingBox!.max.distanceTo(original.geometry.boundingBox!.max)).toBeLessThan(.5);
      // The joined trunk and curved fuller root body intentionally change silhouette.
      expect(tooth.rootGeometry!.boundingBox!.min.distanceTo(original.rootGeometry!.boundingBox!.min)).toBeLessThan(1.5);
    }
    const triangles = result.teeth.reduce((count, tooth) => count + (tooth.geometry.index?.count || tooth.geometry.getAttribute('position').count) / 3 + (tooth.rootGeometry!.index?.count || tooth.rootGeometry!.getAttribute('position').count) / 3, 0);
    expect(triangles).toBeGreaterThan(50000); expect(triangles).toBeLessThan(200000);
  });
  it('preserves supplied pivots and linked roots without recentering', () => {
    const { scene, metadata } = fixture(), result = dentalCaseFromAsset(scene, metadata);
    expect(result.demo).toBe(true); expect(result.teeth).toHaveLength(28);
    expect(result.teeth[1].position).toEqual([8, 15, 0]);
    expect(result.teeth[1].geometry.boundingBox?.min.toArray()).toEqual([-2.5, -4, -2.5]);
    expect(result.teeth[1].rootGeometry?.boundingBox?.min.y).toBe(2);
    expect(result.teeth[1].bracketPosition).toEqual([0, 0, 2.5]);
    expect(result.teeth[1].geometry).not.toBe((scene.getObjectByName('crown_12') as Mesh).geometry);
  });
  it('loads connected root trunks with explicit distal branches and registered cutaways', async () => {
    const bytes = readFileSync('public/models/forma-teaching-v1.glb');
    const raw = JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8'));
    const scene = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const model = dentalCaseFromAsset(scene.scene, raw), anatomy = createTeachingAnatomy(model);
    for (const tooth of model.teeth) {
      const root = tooth.rootGeometry!, index = root.index!, p = root.getAttribute('position');
      const parent = Array.from({ length: p.count }, (_, i) => i);
      const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
      for (let i = 0; i < index.count; i += 3) { parent[find(index.getX(i + 1))] = find(index.getX(i)); parent[find(index.getX(i + 2))] = find(index.getX(i)); }
      expect(new Set(parent.map((_, i) => find(i))).size, `${tooth.id} connected root surface`).toBe(1);
      const upper = Number(tooth.id[0]) < 3, family = Number(tooth.id[1]), count = family >= 6 ? upper ? 3 : 2 : upper && family === 4 ? 2 : 1;
      expect(tooth.rootAnatomy!.branches).toHaveLength(count);
      expect(!!tooth.rootAnatomy!.trunk).toBe(count > 1);
      const saved = [...p.array];
      anatomy.update({}, { bone: true, opacity: .5, ligament: true, cutaway: true }, { selected: tooth.id, roots: true, gums: true });
      expect(anatomy.group.children).toHaveLength((count + (count > 1 ? 1 : 0)) * 2);
      expect(anatomy.labels).toHaveLength(5);
      expect(anatomy.bounds.getSize(new Vector3()).length()).toBeLessThan(55);
      for (const child of anatomy.group.children as Mesh[]) {
        expect(Array.from(child.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        expect(Array.from(child.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
      }
      expect([...p.array]).toEqual(saved);
      expect(tooth.rootAnatomy).not.toBe(raw.teeth.find((item: { id: string }) => item.id === tooth.id).rootAnatomy);
    }
    anatomy.dispose();
  });
  it('retains distinguishing posterior landmarks in the exported surfaces, not just the Blender source', async () => {
    const bytes = readFileSync('public/models/forma-teaching-v1.glb');
    const scene = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const model = dentalCaseFromAsset(scene.scene, JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8')));
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const height = (id: string, u: number, v: number) => {
      const tooth = model.teeth.find(t => t.id === id) as DentalTooth;
      const axis = new Vector3(...tooth.occlusal!), mesial = new Vector3(...tooth.mesial), buccal = new Vector3(...tooth.buccal), point = new Vector3(), positions = tooth.geometry.getAttribute('position');
      let minM = Infinity, maxM = -Infinity, minB = Infinity, maxB = -Infinity, maxA = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i); minM = Math.min(minM, point.dot(mesial)); maxM = Math.max(maxM, point.dot(mesial)); minB = Math.min(minB, point.dot(buccal)); maxB = Math.max(maxB, point.dot(buccal)); maxA = Math.max(maxA, point.dot(axis));
      }
      const origin = mesial.multiplyScalar((minM + maxM) / 2 + (maxM - minM) * u / 2).addScaledVector(buccal, (minB + maxB) / 2 + (maxB - minB) * v / 2).addScaledVector(axis, maxA + 5);
      const hit = new Raycaster(origin, axis.clone().negate()).intersectObject(new Mesh(tooth.geometry, material))[0];
      expect(hit, `${id} occlusal landmark ray`).toBeDefined(); return hit.point.dot(axis) - maxA;
    };
    // Lower first premolar: dominant buccal cusp; second: two separated lingual lobes.
    expect(height('44', 0, .45) - height('44', 0, -.45)).toBeGreaterThan(.65);
    for (const u of [-.30, .30]) expect(height('45', u, -.40) - height('45', 0, -.45)).toBeGreaterThan(.20);
    // Upper first premolar has a more unequal cusp pair than the second.
    expect(height('14', 0, .45) - height('14', 0, -.45)).toBeGreaterThan(height('15', 0, .45) - height('15', 0, -.45) + .15);
    // A smaller distolingual cusp in the upper second molar; a distal fifth-cusp
    // elevation in the lower first molar compared with the four-cusp second.
    expect(height('16', -.30, -.40) - height('17', -.30, -.40)).toBeGreaterThan(.15);
    expect(height('46', -.70, 0) - height('47', -.70, 0)).toBeGreaterThan(.20);
    material.dispose();
  });
  it('applies parent transforms exactly once', () => {
    const { scene, metadata } = fixture(); scene.position.z = 7;
    const result = dentalCaseFromAsset(scene, metadata);
    expect(result.teeth[0].geometry.boundingBox?.min.z).toBe(4.5);
    expect((scene.getObjectByName('crown_11') as Mesh).geometry.getAttribute('position').getZ(0)).toBe(2.5);
  });
  it('rejects missing and duplicate FDI inventory, malformed axes and wrong units', () => {
    const { metadata } = fixture();
    expect(() => validateAnatomyMetadata({ ...metadata, units: 'm' })).toThrow(/millimetres/);
    expect(() => validateAnatomyMetadata({ ...metadata, teeth: metadata.teeth.slice(1) })).toThrow();
    expect(() => validateAnatomyMetadata({ ...metadata, teeth: metadata.teeth.map((t, i) => i === 1 ? { ...t, id: '11' } : t) })).toThrow(/unique/);
    expect(() => validateAnatomyMetadata({ ...metadata, teeth: metadata.teeth.map((t, i) => i === 0 ? { ...t, buccal: [1, 0, 0] } : t) })).toThrow(/perpendicular/);
  });
  it('rejects missing meshes, invalid positions and implausible units', () => {
    const { scene, metadata } = fixture();
    const crown = scene.getObjectByName('crown_11') as Mesh; crown.name = 'unidentified';
    expect(() => dentalCaseFromAsset(scene, metadata)).toThrow(/Missing/);
    crown.name = 'crown_11'; crown.geometry.getAttribute('position').setX(0, NaN);
    expect(() => dentalCaseFromAsset(scene, metadata)).toThrow(/vertices/);
    crown.geometry = new BoxGeometry(1000, 1000, 1000);
    expect(() => dentalCaseFromAsset(scene, metadata)).toThrow(/units/);
  });
});
