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
