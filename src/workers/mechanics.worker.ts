import { solveMechanics } from '../lib/mechanics/solver';
import type { MechanicsWorkerRequest, MechanicsWorkerResponse } from '../lib/mechanics/types';

self.onmessage = (event: MessageEvent<MechanicsWorkerRequest>) => {
  const { requestId, experiment } = event.data;
  let message: MechanicsWorkerResponse;
  try {
    message = { requestId, result: solveMechanics(experiment) };
  } catch (error) {
    message = {
      requestId,
      error: error instanceof Error ? error.message : 'The mechanical solve failed.',
    };
  }
  self.postMessage(message);
};
