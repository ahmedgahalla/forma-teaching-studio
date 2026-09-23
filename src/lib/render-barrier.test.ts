import { describe, expect, it, vi } from 'vitest';
import { createRenderBarrier } from './render-barrier';

describe('render completion barrier', () => {
  it('captures the camera only after the rendered frame has applied its automatic fit', async () => {
    const barrier = createRenderBarrier(), signal = new AbortController().signal;
    let cameraDistance = 180; const captured: number[] = [];
    const after = barrier.wait(signal).then(() => captured.push(cameraDistance));
    await Promise.resolve(); expect(captured).toEqual([]);
    cameraDistance = 45; barrier.rendered(); await after; expect(captured).toEqual([45]);
    cameraDistance = 99; await Promise.resolve(); expect(captured).toEqual([45]);
  });

  it('does not reuse an earlier draw for a newly committed scene', async () => {
    const barrier = createRenderBarrier(); barrier.rendered(); const done = vi.fn();
    const waiting = barrier.wait(new AbortController().signal).then(done);
    await Promise.resolve(); expect(done).not.toHaveBeenCalled(); barrier.rendered(); await waiting; expect(done).toHaveBeenCalledOnce();
  });

  it('unblocks canceled work promptly without resolving other scene waiters', async () => {
    const barrier = createRenderBarrier(), first = new AbortController(), second = new AbortController();
    const canceled = vi.fn(), drawn = vi.fn();
    const a = barrier.wait(first.signal).then(canceled), b = barrier.wait(second.signal).then(drawn);
    first.abort(); await a; expect(canceled).toHaveBeenCalledOnce(); expect(drawn).not.toHaveBeenCalled();
    barrier.rendered(); await b; expect(drawn).toHaveBeenCalledOnce(); expect(canceled).toHaveBeenCalledOnce();
  });

  it('never subscribes an already-canceled request and removes listeners after completion', async () => {
    const barrier = createRenderBarrier(), aborted = new AbortController(); aborted.abort(); const add = vi.spyOn(aborted.signal, 'addEventListener');
    await barrier.wait(aborted.signal); expect(add).not.toHaveBeenCalled();
    const current = new AbortController(), remove = vi.spyOn(current.signal, 'removeEventListener'), waiting = barrier.wait(current.signal);
    barrier.rendered(); await waiting; expect(remove).toHaveBeenCalledOnce(); current.abort(); expect(remove).toHaveBeenCalledOnce();
  });

  it('keeps pending capture across a model renderer rebuild until the replacement draws', async () => {
    const barrier = createRenderBarrier(), done = vi.fn(), waiting = barrier.wait(new AbortController().signal).then(done);
    barrier.reset(); await Promise.resolve(); expect(done).not.toHaveBeenCalled(); barrier.rendered(); await waiting; expect(done).toHaveBeenCalledOnce();
  });

  it('rejects on a render failure and recovers only when a replacement renderer starts', async () => {
    const barrier = createRenderBarrier(), waiting = barrier.wait(new AbortController().signal), error = new Error('Graphics were interrupted.');
    const assertion = expect(waiting).rejects.toThrow('Graphics were interrupted.'); barrier.fail(error); await assertion;
    barrier.rendered(); await expect(barrier.wait(new AbortController().signal)).rejects.toThrow('Graphics were interrupted.');
    barrier.reset(); const recovered = barrier.wait(new AbortController().signal); barrier.rendered(); await expect(recovered).resolves.toBeUndefined();
  });

  it('unblocks and cleans every remaining listener when the viewer unmounts', async () => {
    const barrier = createRenderBarrier(), controller = new AbortController(), remove = vi.spyOn(controller.signal, 'removeEventListener');
    const waiting = barrier.wait(controller.signal); barrier.dispose(); barrier.dispose(); await waiting; expect(remove).toHaveBeenCalledOnce();
    await expect(barrier.wait(new AbortController().signal)).resolves.toBeUndefined(); barrier.rendered(); expect(remove).toHaveBeenCalledOnce();
  });

  it('waits for a real draw after React development cleanup and effect reattachment', async () => {
    const barrier = createRenderBarrier(); barrier.dispose(); barrier.reset(); const done = vi.fn();
    const waiting = barrier.wait(new AbortController().signal).then(done); await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    barrier.rendered(); await waiting; expect(done).toHaveBeenCalledOnce();
  });
});
