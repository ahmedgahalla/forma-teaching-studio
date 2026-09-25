import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateMechanics } from './mechanics-client';
import type {
  MechanicsExperiment,
  MechanicsResult,
  MechanicsWorkerResponse,
} from './mechanics/types';

class ControlledWorker {
  static instances: ControlledWorker[] = [];
  static sendError: Error | null = null;
  onmessage: ((event: MessageEvent<MechanicsWorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn(() => {
    if (ControlledWorker.sendError) throw ControlledWorker.sendError;
  });
  terminate = vi.fn();
  constructor(readonly url: string) {
    ControlledWorker.instances.push(this);
  }
  respond(data: MechanicsWorkerResponse) {
    this.onmessage?.({ data } as MessageEvent<MechanicsWorkerResponse>);
  }
}
const experiment = (): MechanicsExperiment => ({
  version: 1,
  revision: 7,
  reference: { teeth: [], transforms: {} },
  config: {
    brackets: {},
    wires: [],
    tads: [],
    elastics: [],
    expanders: [],
    support: 'standard',
    fixedTeeth: [],
  },
  stages: [],
  stageIndex: -1,
  result: null,
  applied: null,
  comparison: null,
});
const result = (): MechanicsResult => ({
  revision: 7,
  transforms: {},
  teeth: [],
  wires: [],
  elastics: [],
  expanders: [],
  tads: [],
  diagnostics: {
    iterations: 0,
    residual: 0,
    maxDisplacementMm: 0,
    maxRotationDeg: 0,
    assumptions: [],
    warnings: [],
  },
});
beforeEach(() => {
  vi.useFakeTimers();
  ControlledWorker.instances = [];
  ControlledWorker.sendError = null;
  vi.stubGlobal('Worker', ControlledWorker);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('mechanics worker lifecycle', () => {
  it('sends one versioned request to the built worker and disposes it after success', async () => {
    const input = experiment(),
      expected = result(),
      control = new AbortController(),
      remove = vi.spyOn(control.signal, 'removeEventListener');
    const pending = calculateMechanics(input, control.signal),
      worker = ControlledWorker.instances[0];
    expect(worker.url).toMatch(/^\/workers\/mechanics\.js/);
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ requestId: 7, experiment: input });
    worker.respond({ requestId: 7, result: expected });
    await expect(pending).resolves.toBe(expected);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('ignores stale request IDs until the matching response arrives', async () => {
    const pending = calculateMechanics(experiment()),
      worker = ControlledWorker.instances[0],
      resolved = vi.fn();
    pending.then(resolved);
    worker.respond({ requestId: 6, result: result() });
    await Promise.resolve();
    expect(resolved).not.toHaveBeenCalled();
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.respond({ requestId: 7, result: result() });
    await pending;
    expect(resolved).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('keeps simultaneous requests isolated even if their experiment revisions match', async () => {
    const first = calculateMechanics(experiment()),
      second = calculateMechanics(experiment());
    const secondResult = { ...result(), diagnostics: { ...result().diagnostics, iterations: 2 } };
    ControlledWorker.instances[1].respond({ requestId: 7, result: secondResult });
    await expect(second).resolves.toBe(secondResult);
    expect(ControlledWorker.instances[0].terminate).not.toHaveBeenCalled();
    ControlledWorker.instances[0].respond({ requestId: 7, result: result() });
    await first;
    expect(ControlledWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });
  it('propagates a rejected solve and terminates its worker', async () => {
    const pending = calculateMechanics(experiment()),
      failed = expect(pending).rejects.toThrow('Outside the declared domain');
    ControlledWorker.instances[0].respond({ requestId: 7, error: 'Outside the declared domain' });
    await failed;
    expect(ControlledWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('reports a worker load/crash failure without leaving a timeout running', async () => {
    const pending = calculateMechanics(experiment()),
      failed = expect(pending).rejects.toThrow(/worker could not finish/);
    ControlledWorker.instances[0].onerror?.();
    await failed;
    expect(ControlledWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up when the browser cannot clone or send the experiment', async () => {
    ControlledWorker.sendError = new DOMException('Uncloneable request', 'DataCloneError');
    const control = new AbortController(),
      remove = vi.spyOn(control.signal, 'removeEventListener');
    await expect(calculateMechanics(experiment(), control.signal)).rejects.toMatchObject({
      name: 'DataCloneError',
    });
    expect(ControlledWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('never starts a worker for an already cancelled request', async () => {
    const control = new AbortController();
    control.abort();
    await expect(calculateMechanics(experiment(), control.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(ControlledWorker.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('Stop terminates actual work and cannot be undone by a late result', async () => {
    const control = new AbortController(),
      pending = calculateMechanics(experiment(), control.signal),
      failed = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const worker = ControlledWorker.instances[0];
    control.abort();
    worker.respond({ requestId: 7, result: result() });
    await failed;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('terminates a stalled or permanently stale request at the bounded timeout', async () => {
    const pending = calculateMechanics(experiment()),
      failed = expect(pending).rejects.toThrow(/time limit/);
    ControlledWorker.instances[0].respond({ requestId: 6, result: result() });
    await vi.advanceTimersByTimeAsync(20000);
    await failed;
    expect(ControlledWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
