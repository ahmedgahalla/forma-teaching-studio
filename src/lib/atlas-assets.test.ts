import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Group, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ATLAS_TEACHING_IDS, dentalCaseFromAtlas, validateAtlasMetadata } from './atlas-assets';
import { anatomicalFrame, resolveMovement } from './model';
import { createTeachingCase } from './teaching-cases';
import { createApplianceKit } from './appliances';
import { createAttachmentGeometry } from './attachments';
import type { DentalCase } from './geometry';

const metadata = JSON.parse(readFileSync('public/models/forma-atlas-v1.json', 'utf8'));
let scene: Group, model: DentalCase;
beforeAll(async () => {
  const bytes = readFileSync('public/models/forma-atlas-v1.glb');
  scene = (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
  model = dentalCaseFromAtlas(scene, metadata);
});
afterAll(() => {
  for (const tooth of model.teeth) {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  }
  model.gums.forEach(gum => gum.geometry.dispose());
  scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material =>
      material.dispose(),
    );
  });
});

describe('Claude dentition atlas integration', () => {
  it('keeps the complete 32-tooth source and explicitly selects the existing 28 teaching IDs', () => {
    expect(Object.keys(validateAtlasMetadata(metadata))).toHaveLength(32);
    expect(scene.getObjectByName('tooth_18')).toBeDefined();
    expect(model.teeth.map(tooth => tooth.id)).toEqual(ATLAS_TEACHING_IDS);
    expect(model.asset).toBe('claude-atlas-v1');
    expect(model.gums.map(gum => gum.arch)).toEqual(['upper', 'lower']);
    expect(model.teeth.every(tooth => tooth.rootGeometry && !tooth.rootAnatomy)).toBe(true);
  });

  it('preserves exact source positions, anatomical directions and baked surface channels', () => {
    for (const tooth of model.teeth) {
      const source = scene.getObjectByName(`tooth_${tooth.id}`)!;
      const parts: Mesh[] = [];
      source.traverse(object => {
        if ((object as Mesh).isMesh) parts.push(object as Mesh);
      });
      for (const [geometry, material] of [
        [tooth.geometry, 'enamel'],
        [tooth.rootGeometry!, 'cementum'],
      ] as const) {
        const original = parts.find(
          mesh => !Array.isArray(mesh.material) && mesh.material.name === material,
        )!.geometry;
        const p = geometry.getAttribute('position'),
          old = original.getAttribute('position');
        expect(p.count).toBe(old.count);
        for (let i = 0; i < p.count; i += 73) {
          const point = new Vector3().fromBufferAttribute(p, i).add(new Vector3(...tooth.position));
          expect(point.distanceTo(new Vector3().fromBufferAttribute(old, i))).toBeLessThan(0.00001);
        }
        for (const name of ['color', 'color_1', 'uv'])
          expect(Array.from(geometry.getAttribute(name).array)).toEqual(
            Array.from(original.getAttribute(name).array),
          );
        const normal = geometry.getAttribute('normal'),
          originalNormal = original.getAttribute('normal');
        for (let i = 0; i < normal.count; i += 73)
          expect(
            new Vector3()
              .fromBufferAttribute(normal, i)
              .distanceTo(new Vector3().fromBufferAttribute(originalNormal, i)),
          ).toBeLessThan(0.000001);
        expect(geometry.getAttribute('dentalData')).toBe(geometry.getAttribute('color_1'));
      }
      const frame = anatomicalFrame(tooth);
      expect(
        new Vector3(...resolveMovement(tooth, 'extrude', 1)).distanceTo(
          new Vector3(...frame.occlusal),
        ),
      ).toBeLessThan(1e-12);
      expect(
        new Vector3(...frame.occlusal).dot(new Vector3(...metadata.teeth[tooth.id].apicalAxis)),
      ).toBeCloseTo(-1, 3);
      expect(tooth.geometry.boundingBox!.getCenter(new Vector3()).length()).toBeLessThan(0.00001);
    }
  });

  it('places brackets and attachments on every real crown rather than the full-tooth centre', () => {
    const kit = createApplianceKit();
    try {
      for (const tooth of model.teeth) {
        const bracket = kit.bracket(tooth);
        expect(bracket, tooth.id).not.toBeNull();
        expect(bracket!.position.toArray()).toEqual(tooth.bracketPosition);
        const attachment = createAttachmentGeometry(tooth, {
          shape: 'rectangle',
          width: 2,
          height: 2,
          depth: 0.5,
          offsetMesial: 0,
          offsetOcclusal: 0,
          rotation: 0,
        });
        expect(Array.from(attachment.getAttribute('position').array).every(Number.isFinite)).toBe(
          true,
        );
        attachment.dispose();
      }
    } finally {
      kit.dispose();
    }
  });

  it('keeps the producer’s fitted arch positions when opening authored teaching cases', () => {
    const prepared = createTeachingCase(model, 'reference-occlusion').model;
    expect(prepared.asset).toBe(model.asset);
    for (const tooth of prepared.teeth)
      expect(tooth.position).toEqual(model.teeth.find(t => t.id === tooth.id)!.position);
    prepared.gums.forEach((gum, i) => expect(gum.position).toEqual(model.gums[i].position));
    expect(createTeachingCase(model, 'anchorage-space-closure').model.teeth).toHaveLength(26);
  });

  it('rejects missing wisdom source entries, incompatible units, skewed axes and missing tissues', () => {
    const missing = structuredClone(metadata);
    delete missing.teeth['18'];
    expect(() => validateAtlasMetadata(missing)).toThrow(/32 identified/);
    expect(() => validateAtlasMetadata({ ...metadata, units: 'm' })).toThrow(/millimetres/);
    const skewed = structuredClone(metadata);
    skewed.teeth['11'].mesialDir = skewed.teeth['11'].buccalDir;
    expect(() => validateAtlasMetadata(skewed)).toThrow(/perpendicular/);
    expect(() => dentalCaseFromAtlas(new Group(), metadata)).toThrow(/Missing atlas node/);
    const missingWisdom = scene.clone();
    missingWisdom.getObjectByName('tooth_18')!.removeFromParent();
    expect(() => dentalCaseFromAtlas(missingWisdom, metadata)).toThrow(/tooth_18/);
  });
});
