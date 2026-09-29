import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAtlas } from './atlas-assets';
import * as assets from './anatomy-assets';
import type { DentalCase } from './geometry';
import { caseJourneyScenes } from './lecture-documents/sample-case-journey-scenes';
import { createMechanicsVisuals } from './mechanics-view';
import { perspectiveFitFrame } from './camera-fit';
import {
  cameraViewDirection,
  displayedFitPoints,
  displayedToothBounds,
} from './viewer-presentation';

let model: DentalCase;
beforeAll(async () => {
  const bytes = readFileSync('public/models/forma-atlas-v1.glb');
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  model = dentalCaseFromAtlas(
    gltf.scene,
    JSON.parse(readFileSync('public/models/forma-atlas-v1.json', 'utf8')),
  );
  gltf.scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material =>
      material.dispose(),
    );
  });
  vi.spyOn(assets, 'getTeachingAssetCase').mockReturnValue(model);
});
afterAll(() => {
  vi.restoreAllMocks();
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

it.each([3, 2, 1.5, 0.65])('frames the actual TAD and elastic geometry at aspect %s', aspect => {
  const scene = caseJourneyScenes().tadResponse;
  const ids = scene.setup.selectedIds,
    kit = createMechanicsVisuals(model);
  try {
    kit.update(scene.mechanics, scene.transforms, {
      arch: 'upper',
      opening: 0,
      forces: false,
      revealed: true,
      visible: id => ids.includes(id),
    });
    kit.group.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(34, aspect, 0.1, 10000);
    const direction = cameraViewDirection(scene.setup.view, 'upper');
    const fit = perspectiveFitFrame(
      displayedToothBounds(model, scene.transforms, ids, false, 0),
      direction,
      camera.up,
      camera.fov,
      aspect,
      undefined,
      displayedFitPoints(model, scene.transforms, ids, false, 0, false, false, scene.mechanics),
    );
    camera.position.copy(fit.target).addScaledVector(direction, fit.distance);
    camera.lookAt(fit.target);
    camera.updateMatrixWorld();
    const projected = new Vector3();
    const parts = kit.group.children;
    expect(parts.length).toBeGreaterThan(0);
    for (const object of parts) {
      const vertices = (object as Mesh).geometry.getAttribute('position');
      for (let index = 0; index < vertices.count; index++) {
        projected
          .fromBufferAttribute(vertices, index)
          .applyMatrix4(object.matrixWorld)
          .project(camera);
        expect(Math.abs(projected.x), object.name).toBeLessThanOrEqual(1);
        expect(Math.abs(projected.y), object.name).toBeLessThanOrEqual(1);
      }
    }
  } finally {
    kit.dispose();
  }
});
