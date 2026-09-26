import { describe, expect, it } from 'vitest';
import { speechConstructor, type SpeechRecognitionLike } from './speech';

class MockRecognition implements SpeechRecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: SpeechRecognitionLike['onstart'] = null;
  onresult: SpeechRecognitionLike['onresult'] = null;
  onerror: SpeechRecognitionLike['onerror'] = null;
  onend: SpeechRecognitionLike['onend'] = null;
  start() {}
  stop() {}
}

describe('browser speech discovery', () => {
  it('prefers the standard constructor and supports the WebKit fallback', () => {
    class Fallback extends MockRecognition {}
    expect(
      speechConstructor({ SpeechRecognition: MockRecognition, webkitSpeechRecognition: Fallback }),
    ).toBe(MockRecognition);
    expect(speechConstructor({ webkitSpeechRecognition: Fallback })).toBe(Fallback);
    expect(speechConstructor({ SpeechRecognition: null, webkitSpeechRecognition: Fallback })).toBe(
      Fallback,
    );
    expect(speechConstructor({})).toBeUndefined();
  });
});
