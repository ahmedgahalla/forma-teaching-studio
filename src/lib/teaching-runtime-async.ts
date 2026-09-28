export const abortable = <T>(task: Promise<T>, signal: AbortSignal) =>
  new Promise<T | undefined>((resolve, reject) => {
    const canceled = () => {
      signal.removeEventListener('abort', canceled);
      resolve(undefined);
    };
    if (signal.aborted) {
      task.catch(() => {});
      resolve(undefined);
      return;
    }
    signal.addEventListener('abort', canceled, { once: true });
    task.then(
      value => {
        signal.removeEventListener('abort', canceled);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', canceled);
        if (signal.aborted) resolve(undefined);
        else reject(error);
      },
    );
  });

export async function waitForPlayback(playing: () => boolean | undefined, signal: AbortSignal) {
  while (playing() && !signal.aborted)
    await new Promise<void>(resolve => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timer = setTimeout(done, 30);
      signal.addEventListener('abort', done, { once: true });
      if (signal.aborted) done();
    });
}
