// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SpeechRecognitionLike, SpeechResultEvent } from '@/lib/speech';
import { useTeachingVoice } from './useTeachingVoice';

class FakeRecognition implements SpeechRecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = () => this.onstart?.();
  stop = vi.fn();
  abort = vi.fn();
}

let voice: ReturnType<typeof useTeachingVoice>, root: Root, container: HTMLDivElement;
const message = vi.fn();
const options = {
  submit: async () => undefined,
  interrupt: vi.fn(),
  cancel: vi.fn(),
  canStop: () => false,
  message,
};
function Harness() {
  // eslint-disable-next-line react-hooks/globals -- expose the hook state from the mounted test harness
  voice = useTeachingVoice(options);
  return null;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('speechSynthesis', undefined);
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  localStorage.clear();
  message.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('publishes timed fallback narration and its secondary status without a runtime error', async () => {
  const controller = new AbortController();
  let completion!: Promise<void>;
  await act(async () => {
    completion = voice.speak('The cusp is a raised point on the crown.', controller.signal);
  });
  expect(voice.narration).toBe('The cusp is a raised point on the crown.');
  expect(voice.narrationFallback).toBe(true);
  expect(message).not.toHaveBeenCalled();
  await act(async () => vi.runAllTimersAsync());
  await completion;
  expect(voice.narration).toBe('');
  expect(voice.narrationFallback).toBe(false);
  expect(message).not.toHaveBeenCalled();
});

it.each(['stop', 'abort', 'hold'])(
  'interrupts text narration with %s and removes its timer',
  async action => {
    const controller = new AbortController();
    let completion!: Promise<void>;
    await act(async () => {
      completion = voice.speak('Observe the crown and root. '.repeat(8), controller.signal);
    });
    expect(voice.narrationFallback).toBe(true);
    await act(async () => {
      if (action === 'abort') controller.abort();
      else if (action === 'hold') voice.start();
      else voice.stopSpeaking();
      await completion;
    });
    expect(voice.narration).toBe('');
    expect(voice.narrationFallback).toBe(false);
    await act(async () => vi.runAllTimersAsync());
    expect(voice.narration).toBe('');
  },
);

it('resumes hands-free during text fallback so new voice requests remain available', async () => {
  class Utterance {
    onerror: ((event: { error: string }) => void) | null = null;
  }
  const spoken: Utterance[] = [];
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', {
    cancel: vi.fn(),
    speak: (utterance: Utterance) => spoken.push(utterance),
  });
  const controller = new AbortController();
  let completion!: Promise<void>;
  await act(async () => voice.toggleHandsFree());
  expect(voice.voice.phase).toBe('listening');
  await act(async () => {
    completion = voice.speak('Observe the root apex.', controller.signal);
  });
  expect(voice.voice.phase).toBe('paused');
  await act(async () => spoken[0].onerror?.({ error: 'voice-unavailable' }));
  expect(voice.narration).toBe('Observe the root apex.');
  expect(voice.narrationFallback).toBe(true);
  expect(voice.voice.phase).toBe('listening');
  expect(message).not.toHaveBeenCalled();
  await act(async () => {
    controller.abort();
    await completion;
  });
  expect(voice.narration).toBe('');
  expect(voice.voice.phase).toBe('listening');
});
