import type { MechanicsExperiment, MechanicsResult, MechanicsWorkerResponse } from './mechanics/types';

/** One short-lived worker per request makes Stop terminate the actual calculation. */
export function calculateMechanics(experiment: MechanicsExperiment, signal?: AbortSignal): Promise<MechanicsResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Calculation cancelled.', 'AbortError')); return; }
    const worker = new Worker('/workers/mechanics.js?v=1');
    const finish = () => { worker.terminate(); signal?.removeEventListener('abort', abort); clearTimeout(timeout); };
    const abort = () => { finish(); reject(new DOMException('Calculation cancelled.', 'AbortError')); };
    const timeout = setTimeout(() => { finish(); reject(new Error('The calculation exceeded its time limit. Simplify the configuration and try again.')); }, 20000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<MechanicsWorkerResponse>) => {
      if (event.data.requestId !== experiment.revision || signal?.aborted) return;
      finish(); if ('error' in event.data) reject(new Error(event.data.error)); else resolve(event.data.result);
    };
    worker.onerror = () => { finish(); reject(new Error('The mechanics worker could not finish. Your setup is unchanged.')); };
    try { worker.postMessage({ requestId: experiment.revision, experiment }); }
    catch (error) { finish(); reject(error); }
  });
}
