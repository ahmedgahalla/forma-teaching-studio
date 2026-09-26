import type { SpeechRecognitionConstructor, SpeechRecognitionLike } from '../speech';
import { createWakePhraseGate, stripWakePhrase } from './wake-phrase';

export type HandsFreeState = {
  supported: boolean;
  active: boolean;
  phase: 'idle' | 'starting' | 'listening' | 'paused' | 'restarting';
  transcript: string;
};
const fatalErrors: Record<string, string> = {
  'not-allowed': 'Hands-free is off. Allow microphone access before turning it on again.',
  'service-not-allowed': 'Hands-free is off. The browser speech service is unavailable.',
  'audio-capture': 'Hands-free is off. Check that the microphone is connected and available.',
};

export function createHandsFree(
  Recognition: SpeechRecognitionConstructor | undefined,
  callbacks: {
    state: (state: HandsFreeState) => void;
    final: (text: string) => void;
    error: (message: string) => void;
    canStop: () => boolean;
  },
  language = 'en-US',
) {
  let state: HandsFreeState = {
    supported: !!Recognition,
    active: false,
    phase: 'idle',
    transcript: '',
  };
  let recognition: SpeechRecognitionLike | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0,
    attempts = 0,
    networkFailures = 0,
    paused = false,
    disposed = false;
  const gate = createWakePhraseGate();
  const publish = (patch: Partial<HandsFreeState>) => {
    state = { ...state, ...patch };
    if (!disposed) callbacks.state(state);
  };
  const release = () => {
    generation++;
    clearTimeout(timer);
    timer = undefined;
    const previous = recognition;
    recognition = null;
    if (!previous) return;
    previous.onstart = previous.onresult = previous.onerror = previous.onend = null;
    try {
      if (previous.abort) previous.abort();
      else previous.stop();
    } catch {
      // A browser may have already closed this recognition session.
    }
  };
  const stop = () => {
    release();
    gate.reset();
    publish({ active: false, phase: 'idle', transcript: '' });
  };
  const fail = (message: string) => {
    stop();
    if (!disposed) callbacks.error(message);
  };
  const restart = () => {
    release();
    if (!state.active || paused || disposed) return;
    publish({ phase: 'restarting', transcript: '' });
    const delay = Math.min(250 * 2 ** Math.min(attempts++, 4), 4000);
    timer = setTimeout(begin, delay);
  };
  const begin = () => {
    timer = undefined;
    if (!Recognition || !state.active || paused || disposed) return;
    const token = ++generation;
    let session: SpeechRecognitionLike;
    try {
      session = new Recognition();
    } catch {
      fail('Hands-free is off. The browser could not initialize the microphone.');
      return;
    }
    recognition = session;
    const current = () => !disposed && token === generation && recognition === session;
    const finalized = new Set<number>();
    let startedAt = Date.now();
    session.lang = language;
    session.continuous = true;
    session.interimResults = true;
    session.maxAlternatives = 1;
    publish({ phase: 'starting', transcript: '' });
    session.onstart = () => {
      if (!current()) return;
      startedAt = Date.now();
      publish({ phase: 'listening' });
    };
    session.onresult = event => {
      if (!current()) return;
      // Only interim text addressed to Forma enters state; other classroom speech is never shown.
      const interim = Array.from(event.results)
        .filter(result => !result.isFinal)
        .map(result => result[0]?.transcript || '')
        .join(' ')
        .trim();
      const addressed = gate.armed() || stripWakePhrase(interim) !== null;
      publish({ transcript: addressed ? interim : '' });
      for (let index = event.resultIndex; index < event.results.length; index++) {
        if (!current()) return;
        const result = event.results[index];
        if (!result.isFinal || finalized.has(index)) continue;
        finalized.add(index);
        attempts = networkFailures = 0;
        const accepted = gate.accept(result[0]?.transcript || '', callbacks.canStop());
        if (accepted) callbacks.final(accepted);
      }
    };
    session.onerror = event => {
      if (!current()) return;
      if (fatalErrors[event.error]) return fail(fatalErrors[event.error]);
      if (event.error === 'network' && ++networkFailures >= 3)
        return fail(
          'Hands-free is off after repeated network failures. Typed commands still work.',
        );
      restart();
    };
    session.onend = () => {
      if (!current()) return;
      if (Date.now() - startedAt >= 10000) attempts = 0;
      restart();
    };
    try {
      session.start();
    } catch {
      fail('Hands-free is off. The browser could not start recognition. Check microphone access.');
    }
  };
  callbacks.state(state);
  return {
    start() {
      if (disposed || state.active) return;
      if (!Recognition) {
        callbacks.error('Speech recognition is unavailable here. Use Chrome or Edge, or type.');
        return;
      }
      attempts = networkFailures = 0;
      gate.reset();
      publish({ active: true, phase: paused ? 'paused' : 'starting', transcript: '' });
      begin();
    },
    stop,
    setPaused(value: boolean) {
      if (disposed || paused === value) return;
      paused = value;
      gate.reset();
      if (!state.active) return;
      if (paused) {
        release();
        publish({ phase: 'paused', transcript: '' });
      } else begin();
    },
    getState: () => state,
    dispose() {
      disposed = true;
      stop();
    },
  };
}
