/** One interruptible speech path for authored narration and optional confirmations. */
function captionChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim().replace(/\s+/g, ' ');
  while (remaining.length > 100) {
    const boundary = remaining.lastIndexOf(' ', 100);
    const end = boundary > 0 ? boundary : 100;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function createSpeaker(language: () => string, caption: (text: string) => void) {
  let cancelActive: (() => void) | undefined;
  const cancel = () => {
    cancelActive?.();
    window.speechSynthesis?.cancel();
  };
  const speak = (text: string, signal?: AbortSignal) => {
    cancel();
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return resolve();
      const chunks = captionChunks(text);
      if (!chunks.length) return resolve();
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        reject(new Error(`Speech output is unavailable. ${text}`));
        return;
      }
      let utterance = new SpeechSynthesisUtterance(chunks[0]);
      let finished = false,
        canceled = false,
        index = 0;
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener('abort', abort);
        utterance.onend = utterance.onerror = null;
        cancelActive = undefined;
        caption('');
        if (error) reject(error);
        else resolve();
      };
      const abort = () => {
        canceled = true;
        window.speechSynthesis.cancel();
        finish();
      };
      const playChunk = () => {
        const current = utterance;
        current.lang = language();
        current.rate = 0.95;
        const stale = () => finished || canceled || current !== utterance;
        current.onend = () => {
          if (stale()) return;
          current.onend = current.onerror = null;
          if (++index === chunks.length) return finish();
          try {
            utterance = new SpeechSynthesisUtterance(chunks[index]);
            playChunk();
          } catch {
            finish(new Error(`Speech output could not start. ${text}`));
          }
        };
        current.onerror = event => {
          if (stale()) return;
          finish(
            signal?.aborted || ['interrupted', 'canceled'].includes(event.error)
              ? undefined
              : new Error(`Speech output could not start. ${text}`),
          );
        };
        caption(chunks[index]);
        try {
          window.speechSynthesis.speak(current);
        } catch {
          finish(new Error(`Speech output could not start. ${text}`));
        }
      };
      cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      playChunk();
    });
  };
  return { speak, cancel };
}
