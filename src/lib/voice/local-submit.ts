import type { createTeachingRuntime } from '../teaching-runtime';

export async function submitLocalVoice<S>(
  runtime: ReturnType<typeof createTeachingRuntime<S>> | null,
  text: string,
  onLocalAccept: () => void,
) {
  if ((await runtime?.submit(text, { interpreter: 'local', onLocalAccept })) === false) return;
  return runtime?.getState();
}
