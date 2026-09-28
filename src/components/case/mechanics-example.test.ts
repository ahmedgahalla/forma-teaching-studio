import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTeachingRuntime } from '@/lib/teaching-runtime';
import { createMechanicsExperiment, solveMechanics, type MechanicsResult } from '@/lib/mechanics';
import { calculateMechanics } from '@/lib/mechanics-client';
import { setupToothStudy } from './tooth-study.fixtures';
import { createMechanicsActions } from './actions-mechanics';
import { prepareMechanicsExample } from './mechanics-example';
import { createTryActions } from './actions-try';

vi.mock('@/lib/mechanics-client', () => ({ calculateMechanics: vi.fn() }));
const action = {
  kind: 'mechanics-example' as const,
  id: 'vertical' as const,
  variant: 'intrusion',
};
const runtimes: ReturnType<typeof createTeachingRuntime>[] = [];
beforeEach(() => {
  vi.mocked(calculateMechanics).mockImplementation(async input => solveMechanics(input));
});
afterEach(() => {
  runtimes.forEach(runtime => runtime.dispose());
  runtimes.length = 0;
  vi.clearAllMocks();
});
function setup() {
  const fixture = setupToothStudy(),
    { api, refs, host } = fixture;
  Object.assign(
    api,
    { activeExperiment: createMechanicsExperiment(api.model) },
    createMechanicsActions(api, refs),
  );
  const apply = host.apply;
  host.apply = async (next, signal) => {
    if (next.kind === 'mechanics-example')
      await api.loadMechanicsExample(next.id, next.variant, signal);
    else await apply(next, signal);
  };
  const runtime = createTeachingRuntime(host);
  runtimes.push(runtime as ReturnType<typeof createTeachingRuntime>);
  return { ...fixture, runtime };
}

describe('atomic example execution through the case runtime', () => {
  it('keeps the calculated answer hidden when prediction mode is enabled', async () => {
    const { api, runtime } = setup();
    api.setPredictResponse(true);
    await runtime.submitActions([action], 'Predict the response');
    expect(runtime.getState().error).toBe(false);
    expect(api.mechanics?.result).toBeTruthy();
    expect(api.responseRevealed).toBe(false);
    expect(api.playing).toBe(false);
    expect(api.predictResponse).toBe(true);
  });
  it('replaces the setup, preserves the original baseline, and restores whole requests with undo/redo', async () => {
    const { api, runtime } = setup();
    api.dispatch({
      type: 'load',
      value: { '11': { translation: [1, 0, 0], rotation: [0, 5, 0] } },
    });
    const before = api.captureClassroom();
    await runtime.submitActions([action], 'Intrusion');
    expect(runtime.getState().error).toBe(false);
    expect(api.mechanics?.reference.transforms['11']).toEqual(before.history.current['11']);
    expect(api.mechanics?.result).toBeTruthy();
    const first = api.captureClassroom();
    await runtime.submitActions([{ ...action, variant: 'extrusion' }], 'Extrusion');
    expect(api.mechanics?.reference).toEqual(first.mechanics?.reference);
    expect(api.mechanics?.config.elastics).toHaveLength(1);
    await runtime.submit('undo');
    expect(api.mechanics).toEqual(first.mechanics);
    await runtime.submit('undo');
    expect(api.captureClassroom()).toEqual(before);
    await runtime.submit('redo');
    expect(api.mechanics).toEqual(first.mechanics);
  });
  it('checks preview, lock, prepared mode and saved replay state without publishing a replacement', async () => {
    const { api, preflight, runtime } = setup();
    const before = api.captureClassroom();
    const preview = {
      ...before,
      sandbox: { ...before.sandbox, pending: {} as NonNullable<typeof before.sandbox.pending> },
    };
    expect(() => preflight([action], preview)).toThrow(/preview/);
    expect(() =>
      preflight([action], { ...before, sandbox: { ...before.sandbox, lockedIds: ['11'] } }),
    ).toThrow(/Unlock/);
    expect(() => preflight([action, { kind: 'stop' }])).toThrow(/separate/);
    api.setSandbox(preview.sandbox);
    await runtime.submitActions([action], 'Rejected preview');
    expect(calculateMechanics).not.toHaveBeenCalled();
    expect(api.mechanics).toBeNull();
    expect(api.sandbox.pending).toBe(preview.sandbox.pending);
  });
  it('does not publish a worker result that arrives after Stop', async () => {
    const { api, runtime } = setup();
    let finish!: (result: MechanicsResult) => void;
    const response = solveMechanics(prepareMechanicsExample(api, action).experiment);
    vi.mocked(calculateMechanics).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const request = runtime.submitActions([action], 'Delayed example');
    await vi.waitFor(() => expect(calculateMechanics).toHaveBeenCalled());
    runtime.cancel();
    finish(response);
    await request;
    expect(api.mechanics).toBeNull();
    expect(api.plan.current).toEqual({});
    expect(api.playing).toBe(false);
  });
  it('leaves the original configuration and pose intact if calculation fails', async () => {
    const { api, runtime } = setup();
    const before = api.captureClassroom();
    vi.mocked(calculateMechanics).mockRejectedValue(new Error('Calculation rejected'));
    await runtime.submitActions([action], 'Rejected calculation');
    expect(runtime.getState()).toMatchObject({ error: true, message: 'Calculation rejected' });
    expect(api.mechanics).toEqual(before.mechanics);
    expect(api.plan.current).toEqual(before.history.current);
  });
  it('refuses partway geometric playback instead of silently changing its baseline', () => {
    const { api, preflight } = setup();
    api.setStage(5);
    expect(() => preflight([action])).toThrow(/Show after/);
  });
  it('rejects partway geometric playback after a real edit rebases an existing mechanics rig', async () => {
    const { api, refs, preflight, runtime } = setup();
    await runtime.submitActions([action], 'Initial response');
    expect(api.mechanics?.result).toBeTruthy();
    const { applyTry } = createTryActions(api, refs);
    applyTry({
      type: 'preview',
      edit: {
        type: 'dental',
        command: {
          type: 'move',
          tooth: '11',
          direction: 'x',
          amount: 0.1,
        },
      },
    });
    applyTry({ type: 'apply' });
    expect(api.mechanics).toBeTruthy();
    expect(api.mechanics?.result).toBeNull();
    expect(api.mechanics?.reference.transforms).toEqual(api.plan.current);
    api.setStage(5);
    api.setPlaying(false);
    const partial = api.captureClassroom();
    expect(() => preflight([action])).toThrow(/Show after/);
    expect(() => api.loadMechanicsExample('vertical', 'extrusion')).toThrow(/Show after/);
    expect(api.captureClassroom()).toEqual(partial);
    expect(calculateMechanics).toHaveBeenCalledTimes(1);
    api.setStage(api.stages);
    expect(() => preflight([action], partial)).toThrow(/Show after/);
    expect(() => preflight([action])).not.toThrow();
  });
  it('allows switching examples partway through an actual calculated response', async () => {
    const { api, preflight, runtime } = setup();
    await runtime.submitActions([action], 'Initial response');
    const reference = api.mechanics!.reference;
    api.setStage(5);
    api.setPlaying(false);
    expect(api.mechanics?.result).toBeTruthy();
    expect(() => preflight([action])).not.toThrow();
    const next = prepareMechanicsExample(api, { ...action, variant: 'extrusion' });
    expect(next.experiment.reference).toEqual(reference);
  });
  it('retains an active uncommitted drag instead of silently cancelling it', () => {
    const { api, preflight } = setup();
    api.setDragPreview({ '11': { translation: [1, 0, 0], rotation: [0, 0, 0] } });
    const drag = api.dragPreview;
    expect(() => preflight([action])).toThrow(/preview/);
    expect(api.dragPreview).toBe(drag);
    expect(calculateMechanics).not.toHaveBeenCalled();
  });
});
