// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpeaker } from './speaker';

class FakeUtterance {
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}
const spoken: FakeUtterance[] = [];
const synthesis = {
  cancel: vi.fn(),
  speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)),
};
const setup = () => {
  const caption = vi.fn();
  return { caption, speaker: createSpeaker(() => 'en-GB', caption) };
};
beforeEach(() => {
  spoken.length = 0;
  synthesis.cancel.mockReset();
  synthesis.speak.mockReset().mockImplementation(utterance => spoken.push(utterance));
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', synthesis);
});
afterEach(() => vi.unstubAllGlobals());

describe('interruptible speech output', () => {
  it('captions before speaking and clears the caption to resume recognition on completion', async () => {
    let paused = false;
    const caption = vi.fn((text: string) => {
      paused = !!text;
    });
    const speaker = createSpeaker(() => 'en-GB', caption);
    synthesis.speak.mockImplementation(utterance => {
      expect(paused).toBe(true);
      spoken.push(utterance);
      return spoken.length;
    });
    const completion = speaker.speak('Roots are visible.');
    const utterance = spoken[0];
    expect(utterance).toMatchObject({ text: 'Roots are visible.', lang: 'en-GB', rate: 0.95 });
    expect(caption).toHaveBeenCalledWith('Roots are visible.');
    utterance.onend?.();
    await expect(completion).resolves.toBeUndefined();
    expect(caption.mock.calls).toEqual([['Roots are visible.'], ['']]);
    expect(paused).toBe(false);
    expect(utterance.onend).toBeNull();
    expect(utterance.onerror).toBeNull();
  });
  it('abort cancels speech and resolves without relying on browser end callbacks', async () => {
    const { caption, speaker } = setup();
    const controller = new AbortController();
    const completion = speaker.speak('Explain this step.', controller.signal);
    const utterance = spoken[0];
    synthesis.cancel.mockClear();
    controller.abort();
    await expect(completion).resolves.toBeUndefined();
    expect(synthesis.cancel).toHaveBeenCalledOnce();
    expect(caption.mock.calls).toEqual([['Explain this step.'], ['']]);
    expect(utterance.onend).toBeNull();
    expect(utterance.onerror).toBeNull();
  });
  it('does not start or caption an already aborted request', async () => {
    const { caption, speaker } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(speaker.speak('Canceled request', controller.signal)).resolves.toBeUndefined();
    expect(synthesis.speak).not.toHaveBeenCalled();
    expect(caption).not.toHaveBeenCalled();
  });
  it.each(['canceled', 'interrupted'])(
    'cleans up a browser %s event without an error',
    async error => {
      const { caption, speaker } = setup();
      const completion = speaker.speak('Roots are visible.');
      spoken[0].onerror?.({ error });
      await expect(completion).resolves.toBeUndefined();
      expect(caption).toHaveBeenLastCalledWith('');
      expect(spoken[0].onerror).toBeNull();
    },
  );
  it('reports a speech error while clearing the caption and detaching callbacks', async () => {
    const { caption, speaker } = setup();
    const completion = speaker.speak('Show roots.');
    const rejected = expect(completion).rejects.toThrow(
      'Speech output could not start. Show roots.',
    );
    spoken[0].onerror?.({ error: 'audio-busy' });
    await rejected;
    expect(caption).toHaveBeenLastCalledWith('');
    expect(spoken[0].onend).toBeNull();
    expect(spoken[0].onerror).toBeNull();
  });
  it('clears the caption if speechSynthesis.speak throws', async () => {
    const { caption, speaker } = setup();
    synthesis.speak.mockImplementation(() => {
      throw new Error('Browser failed to speak');
    });
    await expect(speaker.speak('Show roots.')).rejects.toThrow('Speech output could not start.');
    expect(caption.mock.calls).toEqual([['Show roots.'], ['']]);
    speaker.cancel();
    expect(caption).toHaveBeenCalledTimes(2);
  });
  it('reports unavailable speech output without a stuck caption', async () => {
    const { caption, speaker } = setup();
    vi.stubGlobal('speechSynthesis', undefined);
    await expect(speaker.speak('Show roots.')).rejects.toThrow('Speech output is unavailable.');
    expect(caption).not.toHaveBeenCalled();
  });
  it('rejects constructor errors before publishing a caption', async () => {
    const { caption, speaker } = setup();
    class BrokenUtterance {
      constructor() {
        throw new Error('Cannot create an utterance');
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', BrokenUtterance);
    await expect(speaker.speak('Show roots.')).rejects.toThrow('Cannot create an utterance');
    expect(caption).not.toHaveBeenCalled();
    expect(synthesis.speak).not.toHaveBeenCalled();
  });
  it('replaces narration and ignores stale completion callbacks from the previous utterance', async () => {
    const { caption, speaker } = setup();
    const first = speaker.speak('First narration.');
    const oldEnd = spoken[0].onend;
    const oldError = spoken[0].onerror;
    const second = speaker.speak('New confirmation.');
    await expect(first).resolves.toBeUndefined();
    oldEnd?.();
    oldError?.({ error: 'synthesis-failed' });
    expect(caption).toHaveBeenLastCalledWith('New confirmation.');
    speaker.cancel();
    await expect(second).resolves.toBeUndefined();
    expect(caption.mock.calls).toEqual([['First narration.'], [''], ['New confirmation.'], ['']]);
  });
  it('cleans up once if cancellation synchronously emits a browser error', async () => {
    const { caption, speaker } = setup();
    const controller = new AbortController();
    const completion = speaker.speak('First narration.', controller.signal);
    synthesis.cancel.mockImplementation(() => spoken[0].onerror?.({ error: 'canceled' }));
    controller.abort();
    await expect(completion).resolves.toBeUndefined();
    speaker.cancel();
    expect(caption.mock.calls).toEqual([['First narration.'], ['']]);
  });
  it('removes the abort listener after completion so a later abort cannot cancel new speech', async () => {
    const { speaker } = setup();
    const oldController = new AbortController();
    const first = speaker.speak('First narration.', oldController.signal);
    spoken[0].onend?.();
    await first;
    const second = speaker.speak('Next narration.');
    synthesis.cancel.mockClear();
    oldController.abort();
    expect(synthesis.cancel).not.toHaveBeenCalled();
    expect(spoken[1].onend).not.toBeNull();
    spoken[1].onend?.();
    await second;
  });

  it('speaks long explanations in bounded captions without resuming recognition between chunks', async () => {
    const { caption, speaker } = setup();
    const text =
      'The two sides shift horizontally to illustrate a maxillary widening concept. ' +
      'Actual expansion may include skeletal, alveolar and dental components with variable inclination and asymmetry. ' +
      'The split palate is a teaching symbol, not reconstructed bone or a predicted suture opening.';
    let completed = false;
    const completion = speaker.speak(text).then(() => {
      completed = true;
    });
    expect(spoken).toHaveLength(1);
    let index = 0;
    while (spoken[index]) {
      const current = spoken[index];
      expect(current.text.length).toBeLessThanOrEqual(100);
      expect(current.text.length).toBeGreaterThan(0);
      expect(caption).toHaveBeenLastCalledWith(current.text);
      expect(caption.mock.calls.every(([value]) => value !== '')).toBe(true);
      expect(completed).toBe(false);
      current.onend?.();
      expect(current.onend).toBeNull();
      expect(current.onerror).toBeNull();
      index++;
      await Promise.resolve();
    }
    await completion;
    expect(spoken.length).toBeGreaterThan(2);
    expect(spoken.map(item => item.text).join(' ')).toBe(text);
    expect(caption.mock.calls).toEqual([...spoken.map(item => [item.text]), ['']]);
    expect(completed).toBe(true);
  });

  it('ignores queued callbacks from previous chunks within the same narration', async () => {
    const { caption, speaker } = setup();
    const completion = speaker.speak('Observe the tooth and root movement. '.repeat(8));
    const oldEnd = spoken[0].onend;
    const oldError = spoken[0].onerror;
    oldEnd?.();
    expect(spoken).toHaveLength(2);
    oldEnd?.();
    oldError?.({ error: 'synthesis-failed' });
    expect(spoken).toHaveLength(2);
    expect(caption).toHaveBeenLastCalledWith(spoken[1].text);
    expect(caption.mock.calls.some(([value]) => value === '')).toBe(false);
    speaker.cancel();
    await completion;
  });

  it('aborts a middle chunk without speaking the rest or leaving an old abort listener', async () => {
    const { caption, speaker } = setup();
    const controller = new AbortController();
    const completion = speaker.speak(
      'Observe the tooth and root movement. '.repeat(8),
      controller.signal,
    );
    spoken[0].onend?.();
    const oldEnd = spoken[1].onend;
    controller.abort();
    await completion;
    expect(spoken).toHaveLength(2);
    expect(caption).toHaveBeenLastCalledWith('');
    expect(spoken[1].onend).toBeNull();
    const next = speaker.speak('New reply.');
    oldEnd?.();
    synthesis.cancel.mockClear();
    controller.abort();
    expect(spoken).toHaveLength(3);
    expect(caption).toHaveBeenLastCalledWith('New reply.');
    expect(synthesis.cancel).not.toHaveBeenCalled();
    speaker.cancel();
    await next;
  });

  it('does not advance a chunk when cancellation synchronously emits its end callback', async () => {
    const { caption, speaker } = setup();
    const completion = speaker.speak('Observe the tooth and root movement. '.repeat(8));
    const oldEnd = spoken[0].onend;
    synthesis.cancel.mockImplementation(() => oldEnd?.());
    speaker.cancel();
    await completion;
    expect(spoken).toHaveLength(1);
    expect(caption.mock.calls).toEqual([[spoken[0].text], ['']]);
  });

  it('clears a long narration if a later utterance cannot be constructed', async () => {
    const { caption, speaker } = setup();
    const controller = new AbortController();
    const completion = speaker.speak(
      'Observe the tooth and root movement. '.repeat(8),
      controller.signal,
    );
    class BrokenUtterance {
      constructor() {
        throw new Error('Cannot create the next chunk');
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', BrokenUtterance);
    const rejected = expect(completion).rejects.toThrow('Speech output could not start.');
    spoken[0].onend?.();
    await rejected;
    expect(caption.mock.calls).toEqual([[spoken[0].text], ['']]);
    synthesis.cancel.mockClear();
    controller.abort();
    expect(synthesis.cancel).not.toHaveBeenCalled();
  });

  it('also bounds a single unusually long token without losing characters', async () => {
    const { speaker } = setup();
    const text = 'a'.repeat(205);
    const completion = speaker.speak(text);
    for (let index = 0; spoken[index]; index++) spoken[index].onend?.();
    await completion;
    expect(spoken.map(item => item.text.length)).toEqual([100, 100, 5]);
    expect(spoken.map(item => item.text).join('')).toBe(text);
  });

  it('does not publish a needless empty caption for empty speech', async () => {
    const { caption, speaker } = setup();
    await speaker.speak('   ');
    expect(caption).not.toHaveBeenCalled();
    expect(synthesis.speak).not.toHaveBeenCalled();
  });
});
