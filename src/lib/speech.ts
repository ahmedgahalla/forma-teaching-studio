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

export function speechConstructor(browser: {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}): SpeechRecognitionConstructor | undefined {
  const constructor =
    typeof browser.SpeechRecognition === 'function'
      ? browser.SpeechRecognition
      : browser.webkitSpeechRecognition;
  return typeof constructor === 'function'
    ? (constructor as SpeechRecognitionConstructor)
    : undefined;
}
