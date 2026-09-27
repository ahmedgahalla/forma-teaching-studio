import { readFileSync } from 'node:fs';
import { Box3, Euler, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { anatomicalFrame, type Tooth } from '../model';
import { getToothStudyCamera, toothStudyCamera, transformedToothFrame } from './camera';
import { TOOTH_STUDY_VIEWS } from './types';
import { VOICE_HUD_SAFE_AREA } from '../lecture-layout';

const metadata: { teeth: Tooth[] } = JSON.parse(
  readFileSync('public/models/forma-teaching-v1.json', 'utf8'),
);
const tooth = (id: string): Tooth => metadata.teeth.find(item => item.id === id)!;

describe('tooth-relative camera', () => {
  for (const id of ['16', '46']) {
    it.each(TOOTH_STUDY_VIEWS)('frames ' + id + ' from %s with anatomical screen-up', view => {
      const frame = anatomicalFrame(tooth(id));
      const { direction, up } = toothStudyCamera(frame, view);
      const expected =
        view === 'buccal' || view === 'lingual'
          ? frame.buccal
          : view === 'mesial' || view === 'distal'
            ? frame.mesial
            : frame.occlusal;
      const sign = ['lingual', 'distal', 'apical'].includes(view) ? -1 : 1;
      direction.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis] * sign));
      expect(new Vector3(...direction).length()).toBeCloseTo(1);
      const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 1000);
      camera.position.fromArray(direction).multiplyScalar(50);
      camera.up.fromArray(up);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const screenTop = new Vector3(
        ...(view === 'occlusal' || view === 'apical' ? frame.buccal : [0, 1, 0]),
      );
      screenTop.project(camera);
      expect(screenTop.y).toBeGreaterThan(0);
      expect(screenTop.x).toBeCloseTo(0);
    });
  }

  it('rotates anatomical directions with the tooth pose, without translating the axes', () => {
    const source = tooth('16');
    const frame = anatomicalFrame(source);
    const pose = {
      translation: [20, 30, 40] as [number, number, number],
      rotation: [20, -35, 14] as [number, number, number],
    };
    const rotated = transformedToothFrame(source, pose);
    const euler = new Euler(...(pose.rotation.map(MathUtils.degToRad) as [number, number, number]));
    for (const axis of ['buccal', 'mesial', 'occlusal'] as const) {
      expect(rotated[axis]).toEqual(new Vector3(...frame[axis]).applyEuler(euler).toArray());
      expect(new Vector3(...rotated[axis]).length()).toBeCloseTo(1);
    }
    expect(anatomicalFrame(source)).toEqual(frame);
  });

  it.each(TOOTH_STUDY_VIEWS)('fills 70–76%% of available model height for %s', view => {
    const bounds = new Box3(new Vector3(-5, -13, -5), new Vector3(5, 13, 5));
    // Axis-aligned frame makes the dimensions intentionally independent of the real arch location.
    const source: Tooth = { ...tooth('16'), buccal: [0, 0, 1], mesial: [1, 0, 0] };
    const state = getToothStudyCamera(source, undefined, bounds, view, 45, 16 / 9);
    const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 1000);
    camera.position.fromArray(state.position);
    camera.up.fromArray(state.up);
    camera.lookAt(...state.target);
    camera.updateMatrixWorld();
    const projected = [];
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          projected.push(new Vector3(x, y, z).project(camera));
    const fraction =
      (Math.max(...projected.map(point => point.y)) -
        Math.min(...projected.map(point => point.y))) /
      (2 * (1 - VOICE_HUD_SAFE_AREA));
    expect(fraction).toBeGreaterThanOrEqual(0.7);
    expect(fraction).toBeLessThanOrEqual(0.76 + 1e-10);
    expect(projected.every(point => Math.abs(point.x) <= 1)).toBe(true);
    expect(Math.min(...projected.map(point => point.y))).toBeGreaterThan(
      2 * VOICE_HUD_SAFE_AREA - 1,
    );
    expect(Math.max(...projected.map(point => point.y))).toBeLessThan(1);
  });

  it('targets the transformed bounds once and keeps a narrow viewport within its width', () => {
    const bounds = new Box3(new Vector3(100, 200, 300), new Vector3(108, 226, 308));
    const state = getToothStudyCamera(tooth('46'), undefined, bounds, 'buccal', 45, 0.3);
    expect(state.target[1]).toBeLessThan(213);
    const camera = new PerspectiveCamera(45, 0.3, 0.1, 1000);
    camera.position.fromArray(state.position);
    camera.up.fromArray(state.up);
    camera.lookAt(...state.target);
    camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          expect(Math.abs(new Vector3(x, y, z).project(camera).x)).toBeLessThan(1);
  });
});
