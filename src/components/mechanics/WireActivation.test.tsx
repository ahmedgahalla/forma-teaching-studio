// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { dentalCaseFromAtlas } from '@/lib/atlas-assets';
import type { DentalCase } from '@/lib/geometry';
import { createTeachingRuntime } from '@/lib/teaching-runtime';
import { createMechanicsExperiment, solveMechanics, transitionMechanics } from '@/lib/mechanics';
import { calculateMechanics } from '@/lib/mechanics-client';
import { mechanicsDisplayPoses } from '@/lib/mechanics-presentation';
import { mechanicsCommandContext } from '@/lib/mechanics-commands';
import { setupToothStudy } from '../case/tooth-study.fixtures';
import { createMechanicsActions } from '../case/actions-mechanics';
import MechanicsPanel, { DEFAULT_WIRE_PRESET } from './MechanicsPanel';

vi.mock('@/lib/mechanics-client', () => ({ calculateMechanics: vi.fn() }));
let model: DentalCase, root: Root, container: HTMLDivElement;
let fixture: ReturnType<typeof setupToothStudy>;
let runtime: ReturnType<typeof createTeachingRuntime>;
let request: Promise<void> | undefined;
const upper = ['13', '12', '11', '21', '22', '23'];
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
});
afterAll(() => {
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(calculateMechanics).mockImplementation(async input => solveMechanics(input));
  fixture = setupToothStudy();
  const { api, refs, host } = fixture;
  api.setModel(model);
  api.setSelectedIds(upper);
  api.setSelected('11');
  api.setWirePreset(DEFAULT_WIRE_PRESET);
  let experiment = createMechanicsExperiment(model);
  experiment = transitionMechanics(experiment, { type: 'brackets', teeth: upper, installed: true });
  experiment = transitionMechanics(experiment, {
    type: 'wire',
    id: 'wire',
    teeth: upper,
    material: 'beta-titanium',
    section: { shape: 'round', diameterMm: 0.014 * 25.4 },
  });
  api.setMechanics(experiment);
  Object.defineProperty(api, 'activeExperiment', { get: () => api.mechanics });
  Object.assign(api, createMechanicsActions(api, refs));
  const context = host.context;
  host.context = () => ({
    ...context(),
    availableIds: model.teeth.map(tooth => tooth.id),
    mechanics: mechanicsCommandContext(api.mechanics!, api.mechanicsFocus, DEFAULT_WIRE_PRESET),
  });
  const apply = host.apply;
  host.apply = async (action, signal) => {
    if (action.kind === 'mechanics') await api.applyMechanics(action.action, signal);
    else await apply(action, signal);
  };
  runtime = createTeachingRuntime(host);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  runtime.dispose();
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
async function render() {
  const { api } = fixture;
  await act(async () =>
    root.render(
      <MechanicsPanel
        experiment={api.mechanics!}
        teeth={model.teeth}
        selectedIds={upper}
        pointed={null}
        focus={{ wireId: 'wire' }}
        preset={DEFAULT_WIRE_PRESET}
        busy={false}
        onPreset={vi.fn()}
        onFocus={vi.fn()}
        onActions={(actions, summary) => {
          request = runtime.submitActions(
            actions.map(action => ({ kind: 'mechanics', action })),
            summary,
          );
        }}
        magnification={api.magnification}
        onMagnification={api.setMagnification}
        onReplay={vi.fn()}
        onFrame={vi.fn()}
        predict={api.predictResponse}
        onPredict={api.setPredictResponse}
        revealed={api.responseRevealed}
        onReveal={vi.fn()}
        forces={false}
        onForces={vi.fn()}
        onExplain={vi.fn()}
      />,
    ),
  );
}
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    item => item.textContent?.trim() === label,
  )!;
  await act(async () => {
    button.click();
    await request;
  });
  await render();
}
async function width(value: string) {
  const input = container.querySelector<HTMLInputElement>(
    '[aria-label="Wire width activation in millimetres"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Set activation');
}
async function activate() {
  await render();
  await width('0.2');
  await click('Show what happens');
  expect(runtime.getState().error, runtime.getState().message).toBe(false);
  expect(fixture.api.mechanics!.result).not.toBeNull();
}

it('calculates and magnifies an actual Atlas wire response only after activation and calculation', async () => {
  const { api } = fixture;
  const reference = structuredClone(api.mechanics!.reference);
  expect(solveMechanics(api.mechanics!).diagnostics.maxDisplacementMm).toBe(0);
  await render();
  await width('0.2');
  expect(api.mechanics!.result).toBeNull();
  expect(api.mechanics!.config.wires[0].expansionMm).toBe(0.2);
  await click('Show what happens');
  expect(runtime.getState().error, runtime.getState().message).toBe(false);
  const result = api.mechanics!.result!;
  expect(result.diagnostics.maxDisplacementMm).toBeGreaterThan(0);
  expect(result.teeth.some(tooth => Math.hypot(...tooth.forceN) > 0.001)).toBe(true);
  expect(api.responseRevealed).toBe(true);
  expect(api.playing).toBe(true);
  expect(api.stage).toBe(0);
  expect(api.magnification).toBeGreaterThan(1);
  const saved = JSON.stringify(result);
  const displayed = mechanicsDisplayPoses(
    reference.transforms,
    result.transforms,
    1,
    api.magnification,
  );
  const moving = result.teeth.find(tooth => Math.hypot(...tooth.displacementMm) > 1e-8)!;
  for (let axis = 0; axis < 3; axis++)
    expect(displayed[moving.id].translation[axis]).toBeCloseTo(
      result.transforms[moving.id].translation[axis] * api.magnification,
      10,
    );
  expect(JSON.stringify(result)).toBe(saved);
  expect(api.mechanics!.reference).toEqual(reference);
  await runtime.submit('undo');
  expect(api.mechanics!.result).toBeNull();
  expect(api.mechanics!.config.wires[0].expansionMm).toBe(0.2);
  await runtime.submit('redo');
  expect(api.mechanics!.result).toEqual(result);
});

it('keeps the calculated answer hidden when Ask students before revealing is selected', async () => {
  fixture.api.setPredictResponse(true);
  await activate();
  expect(fixture.api.responseRevealed).toBe(false);
  expect(fixture.api.playing).toBe(false);
  expect(container.textContent).toContain('Reveal calculated response');
});

it('returns a solved wire to passive without rejected recalculation, and Undo restores the response', async () => {
  await activate();
  const solved = structuredClone(fixture.api.mechanics);
  await width('0');
  expect(runtime.getState().error, runtime.getState().message).toBe(false);
  expect(fixture.api.mechanics!.config.wires[0].expansionMm).toBe(0);
  expect(fixture.api.mechanics!.result).toBeNull();
  expect(fixture.api.plan.current).toEqual(solved!.reference.transforms);
  expect(calculateMechanics).toHaveBeenCalledTimes(1);
  await runtime.submit('undo');
  expect(fixture.api.mechanics).toEqual(solved);
});

it('still recalculates when wire width is zero but an engaged bracket angle remains active', async () => {
  const { api } = fixture;
  await runtime.submitActions(
    [
      {
        kind: 'mechanics',
        action: {
          type: 'bracket-position',
          tooth: '11',
          local: api.mechanics!.config.brackets['11'],
          angleDeg: 0.5,
        },
      },
    ],
    'Change bracket angle',
  );
  await activate();
  await width('0');
  expect(runtime.getState().error, runtime.getState().message).toBe(false);
  expect(api.mechanics!.config.wires[0].expansionMm).toBe(0);
  expect(api.mechanics!.result!.diagnostics.maxDisplacementMm).toBeGreaterThan(0);
  expect(calculateMechanics).toHaveBeenCalledTimes(2);
});

it('recalculates a revised nonzero width and rejects out-of-domain activation without changing the result', async () => {
  const { api } = fixture;
  await activate();
  const first = api.mechanics!.result!.diagnostics.maxDisplacementMm;
  await width('0.1');
  expect(runtime.getState().error, runtime.getState().message).toBe(false);
  expect(api.mechanics!.result!.diagnostics.maxDisplacementMm).toBeCloseTo(first / 2, 8);
  const before = structuredClone(api.mechanics);
  await width('3');
  expect(runtime.getState().error).toBe(true);
  expect(api.mechanics).toEqual(before);
  expect(calculateMechanics).toHaveBeenCalledTimes(2);
});
