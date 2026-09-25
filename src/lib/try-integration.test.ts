import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry } from 'three';
import type { DentalCase } from './geometry';
import type { TeachingAction } from './lecture';
import type { TeachingContext } from './classroom';
import { createTeachingRuntime } from './teaching-runtime';
import {
  createTryState,
  serializeTrySession,
  transitionTryMode,
  type PoseCommand,
  type TryState,
} from './try-mode';
import { validateSession, type CaseSession } from './planning';

const geometry = new BoxGeometry(1, 1, 1);
const model: DentalCase = {
  name: 'Integration fixture',
  demo: true,
  gums: [],
  teeth: ['11', '21'].map((id, i) => ({
    id,
    name: id,
    geometry,
    calibrated: true,
    position: [i * 8, 0, 0],
    buccal: [0, 0, 1],
    mesial: [i ? -1 : 1, 0, 0],
    occlusal: [0, -1, 0],
  })),
};
type Scene = { state: TryState; selected: string[]; view: TeachingContext['view'] };
const runtimes: ReturnType<typeof createTeachingRuntime<Scene>>[] = [];
afterEach(() => {
  runtimes.splice(0).forEach(runtime => runtime.dispose());
});

function setup() {
  let scene: Scene = { state: createTryState(), selected: ['11'], view: 'perspective' };
  function reduce(value: Scene, action: TeachingAction): Scene {
    if (action.kind === 'try')
      return { ...value, state: transitionTryMode(model, value.state, action.action) };
    if (
      action.kind === 'dental' &&
      ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
        action.command.type,
      )
    )
      return {
        ...value,
        state: transitionTryMode(model, value.state, {
          type: 'preview',
          edit: { type: 'dental', command: action.command as PoseCommand },
        }),
      };
    if (action.kind === 'select') return { ...value, selected: action.teeth };
    if (action.kind === 'view') return { ...value, view: action.view };
    return value;
  }
  const runtime = createTeachingRuntime<Scene>({
    context: () => ({
      mode: 'case',
      workflowId: null,
      stepIndex: -1,
      selected: scene.selected[0],
      selectedIds: scene.selected,
      availableIds: ['11', '21'],
      synthetic: true,
      revision: 0,
      view: scene.view,
      arch: 'both',
      speed: 1,
      playing: false,
      tryMode: true,
      lockedIds: scene.state.lockedIds,
      tryPreview: !!scene.state.pending,
      tryLastMovement: !!(scene.state.pending || scene.state.lastEdit),
      savedArrangementNames: scene.state.snapshots.map(item => item.name),
    }),
    capture: () => structuredClone(scene),
    restore: saved => {
      scene = structuredClone(saved);
    },
    preflight: (actions, saved) => {
      actions.reduce(reduce, saved || scene);
    },
    apply: action => {
      scene = reduce(scene, action);
    },
    pause: () => {},
    narration: () => '',
    speak: async () => {},
    interpret: async () => {
      throw new Error('Offline');
    },
    publish: () => {},
  });
  runtimes.push(runtime);
  return { runtime, scene: () => scene };
}

describe('Try Mode command-to-geometry integration', () => {
  it('previews a contextual group, applies once, and undoes the whole apply request', async () => {
    const { runtime, scene } = setup();
    await runtime.submit('select upper incisors and move them buccally 1 mm');
    expect(runtime.getState().error).toBe(false);
    expect(scene().selected).toEqual(['11', '21']);
    expect(scene().state.current).toEqual({});
    expect(scene().state.pending?.to['21'].translation).toEqual([0, 0, 1]);
    await runtime.submit('apply preview');
    expect(scene().state.current['11'].translation).toEqual([0, 0, 1]);
    expect(scene().state.pending).toBeNull();
    await runtime.submit('undo that');
    expect(scene().state.current).toEqual({});
    expect(scene().state.pending).not.toBeNull();
    await runtime.submit('redo');
    expect(scene().state.current['21'].translation).toEqual([0, 0, 1]);
  });

  it('performs an explicit preview-and-apply compound as one undoable request', async () => {
    const { runtime, scene } = setup();
    await runtime.submit('select upper incisors then move them buccally 1 mm then apply preview');
    expect(runtime.getState().error).toBe(false);
    expect(scene().state.current['21'].translation[2]).toBe(1);
    await runtime.submit('undo that');
    expect(scene().state.current).toEqual({});
    expect(scene().selected).toEqual(['11']);
    expect(scene().state.pending).toBeNull();
  });

  it('rejects a second pending edit before any earlier display change is applied', async () => {
    const { runtime, scene } = setup();
    await runtime.submit('show front view and move 11 x 1 mm then move 21 x 1 mm');
    expect(runtime.getState().error).toBe(true);
    expect(scene().view).toBe('perspective');
    expect(scene().state.pending).toBeNull();
    expect(scene().state.current).toEqual({});
  });

  it('rejects a locked mutation atomically, even when unrestricted is requested', async () => {
    const { runtime, scene } = setup();
    await runtime.submit('lock tooth 11');
    await runtime.submitActions(
      [
        { kind: 'try', action: { type: 'unrestricted', enabled: true } },
        { kind: 'select', teeth: ['21'] },
        { kind: 'dental', command: { type: 'move', tooth: '11', direction: 'x', amount: 1 } },
      ],
      'Invalid locked edit',
    );
    expect(runtime.getState().error).toBe(true);
    expect(scene().state.unrestricted).toBe(false);
    expect(scene().selected).toEqual(['11']);
    expect(scene().state.current).toEqual({});
  });

  it('replaces a last movement from its original baseline, without accumulation', async () => {
    const { runtime, scene } = setup();
    await runtime.submit('move 11 x 2 mm then apply preview');
    await runtime.submit('make the last movement smaller');
    expect(scene().state.current['11'].translation[0]).toBe(2);
    expect(scene().state.pending?.to['11'].translation[0]).toBe(1);
    await runtime.submit('make the last movement smaller');
    expect(scene().state.pending?.to['11'].translation[0]).toBe(1);
    await runtime.submit('apply preview');
    expect(scene().state.current['11'].translation[0]).toBe(1);
  });

  it('keeps a named comparison separate from a pose restoration', async () => {
    const { runtime, scene } = setup();
    await runtime.submitActions(
      [{ kind: 'try', action: { type: 'save-snapshot', name: 'Baseline' } }],
      'Save baseline',
    );
    await runtime.submit('move 11 x 1 mm then apply preview');
    await runtime.submit('compare with arrangement Baseline');
    expect(runtime.getState().error).toBe(false);
    expect(scene().state.comparisonName).toBe('Baseline');
    expect(scene().state.pending).toBeNull();
    expect(scene().state.current['11'].translation[0]).toBe(1);
  });
});

describe('case session compatibility for Try Mode', () => {
  const base: CaseSession = {
    stages: 10,
    checkpoints: [],
    past: [],
    future: [],
    braces: true,
    roots: false,
    bracketStyle: 'metal',
    ligatureColor: '#299f9b',
  };
  it('reads existing sessions without adding invented Try data', () => {
    expect(validateSession(JSON.parse(JSON.stringify(base)), new Set(['11', '21']))).toEqual(base);
  });
  it('round-trips locks, groups and saved poses, excluding unfinished previews', () => {
    let state = createTryState();
    state = transitionTryMode(model, state, { type: 'lock', teeth: ['21'], locked: true });
    state = transitionTryMode(model, state, { type: 'save-group', name: 'Anchors', teeth: ['21'] });
    state = transitionTryMode(model, state, { type: 'save-snapshot', name: 'Start' });
    state = transitionTryMode(model, state, {
      type: 'preview',
      edit: { type: 'segment-translate', teeth: ['11'], axis: 'x', amount: 1 },
    });
    const saved = { ...base, tryMode: serializeTrySession(state) };
    expect(validateSession(JSON.parse(JSON.stringify(saved)), new Set(['11', '21']))).toEqual(
      saved,
    );
    expect(saved.tryMode).not.toHaveProperty('pending');
    expect(saved.tryMode.lockedIds).toEqual(['21']);
    const corrupt = structuredClone(saved);
    corrupt.tryMode.lockedIds.push('99');
    expect(() => validateSession(corrupt, new Set(['11', '21']))).toThrow();
  });
});
