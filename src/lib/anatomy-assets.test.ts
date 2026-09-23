import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAsset, validateAnatomyMetadata } from './anatomy-assets';
import { createOrthodonticDemo } from './demo';

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
      expect(tooth.rootGeometry!.boundingBox!.min.distanceTo(original.rootGeometry!.boundingBox!.min)).toBeLessThan(1.1);
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
