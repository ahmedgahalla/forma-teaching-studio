import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createDentalMaterials } from './viewer-materials';
import { dentalStagePalette, dentalSurface } from './dental-surface';

const luminance = (color: THREE.Color) => color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;

describe('lecture tissue materials', () => {
  it.each([true, false])(
    'retains editable cues and keeps tissue reflections subdued (demo=%s)',
    demo => {
      const materials = createDentalMaterials(demo, 'midnight');
      const { enamel, gumMaterial, rootMaterial, lockedMaterial, contactMaterial } = materials;
      expect(enamel.vertexColors).toBe(demo);
      expect(rootMaterial.vertexColors).toBe(demo);
      expect(gumMaterial.vertexColors).toBe(demo);
      expect(enamel.color.r).toBeGreaterThan(enamel.color.b);
      expect(enamel.roughness).toBeGreaterThan(0.5);
      expect(gumMaterial.roughness).toBeGreaterThan(rootMaterial.roughness);
      expect(rootMaterial.roughness).toBeGreaterThan(enamel.roughness);
      expect(gumMaterial.specularIntensity).toBeLessThan(enamel.specularIntensity);
      expect(gumMaterial.clearcoat).toBe(0);
      expect(enamel.clearcoat).toBeLessThan(0.05);
      expect(lockedMaterial.color.getHexString()).toBe(dentalStagePalette.midnight.locked.slice(1));
      expect(contactMaterial.color.getHexString()).toBe(
        dentalStagePalette.midnight.contact.slice(1),
      );
      expect(lockedMaterial).not.toBe(enamel);
      expect(contactMaterial).not.toBe(enamel);
      Object.values(materials).forEach(material => material.dispose());
    },
  );

  it('separates the ivory crown body from the cool light stage without changing tissue by theme', () => {
    const clinical = createDentalMaterials(true, 'clinical'),
      midnight = createDentalMaterials(true, 'midnight');
    for (const key of ['enamel', 'gumMaterial', 'rootMaterial'] as const)
      expect(clinical[key].color.equals(midnight[key].color)).toBe(true);
    const source = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 5, 0),
      new THREE.Vector3(0, 10, 0),
    ]);
    const crown = dentalSurface(source, [0, 1, 0], 'enamel');
    const body = new THREE.Color().fromBufferAttribute(crown.getAttribute('color'), 1);
    const stage = new THREE.Color(dentalStagePalette.clinical.center);
    // The light stage is cool and distinct even before lighting and tone mapping.
    expect(stage.b).toBeGreaterThan(stage.r);
    expect(luminance(stage)).toBeGreaterThan(0.6);
    expect(Math.abs(body.r - stage.r)).toBeGreaterThan(0.1);
    expect(Math.abs(body.b - stage.b)).toBeGreaterThan(0.2);
    crown.dispose();
    source.dispose();
    [...Object.values(clinical), ...Object.values(midnight)].forEach(material =>
      material.dispose(),
    );
  });
});
