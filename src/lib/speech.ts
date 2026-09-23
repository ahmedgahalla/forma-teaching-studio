/** Browser speech semantics: https://webaudio.github.io/web-speech-api/ */
export type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>;
};
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
export type SpeechState = { supported: boolean; listening: boolean; transcript: string };
type Callbacks = { onFinal: (text: string) => void; onError: (message: string) => void; onState: (state: SpeechState) => void };

export function speechConstructor(browser: { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }): SpeechRecognitionConstructor | undefined {
  const constructor = typeof browser.SpeechRecognition === 'function' ? browser.SpeechRecognition : browser.webkitSpeechRecognition;
  return typeof constructor === 'function' ? constructor as SpeechRecognitionConstructor : undefined;
}

const errorMessages: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow microphone access in the browser, then start listening again.',
  'service-not-allowed': 'The browser did not allow its speech service. Check browser permissions, then start listening again.',
  'audio-capture': 'The microphone is unavailable. Check its connection and browser permissions, then start listening again.',
  'network': 'The browser speech service could not connect. Check your connection, then start listening again.',
  'language-not-supported': 'This browser speech service does not support English recognition.',
  'aborted': 'Speech recognition was canceled. Start listening again when ready.',
};

/**
 * No microphone starts during construction. Each browser session gets a fresh
 * final-result index set; repeated words in later utterances remain valid.
 * stop/dispose cancel pending results and restarts rather than executing a late
 * final command after the user has stopped listening.
 */
export function createSpeechController(Recognition: SpeechRecognitionConstructor | undefined, callbacks: Callbacks) {
  let state: SpeechState = { supported: !!Recognition, listening: false, transcript: '' };
  let wanted = false, continuous = false, disposed = false, generation = 0;
  let active: SpeechRecognitionLike | null = null, restart: ReturnType<typeof setTimeout> | null = null;
  let lastFinal = '';
  const publish = (patch: Partial<SpeechState>) => {
    const next = { ...state, ...patch };
    if (next.listening === state.listening && next.transcript === state.transcript && next.supported === state.supported) return;
    state = next; if (!disposed) callbacks.onState({ ...state });
  };
  const detach = (recognition: SpeechRecognitionLike) => { recognition.onstart = null; recognition.onresult = null; recognition.onerror = null; recognition.onend = null; };
  const cancel = () => {
    wanted = false; generation++;
    if (restart !== null) { clearTimeout(restart); restart = null; }
    const recognition = active; active = null;
    if (recognition) {
      detach(recognition);
      try { if (recognition.abort) recognition.abort(); else recognition.stop(); } catch { /* An already-ended browser session needs no further cleanup. */ }
    }
    publish({ listening: false });
  };
  const fail = (message: string) => { cancel(); if (!disposed) callbacks.onError(message); };
  function begin() {
    if (!wanted || disposed || !Recognition) return;
    const token = ++generation;
    let recognition: SpeechRecognitionLike;
    try { recognition = new Recognition(); } catch { fail('This browser could not initialize speech recognition. Type a command or try another supported browser.'); return; }
    active = recognition;
    recognition.lang = 'en-US'; recognition.continuous = continuous; recognition.interimResults = true; recognition.maxAlternatives = 1;
    const finalIndexes = new Set<number>();
    const current = () => !disposed && wanted && token === generation && active === recognition;
    recognition.onstart = () => { if (current()) publish({ listening: true }); };
    recognition.onresult = event => {
      if (!current()) return;
      const finals: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal || finalIndexes.has(i)) continue;
        finalIndexes.add(i);
        const text = result[0]?.transcript.trim(); if (text) finals.push(text);
      }
      if (finals.length) lastFinal = finals[finals.length - 1];
      const interim = Array.from(event.results).filter(result => !result.isFinal).map(result => result[0]?.transcript.trim() || '').filter(Boolean).join(' ');
      publish({ transcript: interim || lastFinal });
      for (const text of finals) {
        if (!current()) break;
        // Finish the single utterance BEFORE callback, so it may safely start another session.
        if (!continuous) { cancel(); callbacks.onFinal(text); break; }
        callbacks.onFinal(text);
      }
    };
    recognition.onerror = event => {
      if (!current()) return;
      if (event.error === 'no-speech') {
        if (!continuous) fail('No speech was detected. Start listening and try again.');
        // Continuous mode waits for onend, then resumes without interrupting a lecture.
        return;
      }
      fail(errorMessages[event.error] || 'The browser speech service stopped. Start listening again or type your command.');
    };
    recognition.onend = () => {
      if (!current()) return;
      detach(recognition); active = null;
      if (!continuous) { wanted = false; publish({ listening: false }); return; }
      restart = setTimeout(() => {
        restart = null;
        if (!disposed && wanted && token === generation) begin();
      }, 300);
    };
    try { recognition.start(); } catch { fail('The browser could not start speech recognition. Check microphone access, then try again.'); }
  }
  callbacks.onState({ ...state });
  return {
    getState: () => ({ ...state }),
    start(nextContinuous: boolean) {
      if (disposed) return;
      if (!Recognition) { callbacks.onError('Speech recognition is unavailable in this browser. Type a command or use a supported browser.'); return; }
      if (wanted && continuous === nextContinuous) return;
      cancel(); continuous = nextContinuous; wanted = true; lastFinal = '';
      publish({ listening: true, transcript: '' }); begin();
    },
    stop: cancel,
    dispose() { if (disposed) return; disposed = true; cancel(); },
  };
}
