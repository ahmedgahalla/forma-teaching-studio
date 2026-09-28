import { describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import * as THREE from 'three';
import { DENTAL_DIRECT_DIFFUSE } from './atlas-shader';
import { createDentalMaterials } from './viewer-materials';
import { makePerikymataTexture, makeStipplingTexture } from './atlas-textures';

function textureBytes(texture: THREE.DataTexture) {
  const data = texture.image.data!;
  // Compare every byte without the matcher recursively traversing a million entries.
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

function shaderFor(material: THREE.Material) {
  const shader = {
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
    uniforms: {},
  } as Parameters<THREE.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('atlas tissue materials', () => {
  it('patches the installed physical shader, with baked AO, thickness and masked bump', () => {
    expect(
      THREE.ShaderChunk.lights_physical_pars_fragment.split(DENTAL_DIRECT_DIFFUSE),
    ).toHaveLength(2);
    expect(THREE.ShaderChunk.bumpmap_pars_fragment.match(/bumpScale \*/g)).toHaveLength(3);
    const farAO = { value: 1 };
    const materials = createDentalMaterials(true, 'midnight', farAO);
    const { enamel, gumMaterial, rootMaterial } = materials;
    for (const material of [enamel, gumMaterial, rootMaterial]) {
      const shader = shaderFor(material);
      expect(shader.vertexShader).toContain('attribute vec4 dentalData;');
      expect(shader.vertexShader).toContain('vDental = dentalData;');
      expect(shader.fragmentShader).toContain('irradiance + scatterIrr');
      expect(shader.fragmentShader).not.toContain(DENTAL_DIRECT_DIFFUSE);
      expect(shader.fragmentShader.match(/bumpScale \* dentalBumpMask\(\) \*/g)).toHaveLength(3);
      expect(shader.fragmentShader).toContain('( 1.0 - vDental.g ) * uTransColor');
      expect(shader.fragmentShader).toContain('vDental.r * mix( 1.0, vDental.a, uFarAO )');
      expect(shader.fragmentShader).toContain('clearcoatSpecularIndirect *= vao');
      expect(shader.fragmentShader).toContain(
        'computeSpecularOcclusion( dotNVao, vao, material.roughness )',
      );
      expect(shader.uniforms.uFarAO).toBe(farAO);
    }
    const enamelShader = shaderFor(enamel),
      gumShader = shaderFor(gumMaterial);
    expect(enamelShader.fragmentShader).toContain('smoothstep( 0.82, 0.98, vDental.b )');
    expect(enamelShader.fragmentShader).not.toContain('float dentalZone5');
    expect(gumShader.fragmentShader).toContain('vDental.b - 0.25');
    expect(gumShader.fragmentShader).toContain('vDental.b - 0.75');
    expect(gumShader.fragmentShader).toContain('0.46, 0.52, 0.42, 0.52, 0.42');
    expect(gumShader.fragmentShader).toContain('0.25, 0.18, 0.28, 0.20, 0.28');
    expect(gumShader.fragmentShader).toContain('0.22, 0.28, 0.20, 0.25, 0.20');
    expect(gumShader.fragmentShader).toContain('0.8, 0.8, 1.0, 0.4, 0.9');
    expect(enamel).toMatchObject({ roughness: 0.28, ior: 1.63, clearcoat: 0.35, bumpScale: 0.08 });
    expect(rootMaterial).toMatchObject({ roughness: 0.65, ior: 1.5 });
    expect(gumMaterial).toMatchObject({
      roughness: 0.5,
      ior: 1.4,
      bumpScale: 0.45,
      transparent: true,
    });
    expect(enamel.color.getHex()).toBe(0xffffff);
    expect(shaderFor(rootMaterial).uniforms.uTransScale.value).toBe(0);
    expect(enamelShader.uniforms.uTransScale.value).toBe(0.35);
    expect(enamelShader.uniforms.uScatterColor.value.getHex()).toBe(0xd9b48a);
    expect(gumShader.uniforms.uScatterColor.value.getHex()).toBe(0x701818);
    Object.values(materials).forEach(material => material.dispose());
  });

  it('retains shader programs in status clones, shares uniforms only within a viewer and owns textures once', () => {
    const first = createDentalMaterials(true, 'midnight', { value: 1 });
    const second = createDentalMaterials(true, 'clinical', { value: 0.4 });
    const enamelTextureDisposed = vi.fn(),
      gumTextureDisposed = vi.fn();
    first.enamel.bumpMap!.addEventListener('dispose', enamelTextureDisposed);
    first.gumMaterial.bumpMap!.addEventListener('dispose', gumTextureDisposed);
    for (const material of [first.lockedMaterial, first.contactMaterial]) {
      expect(material.onBeforeCompile).toBe(first.enamel.onBeforeCompile);
      expect(material.customProgramCacheKey()).toBe(first.enamel.customProgramCacheKey());
      expect(shaderFor(material).uniforms.uFarAO).toBe(shaderFor(first.enamel).uniforms.uFarAO);
      expect(material.bumpMap).toBe(first.enamel.bumpMap);
      material.dispose();
    }
    expect(enamelTextureDisposed).not.toHaveBeenCalled();
    const firstShader = shaderFor(first.enamel),
      secondShader = shaderFor(second.enamel);
    firstShader.uniforms.uFarAO.value = 0;
    expect(secondShader.uniforms.uFarAO.value).toBe(0.4);
    expect(first.enamel.bumpMap).not.toBe(second.enamel.bumpMap);
    expect(first.gumMaterial.customProgramCacheKey()).not.toBe(
      first.enamel.customProgramCacheKey(),
    );
    Object.values(first).forEach(material => material.dispose());
    first.enamel.dispose();
    expect(enamelTextureDisposed).toHaveBeenCalledTimes(1);
    expect(gumTextureDisposed).toHaveBeenCalledTimes(1);
    Object.values(second).forEach(material => material.dispose());
  });
});

describe('deterministic atlas microtextures', () => {
  it('keeps the source enamel UV orientation, edge fade and seeded band pattern', () => {
    const texture = makePerikymataTexture();
    const again = makePerikymataTexture();
    expect(texture.image).toMatchObject({ width: 256, height: 1024 });
    expect(textureBytes(texture).equals(textureBytes(again))).toBe(true);
    expect(texture).toMatchObject({
      flipY: false,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      colorSpace: THREE.NoColorSpace,
      anisotropy: 8,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    const data = texture.image.data!;
    for (let x = 0; x < 256; x++) {
      expect(data[x * 4]).toBe(128);
      expect(data[(1023 * 256 + x) * 4]).toBe(128);
    }
    const body = Array.from(data.slice(256 * 500 * 4, 256 * 501 * 4)).filter((_, i) => i % 4 === 0);
    expect(Math.max(...body) - Math.min(...body)).toBeGreaterThan(30);
    const different = makePerikymataTexture(256, 1024, 70, 4);
    expect(textureBytes(different).equals(textureBytes(texture))).toBe(false);
    texture.dispose();
    again.dispose();
    different.dispose();
  });

  it('makes seeded gum pits tile across edges, with opaque scalar values and no random dependency', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const texture = makeStipplingTexture();
    random.mockReturnValue(0.9);
    const again = makeStipplingTexture();
    random.mockRestore();
    expect(texture.image).toMatchObject({ width: 512, height: 512 });
    expect(textureBytes(texture).equals(textureBytes(again))).toBe(true);
    expect(texture).toMatchObject({
      flipY: true,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
    });
    const data = texture.image.data!;
    expect(
      Array.from(data)
        .filter((_, i) => i % 4 === 3)
        .every(alpha => alpha === 255),
    ).toBe(true);
    expect(
      Array.from({ length: 512 }, (_, y) => data[y * 512 * 4]).some(value => value < 100),
    ).toBe(true);
    expect(
      Array.from({ length: 512 }, (_, y) => data[(y * 512 + 511) * 4]).some(value => value < 100),
    ).toBe(true);
    texture.dispose();
    again.dispose();
  });
});
