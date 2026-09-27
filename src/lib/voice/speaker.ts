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

// Match an unhurried teaching voice (150 words/minute at the spoken rate).
const readingTime = (text: string) => Math.max(2000, (text.split(/\s+/).length * 400) / 0.95);

export function createSpeaker(
  language: () => string,
  caption: (text: string) => void,
  textOnly: (active: boolean) => void = () => {},
) {
  let cancelActive: (() => void) | undefined;
  const stopSpeech = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // A broken speech service must not prevent caption cancellation or fallback.
    }
  };
  const cancel = () => {
    cancelActive?.();
    stopSpeech();
  };
  const speak = (text: string, signal?: AbortSignal) => {
    cancel();
    return new Promise<void>(resolve => {
      if (signal?.aborted) return resolve();
      const chunks = captionChunks(text);
      if (!chunks.length) return resolve();
      let utterance: SpeechSynthesisUtterance | undefined, timer: number | undefined;
      let finished = false,
        canceled = false,
        fallback = false,
        index = 0;
      const detach = () => {
        window.clearTimeout(timer);
        if (utterance) utterance.onstart = utterance.onend = utterance.onerror = null;
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener('abort', abort);
        detach();
        cancelActive = undefined;
        textOnly(false);
        caption('');
        resolve();
      };
      const abort = () => {
        canceled = true;
        stopSpeech();
        finish();
      };
      const next = () => {
        detach();
        if (++index === chunks.length) return finish();
        playChunk();
      };
      const showText = () => {
        if (finished || canceled) return;
        detach();
        fallback = true;
        stopSpeech();
        textOnly(true);
        caption(chunks[index]);
        timer = window.setTimeout(next, readingTime(chunks[index]));
      };
      const playChunk = () => {
        if (fallback || !window.speechSynthesis || !window.SpeechSynthesisUtterance)
          return showText();
        try {
          utterance = new SpeechSynthesisUtterance(chunks[index]);
        } catch {
          return showText();
        }
        const current = utterance;
        current.lang = language();
        current.rate = 0.95;
        const stale = () => finished || canceled || fallback || current !== utterance;
        current.onstart = () => {
          if (stale()) return;
          window.clearTimeout(timer);
          timer = window.setTimeout(showText, readingTime(chunks[index]) + 5000);
        };
        current.onend = () => {
          if (!stale()) next();
        };
        current.onerror = event => {
          if (stale()) return;
          if (signal?.aborted || ['interrupted', 'canceled'].includes(event.error)) finish();
          else showText();
        };
        caption(chunks[index]);
        // Empty/unavailable voice lists can fail silently instead of emitting onerror.
        timer = window.setTimeout(showText, 2000);
        try {
          window.speechSynthesis.speak(current);
        } catch {
          showText();
        }
      };
      cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      playChunk();
    });
  };
  return { speak, cancel };
}
