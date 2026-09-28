import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  atlasBackdrop,
  atlasEnvironmentScene,
  createAtlasLightRig,
  updateAtlasBackdrop,
} from './atlas-stage';
import {
  dentalBackdrop,
  dentalStagePalette,
  updateDentalBackdrop,
  type DentalStageTheme,
} from './dental-surface';
import type { DentalCase } from './geometry';
import type { DentalFarAO } from './atlas-shader';

function modelBounds(model: DentalCase) {
  const bounds = new THREE.Box3(),
    box = new THREE.Box3(),
    position = new THREE.Vector3();
  for (const part of [...model.teeth, ...model.gums]) {
    position.fromArray(part.position);
    part.geometry.computeBoundingBox();
    bounds.union(box.copy(part.geometry.boundingBox!).translate(position));
    if ('rootGeometry' in part && part.rootGeometry) {
      part.rootGeometry.computeBoundingBox();
      bounds.union(box.copy(part.rootGeometry.boundingBox!).translate(position));
    }
  }
  return bounds;
}

function fallbackLights(scene: THREE.Scene, camera: THREE.Camera) {
  scene.add(new THREE.HemisphereLight(0xf8fbff, 0x56647d, 0.28));
  const key = new THREE.DirectionalLight(0xfff6e8, 1.7);
  key.position.set(-48, 65, 75);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90 });
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.08;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xf0f5ff, 0.7);
  fill.position.set(40, 15, 65);
  fill.target.position.set(0, 0, -1);
  camera.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xd7eaff, 1.1);
  rim.position.set(25, 45, -65);
  scene.add(rim);
  return key;
}

/** Own the scene's lighting and textures; editing-cue colours remain independent. */
export function createViewerStage(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  model: DentalCase,
  theme: DentalStageTheme,
) {
  const atlas = model.asset === 'claude-atlas-v1';
  const farAO: DentalFarAO | undefined = atlas ? { value: 1 } : undefined;
  renderer.toneMapping = atlas ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = atlas ? 1 : 0.88;
  camera.fov = atlas ? 20 : 34;
  camera.updateProjectionMatrix();
  scene.add(camera);
  const backdrop = atlas ? atlasBackdrop(theme) : dentalBackdrop(theme);
  scene.background = backdrop;
  scene.environmentIntensity = 0.55;
  const environmentScene = atlas ? atlasEnvironmentScene() : new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, atlas ? 0.02 : 0.04);
  scene.environment = environment.texture;
  if (environmentScene instanceof RoomEnvironment) environmentScene.dispose();
  else
    environmentScene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
  pmrem.dispose();
  const rig = atlas ? createAtlasLightRig(scene, camera, modelBounds(model)) : null;
  const fallbackKey = atlas ? null : fallbackLights(scene, camera);
  let currentTheme = theme;
  const setTheme = (next: DentalStageTheme) => {
    currentTheme = next;
    if (atlas) {
      updateAtlasBackdrop(backdrop, next);
      rig!.setTheme(next);
      renderer.setClearColor(next === 'clinical' ? 0xc9c4bd : 0x070505, 1);
    } else {
      updateDentalBackdrop(backdrop, next);
      renderer.setClearColor(dentalStagePalette[next].clear, 1);
    }
  };
  setTheme(theme);
  return {
    farAO,
    setTheme,
    update(target: THREE.Vector3, isolated: boolean) {
      if (farAO) farAO.value = isolated ? 0 : currentTheme === 'clinical' ? 0.4 : 1;
      rig?.update(target);
    },
    dispose() {
      rig?.dispose();
      fallbackKey?.shadow.dispose();
      environment.dispose();
      backdrop.dispose();
    },
  };
}
