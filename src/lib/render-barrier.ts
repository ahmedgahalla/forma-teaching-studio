/** Wait for an actual scene draw; no timer or assumed frame duration. */
export function createRenderBarrier() {
  type Waiter = { finish: () => void; fail: (error: Error) => void };
  const pending = new Set<Waiter>();
  let closed = false, failure: Error | null = null;
  return {
    wait(signal: AbortSignal): Promise<void> {
      if (signal.aborted || closed) return Promise.resolve();
      if (failure) return Promise.reject(failure);
      return new Promise<void>((resolve, reject) => {
        const cleanup = () => { pending.delete(waiter); signal.removeEventListener('abort', finish); };
        const finish = () => { cleanup(); resolve(); };
        const waiter: Waiter = { finish, fail: error => { cleanup(); reject(error); } };
        pending.add(waiter); signal.addEventListener('abort', finish, { once: true });
      });
    },
    rendered() { if (!failure && !closed) [...pending].forEach(waiter => waiter.finish()); },
    fail(error: Error) { failure = error; [...pending].forEach(waiter => waiter.fail(error)); },
    // A model replacement rebuilds the renderer while existing waiters remain pending.
    reset() { failure = null; closed = false; },
    dispose() { closed = true; [...pending].forEach(waiter => waiter.finish()); },
  };
}
