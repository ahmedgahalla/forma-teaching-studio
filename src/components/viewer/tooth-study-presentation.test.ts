// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOrthodonticDemo } from '@/lib/demo';
import { TOOTH_ANATOMY_DISCLAIMER } from '@/lib/tooth-anatomy';
import { createStudyCameraGate, createToothStudyPresentation } from './tooth-study-presentation';
import type { ViewerToothStudy } from './viewer-types';
import { TOOTH_STUDY_DISPLAY } from './tooth-study-display';

const study: ViewerToothStudy = { tooth: '16', view: 'buccal', revision: 1 };

it('lets a pending snapshot win when restoring an open study, without a delayed reframe', () => {
  const frame = createStudyCameraGate();
  expect(frame(study, false)).toBe(true);
  const changed = { ...study, view: 'mesial' as const, revision: 2 };
  expect(frame(changed, false)).toBe(true);
  expect(frame(study, true)).toBe(false);
  expect(frame(study, false)).toBe(false);
  expect(frame(null, true)).toBe(false);
  expect(frame(study, true)).toBe(false);
  expect(frame(study, false)).toBe(false);
  expect(frame({ ...study, revision: 2 }, false)).toBe(true);
});

it('projects reusable surface labels, hides the camera-facing surface and disposes the overlay', () => {
  const model = createOrthodonticDemo();
  const camera = new PerspectiveCamera(34, 1.4, 0.1, 10000);
  const host = document.createElement('div');
  const controls = new OrbitControls(camera, host);
  const presentation = createToothStudyPresentation(model, host, camera, controls);
  const transforms = {};
  presentation.prepare(study, transforms, 0, false);
  camera.updateMatrixWorld();
  presentation.render(1000, 700);
  const labels = [...host.querySelectorAll<HTMLSpanElement>('.tooth-study-surface-label')];
  expect(labels).toHaveLength(6);
  expect(labels.find(label => label.textContent === 'Buccal')?.hidden).toBe(true);
  expect(labels.find(label => label.textContent === 'Mesial')?.hidden).toBe(false);
  expect(labels.find(label => label.textContent === 'Apex')?.hidden).toBe(false);
  expect(host.textContent).toContain(TOOTH_ANATOMY_DISCLAIMER);
  const saved = camera.position.clone();
  saved.x += 4;
  camera.position.copy(saved);
  camera.aspect = 2.2;
  camera.updateProjectionMatrix();
  presentation.prepare({ ...study, revision: 2 }, transforms, 0, true);
  expect(camera.position.equals(saved)).toBe(true);
  presentation.prepare({ ...study, revision: 2 }, transforms, 0, false);
  expect(camera.position.equals(saved)).toBe(true);
  presentation.prepare(study, transforms, 0, false);
  presentation.render(1000, 700);
  expect(host.querySelectorAll('.tooth-study-surface-label')[0]).toBe(labels[0]);
  presentation.prepare(null, transforms, 0, true);
  expect(host.querySelector<HTMLDivElement>('.tooth-study-labels')?.hidden).toBe(true);
  presentation.dispose();
  expect(host.childElementCount).toBe(0);
  controls.dispose();
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

it('temporarily removes overlays and editing handles from individual tooth presentation', () => {
  expect(TOOTH_STUDY_DISPLAY).toMatchObject({
    ghost: false,
    gums: false,
    labels: false,
    grid: false,
    roots: true,
    braces: false,
    attachments: false,
    mechanicsForces: false,
    archCurve: undefined,
    traceFrom: undefined,
    anatomy: undefined,
    pointed: null,
    landmarks: [],
    tool: 'orbit',
    measureMode: false,
  });
});
