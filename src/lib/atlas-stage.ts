import * as THREE from 'three';
import type { DentalStageTheme } from './dental-surface';

/** The source atlas's two tall flash softboxes, overhead strip and warm low bounce. */
export function atlasEnvironmentScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a201e);
  const boxes = [
    [2, 4, 10, -4.5, 1, 5, 0xffffff],
    [2, 4, 10, 4.5, 1, 5, 0xffffff],
    [8, 1, 2.5, 0, 6, 1, 0xffffff],
    [10, 3, 0.25, 0, -3, 4, 0xff9a8a],
  ];
  for (const [width, height, intensity, x, y, z, tint] of boxes) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(tint).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }
  return scene;
}

export function updateAtlasBackdrop(texture: THREE.DataTexture, theme: DentalStageTheme) {
  const inner = theme === 'clinical' ? [236, 234, 230] : [29, 20, 19];
  const outer = theme === 'clinical' ? [201, 196, 189] : [7, 5, 5];
  const pixels = texture.image.data!;
  // Radial gradient circles: (128,110,10) -> (128,128,190), in source sRGB space.
  const a = 18 * 18 - 180 * 180;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = x + 0.5 - 128,
        dy = y + 0.5 - 110;
      const b = -2 * (dy * 18 + 10 * 180),
        c = dx * dx + dy * dy - 100;
      const blend = THREE.MathUtils.clamp((-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a), 0, 1);
      const index = (y * 256 + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        pixels[index + channel] = Math.round(
          inner[channel] + (outer[channel] - inner[channel]) * blend,
        );
      pixels[index + 3] = 255;
    }
  }
  texture.needsUpdate = true;
}

export function atlasBackdrop(theme: DentalStageTheme) {
  const texture = new THREE.DataTexture(new Uint8Array(256 * 256 * 4), 256, 256);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.flipY = true;
  updateAtlasBackdrop(texture, theme);
  return texture;
}

/** Camera-relative flash lighting, with preallocated vectors for the render loop. */
export function createAtlasLightRig(scene: THREE.Scene, camera: THREE.Camera, bounds: THREE.Box3) {
  const key = new THREE.DirectionalLight(0xfffaf2, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.05;
  key.shadow.radius = 4;
  const fill = new THREE.DirectionalLight(0xeef3ff, 0.7);
  const rim = new THREE.DirectionalLight(0xffffff, 1);
  const hemi = new THREE.HemisphereLight(0xfff8f0, 0x3a1c1c, 0.2);
  scene.add(key, key.target, fill, fill.target, rim, rim.target, hemi);
  scene.environmentRotation.order = 'YXZ';
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  Object.assign(key.shadow.camera, {
    left: -radius,
    right: radius,
    top: radius,
    bottom: -radius,
    near: radius * 0.5,
    far: radius * 5.5,
  });
  key.shadow.camera.updateProjectionMatrix();
  const lights = [key, fill, rim];
  const directions = [
    new THREE.Vector3(-0.22, 0.32, 0.92).normalize(),
    new THREE.Vector3(0.6, 0.3, 1).normalize(),
    new THREE.Vector3(0.1, 0.6, -0.8).normalize(),
  ];
  const hemiDirection = new THREE.Vector3(0, 0.75, 0.66).normalize();
  const direction = new THREE.Vector3();
  return {
    key,
    fill,
    rim,
    hemi,
    setTheme(theme: DentalStageTheme) {
      scene.environmentIntensity = theme === 'clinical' ? 0.72 : 0.6;
      hemi.intensity = theme === 'clinical' ? 0.35 : 0.2;
    },
    update(target: THREE.Vector3) {
      camera.updateMatrixWorld();
      for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        direction.copy(directions[i]).applyQuaternion(camera.quaternion);
        light.position.copy(center).addScaledVector(direction, radius * 3);
        light.target.position.copy(center);
        light.target.updateMatrixWorld();
        light.updateMatrixWorld();
      }
      hemi.position.copy(hemiDirection).applyQuaternion(camera.quaternion);
      hemi.updateMatrixWorld();
      direction.copy(camera.position).sub(target).normalize();
      scene.environmentRotation.set(
        -Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)),
        Math.atan2(direction.x, direction.z),
        0,
      );
    },
    dispose() {
      key.shadow.dispose();
    },
  };
}
