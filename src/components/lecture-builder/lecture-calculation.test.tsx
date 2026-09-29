// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { dentalCaseFromAtlas } from '@/lib/atlas-assets';
import * as assets from '@/lib/anatomy-assets';
import type { DentalCase } from '@/lib/geometry';
import { createCaseJourneyLecture } from '@/lib/lecture-documents/sample-case-journey';
import { calculateMechanics } from '@/lib/mechanics-client';
import { solveMechanics } from '@/lib/mechanics';
import { mechanicsCommandContext } from '@/lib/mechanics-commands';
import { createTeachingRuntime } from '@/lib/teaching-runtime';
import type { TeachingAction } from '@/lib/lecture';
import type { TeachingAdapter } from '../teaching/TeachingController';
import type { ClassroomSnapshot } from '../case/types';
import { setupToothStudy } from '../case/tooth-study.fixtures';
import { createMechanicsActions } from '../case/actions-mechanics';
import { CaseStageDock } from '../case/CaseStageDock';
import { DEFAULT_WIRE_PRESET } from '../mechanics/MechanicsPanel';
import { createLectureSessionActions, EMPTY_LECTURE_SESSION } from './session';
import { canRunLectureMechanics } from './lecture-mechanics';

vi.mock('@/lib/mechanics-client', () => ({ calculateMechanics: vi.fn() }));
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
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

function setup() {
  const document = createCaseJourneyLecture();
  const { api, refs, host } = setupToothStudy();
  api.setModel(model);
  api.setWirePreset(DEFAULT_WIRE_PRESET);
  Object.defineProperty(api, 'activeExperiment', { get: () => api.mechanics });
  Object.assign(api, createMechanicsActions(api, refs));
  let session = { ...EMPTY_LECTURE_SESSION };
  const original = { current: null as ClassroomSnapshot | null };
  const paused = { current: null as ClassroomSnapshot | null };
  const comparison = { current: null as ClassroomSnapshot | null };
  const base: TeachingAdapter = {
    ...host,
    restore: value => host.restore(value as ClassroomSnapshot),
    preflight: (actions, from) => host.preflight(actions, from as ClassroomSnapshot | undefined),
    context: () => ({
      ...host.context(),
      availableIds: api.model.teeth.map(tooth => tooth.id),
      playing: api.playing,
      ...(api.mechanics
        ? {
            mechanics: mechanicsCommandContext(
              api.mechanics,
              api.mechanicsFocus,
              DEFAULT_WIRE_PRESET,
            ),
          }
        : {}),
    }),
    apply: async (action, signal) => {
      if (action.kind === 'mechanics') return api.applyMechanics(action.action, signal);
      await host.apply(action, signal);
      return true;
    },
  };
  const adapter = () =>
    createLectureSessionActions(
      api,
      refs,
      session,
      next => {
        session = next;
      },
      id => (id === document.id ? document : undefined),
      session.documentId ? document : undefined,
      original,
      paused,
      comparison,
    ).decorate(base);
  const runtime = createTeachingRuntime({
    ...host,
    context: () => ({ ...adapter().context(), revision: 0 }),
    capture: () => adapter().capture(),
    restore: value => adapter().restore(value),
    preflight: (actions, from) => adapter().preflight(actions, from),
    apply: async (action, signal) => {
      await adapter().apply(action, signal);
    },
    narration: target => adapter().narration(target),
  });
  let request: Promise<void> | undefined;
  api.teaching = {
    execute: (actions: TeachingAction[], summary: string) =>
      (request = runtime.submitActions(actions, summary)),
    get runtime() {
      return runtime.getState();
    },
  } as typeof api.teaching;
  return {
    api,
    adapter,
    document,
    runtime,
    get session() {
      return session;
    },
    get request() {
      return request;
    },
  };
}

it('calculates authored appliance inputs in place, switches to one playback bar and restores on undo/step reload', async () => {
  vi.mocked(calculateMechanics).mockImplementation(async input => solveMechanics(input));
  const h = setup();
  const container = document.createElement('div'),
    root = createRoot(container);
  try {
    await h.runtime.submitActions(
      [{ kind: 'presentation', action: 'open', id: h.document.id }],
      'Open',
    );
    const index = h.document.steps.findIndex(step => canRunLectureMechanics(step, null));
    await h.runtime.submitActions([{ kind: 'presentation', action: 'go', index }], 'Step');
    const before = h.adapter().capture();
    await act(async () => root.render(<CaseStageDock api={h.api} authored canCalculate />));
    const calculate = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Calculate response',
    )!;
    expect(calculate).toBeDefined();
    await act(async () => {
      calculate.click();
      await vi.waitFor(() => expect(h.api.playing).toBe(true));
      // Complete the model playback normally supplied by the viewer's frame loop.
      h.api.setStage(h.api.stages);
      h.api.setPlaying(false);
      await h.request;
    });
    expect(h.runtime.getState().error).toBe(false);
    expect(h.session).toMatchObject({ index, exploring: false });
    expect(h.api.mechanics?.result?.diagnostics.maxDisplacementMm).toBeGreaterThan(0);
    expect(h.api.playing).toBe(false);
    expect(h.api.toolsOpen).toBe(false);
    await act(async () => root.render(<CaseStageDock api={h.api} authored canCalculate />));
    expect(container.textContent).not.toContain('Calculate response');
    expect(container.querySelectorAll('[aria-label="Demonstration progress"]')).toHaveLength(1);
    await h.runtime.submit('undo');
    expect(h.adapter().capture()).toEqual(before);
    await h.runtime.submit('redo');
    expect(h.api.mechanics?.result).not.toBeNull();
    await h.runtime.submit('next step');
    await h.runtime.submit('previous step');
    expect(h.api.mechanics?.result).toBeNull();
    expect(h.session.index).toBe(index);
  } finally {
    await act(async () => root.unmount());
    h.runtime.dispose();
  }
});

it('allows only a single solve on an activated authored step and keeps passive/comparison/edit guards', async () => {
  const h = setup();
  const solve: TeachingAction = { kind: 'mechanics', action: { type: 'solve' } };
  try {
    await h.runtime.submitActions(
      [{ kind: 'presentation', action: 'open', id: h.document.id }],
      'Open',
    );
    expect(() => h.adapter().preflight([solve])).toThrow(/Explore this step/);
    const index = h.document.steps.findIndex(step => canRunLectureMechanics(step, null));
    await h.runtime.submitActions([{ kind: 'presentation', action: 'go', index }], 'Step');
    expect(() => h.adapter().preflight([solve])).not.toThrow();
    expect(() => h.adapter().preflight([solve, solve])).toThrow(/Explore this step/);
    expect(() =>
      h
        .adapter()
        .preflight([
          { kind: 'mechanics', action: { type: 'tad', id: 'extra', position: [0, 0, 0] } },
        ]),
    ).toThrow(/Explore this step/);
    await h.runtime.submitActions(
      [{ kind: 'presentation', action: 'compare', target: 'start' }],
      'Compare',
    );
    expect(() => h.adapter().preflight([solve])).toThrow(/Explore this step/);
    expect(h.adapter().narration('step')).toContain('Comparison:');
    expect(h.adapter().narration('answer')).toBe(h.adapter().narration('step'));
    expect(h.adapter().narration('step')).not.toContain(h.document.steps[index].answer);
  } finally {
    h.runtime.dispose();
  }
});

it('cancels an unfinished calculation when moving to the next step without publishing an obsolete result', async () => {
  let canceled = false;
  vi.mocked(calculateMechanics).mockImplementation(
    (_input, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            canceled = true;
            reject(new DOMException('Canceled', 'AbortError'));
          },
          { once: true },
        );
      }),
  );
  const h = setup();
  try {
    await h.runtime.submitActions(
      [{ kind: 'presentation', action: 'open', id: h.document.id }],
      'Open',
    );
    const index = h.document.steps.findIndex(step => canRunLectureMechanics(step, null));
    await h.runtime.submitActions([{ kind: 'presentation', action: 'go', index }], 'Step');
    const pending = h.runtime.submitActions(
      [{ kind: 'mechanics', action: { type: 'solve' } }],
      'Calculate',
    );
    await vi.waitFor(() => expect(h.runtime.getState().phase).toBe('executing'));
    await h.runtime.submit('next step');
    await pending;
    expect(canceled).toBe(true);
    expect(h.session.index).toBe(index + 1);
    expect(h.api.mechanics?.result ?? null).toBeNull();
    expect(h.runtime.getState().error).toBe(false);
  } finally {
    h.runtime.dispose();
  }
});
