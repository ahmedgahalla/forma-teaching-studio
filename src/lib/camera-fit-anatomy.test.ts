import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAsset } from './anatomy-assets';
import { toothMatrix } from './analysis';
import { LECTURE_CAMERA_MARGIN, perspectiveFitFrame } from './camera-fit';
import { VOICE_HUD_SAFE_AREA } from './lecture-layout';
import {
  cameraViewDirection,
  displayedToothBounds,
  displayedToothPoints,
  displayedFitPoints,
} from './viewer-presentation';
import { getToothStudyCamera } from './tooth-study/camera';
import { TOOTH_STUDY_VIEWS } from './tooth-study/types';
import type { DentalCase } from './geometry';
import type { Transforms } from './model';

let model: DentalCase;
beforeAll(async () => {
  const bytes = readFileSync('public/models/forma-teaching-v1.glb');
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model = dentalCaseFromAsset(
    gltf.scene,
    JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8')),
  );
});
afterAll(() => {
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

function projectedExtent(
  ids: string[],
  roots: boolean,
  opening: number,
  transforms: Transforms,
  camera: PerspectiveCamera,
  gums = false,
) {
  const point = new Vector3();
  let left = Infinity,
    right = -Infinity,
    top = -Infinity,
    bottom = Infinity;
  camera.updateMatrixWorld();
  for (const tooth of model.teeth) {
    if (!ids.includes(tooth.id)) continue;
    const matrix = toothMatrix(tooth, transforms);
    if (Number(tooth.id[0]) >= 3) matrix.elements[13] -= opening;
    for (const geometry of [tooth.geometry, ...(roots ? [tooth.rootGeometry!] : [])]) {
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(matrix).project(camera);
        left = Math.min(left, point.x);
        right = Math.max(right, point.x);
        top = Math.max(top, point.y);
        bottom = Math.min(bottom, point.y);
      }
    }
  }
  if (gums)
    for (const gum of model.gums) {
      const positions = gum.geometry.getAttribute('position');
      const offset = new Vector3(...gum.position);
      if (gum.arch === 'lower') offset.y -= opening;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).add(offset).project(camera);
        left = Math.min(left, point.x);
        right = Math.max(right, point.x);
        top = Math.max(top, point.y);
        bottom = Math.min(bottom, point.y);
      }
    }
  return { left, right, top, bottom, width: (right - left) / 2, height: (top - bottom) / 2 };
}

describe('projector framing with the shipped anatomy', () => {
  it.each(['perspective', 'front', 'right', 'left', 'occlusal'] as const)(
    'fits transformed crowns and roots in the available %s canvas',
    view => {
      const transforms: Transforms = {
        '11': { translation: [3, 2, 1], rotation: [12, 18, -8] },
      };
      const ids = model.teeth.map(tooth => tooth.id);
      for (const roots of [false, true])
        for (const aspect of [1400 / 688, 800 / 430, 0.65]) {
          const camera = new PerspectiveCamera(34, aspect, 0.1, 10000),
            direction = cameraViewDirection(view, 'both'),
            bounds = displayedToothBounds(model, transforms, ids, roots, 5);
          const fit = perspectiveFitFrame(
            bounds,
            direction,
            camera.up,
            camera.fov,
            aspect,
            LECTURE_CAMERA_MARGIN,
            displayedFitPoints(model, transforms, ids, roots, 5, true),
          );
          camera.position.copy(fit.target).addScaledVector(direction, fit.distance);
          camera.lookAt(fit.target);
          const extent = projectedExtent(ids, roots, 5, transforms, camera, true);
          expect(extent.left).toBeGreaterThanOrEqual(-0.78 - 1e-10);
          expect(extent.right).toBeLessThanOrEqual(0.78 + 1e-10);
          expect(extent.bottom).toBeGreaterThanOrEqual(-0.52 - 1e-10);
          expect(extent.top).toBeLessThanOrEqual(0.92 + 1e-10);
          expect(extent.left + extent.right).toBeCloseTo(0, 7);
          expect((extent.bottom + extent.top) / 2).toBeCloseTo(VOICE_HUD_SAFE_AREA, 7);
        }
    },
  );

  it('uses the intended lecture width for a full frontal bite when height permits', () => {
    const ids = model.teeth.map(tooth => tooth.id),
      aspect = 1.5,
      camera = new PerspectiveCamera(34, aspect, 0.1, 10000),
      direction = cameraViewDirection('front', 'both'),
      bounds = displayedToothBounds(model, {}, ids, false, 0);
    const fit = perspectiveFitFrame(
      bounds,
      direction,
      camera.up,
      34,
      aspect,
      LECTURE_CAMERA_MARGIN,
      displayedToothPoints(model, {}, ids, false, 0),
    );
    camera.position.copy(fit.target).addScaledVector(direction, fit.distance);
    camera.lookAt(fit.target);
    const extent = projectedExtent(ids, false, 0, {}, camera);
    expect(extent.width).toBeGreaterThanOrEqual(0.65);
    expect(extent.width).toBeLessThanOrEqual(0.8);
  });

  it.each(['perspective', 'front'] as const)(
    'keeps default %s gingiva and teeth above the HUD',
    view => {
      for (const roots of [false, true]) {
        const ids = model.teeth.map(tooth => tooth.id),
          aspect = 1400 / 688,
          camera = new PerspectiveCamera(34, aspect, 0.1, 10000),
          direction = cameraViewDirection(view, 'both'),
          bounds = displayedToothBounds(model, {}, ids, roots, 0);
        const fit = perspectiveFitFrame(
          bounds,
          direction,
          camera.up,
          34,
          aspect,
          LECTURE_CAMERA_MARGIN,
          displayedFitPoints(model, {}, ids, roots, 0, true),
        );
        camera.position.copy(fit.target).addScaledVector(direction, fit.distance);
        camera.lookAt(fit.target);
        const after = projectedExtent(ids, roots, 0, {}, camera, true);
        expect(after.height).toBeCloseTo(0.9 * (1 - VOICE_HUD_SAFE_AREA));
        expect((after.bottom + after.top) / 2).toBeCloseTo(VOICE_HUD_SAFE_AREA, 7);
        expect(after.left + after.right).toBeCloseTo(0, 7);
        expect(after.top).toBeLessThanOrEqual(0.92 + 1e-10);
        expect(after.bottom).toBeGreaterThan(2 * VOICE_HUD_SAFE_AREA - 1);
      }
    },
  );

  it.each(TOOTH_STUDY_VIEWS)('keeps the real study crown and roots clear of the HUD: %s', view => {
    for (const id of ['16', '46']) {
      const source = model.teeth.find(tooth => tooth.id === id)!;
      const bounds = displayedToothBounds(model, {}, [id], true, 4);
      const aspect = 800 / 430;
      const state = getToothStudyCamera(source, undefined, bounds, view, 34, aspect);
      const camera = new PerspectiveCamera(34, aspect, 0.1, 10000);
      camera.position.fromArray(state.position);
      camera.up.fromArray(state.up);
      camera.lookAt(...state.target);
      const extent = projectedExtent([id], true, 4, {}, camera);
      expect(extent.left).toBeGreaterThanOrEqual(-0.7);
      expect(extent.right).toBeLessThanOrEqual(0.7);
      expect(extent.bottom).toBeGreaterThanOrEqual(
        VOICE_HUD_SAFE_AREA - 0.76 * (1 - VOICE_HUD_SAFE_AREA) - 1e-10,
      );
      expect(extent.top).toBeLessThanOrEqual(
        VOICE_HUD_SAFE_AREA + 0.76 * (1 - VOICE_HUD_SAFE_AREA) + 1e-10,
      );
      expect((1 - extent.bottom) / 2).toBeLessThan(1 - VOICE_HUD_SAFE_AREA);
    }
  });
});
