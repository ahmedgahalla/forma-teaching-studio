// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Vector3 } from 'three';
import type { DentalCase } from '@/lib/geometry';
import type { Transforms } from '@/lib/model';
import { toothMatrix } from '@/lib/analysis';
import { createMechanicsExperiment } from '@/lib/mechanics/state';
import { sampleCaseDemonstration } from '@/lib/teaching-cases';
import type { TryPreview } from '@/lib/try-mode';
import { useDisplayedMotion } from './useDisplayedMotion';
import { useMovementTrail, type MovementTrailInputs } from './useMovementTrail';

type Inputs = Parameters<typeof useDisplayedMotion>[0] &
  Omit<MovementTrailInputs, 'displayedMotion'> & { paused?: boolean };
type Result = ReturnType<typeof useDisplayedMotion> & {
  trail: ReturnType<typeof useMovementTrail>;
};
let root: Root, container: HTMLDivElement, inputs: Inputs, result: Result;
const translated = (x: number): Transforms => ({
  '11': { translation: [x, 0, 0], rotation: [0, 0, 0] },
});
function Harness({ value }: { value: Inputs }) {
  const motion = useDisplayedMotion(value);
  const trail = useMovementTrail({ ...value, displayedMotion: motion.displayedMotion });
  useLayoutEffect(() => {
    result = { ...motion, trail };
  });
  return <output>{value.paused ? 'Paused' : 'Playing'}</output>;
}
function render(change: Partial<Inputs> = {}) {
  inputs = { ...inputs, ...change };
  act(() => root.render(<Harness value={inputs} />));
}
function fixture(): DentalCase {
  return {
    name: 'Calibrated teaching geometry',
    demo: true,
    gums: [],
    teeth: ['11', '21'].map((id, index) => ({
      id,
      name: 'Incisor',
      position: [index * 8, 10, 0],
      buccal: [0, 0, 1],
      mesial: [1, 0, 0],
      occlusal: [0, 1, 0],
      calibrated: true,
      geometry: new BoxGeometry(4, 6, 3),
      rootGeometry: new BoxGeometry(2, 12, 2).translate(0, -8, 0),
    })),
  };
}
function calculated() {
  const experiment = createMechanicsExperiment(inputs.model, translated(1));
  experiment.result = {
    revision: 0,
    transforms: translated(1.02),
    teeth: [],
    wires: [],
    elastics: [],
    expanders: [],
    tads: [],
    diagnostics: {
      iterations: 1,
      residual: 0,
      maxDisplacementMm: 0.02,
      maxRotationDeg: 0,
      assumptions: [],
      warnings: [],
    },
  };
  return experiment;
}
function pendingPreview(): TryPreview {
  const edit: TryPreview['edit'] = {
    type: 'dental',
    command: { type: 'move', tooth: '11', direction: 'x', amount: 4 },
  };
  return {
    from: translated(3),
    to: translated(7),
    currentAtPreview: translated(3),
    label: 'Move 11',
    affectedIds: ['11'],
    edit,
    baseEdit: edit,
    motion: { type: 'linear' },
    revisionOfLast: false,
    collision: {
      baseline: [],
      crossings: [],
      endpoint: [],
      samples: 2,
      sampleLimitReached: false,
      approximation: 'Fixture',
    },
  };
}
function expectTrailPose(progress: number, shown: Transforms) {
  const trail = result.trail!;
  const index = trail.progress.indexOf(progress);
  expect(index).toBeGreaterThanOrEqual(0);
  const tooth = inputs.model.teeth.find(item => item.id === trail.toothId)!;
  const matrix = toothMatrix(tooth, shown);
  for (const [point, samples] of [
    [trail.crownPoint, trail.crown],
    [trail.rootPoint!, trail.root!],
  ] as const) {
    expect(
      new Vector3()
        .fromArray(samples, index * 3)
        .distanceTo(new Vector3(...point).applyMatrix4(matrix)),
    ).toBeLessThan(0.00001);
  }
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  inputs = {
    model: fixture(),
    selected: '11',
    traces: true,
    dragPreview: null,
    toothStudy: null,
    demonstration: null,
    current: translated(2),
    checkpoints: [],
    original: {},
    mechanics: null,
    pending: false,
    responseRevealed: true,
    magnification: 1,
    stage: 8,
    stages: 16,
  };
  render();
});
afterEach(() => {
  act(() => root.unmount());
  for (const tooth of inputs.model.teeth) {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  }
  container.remove();
  vi.unstubAllGlobals();
});

it('retains the sampled path across forward/reverse seeking and unrelated pause rerenders', () => {
  const path = result.displayedMotion,
    trail = result.trail;
  for (const stage of [16, 3, 0, 8]) {
    render({ stage });
    expect(result.displayedMotion).toBe(path);
    expect(result.trail).toBe(trail);
    expectTrailPose(stage / 16, result.shown);
  }
  const shown = result.shown;
  render({ paused: true });
  expect(result.shown).toBe(shown);
  expect(result.trail).toBe(trail);
  expect(container.textContent).toBe('Paused');
});

it('uses the real prepared case path and includes its exact authored corner', () => {
  render({ caseId: 'crowding', variantId: 'position-then-rotation', stage: 0.45 * 16 });
  const expected = sampleCaseDemonstration('crowding', 'position-then-rotation', 0.45);
  expect(result.shown).toEqual(expected);
  expect(result.actualShown).toEqual(expected);
  expect(result.displayedMotion.breaks).toEqual([0, 0.45, 1]);
  expectTrailPose(0.45, expected);
  const trail = result.trail;
  render({ stage: 4 });
  expect(result.trail).toBe(trail);
  expectTrailPose(0.25, sampleCaseDemonstration('crowding', 'position-then-rotation', 0.25));
});

it('preserves every checkpoint corner instead of taking the start-to-end shortcut', () => {
  const corner: Transforms = { '11': { translation: [0, 3, 0], rotation: [0, 0, 0] } };
  render({
    checkpoints: [
      { id: 'corner', name: 'Up', transforms: corner },
      { id: 'back', name: 'Return', transforms: translated(0) },
    ],
    stage: 16 / 3,
  });
  expect(result.displayedMotion.breaks).toEqual([1 / 3, 2 / 3]);
  expect(result.shown).toEqual(corner);
  expectTrailPose(1 / 3, corner);
  expectTrailPose(2 / 3, translated(0));
});

it('gives a pending Try preview priority over an existing hidden mechanics response', () => {
  render({
    mechanics: calculated(),
    demonstration: pendingPreview(),
    pending: true,
    responseRevealed: false,
    magnification: 50,
  });
  expect(result.shown['11'].translation).toEqual([5, 0, 0]);
  expect(result.actualShown).toBe(result.geometricShown);
  expect(result.displayedMotion.traceable).toBe(true);
  expectTrailPose(0.5, translated(5));
  expectTrailPose(0, translated(3));
  expectTrailPose(1, translated(7));
});

it('magnifies the model and both trails together while keeping actual movement unscaled', () => {
  const mechanics = calculated();
  const saved = structuredClone(mechanics.result);
  render({ mechanics, magnification: 50 });
  expect(result.shown['11'].translation[0]).toBeCloseTo(1.5);
  expect(result.actualShown['11'].translation[0]).toBeCloseTo(1.01);
  expectTrailPose(0.5, result.shown);
  const trail = result.trail;
  render({ magnification: 10 });
  expect(result.trail).not.toBe(trail);
  expect(result.shown['11'].translation[0]).toBeCloseTo(1.1);
  expect(result.actualShown['11'].translation[0]).toBeCloseTo(1.01);
  expectTrailPose(0.5, result.shown);
  expect(mechanics.result).toEqual(saved);
});

it('suppresses a hidden mechanics result at every scrub position and restores only after reveal', () => {
  const mechanics = calculated();
  render({ mechanics, responseRevealed: false, magnification: 50 });
  for (const stage of [16, 4, 0, 8]) {
    render({ stage });
    expect(result.trail).toBeNull();
    expect(result.shown).toEqual(mechanics.reference.transforms);
    expect(result.actualShown).toEqual(mechanics.reference.transforms);
  }
  render({ responseRevealed: true });
  expectTrailPose(0.5, result.shown);
  render({ responseRevealed: false });
  expect(result.trail).toBeNull();
});

it('hides trails when disabled, dragging or studying a tooth and recovers the current path', () => {
  render({ traces: false });
  expect(result.trail).toBeNull();
  render({ traces: true, dragPreview: translated(8) });
  expect(result.trail).toBeNull();
  render({
    dragPreview: null,
    toothStudy: {
      tooth: '11',
      view: 'buccal',
      revision: 1,
      explanationVisible: false,
      model: inputs.model,
      prior: {
        camera: null,
        selected: '11',
        selectedIds: ['11'],
        isolated: false,
        roots: true,
        gums: true,
        labels: true,
        arch: 'both',
        view: 'front',
        anatomy: { bone: false, ligament: false, cutaway: false, opacity: 0.5 },
      },
    },
  });
  expect(result.trail).toBeNull();
  render({ toothStudy: null });
  expectTrailPose(0.5, result.shown);
});

it('tracks the primary selection and regenerates after a source edit or undo', () => {
  const original = inputs.current,
    originalTrail = result.trail!;
  render({ selected: '21' });
  expect(result.trail!.toothId).toBe('21');
  expect(result.trail).not.toBe(originalTrail);
  render({ selected: '11', current: translated(6) });
  expect(result.trail!.toothId).toBe('11');
  expectTrailPose(0.5, translated(3));
  const editedTrail = result.trail;
  render({ current: original });
  expect(result.trail).not.toBe(editedTrail);
  expect(result.trail!.crown).toEqual(originalTrail.crown);
  expect(result.trail!.root).toEqual(originalTrail.root);
  render({ selected: '99' });
  expect(result.trail).toBeNull();
});
