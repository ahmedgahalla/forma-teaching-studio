import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  atlasBackdrop,
  atlasEnvironmentScene,
  createAtlasLightRig,
  updateAtlasBackdrop,
} from './atlas-stage';
import { createViewerStage } from './viewer-stage';
import type { DentalCase } from './geometry';

const pmrem = vi.hoisted(() => ({
  fromScene: vi.fn(),
  dispose: vi.fn(),
  targets: [] as { dispose: () => void }[],
}));
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    PMREMGenerator: class {
      fromScene(scene: THREE.Scene, sigma: number) {
        pmrem.fromScene(scene, sigma);
        const target = { texture: new actual.Texture(), dispose: vi.fn() };
        pmrem.targets.push(target);
        return target;
      }
      dispose = pmrem.dispose;
    },
  };
});

describe('atlas studio stage', () => {
  it('preserves the warm two-circle source gradient in both themes without replacing its storage', () => {
    const texture = atlasBackdrop('midnight');
    const data = texture.image.data!;
    const center = (110 * 256 + 128) * 4;
    expect(Array.from(data.slice(center, center + 4))).toEqual([29, 20, 19, 255]);
    expect(data[0]).toBeLessThan(10);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.flipY).toBe(true);
    updateAtlasBackdrop(texture, 'clinical');
    expect(texture.image.data).toBe(data);
    expect(Array.from(data.slice(center, center + 4))).toEqual([236, 234, 230, 255]);
    expect(data[0]).toBeLessThan(data[center]);
    texture.dispose();
  });

  it('builds the original twin-flash environment and disposes only caller-owned geometry', () => {
    const scene = atlasEnvironmentScene();
    expect((scene.background as THREE.Color).getHex()).toBe(0x2a201e);
    expect(scene.children).toHaveLength(4);
    const meshes = scene.children as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
    expect(meshes.map(mesh => mesh.position.toArray())).toEqual([
      [-4.5, 1, 5],
      [4.5, 1, 5],
      [0, 6, 1],
      [0, -3, 4],
    ]);
    expect(
      meshes.map(mesh => [mesh.geometry.parameters.width, mesh.geometry.parameters.height]),
    ).toEqual([
      [2, 4],
      [2, 4],
      [8, 1],
      [10, 3],
    ]);
    expect(meshes[0].material.color.r).toBe(10);
    expect(meshes[2].material.color.r).toBe(2.5);
    expect(meshes[3].material.color.r).toBe(0.25);
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });

  it('keeps key/fill/rim and environment behind the camera through front and occlusal orbits', () => {
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(20);
    const bounds = new THREE.Box3(new THREE.Vector3(-30, -20, -10), new THREE.Vector3(30, 20, 30));
    const center = bounds.getCenter(new THREE.Vector3());
    const rig = createAtlasLightRig(scene, camera, bounds);
    const positions = [rig.key.position, rig.fill.position, rig.rim.position];
    for (const position of [
      [0, 0, 100],
      [0, 100, 0.01],
      [-80, 30, 60],
    ]) {
      camera.position.fromArray(position);
      camera.lookAt(center);
      rig.update(center);
      const inverse = camera.quaternion.clone().invert();
      const direction = rig.key.position.clone().sub(center).normalize().applyQuaternion(inverse);
      expect(direction.distanceTo(new THREE.Vector3(-0.22, 0.32, 0.92).normalize())).toBeLessThan(
        1e-12,
      );
      expect(rig.key.target.position.equals(center)).toBe(true);
      expect(rig.fill.target.position.equals(center)).toBe(true);
      expect(rig.rim.target.position.equals(center)).toBe(true);
      expect([rig.key.position, rig.fill.position, rig.rim.position]).toEqual(positions);
      const view = camera.position.clone().sub(center).normalize();
      expect(scene.environmentRotation.x).toBeCloseTo(-Math.asin(view.y));
      expect(scene.environmentRotation.y).toBeCloseTo(Math.atan2(view.x, view.z));
    }
    rig.setTheme('clinical');
    expect(scene.environmentIntensity).toBe(0.72);
    expect(rig.hemi.intensity).toBe(0.35);
    rig.setTheme('midnight');
    expect(scene.environmentIntensity).toBe(0.6);
    expect(rig.hemi.intensity).toBe(0.2);
    expect(rig.key.intensity).toBe(2);
    expect(rig.key.color.getHex()).toBe(0xfffaf2);
    expect(rig.key.shadow.mapSize.toArray()).toEqual([2048, 2048]);
    const dispose = vi.spyOn(rig.key.shadow, 'dispose');
    rig.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('selects atlas rendering only for the atlas and releases backdrop, environment and shadow map', () => {
    const model: DentalCase = {
      name: 'test',
      demo: true,
      teeth: [],
      gums: [{ id: 'upper', geometry: new THREE.BoxGeometry(60, 40, 30), position: [0, 0, 0] }],
    };
    for (const atlas of [true, false]) {
      const renderer = { setClearColor: vi.fn() } as unknown as THREE.WebGLRenderer;
      const scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera();
      const stage = createViewerStage(
        renderer,
        scene,
        camera,
        { ...model, asset: atlas ? 'claude-atlas-v1' : undefined },
        'midnight',
      );
      const backdrop = scene.background as THREE.Texture;
      const disposeBackdrop = vi.spyOn(backdrop, 'dispose');
      const key = scene.children.find(
        object => object instanceof THREE.DirectionalLight && object.castShadow,
      ) as THREE.DirectionalLight;
      const disposeShadow = vi.spyOn(key.shadow, 'dispose');
      expect(renderer.toneMapping).toBe(
        atlas ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping,
      );
      expect(renderer.toneMappingExposure).toBe(atlas ? 1 : 0.88);
      expect(camera.fov).toBe(atlas ? 20 : 34);
      expect(pmrem.fromScene).toHaveBeenLastCalledWith(
        expect.any(THREE.Scene),
        atlas ? 0.02 : 0.04,
      );
      stage.update(new THREE.Vector3(), false);
      expect(stage.farAO?.value).toBe(atlas ? 1 : undefined);
      stage.setTheme('clinical');
      stage.update(new THREE.Vector3(), false);
      expect(stage.farAO?.value).toBe(atlas ? 0.4 : undefined);
      stage.update(new THREE.Vector3(), true);
      expect(stage.farAO?.value).toBe(atlas ? 0 : undefined);
      stage.dispose();
      expect(disposeBackdrop).toHaveBeenCalledOnce();
      expect(disposeShadow).toHaveBeenCalledOnce();
      expect(pmrem.targets.at(-1)!.dispose).toHaveBeenCalledOnce();
    }
    model.gums[0].geometry.dispose();
  });
});
