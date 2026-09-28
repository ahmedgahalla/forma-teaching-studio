// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Box3, PerspectiveCamera, Vector3, type WebGLRenderer } from 'three';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createViewerResize } from './viewer-resize';
import { LECTURE_CAMERA_MARGIN, perspectiveFitFrame } from '@/lib/camera-fit';
import { TOOTH_STUDY_CAMERA_MARGIN } from '@/lib/tooth-study/camera';
import { VOICE_HUD_SAFE_AREA } from '@/lib/lecture-layout';

afterEach(() => vi.unstubAllGlobals());

it('resizes actual canvas targets, preserves relative zoom and disposes its observer', () => {
  const disconnect = vi.fn(),
    observe = vi.fn();
  let resized: (() => void) | undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const host = document.createElement('div');
  let width = 800;
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(
    () => ({ width, height: 400 }) as DOMRect,
  );
  const camera = new PerspectiveCamera(34, 2);
  camera.position.set(0, 100, 0);
  camera.up.set(0, 0, -1);
  const controls = { target: new Vector3(), maxDistance: 3000 } as OrbitControls;
  const renderer = { setSize: vi.fn() },
    composer = { setSize: vi.fn() };
  const finish = vi.fn();
  const fit = vi.fn((_direction: Vector3, aspect: number) => {
    expect(finish).toHaveBeenCalled();
    return { distance: 100 / aspect, target: new Vector3() };
  });
  const sizing = createViewerResize(
    host,
    camera,
    controls,
    renderer as unknown as WebGLRenderer,
    composer as unknown as EffectComposer,
    finish,
    fit,
  );
  expect(observe).toHaveBeenCalledWith(host);
  sizing.resize();
  expect(camera.position.toArray()).toEqual([0, 100, 0]);
  expect(renderer.setSize).toHaveBeenCalledWith(800, 400);
  expect(composer.setSize).toHaveBeenCalledWith(800, 400);
  sizing.resize();
  expect(finish).toHaveBeenCalledOnce();
  width = 400;
  resized!();
  expect(camera.aspect).toBe(1);
  expect(camera.position.toArray()).toEqual([0, 200, 0]);
  expect(sizing.width).toBe(400);
  expect(sizing.height).toBe(400);
  width = 0;
  resized!();
  expect(sizing.width).toBe(400);
  expect(finish).toHaveBeenCalledTimes(2);
  sizing.dispose();
  expect(disconnect).toHaveBeenCalledOnce();
});

function framedResize(margin = LECTURE_CAMERA_MARGIN) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const host = document.createElement('div'),
    dimensions = { width: 200, height: 500 };
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => dimensions as DOMRect);
  const bounds = new Box3(new Vector3(-5, -5, -1), new Vector3(5, 5, 1)),
    camera = new PerspectiveCamera(34, 0.4, 0.1, 10000);
  const controls = { target: new Vector3(), maxDistance: 3000 } as OrbitControls;
  const fit = (direction: Vector3, aspect: number) =>
    perspectiveFitFrame(bounds, direction, camera.up, camera.fov, aspect, margin);
  const direction = new Vector3(0, 0, 1),
    initial = fit(direction, camera.aspect);
  controls.target.copy(initial.target);
  camera.position.copy(initial.target).addScaledVector(direction, initial.distance);
  camera.lookAt(controls.target);
  const renderer = { setSize: vi.fn() },
    composer = { setSize: vi.fn() };
  const sizing = createViewerResize(
    host,
    camera,
    controls,
    renderer as unknown as WebGLRenderer,
    composer as unknown as EffectComposer,
    vi.fn(),
    fit,
  );
  sizing.resize();
  return { camera, controls, dimensions, bounds, sizing, fit, direction, initial, renderer };
}

it.each([
  ['lecture', LECTURE_CAMERA_MARGIN],
  ['study', TOOTH_STUDY_CAMERA_MARGIN],
] as const)(
  'keeps %s anatomy above the HUD and inside the full canvas after widening',
  (_, margin) => {
    const { camera, dimensions, bounds, sizing } = framedResize(margin);
    dimensions.width = 1000;
    sizing.resize();
    camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const point = new Vector3(x, y, z).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(1);
          expect(point.y).toBeLessThan(1);
          expect(point.y).toBeGreaterThan(-1 + 2 * VOICE_HUD_SAFE_AREA);
        }
    sizing.dispose();
  },
);

it('retains user pan and relative zoom while moving the safe-area target on resize', () => {
  const { camera, controls, dimensions, sizing, fit, direction, initial } = framedResize();
  const pan = new Vector3(3, -2, 1),
    zoom = 1.4;
  controls.target.copy(initial.target).add(pan);
  camera.position.copy(controls.target).addScaledVector(direction, initial.distance * zoom);
  const next = fit(direction, 2);
  dimensions.width = 1000;
  sizing.resize();
  expect(controls.target.distanceTo(next.target.clone().add(pan))).toBeLessThan(1e-12);
  expect(camera.position.distanceTo(controls.target) / next.distance).toBeCloseTo(zoom, 12);
  sizing.dispose();
});

it('keeps saved camera and target coordinates exact when only pixel dimensions change', () => {
  const { camera, controls, dimensions, sizing, renderer } = framedResize();
  camera.position.set(1.23456789, 27.98765432, 3.14159265);
  controls.target.set(0.12345678, 2.98765432, 0.31415926);
  const position = camera.position.toArray(),
    target = controls.target.toArray();
  dimensions.width = 400;
  dimensions.height = 1000;
  sizing.resize();
  expect(camera.position.toArray()).toEqual(position);
  expect(controls.target.toArray()).toEqual(target);
  expect(renderer.setSize).toHaveBeenLastCalledWith(400, 1000);
  sizing.dispose();
});
