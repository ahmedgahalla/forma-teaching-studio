import type { SpeechRecognitionConstructor, SpeechRecognitionLike } from './speech';

export type CaptureState = {
  supported: boolean;
  phase: 'idle' | 'starting' | 'listening' | 'finishing';
  transcript: string;
};
/** A release requests the final result. Cancellation never submits captured speech. */
export function createPushToTalk(
  Recognition: SpeechRecognitionConstructor | undefined,
  callbacks: {
    state: (state: CaptureState) => void;
    final: (text: string) => void;
    error: (message: string) => void;
  },
) {
  let state: CaptureState = { supported: !!Recognition, phase: 'idle', transcript: '' };
  let active: SpeechRecognitionLike | null = null,
    generation = 0,
    released = false,
    started = false,
    disposed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const publish = (patch: Partial<CaptureState>) => {
    state = { ...state, ...patch };
    if (!disposed) callbacks.state(state);
  };
  const detach = (r: SpeechRecognitionLike) => {
    r.onstart = r.onresult = r.onerror = r.onend = null;
  };
  const cancel = () => {
    generation++;
    clearTimeout(timeout);
    const r = active;
    active = null;
    if (r) {
      detach(r);
      try {
        r.abort ? r.abort() : r.stop();
      } catch {
        /* Already ended. */
      }
    }
    publish({ phase: 'idle' });
  };
  const fail = (message: string) => {
    cancel();
    callbacks.error(message);
  };
  const finish = () => {
    if (!active || released) return;
    released = true;
    publish({ phase: 'finishing' });
    timeout = setTimeout(
      () => fail('No final transcript arrived. Hold to talk again, or type the command.'),
      5000,
    );
    // A quick release may precede onstart. Calling stop then can fail in browsers.
    if (started)
      try {
        active.stop();
      } catch {
        fail('The microphone stopped unexpectedly. Hold to talk again, or type the command.');
      }
  };
  const start = () => {
    if (disposed || active) return;
    if (!Recognition) {
      callbacks.error(
        'Speech recognition is unavailable here. Open Chrome or Edge, or type a command.',
      );
      return;
    }
    const token = ++generation;
    released = false;
    started = false;
    let r: SpeechRecognitionLike;
    try {
      r = new Recognition();
    } catch {
      fail('The browser could not initialize the microphone.');
      return;
    }
    active = r;
    const finals = new Map<number, string>();
    const current = () => !disposed && token === generation && active === r;
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    publish({ phase: 'starting', transcript: '' });
    r.onstart = () => {
      if (current()) {
        started = true;
        publish({ phase: released ? 'finishing' : 'listening' });
        if (released) {
          try {
            r.stop();
          } catch {
            fail('The microphone stopped unexpectedly. Hold to talk again, or type the command.');
          }
        }
      }
    };
    r.onresult = event => {
      if (!current()) return;
      for (let i = event.resultIndex; i < event.results.length; i++)
        if (event.results[i].isFinal) finals.set(i, event.results[i][0]?.transcript.trim() || '');
      const interim = Array.from(event.results)
        .filter(result => !result.isFinal)
        .map(result => result[0]?.transcript || '')
        .join(' ');
      publish({ transcript: [...finals.values(), interim].filter(Boolean).join(' ').trim() });
    };
    r.onerror = event => {
      if (!current()) return;
      if (event.error === 'no-speech') {
        fail('No speech detected. Hold Space and speak, or type your command.');
        return;
      }
      const messages: Record<string, string> = {
        'not-allowed': 'Allow microphone access in the browser, then hold to talk again.',
        'service-not-allowed':
          'The browser speech service is unavailable. Try Chrome or Edge, or type a command.',
        'audio-capture': 'The microphone is unavailable. Check its connection.',
        network: 'The speech service could not connect. Typed commands remain available.',
      };
      fail(
        messages[event.error] ||
          'Speech recognition stopped. Hold to talk again, or type a command.',
      );
    };
    r.onend = () => {
      if (!current()) return;
      const text = [...finals.values()].filter(Boolean).join(' ').trim(),
        submit = released;
      clearTimeout(timeout);
      detach(r);
      active = null;
      generation++;
      publish({ phase: 'idle', transcript: text });
      if (submit && text) callbacks.final(text);
      else
        callbacks.error(
          submit
            ? 'No final speech was recognized. Please try again.'
            : 'Listening ended before release. Hold to talk again.',
        );
    };
    try {
      r.start();
    } catch {
      fail('The browser could not start speech recognition. Check microphone permission.');
    }
  };
  callbacks.state(state);
  return {
    start,
    finish,
    cancel,
    getState: () => state,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
