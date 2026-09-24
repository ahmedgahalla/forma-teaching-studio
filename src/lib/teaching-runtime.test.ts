import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTeachingRuntime, type TeachingHost } from './teaching-runtime';
import { validateTeachingPlan, type TeachingContext } from './classroom';
import type { TeachingAction } from './lecture';
import { getTeachingCase, sampleCaseDemonstration, type TeachingCaseId } from './teaching-cases';
import type { Transforms } from './model';

type Scene = {
  context: TeachingContext; distance: number; gums: boolean; roots: boolean;
  answerVisible?: boolean;
  modelId?: string;
  appliancePreset?: Extract<TeachingAction, { kind: 'appliance-display' }>['preset'];
  applianceDisplay?: { preset: Extract<TeachingAction, { kind: 'appliance-display' }>['preset']; progress: number; palate: boolean };
  savedWorkspace?: { modelId: string; distance: number; selected: string; appliancePreset: Extract<TeachingAction, { kind: 'appliance-display' }>['preset'] };
  sourceLesson?: { workflowId: string; stepIndex: number; distance: number };
};
const controllers: { dispose(): void }[] = [];
const deferred = <T>() => { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const external = (actions: TeachingAction[]) => ({ actions, summary: 'Interpreted request', clarification: null });
function setup(inWorkflow = false) {
  let scene: Scene = { context: { mode: inWorkflow ? 'workflow' : 'case', workflowId: inWorkflow ? 'fixed-braces' : null, stepIndex: 0, selected: '11', selectedIds: ['11'], availableIds: ['11', '21'], synthetic: true, revision: 0, view: 'perspective', arch: 'both', speed: 1, playing: false }, distance: 0, gums: true, roots: false };
  const host = {
    context: vi.fn(() => ({ ...scene.context })), capture: vi.fn(() => structuredClone(scene)),
    restore: vi.fn((snapshot: Scene) => { const revision = scene.context.revision + 1; scene = structuredClone(snapshot); scene.context.revision = revision; }),
    preflight: vi.fn((_actions: TeachingAction[], _snapshot?: Scene) => {}),
    apply: vi.fn((action: TeachingAction) => {
      if (action.kind === 'dental') {
        if ('amount' in action.command) scene.distance += action.command.amount;
        if (action.command.type === 'play') scene.context.playing = true;
      }
      if (action.kind === 'select') { scene.context.selectedIds = [...action.teeth]; scene.context.selected = action.teeth[0]; }
      if (action.kind === 'toggle' && action.target === 'gums') scene.gums = action.visible;
      if (action.kind === 'toggle' && action.target === 'roots') scene.roots = action.visible;
      if (action.kind === 'view') scene.context.view = action.view;
      if (action.kind === 'question') scene.answerVisible = action.visible;
      if (action.kind === 'progress') { scene.context.stage = action.value * (scene.context.stages ?? 10); scene.context.playing = false; }
      if (action.kind === 'speed') scene.context.speed = action.value;
      if (action.kind === 'workflow' && action.action === 'play') scene.context.playing = true;
      if (action.kind === 'workflow' && action.action === 'start') { scene.context.mode = 'workflow'; scene.context.workflowId = action.id; scene.context.stepIndex = 0; scene.context.selected = '11'; scene.context.selectedIds = ['11']; }
      if (action.kind === 'anatomy-lesson') { scene.context.mode = 'workflow'; scene.context.workflowId = 'anatomy'; scene.context.stepIndex = action.action === 'translation' ? 1 : action.action === 'tipping' ? 2 : 0; scene.context.playing = false; }
      scene.context.revision++;
    }),
    pause: vi.fn(() => { scene.context.playing = false; }), narration: vi.fn(() => 'Prepared teaching explanation.'),
    speak: vi.fn(async (_text: string, _signal: AbortSignal) => {}),
    interpret: vi.fn(async (_text: string, _context: TeachingContext, _signal: AbortSignal): Promise<unknown> => { throw new Error('Interpreter unavailable'); }),
    publish: vi.fn(),
  } satisfies TeachingHost<Scene>;
  const runtime = createTeachingRuntime(host); controllers.push(runtime);
  return { host, runtime, scene: () => scene };
}
afterEach(() => { controllers.splice(0).forEach(controller => controller.dispose()); vi.useRealTimers(); });

describe('classroom request execution', () => {
  it('sends a polite contextual appliance request through forced AI and independently accepts its matching targets', async () => {
    const { runtime, host, scene } = setup();
    scene().context.selectedIds = ['11', '21'];
    scene().context.mechanics = {
      config: { brackets: {}, wires: [], tads: [], elastics: [], expanders: [], support: 'standard', fixedTeeth: [] },
      bracketAnchors: { '11': [0, 0, 3], '21': [0, 0, 3] }, focus: {}, stageIndex: 0, stageCount: 1, hasResult: false,
    };
    const action: TeachingAction = { kind: 'mechanics', action: { type: 'brackets', teeth: ['11', '21'], installed: true } };
    host.interpret.mockResolvedValue(external([action]));
    await runtime.submit('Could you put brackets on these teeth for me?', { interpreter: 'ai' });
    expect(host.interpret).toHaveBeenCalledOnce();
    expect(host.preflight).toHaveBeenCalledWith([action]);
    expect(host.apply).toHaveBeenCalledWith(action, expect.any(AbortSignal));
    expect(runtime.getState()).toMatchObject({ interpreter: 'ai', error: false });
  });

  it('routes even a known command through AI when explicitly requested and records its provenance', async () => {
    const { runtime, host, scene } = setup();
    host.interpret.mockResolvedValue(external([{ kind: 'toggle', target: 'roots', visible: true }]));
    await runtime.submit('show roots', { interpreter: 'ai' });
    expect(host.interpret).toHaveBeenCalledOnce(); expect(scene().roots).toBe(true);
    expect(runtime.getState()).toMatchObject({ interpreter: 'ai', error: false, message: 'Interpreted request' });
    await runtime.submit('undo', { interpreter: 'ai' });
    expect(scene().roots).toBe(false); expect(host.interpret).toHaveBeenCalledOnce();
    expect(runtime.getState().interpreter).toBe('local');
  });

  it('does not silently substitute local execution after an explicitly requested AI failure', async () => {
    const { runtime, host, scene } = setup();
    await runtime.submit('show roots', { interpreter: 'ai' });
    expect(host.interpret).toHaveBeenCalledOnce(); expect(scene().roots).toBe(false);
    expect(runtime.getState()).toMatchObject({ error: true, interpreter: undefined });
    await runtime.submit('show roots');
    expect(scene().roots).toBe(true); expect(runtime.getState().interpreter).toBe('local');
  });

  it('retains independent amount validation for explicitly requested AI plans', async () => {
    const { runtime, host, scene } = setup();
    host.interpret.mockResolvedValue(external([{ kind: 'dental', command: { type: 'move', tooth: '11', direction: 'buccal', amount: 2 } }]));
    await runtime.submit('move tooth 11 buccally 0.5 mm', { interpreter: 'ai' });
    expect(host.apply).not.toHaveBeenCalled(); expect(scene().distance).toBe(0);
    expect(runtime.getState()).toMatchObject({ error: true, interpreter: undefined });
  });

  it('Stop cancels an explicit AI request without accepting its stale response', async () => {
    const { runtime, host, scene } = setup(), pending = deferred<unknown>();
    host.interpret.mockReturnValue(pending.promise);
    const running = runtime.submit('show roots', { interpreter: 'ai' }); await flush();
    await runtime.submit('stop', { interpreter: 'ai' }); await running;
    pending.resolve(external([{ kind: 'toggle', target: 'roots', visible: true }])); await flush();
    expect(scene().roots).toBe(false); expect(host.apply).not.toHaveBeenCalled();
    expect(runtime.getState().interpreter).toBeUndefined();
  });

  it('awaits an asynchronous host action before executing the next instruction', async () => {
    const { host, scene } = setup(), pending = deferred<void>(), baseApply = host.apply.getMockImplementation()!;
    const asyncApply = vi.fn(async (action: TeachingAction, signal?: AbortSignal) => {
      if (action.kind === 'view') { await pending.promise; if (signal?.aborted) return; }
      baseApply(action);
    });
    const runtime = createTeachingRuntime({ ...host, apply: asyncApply }); controllers.push(runtime);
    const work = runtime.submit('show front view then hide gums'); await flush();
    expect(scene().gums).toBe(true); expect(scene().context.view).toBe('perspective');
    expect(asyncApply).toHaveBeenCalledTimes(1);
    pending.resolve(); await work;
    expect(scene().context.view).toBe('front'); expect(scene().gums).toBe(false);
    await runtime.submit('undo'); expect(scene().context.view).toBe('perspective'); expect(scene().gums).toBe(true);
  });

  it('aborts a pending asynchronous action and cannot execute its trailing instruction', async () => {
    const { host, scene } = setup(), pending = deferred<void>();
    const signals: AbortSignal[] = [];
    const runtime = createTeachingRuntime({ ...host, apply: async (_action, signal) => { signals.push(signal!); await pending.promise; if (!signal?.aborted) scene().gums = false; } }); controllers.push(runtime);
    const work = runtime.submit('show front view then hide roots'); await flush(); runtime.cancel(); await work;
    expect(signals).toHaveLength(1); expect(signals[0].aborted).toBe(true);
    pending.resolve(); await flush(); expect(scene().gums).toBe(true); expect(scene().roots).toBe(false);
    expect(runtime.getLastActions()).toBeUndefined();
  });

  it('stops and undoes the whole previous request from one natural utterance', async () => {
    const { runtime, scene, host } = setup();
    await runtime.submit('move tooth 11 x 1 mm and hide gums');
    expect(scene().distance).toBe(1); expect(scene().gums).toBe(false);
    await runtime.submit('Stop. Undo that.');
    expect(scene().distance).toBe(0); expect(scene().gums).toBe(true); expect(host.interpret).not.toHaveBeenCalled();
  });

  it('positions fractional progress immediately and retains whole-request undo without a playback wait', async () => {
    const { runtime, host, scene } = setup(true);
    scene().context.stages = 9; scene().context.stage = 9;
    await runtime.submitActions([{ kind: 'progress', value: .375 }], 'Show demonstration progress');
    expect(host.apply).toHaveBeenCalledExactlyOnceWith({ kind: 'progress', value: .375 }, expect.any(AbortSignal));
    expect(scene().context.stage).toBe(3.375); expect(scene().context.playing).toBe(false); expect(runtime.getState().phase).toBe('idle');
    await runtime.submit('undo'); expect(scene().context.stage).toBe(9);
    await runtime.submit('redo'); expect(scene().context.stage).toBe(3.375);
    await runtime.submit('pause halfway'); expect(scene().context.stage).toBe(4.5);
    expect(host.interpret).not.toHaveBeenCalled();
  });

  it('restores and replays a whole camera and answer-display request without speaking or moving teeth', async () => {
    const { runtime, host, scene } = setup(true);
    scene().answerVisible = false; scene().distance = 1.25;
    await runtime.submit('show left view and reveal answer');
    expect(scene()).toMatchObject({ answerVisible: true, distance: 1.25, context: { view: 'left' } });
    expect(host.speak).not.toHaveBeenCalled(); expect(host.interpret).not.toHaveBeenCalled();
    await runtime.submit('undo');
    expect(scene()).toMatchObject({ answerVisible: false, distance: 1.25, context: { view: 'perspective' } });
    await runtime.submit('redo');
    expect(scene()).toMatchObject({ answerVisible: true, distance: 1.25, context: { view: 'left' } });
    scene().answerVisible = false;
    await runtime.submit('repeat that');
    expect(scene().answerVisible).toBe(true);
    expect(runtime.getLastActions()).toEqual([{ kind: 'view', view: 'left' }, { kind: 'question', visible: true }]);
    await runtime.submit('explain answer aloud');
    expect(host.narration).toHaveBeenCalledWith('answer'); expect(host.speak).toHaveBeenCalledOnce();
  });

  it('keeps the whole free-workspace request unchanged and clarifies unavailable answers locally', async () => {
    const { runtime, host, scene } = setup();
    await runtime.submit('show left view then reveal explanation');
    expect(host.apply).not.toHaveBeenCalled(); expect(host.interpret).not.toHaveBeenCalled();
    expect(scene().context.view).toBe('perspective');
    expect(runtime.getState()).toMatchObject({ phase: 'idle', error: true, message: expect.stringMatching(/authored question/) });
    expect(runtime.getLastActions()).toBeUndefined();
  });

  it('preserves palette progress and palate state through preflight and whole-request undo without moving teeth', async () => {
    const { runtime, host, scene } = setup(), baseApply = host.apply.getMockImplementation()!;
    scene().distance = 2.25; scene().applianceDisplay = { preset: 'palatal-expander', progress: .2, palate: false };
    host.apply.mockImplementation(action => {
      if (action.kind !== 'appliance-display') return baseApply(action);
      scene().applianceDisplay = { preset: action.preset, progress: action.progress ?? 0, palate: action.palate ?? false };
      scene().context.revision++;
    });
    const action: TeachingAction = { kind: 'appliance-display', preset: 'palatal-expander', progress: .65, palate: true };
    await runtime.submitActions([action], 'Update teaching appliance illustration');
    expect(host.preflight).toHaveBeenCalledExactlyOnceWith([action]);
    expect(host.apply).toHaveBeenCalledExactlyOnceWith(action, expect.any(AbortSignal));
    expect(scene().applianceDisplay).toEqual({ preset: 'palatal-expander', progress: .65, palate: true });
    expect(scene().distance).toBe(2.25);
    await runtime.submit('undo');
    expect(scene().applianceDisplay).toEqual({ preset: 'palatal-expander', progress: .2, palate: false }); expect(scene().distance).toBe(2.25);
    await runtime.submit('redo');
    expect(scene().applianceDisplay).toEqual({ preset: 'palatal-expander', progress: .65, palate: true }); expect(scene().distance).toBe(2.25);
    await runtime.submit('place braces');
    expect(scene().applianceDisplay).toEqual({ preset: 'braces', progress: 0, palate: false }); expect(scene().distance).toBe(2.25);
    expect(host.interpret).not.toHaveBeenCalled();
  });

  it('runs the explore, place appliance, return to source and restore recipe with atomic undo and redo', async () => {
    const { runtime, host, scene } = setup(true), baseApply = host.apply.getMockImplementation()!;
    scene().modelId = 'synthetic-lesson'; scene().distance = 1.5; scene().appliancePreset = 'braces';
    scene().savedWorkspace = { modelId: 'imported-case', distance: -2, selected: '21', appliancePreset: 'braces' };
    scene().context.canRestoreWorkspace = true;
    host.apply.mockImplementation(action => {
      if (action.kind === 'appliance-display') { scene().appliancePreset = action.preset; scene().context.revision++; return; }
      if (action.kind !== 'workspace') return baseApply(action);
      if (action.action === 'explore') {
        scene().sourceLesson = { workflowId: scene().context.workflowId!, stepIndex: scene().context.stepIndex, distance: scene().distance };
        scene().context.mode = 'case'; scene().context.workflowId = null; scene().context.hasWorkflowOrigin = true; scene().context.tryMode = true;
      } else if (action.action === 'lesson') {
        const source = scene().sourceLesson!;
        scene().context.mode = 'workflow'; scene().context.workflowId = source.workflowId; scene().context.stepIndex = source.stepIndex;
      } else if (action.action === 'restore') {
        const saved = scene().savedWorkspace!;
        scene().modelId = saved.modelId; scene().distance = saved.distance; scene().appliancePreset = saved.appliancePreset;
        scene().context.mode = 'case'; scene().context.workflowId = null; scene().context.synthetic = false; scene().context.availableIds = [saved.selected];
        scene().context.selected = saved.selected; scene().context.selectedIds = [saved.selected];
        scene().context.canRestoreWorkspace = false; scene().context.hasWorkflowOrigin = false;
        scene().savedWorkspace = undefined; scene().sourceLesson = undefined;
      }
      scene().context.revision++;
    });
    const withoutRevision = (value: Scene) => ({ ...structuredClone(value), context: { ...value.context, revision: 0 } });
    const before = withoutRevision(scene());
    await runtime.submit('try this setup');
    const explored = withoutRevision(scene());
    expect(explored.context).toMatchObject({ mode: 'case', hasWorkflowOrigin: true, tryMode: true });
    expect(explored.distance).toBe(1.5); expect(explored.savedWorkspace).toEqual(before.savedWorkspace);
    expect(explored.sourceLesson).toEqual({ workflowId: 'fixed-braces', stepIndex: 0, distance: 1.5 });
    host.restore.mockClear();
    await runtime.submit('undo'); expect(host.restore).toHaveBeenCalledOnce(); expect(withoutRevision(scene())).toEqual(before);
    await runtime.submit('redo'); expect(withoutRevision(scene())).toEqual(explored);
    await runtime.submit('place palatal expander');
    const placed = withoutRevision(scene());
    expect(placed.appliancePreset).toBe('palatal-expander'); expect(placed.distance).toBe(explored.distance);
    expect(placed.savedWorkspace).toEqual(before.savedWorkspace); expect(placed.sourceLesson).toEqual(explored.sourceLesson);
    await runtime.submit('undo'); expect(withoutRevision(scene())).toEqual(explored);
    await runtime.submit('redo'); expect(withoutRevision(scene())).toEqual(placed);
    await runtime.submit('return to lesson');
    const returned = withoutRevision(scene());
    expect(returned.context).toMatchObject({ mode: 'workflow', workflowId: 'fixed-braces', stepIndex: 0, canRestoreWorkspace: true });
    expect(returned.savedWorkspace).toEqual(before.savedWorkspace);
    await runtime.submit('undo'); expect(withoutRevision(scene())).toEqual(placed);
    await runtime.submit('redo'); expect(withoutRevision(scene())).toEqual(returned);
    await runtime.submit('restore my workspace');
    const restored = withoutRevision(scene());
    expect(restored).toMatchObject({ modelId: 'imported-case', distance: -2, appliancePreset: 'braces', context: { availableIds: ['21'], selected: '21', synthetic: false } });
    expect(restored.savedWorkspace).toBeUndefined(); expect(restored.sourceLesson).toBeUndefined();
    await runtime.submit('undo'); expect(withoutRevision(scene())).toEqual(returned);
    await runtime.submit('redo'); expect(withoutRevision(scene())).toEqual(restored);
    await runtime.submit('undo last four changes'); expect(withoutRevision(scene())).toEqual(before);
    await runtime.submit('redo last four changes'); expect(withoutRevision(scene())).toEqual(restored);
    expect(host.interpret).not.toHaveBeenCalled();
  });

  it('keeps invalid workspace transfers local and applies none of a compound transfer request', async () => {
    const { runtime, host, scene } = setup(true);
    await runtime.submit('hide gums then explore this setup');
    expect(host.apply).not.toHaveBeenCalled(); expect(scene().gums).toBe(true); expect(runtime.getState().message).toMatch(/separate request/);
    scene().context.mode = 'case'; scene().context.hasWorkflowOrigin = true; scene().context.tryPreview = true;
    await runtime.submit('return to lesson');
    expect(host.apply).not.toHaveBeenCalled(); expect(host.interpret).not.toHaveBeenCalled(); expect(runtime.getState().message).toMatch(/Apply or discard/);
  });

  it('undoes and redoes multiple complete requests with one restore and no partial history consumption', async () => {
    const { runtime, host, scene } = setup();
    await runtime.submit('move tooth eleven x one millimeter then hide gums');
    await runtime.submit('move tooth eleven x two millimeters');
    await runtime.submit('move tooth eleven x three millimeters');
    host.restore.mockClear();
    await runtime.submit('undo last two changes');
    expect(host.restore).toHaveBeenCalledOnce(); expect(scene().distance).toBe(1); expect(scene().gums).toBe(false);
    host.restore.mockClear();
    await runtime.submit('redo last three changes');
    expect(host.restore).not.toHaveBeenCalled(); expect(scene().distance).toBe(1); expect(runtime.getState().message).toMatch(/Only 2/);
    await runtime.submit('redo last two changes'); expect(scene().distance).toBe(6);
    await runtime.submit('undo last three changes'); expect(scene().distance).toBe(0); expect(scene().gums).toBe(true);
  });

  it('does not silently fall back to partial manual history for counted undo', async () => {
    const { runtime, host } = setup(); await runtime.submit('undo last two changes');
    expect(host.apply).not.toHaveBeenCalled(); expect(host.restore).not.toHaveBeenCalled();
    expect(runtime.getState()).toMatchObject({ error: true, message: expect.stringMatching(/Only 0/) });
  });

  it('executes authored button actions through the same validation and atomic request history', async () => {
    const { runtime, host, scene } = setup();
    await runtime.submitActions([{ kind: 'dental', command: { type: 'move', tooth: '11', direction: 'x', amount: 2 } }, { kind: 'toggle', target: 'gums', visible: false }], 'Two button actions');
    expect(host.preflight).toHaveBeenCalledOnce(); expect(scene().distance).toBe(2); expect(scene().gums).toBe(false);
    await runtime.submitActions([{ kind: 'history', action: 'undo', count: 1 }], 'Undo button');
    expect(scene().distance).toBe(0); expect(scene().gums).toBe(true);
    host.apply.mockClear();
    await runtime.submitActions([{ kind: 'dental', command: { type: 'move', tooth: '11', direction: 'x', amount: 99 } }], 'Invalid button');
    expect(host.apply).not.toHaveBeenCalled(); expect(runtime.getState().error).toBe(true);
  });

  it('keeps recognized incomplete Try requests local and rolls no preceding display actions forward', async () => {
    const { runtime, host, scene } = setup(); scene().context.tryMode = true;
    await runtime.submit('hide gums then close selected gap');
    expect(host.interpret).not.toHaveBeenCalled(); expect(host.apply).not.toHaveBeenCalled();
    expect(scene().gums).toBe(true); expect(runtime.getState().message).toMatch(/allocation rule/);
    await runtime.submit('move segment posterior');
    expect(host.interpret).not.toHaveBeenCalled(); expect(runtime.getState().message).toMatch(/How many millimetres/);
  });

  it('cancels an older pending provider request when a validated button action arrives', async () => {
    const { runtime, host, scene } = setup(), response = deferred<unknown>(); host.interpret.mockReturnValue(response.promise);
    const old = runtime.submit('conceal the gingiva'); await flush();
    await runtime.submitActions([{ kind: 'toggle', target: 'roots', visible: true }], 'Show roots'); await old;
    response.resolve(external([{ kind: 'toggle', target: 'gums', visible: false }])); await flush();
    expect(scene().roots).toBe(true); expect(scene().gums).toBe(true); expect(host.interpret.mock.calls[0][2].aborted).toBe(true);
  });
  it('rejects a button plan if the case changes while waiting for the rendered starting frame', async () => {
    const { host, scene } = setup(), ready = deferred<void>();
    const runtime = createTeachingRuntime({ ...host, settle: () => ready.promise }); controllers.push(runtime);
    const work = runtime.submitActions([{ kind: 'toggle', target: 'gums', visible: false }], 'Hide gums'); await flush();
    scene().context.revision++; ready.resolve(); await work;
    expect(host.apply).not.toHaveBeenCalled(); expect(scene().gums).toBe(true); expect(runtime.getState().message).toMatch(/context changed/);
  });

  it('preflights the complete request before changing any scene property', async () => {
    const { host, runtime, scene } = setup();
    host.preflight.mockImplementation(actions => { expect(actions).toHaveLength(2); throw new Error('Geometry cannot perform the second action'); });
    await runtime.submit('hide gums then move tooth eleven buccally one millimeter');
    expect(host.apply).not.toHaveBeenCalled(); expect(scene().distance).toBe(0); expect(scene().gums).toBe(true);
    expect(runtime.getState()).toMatchObject({ phase: 'idle', error: true, message: 'Geometry cannot perform the second action' });
  });

  it('executes sequential targets and undoes/redoes the entire multi-action request', async () => {
    const { runtime, scene, host } = setup();
    await runtime.submit('select tooth twenty one then move it buccally one millimeter then hide gums');
    expect(scene().context.selected).toBe('21'); expect(scene().distance).toBe(1); expect(scene().gums).toBe(false);
    expect(host.interpret).not.toHaveBeenCalled();
    await runtime.submit('undo that');
    expect(scene().context.selected).toBe('11'); expect(scene().distance).toBe(0); expect(scene().gums).toBe(true);
    await runtime.submit('redo that');
    expect(scene().context.selected).toBe('21'); expect(scene().distance).toBe(1); expect(scene().gums).toBe(false);
  });

  it('waits for an animation before executing the following instruction', async () => {
    vi.useFakeTimers(); const { runtime, scene } = setup(true);
    const work = runtime.submit('play demonstration then hide gums'); await flush();
    expect(scene().context.playing).toBe(true); expect(scene().gums).toBe(true);
    scene().context.playing = false; await vi.advanceTimersByTimeAsync(30); await work;
    expect(scene().gums).toBe(false); expect(runtime.getState().phase).toBe('idle');
  });

  it('cancels animation immediately and makes its observed partial result undoable and redoable', async () => {
    vi.useFakeTimers(); const { runtime, scene } = setup();
    const work = runtime.submit('move tooth eleven x one millimeter then play then hide gums'); await flush();
    expect(scene().distance).toBe(1); expect(scene().context.playing).toBe(true);
    runtime.cancel(); await work;
    expect(scene().context.playing).toBe(false); expect(scene().gums).toBe(true); expect(vi.getTimerCount()).toBe(0);
    await runtime.submit('undo'); expect(scene().distance).toBe(0);
    await runtime.submit('redo'); expect(scene().distance).toBe(1); expect(scene().gums).toBe(true); expect(scene().context.playing).toBe(false);
  });

  it('aborts narration even when its provider ignores the signal and rejects much later', async () => {
    const { runtime, host, scene } = setup(true), narration = deferred<void>();
    host.speak.mockReturnValue(narration.promise);
    const work = runtime.submit('explain this step then hide gums'); await flush();
    expect(runtime.getState().phase).toBe('speaking');
    const signal = host.speak.mock.calls[0][1];
    runtime.cancel(); await work;
    expect(signal.aborted).toBe(true); expect(scene().gums).toBe(true); expect(runtime.getState().phase).toBe('idle');
    narration.reject(new Error('Provider eventually failed')); await flush();
    expect(runtime.getState().error).toBe(false);
  });

  it('rolls a failed request back without destroying the existing redo branch', async () => {
    const { runtime, host, scene } = setup();
    await runtime.submit('move tooth eleven x one millimeter'); await runtime.submit('undo');
    const apply = host.apply.getMockImplementation()!;
    host.apply.mockImplementation(action => { if (action.kind === 'toggle') throw new Error('Renderer rejected the change'); apply(action); });
    await runtime.submit('move tooth eleven x two millimeters then hide gums');
    expect(scene().distance).toBe(0); expect(scene().gums).toBe(true); expect(runtime.getState().error).toBe(true);
    await runtime.submit('redo'); expect(scene().distance).toBe(1);
  });

  it('falls back to manual case history only when no whole-request undo entry exists', async () => {
    const { runtime, host } = setup(); await runtime.submit('undo');
    expect(host.apply).toHaveBeenCalledExactlyOnceWith({ kind: 'dental', command: { type: 'undo' } }, expect.any(AbortSignal));
    const other = setup(true); await other.runtime.submit('undo'); expect(other.host.apply).not.toHaveBeenCalled();
  });

  it('restores prior display overrides after starting a workflow', async () => {
    const { runtime, host } = setup();
    await runtime.submit('select tooth twenty one and hide gums then start braces workflow');
    expect(host.apply.mock.calls.map(([action]) => action)).toEqual([
      { kind: 'select', teeth: ['21'] }, { kind: 'toggle', target: 'gums', visible: false }, { kind: 'workflow', action: 'start', id: 'fixed-braces' },
      { kind: 'select', teeth: ['21'] }, { kind: 'toggle', target: 'gums', visible: false },
    ]);
  });
});

// Adapter contract fixture: identities stand in for meshes, while authored poses are real.
// These exercise request history across both mounted scenes, not React event handling.
type CaseWorkspace = {
  modelId: string; geometryId: string; ids: string[]; synthetic: boolean; poses: Transforms;
  progress: number; playing: boolean; speed: .5 | 1 | 2; selectedIds: string[];
  view: TeachingContext['view']; arch: TeachingContext['arch']; camera: number[];
  layers: { roots: boolean; gums: boolean; braces: boolean }; appliance: string;
  attachments: Record<string, string>; lockedIds: string[]; tryActive: boolean; pending: boolean;
  scenario: { caseId: TeachingCaseId; variantId: string; returnProgress: number; exploring: boolean; answerVisible: boolean } | null;
  original: CaseWorkspace | null;
};
type CaseScenes = { mode: 'case' | 'workflow'; scenes: { case: CaseWorkspace; workflow: CaseWorkspace } };
const DEMO_IDS = [1, 2, 3, 4].flatMap(quadrant => Array.from({ length: 7 }, (_, i) => `${quadrant}${i + 1}`));
function setupCaseScenes(mode: CaseScenes['mode'] = 'case') {
  const imported: CaseWorkspace = {
    modelId: 'imported-separate-stls', geometryId: 'uploaded-crown-buffers', ids: ['11', '21', '36'], synthetic: false,
    poses: { '21': { translation: [1.25, -.5, 2], rotation: [0, 7, 0] } }, progress: 1, playing: false,
    speed: .5, selectedIds: ['21'], view: 'right', arch: 'both', camera: [31, 8, 45],
    layers: { roots: false, gums: false, braces: true }, appliance: 'braces', attachments: { '21': 'rectangle' },
    lockedIds: ['36'], tryActive: true, pending: false, scenario: null, original: null,
  };
  let scene: CaseScenes = { mode, scenes: { case: imported, workflow: {
    ...structuredClone(imported), modelId: 'fixed-braces-step-2', geometryId: 'workflow-crown-buffers', ids: [...DEMO_IDS], synthetic: true,
    poses: { '11': { translation: [0, 0, .8], rotation: [0, 0, 5] } }, progress: .6, speed: 2,
    selectedIds: ['11', '12'], view: 'front', camera: [0, 3, 80], attachments: {}, lockedIds: [], tryActive: false,
  } } };
  let revision = 0;
  const context = (snapshot = scene): TeachingContext => {
    const current = snapshot.scenes[snapshot.mode];
    return { mode: snapshot.mode, workflowId: snapshot.mode === 'workflow' ? 'fixed-braces' : null, stepIndex: 2,
      selected: current.selectedIds[0], selectedIds: current.selectedIds, availableIds: current.ids, synthetic: current.synthetic,
      revision, view: current.view, arch: current.arch, speed: current.speed, playing: current.playing, stage: current.progress * 10, stages: 10,
      caseId: current.scenario?.caseId, caseVariantId: current.scenario?.variantId, caseExploring: current.scenario?.exploring,
      canRestoreWorkspace: !!snapshot.scenes.case.original, tryMode: current.tryActive, tryPreview: current.pending, lockedIds: current.lockedIds,
    };
  };
  const host = {
    context: vi.fn(() => context()), capture: vi.fn(() => structuredClone(scene)),
    restore: vi.fn((saved: CaseScenes) => { scene = structuredClone(saved); Object.values(scene.scenes).forEach(item => { item.playing = false; }); revision++; }),
    preflight: vi.fn((actions: TeachingAction[], from?: CaseScenes) => {
      validateTeachingPlan({ actions, summary: '', clarification: null }, context(from), { allowLocalActions: true });
      if (actions.some(action => action.kind === 'case' && action.action !== 'pause') && (from || scene).scenes.case.pending) throw new Error('Apply or discard the workspace preview.');
    }),
    apply: vi.fn((action: TeachingAction) => {
      if (action.kind === 'case') {
        scene.mode = 'case';
        let current = scene.scenes.case;
        if (action.action === 'load') {
          const definition = getTeachingCase(action.id), variant = definition.variants[0];
          current = scene.scenes.case = { ...structuredClone(current), modelId: `prepared:${definition.id}`, geometryId: 'shared-synthetic-crown-buffers', ids: [...DEMO_IDS], synthetic: true,
            poses: sampleCaseDemonstration(definition.id, variant.id, 0), progress: 0, playing: false, selectedIds: [...definition.selectedIds], view: definition.view, arch: definition.arch,
            camera: [0, 10, 70], layers: { roots: false, gums: true, braces: variant.appliance.preset !== 'none' }, appliance: variant.appliance.preset,
            attachments: {}, lockedIds: [], tryActive: false, pending: false,
            scenario: { caseId: definition.id, variantId: variant.id, returnProgress: 0, exploring: false, answerVisible: false }, original: current.original || structuredClone(current),
          };
        } else {
          const metadata = current.scenario!;
          if (action.action === 'progress') current.progress = action.value;
          if (action.action === 'explore') {
            current.poses = sampleCaseDemonstration(metadata.caseId, metadata.variantId, current.progress);
            current.scenario = { ...metadata, exploring: true, returnProgress: current.progress }; current.tryActive = true; current.progress = 1;
          }
          if (action.action === 'variant' || action.action === 'reset' || action.action === 'return') {
            const variantId = action.action === 'variant' ? action.id : metadata.variantId;
            const progress = action.action === 'return' ? metadata.returnProgress : 0;
            current.scenario = { ...metadata, variantId, returnProgress: progress, exploring: false, answerVisible: false };
            current.poses = sampleCaseDemonstration(metadata.caseId, variantId, 0); current.tryActive = false; current.lockedIds = [];
            current.progress = progress;
          }
          if (action.action === 'play') { if (current.progress === 1) current.progress = 0; current.playing = true; }
          if (action.action === 'pause') current.playing = false;
        }
      } else if (action.kind === 'workspace' && action.action === 'restore') {
        scene.scenes.case = structuredClone(scene.scenes.case.original!); scene.mode = 'case';
      } else if (action.kind === 'speed') scene.scenes[scene.mode].speed = action.value;
      else if (action.kind === 'toggle' && action.target === 'roots') scene.scenes[scene.mode].layers.roots = action.visible;
      revision++;
    }),
    pause: vi.fn(() => { Object.values(scene.scenes).forEach(item => { item.playing = false; }); }),
    narration: vi.fn(() => 'Authored case explanation.'), speak: vi.fn(async () => {}),
    interpret: vi.fn(async (): Promise<unknown> => { throw new Error('No interpreter needed for prepared cases.'); }), publish: vi.fn(),
  } satisfies TeachingHost<CaseScenes>;
  const runtime = createTeachingRuntime(host); controllers.push(runtime);
  const load = (id: TeachingCaseId) => runtime.submitActions([{ kind: 'case', action: 'load', id }], `Load ${id}`);
  return { runtime, host, load, scene: () => scene };
}

describe('prepared case whole-scene runtime history', () => {
  it.each(['case', 'workflow'] as const)('loads from %s and undo/redo restores both model identities and the untouched original workspace', async mode => {
    const { runtime, host, load, scene } = setupCaseScenes(mode), before = structuredClone(scene());
    await load('movement-types');
    const loaded = structuredClone(scene());
    expect(loaded.mode).toBe('case'); expect(loaded.scenes.case.scenario).toMatchObject({ caseId: 'movement-types', variantId: 'translation', exploring: false });
    expect(loaded.scenes.case.original).toEqual(before.scenes.case); expect(loaded.scenes.workflow).toEqual(before.scenes.workflow);
    expect(loaded.scenes.case.geometryId).not.toBe(before.scenes.case.geometryId);
    await runtime.submit('undo'); expect(scene()).toEqual(before);
    await runtime.submit('redo'); expect(scene()).toEqual(loaded);
    await runtime.submit('restore my workspace');
    expect(scene().scenes.case).toEqual(before.scenes.case); expect(scene().scenes.workflow).toEqual(before.scenes.workflow);
    await runtime.submit('undo'); expect(scene()).toEqual(loaded);
    expect(host.interpret).not.toHaveBeenCalled();
  });

  it('explores the shown midstage and return, undo and redo preserve the exact edited variation and its source metadata', async () => {
    const { runtime, load, scene } = setupCaseScenes(); await load('movement-types');
    await runtime.submit('set case progress to 40 percent');
    const prepared = structuredClone(scene()), shown = sampleCaseDemonstration('movement-types', 'translation', .4);
    await runtime.submit('explore this arrangement');
    expect(scene().scenes.case.poses).toEqual(shown); expect(shown).not.toEqual(sampleCaseDemonstration('movement-types', 'translation', 0));
    expect(scene().scenes.case.scenario).toMatchObject({ exploring: true, returnProgress: .4 });
    expect(scene().scenes.case.tryActive).toBe(true);
    // A committed drag, selection, locks and question reveal occur outside voice history.
    const edited = scene().scenes.case; edited.poses['11'].translation[0] += .7; edited.lockedIds = ['21']; edited.selectedIds = ['21'];
    edited.camera = [9, 3, 48]; edited.scenario!.answerVisible = true;
    const variation = structuredClone(scene());
    await runtime.submit('return to prepared case');
    const returned = structuredClone(scene());
    expect(returned.scenes.case.progress).toBe(.4); expect(returned.scenes.case.scenario).toMatchObject({ exploring: false, answerVisible: false });
    expect(returned.scenes.case.tryActive).toBe(false); expect(returned.scenes.case.original).toEqual(prepared.scenes.case.original);
    expect(sampleCaseDemonstration('movement-types', 'translation', returned.scenes.case.progress)).toEqual(shown);
    await runtime.submit('undo'); expect(scene()).toEqual(variation);
    await runtime.submit('redo'); expect(scene()).toEqual(returned);
    await runtime.submit('undo last two changes'); expect(scene()).toEqual(prepared);
    await runtime.submit('redo last two changes'); expect(scene()).toEqual(returned);
  });

  it('keeps the first imported backup while switching cases and rejects playback or variant changes during exploration', async () => {
    const { runtime, host, load, scene } = setupCaseScenes(), imported = structuredClone(scene().scenes.case);
    await load('movement-types'); await runtime.submit('explore this arrangement');
    scene().scenes.case.poses['11'].translation[0] = 3;
    const beforeSecond = structuredClone(scene());
    await load('midline-diastema'); const second = structuredClone(scene());
    expect(second.scenes.case.original).toEqual(imported); expect(second.scenes.case.scenario?.variantId).toBe('symmetric-closure');
    await runtime.submit('undo'); expect(scene()).toEqual(beforeSecond);
    host.apply.mockClear();
    await runtime.submit('play case'); await runtime.submit('choose torque');
    expect(host.apply).not.toHaveBeenCalled(); expect(scene()).toEqual(beforeSecond);
    expect(runtime.getState().message).toMatch(/Return to the prepared case/);
    await runtime.submit('redo'); expect(scene()).toEqual(second);
    await runtime.submit('restore my workspace'); expect(scene().scenes.case).toEqual(imported);
  });

  it('replays exploration against its saved prepared frame rather than a different current model, then undo restores that model', async () => {
    const { runtime, host, load, scene } = setupCaseScenes('workflow'); await load('movement-types');
    await runtime.submit('set case progress to 35 percent'); const prepared = structuredClone(scene());
    await runtime.submit('explore this arrangement'); const explored = structuredClone(scene());
    scene().mode = 'workflow'; scene().scenes.workflow.camera = [-8, 5, 69];
    scene().scenes.case.modelId = 'different-manual-model'; scene().scenes.case.ids = ['36'];
    scene().scenes.case.selectedIds = ['36']; scene().scenes.case.scenario = null;
    const manual = structuredClone(scene()); host.preflight.mockClear();
    await runtime.submit('repeat that');
    expect(host.preflight).toHaveBeenCalledWith([{ kind: 'case', action: 'explore' }], prepared);
    expect(scene()).toEqual(explored);
    await runtime.submit('undo'); expect(scene()).toEqual(manual);
    await runtime.submit('redo'); expect(scene()).toEqual(explored);
  });

  it('captures only observed playback progress on Stop and redo never resumes it', async () => {
    vi.useFakeTimers(); const { runtime, load, scene } = setupCaseScenes(); await load('movement-types');
    await runtime.submit('set case progress to 20 percent'); const before = structuredClone(scene());
    const playing = runtime.submit('play case'); await flush(); expect(scene().scenes.case.playing).toBe(true);
    scene().scenes.case.progress = .57; runtime.cancel(); await playing;
    const stopped = structuredClone(scene()); expect(stopped.scenes.case.playing).toBe(false); expect(vi.getTimerCount()).toBe(0);
    await runtime.submit('undo'); expect(scene()).toEqual(before);
    await runtime.submit('redo'); expect(scene()).toEqual(stopped); expect(scene().scenes.case.progress).toBe(.57);
    await runtime.submit('explore this arrangement'); expect(scene().scenes.case.poses).toEqual(sampleCaseDemonstration('movement-types', 'translation', .57));
  });

  it('guards a pending preview in the inactive case workspace and preserves the redo branch after a failed load', async () => {
    const { runtime, host, load, scene } = setupCaseScenes('workflow'), initial = structuredClone(scene());
    scene().scenes.case.pending = true; const pending = structuredClone(scene());
    await load('movement-types'); expect(host.apply).not.toHaveBeenCalled(); expect(scene()).toEqual(pending);
    scene().scenes.case.pending = false; await load('movement-types'); const loaded = structuredClone(scene());
    await runtime.submit('undo'); expect(scene()).toEqual(initial);
    const apply = host.apply.getMockImplementation()!;
    host.apply.mockImplementation(action => { apply(action); throw new Error('Viewer could not accept the new model.'); });
    await load('midline-diastema'); expect(scene()).toEqual(initial); expect(runtime.getState().message).toMatch(/could not accept/);
    host.apply.mockImplementation(apply);
    await runtime.submit('redo'); expect(scene()).toEqual(loaded);
  });
});

describe('interpretation and replay boundaries', () => {
  it('uses configured AI for unfamiliar legacy view wording while Try Mode is active', async () => {
    const { runtime, host, scene } = setup(); scene().context.tryMode = true;
    host.interpret.mockResolvedValue(external([{ kind: 'view', view: 'front' }]));
    await runtime.submit('show me the frontal camera');
    expect(host.interpret).toHaveBeenCalledOnce(); expect(host.preflight).toHaveBeenCalledOnce();
    expect(scene().context.view).toBe('front'); expect(runtime.getState().error).toBe(false);
    host.interpret.mockClear(); host.apply.mockClear();
    await runtime.submit('move segment posterior');
    expect(host.interpret).not.toHaveBeenCalled(); expect(host.apply).not.toHaveBeenCalled();
    expect(runtime.getState().message).toMatch(/How many millimetres/);
    await runtime.submit('move tooth 18 x 1 mm');
    expect(host.interpret).not.toHaveBeenCalled(); expect(runtime.getState().message).toMatch(/not present/);
  });

  it('still refuses AI-supplied Try Mode mechanics after an unfamiliar view request', async () => {
    const { runtime, host, scene } = setup(); scene().context.tryMode = true;
    host.interpret.mockResolvedValue(external([{ kind: 'try', action: { type: 'unrestricted', enabled: true } }]));
    await runtime.submit('show me the frontal camera');
    expect(host.interpret).toHaveBeenCalledOnce(); expect(host.apply).not.toHaveBeenCalled();
    expect(runtime.getState().message).toMatch(/local commands/);
  });

  it('discards a provider response when scene revision changed during interpretation', async () => {
    const { runtime, host, scene } = setup(), response = deferred<unknown>();
    host.interpret.mockReturnValue(response.promise);
    const work = runtime.submit('conceal the gingiva'); await flush(); scene().context.revision++;
    response.resolve(external([{ kind: 'toggle', target: 'gums', visible: false }])); await work;
    expect(host.apply).not.toHaveBeenCalled(); expect(runtime.getState().message).toMatch(/changed/);
  });

  it('validates every external action and refuses invented movement amounts', async () => {
    const { runtime, host } = setup();
    host.interpret.mockResolvedValue(external([{ kind: 'toggle', target: 'gums', visible: false }, { kind: 'dental', command: { type: 'move', tooth: '11', direction: 'buccal', amount: 1 } }]));
    await runtime.submit('conceal the gingiva and shift tooth eleven toward the cheek');
    expect(host.apply).not.toHaveBeenCalled(); expect(host.preflight).not.toHaveBeenCalled();
    expect(runtime.getState().message).toMatch(/explicit/);
  });

  it('settles a superseded interpretation promptly and ignores its late response', async () => {
    const { runtime, host, scene } = setup(), response = deferred<unknown>(); host.interpret.mockReturnValue(response.promise);
    const first = runtime.submit('conceal the gingiva'); await flush();
    await runtime.submit('show roots'); await first;
    expect(host.interpret.mock.calls[0][2].aborted).toBe(true);
    response.resolve(external([{ kind: 'toggle', target: 'gums', visible: false }])); await flush();
    expect(scene().gums).toBe(true); expect(scene().roots).toBe(true); expect(runtime.getState().error).toBe(false);
  });

  it('displays clarification without running or recording any action', async () => {
    const { runtime, host } = setup(true);
    host.interpret.mockResolvedValue({ actions: [], summary: '', clarification: 'Palatal or archwire expansion?' });
    await runtime.submit('show expansion');
    expect(host.apply).not.toHaveBeenCalled(); expect(runtime.getLastActions()).toBeUndefined();
    expect(runtime.getState()).toMatchObject({ phase: 'idle', message: 'Palatal or archwire expansion?' });
  });

  it('preflights replay against its saved starting snapshot before restoring anything', async () => {
    const { runtime, host, scene } = setup(); await runtime.submit('move tooth eleven x one millimeter');
    scene().distance = 20; host.restore.mockClear();
    host.preflight.mockImplementation((_actions, snapshot) => { expect(snapshot?.distance).toBe(0); expect(scene().distance).toBe(20); throw new Error('Replay cannot run'); });
    await runtime.submit('repeat that');
    expect(host.restore).not.toHaveBeenCalled(); expect(scene().distance).toBe(20);
  });

  it('replays from the original request setup and undo returns to the pre-replay manual scene', async () => {
    const { runtime, scene } = setup(); await runtime.submit('set speed to fast then move tooth eleven x one millimeter');
    scene().distance = 20;
    await runtime.submit('repeat that'); expect(scene().distance).toBe(1); expect(scene().context.speed).toBe(2);
    await runtime.submit('undo'); expect(scene().distance).toBe(20);
    await runtime.submit('redo'); expect(scene().distance).toBe(1);
    await runtime.submit('repeat that more slowly'); expect(scene().distance).toBe(1); expect(scene().context.speed).toBe(0.5);
  });

  it('clearing history or disposing cancels active work and prevents late execution', async () => {
    const { runtime, host, scene } = setup(true), narration = deferred<void>(); host.speak.mockReturnValue(narration.promise);
    const work = runtime.submit('explain this step then hide gums'); await flush(); runtime.clearHistory(); await work;
    expect(runtime.getLastActions()).toBeUndefined(); expect(scene().gums).toBe(true);
    runtime.dispose(); host.publish.mockClear(); await runtime.submit('hide gums'); narration.resolve(); await flush();
    expect(scene().gums).toBe(true); expect(host.publish).not.toHaveBeenCalled();
  });

  it('replays an eight-action request slowly without growing history or future interpreter context', async () => {
    const { runtime, host, scene } = setup();
    await runtime.submit('show roots then hide gums then select tooth eleven then show front view then hide roots then show gums then select tooth twenty one then show right view');
    expect(runtime.getLastActions()).toHaveLength(8);
    await runtime.submit('repeat that more slowly');
    expect(scene().context.speed).toBe(0.5); expect(runtime.getLastActions()).toHaveLength(8);
    await runtime.submit('repeat that');
    expect(scene().context.speed).toBe(0.5); expect(runtime.getLastActions()).toHaveLength(8);
    host.interpret.mockResolvedValue({ actions: [], summary: '', clarification: 'Please name a display layer.' });
    await runtime.submit('change the display');
    expect(host.interpret.mock.calls.at(-1)?.[1].lastActions).toHaveLength(8);
  });

  it('clarifies a recognized missing amount without calling AI or executing preceding actions', async () => {
    const { runtime, host, scene } = setup();
    await runtime.submit('show upper arch and move tooth 11 buccally');
    expect(host.interpret).not.toHaveBeenCalled(); expect(host.apply).not.toHaveBeenCalled();
    expect(scene().context.arch).toBe('both'); expect(runtime.getState().message).toMatch(/How many millimetres/);
  });

  it('finishes translation playback before starting tipping in the comparison request', async () => {
    vi.useFakeTimers(); const { runtime, host, scene } = setup();
    const work = runtime.submit('compare translation and tipping'); await flush();
    expect(scene().context.stepIndex).toBe(1); expect(scene().context.playing).toBe(true);
    expect(host.apply.mock.calls.some(([action]) => action.kind === 'anatomy-lesson' && action.action === 'tipping')).toBe(false);
    scene().context.playing = false; await vi.advanceTimersByTimeAsync(30);
    expect(scene().context.stepIndex).toBe(2); expect(scene().context.playing).toBe(true);
    scene().context.playing = false; await vi.advanceTimersByTimeAsync(30); await work;
    expect(runtime.getState().phase).toBe('idle'); expect(runtime.getLastActions()).toHaveLength(4);
  });

  it('waits for the rendered scene before each history capture and cancels a pending render wait', async () => {
    const { host, scene } = setup(), before = deferred<void>(), after = deferred<void>();
    const settle = vi.fn().mockReturnValueOnce(before.promise).mockReturnValueOnce(after.promise);
    const runtime = createTeachingRuntime({ ...host, settle }); controllers.push(runtime);
    const work = runtime.submit('show front view'); await flush();
    expect(host.apply).not.toHaveBeenCalled(); expect(host.capture).not.toHaveBeenCalled();
    before.resolve(); await flush(); expect(scene().context.view).toBe('front');
    expect(host.capture).toHaveBeenCalledOnce(); expect(runtime.getLastActions()).toBeUndefined();
    after.resolve(); await work; expect(host.capture).toHaveBeenCalledTimes(2); expect(runtime.getLastActions()).toHaveLength(1);
    const pending = deferred<void>(); settle.mockReturnValueOnce(pending.promise);
    const canceled = runtime.submit('hide gums'); await flush(); runtime.cancel(); await canceled;
    expect(scene().gums).toBe(true); pending.resolve(); await flush(); expect(runtime.getState().phase).toBe('idle');
  });
});
