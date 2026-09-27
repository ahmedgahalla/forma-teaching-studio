// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createSpeaker } from './speaker';

class FakeUtterance {
  lang = '';
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}
class BrokenUtterance {
  constructor() {
    throw new Error('No speech voice');
  }
}
let spoken: FakeUtterance[];
let synthesis: { cancel: Mock<() => void>; speak: Mock<(utterance: FakeUtterance) => number> };
let caption: Mock<(text: string) => void>, fallback: Mock<(active: boolean) => void>;
let speaker: ReturnType<typeof createSpeaker>;
const text = 'Observe the tooth and root movement. '.repeat(8).trim();

beforeEach(() => {
  vi.useFakeTimers();
  spoken = [];
  synthesis = {
    cancel: vi.fn(),
    speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)),
  };
  caption = vi.fn();
  fallback = vi.fn();
  speaker = createSpeaker(() => 'en-GB', caption, fallback);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', synthesis);
});
afterEach(() => {
  speaker.cancel();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('readable speech-unavailable captions', () => {
  it.each(['speechSynthesis', 'SpeechSynthesisUtterance'])(
    'reads every bounded chunk with normal timing when %s is missing',
    async missing => {
      vi.stubGlobal(missing, undefined);
      const completion = speaker.speak(text);
      expect(fallback).toHaveBeenLastCalledWith(true);
      const first = caption.mock.calls[0][0] as string;
      expect(first.length).toBeLessThanOrEqual(100);
      const duration = Math.max(2000, (first.split(/\s+/).length * 400) / 0.95);
      await vi.advanceTimersByTimeAsync(Math.floor(duration) - 1);
      expect(caption).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(caption).toHaveBeenCalledTimes(2);
      expect(caption.mock.calls.every(([value]) => value !== '')).toBe(true);
      await vi.runAllTimersAsync();
      await expect(completion).resolves.toBeUndefined();
      const chunks = caption.mock.calls.map(([value]) => value).filter(Boolean);
      expect(chunks.every(chunk => chunk.length <= 100)).toBe(true);
      expect(chunks.join(' ')).toBe(text);
      expect(caption).toHaveBeenLastCalledWith('');
      expect(fallback).toHaveBeenLastCalledWith(false);
      expect(synthesis.speak).not.toHaveBeenCalled();
    },
  );

  it.each(['audio-busy', 'voice-unavailable', 'synthesis-failed'])(
    'keeps the caption and detaches the failed utterance for %s',
    async error => {
      const completion = speaker.speak('Show roots.');
      const current = spoken[0],
        oldEnd = current.onend;
      current.onerror?.({ error });
      expect(caption).toHaveBeenLastCalledWith('Show roots.');
      expect(fallback).toHaveBeenLastCalledWith(true);
      expect(current.onend).toBeNull();
      expect(current.onerror).toBeNull();
      oldEnd?.();
      await vi.advanceTimersByTimeAsync(1999);
      expect(caption).toHaveBeenLastCalledWith('Show roots.');
      await vi.advanceTimersByTimeAsync(1);
      await expect(completion).resolves.toBeUndefined();
      expect(caption).toHaveBeenLastCalledWith('');
    },
  );

  it.each(['construct', 'speak', 'cancel'] as const)(
    'shows text if the speech service throws from %s',
    async operation => {
      if (operation === 'construct') vi.stubGlobal('SpeechSynthesisUtterance', BrokenUtterance);
      else
        synthesis[operation].mockImplementation(() => {
          throw new Error('No audio');
        });
      const completion = speaker.speak('Show roots.');
      if (operation === 'cancel') spoken[0].onerror?.({ error: 'synthesis-failed' });
      expect(fallback).toHaveBeenLastCalledWith(true);
      expect(caption).toHaveBeenLastCalledWith('Show roots.');
      await vi.runAllTimersAsync();
      await expect(completion).resolves.toBeUndefined();
      expect(caption).toHaveBeenLastCalledWith('');
    },
  );

  it('continues from the next chunk when a later utterance cannot be constructed', async () => {
    const completion = speaker.speak(text);
    vi.stubGlobal('SpeechSynthesisUtterance', BrokenUtterance);
    spoken[0].onend?.();
    expect(fallback).toHaveBeenLastCalledWith(true);
    expect(caption.mock.calls).toHaveLength(2);
    await vi.runAllTimersAsync();
    await completion;
    expect(
      caption.mock.calls
        .map(([value]) => value)
        .filter(Boolean)
        .join(' '),
    ).toBe(text);
    expect(spoken).toHaveLength(1);
  });

  it('falls back when the speech service never starts or reports an error', async () => {
    const completion = speaker.speak('Show roots.');
    expect(fallback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fallback).toHaveBeenLastCalledWith(true);
    expect(caption).toHaveBeenLastCalledWith('Show roots.');
    await vi.advanceTimersByTimeAsync(2000);
    await completion;
    expect(caption).toHaveBeenLastCalledWith('');
  });

  it('waits for spoken completion when speech starts normally', async () => {
    const completion = speaker.speak('Show roots.');
    spoken[0].onstart?.();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fallback).not.toHaveBeenCalled();
    spoken[0].onend?.();
    await completion;
    await vi.runAllTimersAsync();
    expect(fallback.mock.calls).toEqual([[false]]);
  });

  it('uses the same fallback if a started utterance never completes', async () => {
    const completion = speaker.speak('Show roots.');
    spoken[0].onstart?.();
    await vi.advanceTimersByTimeAsync(7000);
    expect(fallback).toHaveBeenLastCalledWith(true);
    await vi.runAllTimersAsync();
    await completion;
    expect(caption).toHaveBeenLastCalledWith('');
  });

  it.each(['abort', 'cancel', 'replace'])(
    'clears caption timers and status on %s',
    async operation => {
      vi.stubGlobal('speechSynthesis', undefined);
      const controller = new AbortController();
      const completion = speaker.speak(text, controller.signal);
      let replacement: Promise<void> | undefined;
      if (operation === 'abort') controller.abort();
      else if (operation === 'cancel') speaker.cancel();
      else replacement = speaker.speak('New reply.');
      await completion;
      expect(caption).toHaveBeenLastCalledWith(operation === 'replace' ? 'New reply.' : '');
      await vi.runAllTimersAsync();
      await replacement;
      expect(caption).toHaveBeenLastCalledWith('');
      expect(fallback).toHaveBeenLastCalledWith(false);
      expect(caption.mock.calls.filter(([value]) => value && value !== 'New reply.')).toHaveLength(
        1,
      );
    },
  );
});
