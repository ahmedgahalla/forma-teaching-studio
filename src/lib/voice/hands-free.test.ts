import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeechRecognitionLike, SpeechResultEvent } from '../speech';
import { createHandsFree } from './hands-free';

class Recognition implements SpeechRecognitionLike {
  static sessions: Recognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: SpeechRecognitionLike['onstart'] = null;
  onresult: SpeechRecognitionLike['onresult'] = null;
  onerror: SpeechRecognitionLike['onerror'] = null;
  onend: SpeechRecognitionLike['onend'] = null;
  constructor() {
    Recognition.sessions.push(this);
  }
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn();
  abort = vi.fn();
}
const event = (text: string, final = true, index = 0): SpeechResultEvent => ({
  resultIndex: index,
  results: Array.from({ length: index + 1 }, (_, i) =>
    Object.assign([{ transcript: i === index ? text : '' }], { isFinal: final }),
  ),
});
const last = () => Recognition.sessions[Recognition.sessions.length - 1];
const setup = () => {
  const callbacks = { state: vi.fn(), final: vi.fn(), error: vi.fn(), canStop: vi.fn(() => false) };
  return { callbacks, controller: createHandsFree(Recognition, callbacks, 'en-GB') };
};
beforeEach(() => {
  vi.useFakeTimers();
  Recognition.sessions = [];
});
afterEach(() => vi.useRealTimers());

describe('hands-free recognition', () => {
  it.each(['no-speech', 'aborted'])('restarts repeated %s sessions after only 250 ms', error => {
    const { callbacks, controller } = setup();
    controller.start();
    for (let count = 1; count <= 6; count++) {
      last().onerror?.({ error });
      vi.advanceTimersByTime(249);
      expect(Recognition.sessions).toHaveLength(count);
      vi.advanceTimersByTime(1);
      expect(Recognition.sessions).toHaveLength(count + 1);
    }
    expect(callbacks.error).not.toHaveBeenCalled();
    controller.dispose();
  });
  it.each(['end', 'error'])('resets immediate-failure backoff after a healthy %s session', path => {
    const { controller } = setup();
    controller.start();
    last().onend?.();
    vi.advanceTimersByTime(250);
    last().onend?.();
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(3000);
    if (path === 'end') last().onend?.();
    else last().onerror?.({ error: 'network' });
    vi.advanceTimersByTime(250);
    expect(Recognition.sessions).toHaveLength(4);
    controller.dispose();
  });
  it.each(['Former', 'Fauna', "Forma's"])(
    'never captions %s alias speech or arms follow-up from the bare alias',
    alias => {
      const { controller, callbacks } = setup();
      controller.start();
      last().onresult?.(event(`${alias} guidelines treated this differently`, false));
      expect(controller.getState().transcript).toBe('');
      last().onresult?.(event(`${alias}.`));
      last().onresult?.(event('show the roots', true, 1));
      expect(callbacks.final).not.toHaveBeenCalled();
      controller.dispose();
    },
  );
  it('requires explicit start and configures continuous recognition', () => {
    const { controller } = setup();
    expect(controller.getState()).toEqual({
      supported: true,
      active: false,
      phase: 'idle',
      transcript: '',
    });
    expect(Recognition.sessions).toHaveLength(0);
    controller.start();
    controller.start();
    expect(Recognition.sessions).toHaveLength(1);
    expect(last()).toMatchObject({ lang: 'en-GB', continuous: true, interimResults: true });
    expect(controller.getState().phase).toBe('listening');
    controller.dispose();
  });
  it('shows only interim text and submits only stripped, unique final wake commands', () => {
    const { callbacks, controller } = setup();
    controller.start();
    last().onresult?.(event('Forma show roots', false));
    expect(controller.getState().transcript).toBe('Forma show roots');
    expect(callbacks.final).not.toHaveBeenCalled();
    last().onresult?.(event('Forma, show roots'));
    last().onresult?.(event('Forma, show roots'));
    expect(callbacks.final).toHaveBeenCalledExactlyOnceWith('show roots');
    expect(controller.getState().transcript).toBe('');
    controller.dispose();
  });
  it('never shows interim classroom speech that is not addressed to Forma', () => {
    const { controller } = setup();
    controller.start();
    last().onresult?.(event('today we discuss anchorage', false));
    expect(controller.getState().transcript).toBe('');
    last().onresult?.(event('Forma', true));
    last().onresult?.(event('show the roots', false, 1));
    expect(controller.getState().transcript).toBe('show the roots');
    controller.dispose();
  });
  it('discards non-wake final speech without submitting, storing or reporting it', () => {
    const { callbacks, controller } = setup();
    controller.start();
    last().onresult?.(event('private classroom discussion'));
    expect(callbacks.final).not.toHaveBeenCalled();
    expect(callbacks.error).not.toHaveBeenCalled();
    expect(JSON.stringify(callbacks.state.mock.calls)).not.toContain('private classroom');
    expect(controller.getState().transcript).toBe('');
    controller.dispose();
  });
  it('uses one timely follow-up and discards a follow-up after expiry', () => {
    const { callbacks, controller } = setup();
    controller.start();
    last().onresult?.(event('Forma'));
    vi.advanceTimersByTime(5999);
    last().onresult?.(event('show roots', true, 1));
    last().onresult?.(event('show labels', true, 2));
    last().onresult?.(event('Forma', true, 3));
    vi.advanceTimersByTime(6000);
    last().onresult?.(event('hide gums', true, 4));
    expect(callbacks.final).toHaveBeenCalledExactlyOnceWith('show roots');
    controller.dispose();
  });
  it('accepts bare stop/cancel only while the host has stoppable work', () => {
    const { callbacks, controller } = setup();
    controller.start();
    last().onresult?.(event('stop'));
    callbacks.canStop.mockReturnValue(true);
    last().onresult?.(event('stop', true, 1));
    last().onresult?.(event('cancel', true, 2));
    expect(callbacks.final.mock.calls).toEqual([['stop'], ['cancel']]);
    controller.dispose();
  });
  it('restarts automatically with bounded backoff and invalidates old callbacks', () => {
    const { callbacks, controller } = setup();
    controller.start();
    const oldResult = last().onresult;
    for (const delay of [250, 500, 1000, 2000, 4000, 4000]) {
      const count = Recognition.sessions.length;
      last().onend?.();
      expect(controller.getState().phase).toBe('restarting');
      vi.advanceTimersByTime(delay - 1);
      expect(Recognition.sessions).toHaveLength(count);
      vi.advanceTimersByTime(1);
      expect(Recognition.sessions).toHaveLength(count + 1);
    }
    oldResult?.(event('Forma, play'));
    expect(callbacks.final).not.toHaveBeenCalled();
    controller.dispose();
  });
  it.each(['not-allowed', 'service-not-allowed', 'audio-capture'])(
    'turns off permanently on %s',
    error => {
      const { callbacks, controller } = setup();
      controller.start();
      const end = last().onend;
      last().onerror?.({ error });
      end?.();
      vi.advanceTimersByTime(10000);
      expect(controller.getState()).toMatchObject({ active: false, phase: 'idle' });
      expect(Recognition.sessions).toHaveLength(1);
      expect(callbacks.error).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/off/));
      controller.dispose();
    },
  );
  it('turns off after three network failures even if each session started', () => {
    const { callbacks, controller } = setup();
    controller.start();
    last().onerror?.({ error: 'network' });
    vi.advanceTimersByTime(250);
    last().onerror?.({ error: 'network' });
    vi.advanceTimersByTime(500);
    last().onerror?.({ error: 'network' });
    vi.advanceTimersByTime(10000);
    expect(controller.getState().active).toBe(false);
    expect(Recognition.sessions).toHaveLength(3);
    expect(callbacks.error).toHaveBeenCalledWith(expect.stringMatching(/repeated network/));
    controller.dispose();
  });
  it('retries silence and resets the network-failure streak after recognized speech', () => {
    const { callbacks, controller } = setup();
    controller.start();
    last().onerror?.({ error: 'no-speech' });
    vi.advanceTimersByTime(250);
    last().onerror?.({ error: 'network' });
    vi.advanceTimersByTime(500);
    last().onerror?.({ error: 'network' });
    vi.advanceTimersByTime(1000);
    last().onresult?.(event('classroom speech'));
    last().onerror?.({ error: 'network' });
    vi.advanceTimersByTime(250);
    expect(Recognition.sessions).toHaveLength(5);
    expect(controller.getState().active).toBe(true);
    expect(callbacks.error).not.toHaveBeenCalled();
    expect(callbacks.final).not.toHaveBeenCalled();
    controller.dispose();
  });
  it('aborts and detaches while speaking, discards arming, and resumes afterward', () => {
    const { callbacks, controller } = setup();
    controller.start();
    last().onresult?.(event('Forma'));
    const old = last(),
      result = old.onresult,
      end = old.onend;
    controller.setPaused(true);
    expect(old.abort).toHaveBeenCalledOnce();
    expect(old.onresult).toBeNull();
    expect(controller.getState()).toMatchObject({ active: true, phase: 'paused' });
    result?.(event('Forma, play', true, 1));
    end?.();
    vi.advanceTimersByTime(10000);
    expect(Recognition.sessions).toHaveLength(1);
    controller.setPaused(false);
    expect(Recognition.sessions).toHaveLength(2);
    last().onresult?.(event('show roots'));
    last().onresult?.(event('Forma, show roots', true, 1));
    expect(callbacks.final).toHaveBeenCalledExactlyOnceWith('show roots');
    controller.dispose();
  });
  it('cancels a pending restart while paused or stopped and does not auto-start after stop', () => {
    const { controller } = setup();
    controller.start();
    last().onend?.();
    controller.setPaused(true);
    vi.advanceTimersByTime(5000);
    expect(Recognition.sessions).toHaveLength(1);
    controller.setPaused(false);
    last().onend?.();
    controller.stop();
    controller.setPaused(false);
    vi.advanceTimersByTime(5000);
    expect(Recognition.sessions).toHaveLength(2);
    expect(controller.getState().active).toBe(false);
    controller.dispose();
  });
  it('stops and rejects callbacks and starts after disposal', () => {
    const { callbacks, controller } = setup();
    controller.start();
    const result = last().onresult;
    last().onend?.();
    controller.dispose();
    callbacks.state.mockClear();
    result?.(event('Forma, play'));
    controller.start();
    vi.advanceTimersByTime(10000);
    expect(callbacks.state).not.toHaveBeenCalled();
    expect(callbacks.final).not.toHaveBeenCalled();
    expect(Recognition.sessions).toHaveLength(1);
  });
  it('reports unavailable recognition without activation', () => {
    const callbacks = { state: vi.fn(), final: vi.fn(), error: vi.fn(), canStop: () => false };
    const controller = createHandsFree(undefined, callbacks);
    controller.start();
    expect(controller.getState()).toMatchObject({ supported: false, active: false });
    expect(callbacks.error).toHaveBeenCalledWith(expect.stringMatching(/unavailable/));
    controller.dispose();
  });
  it('turns off if the browser throws during initialization or start', () => {
    class BrokenConstructor extends Recognition {
      constructor() {
        super();
        throw new Error('Microphone initialization failed');
      }
    }
    class BrokenStart extends Recognition {
      start = vi.fn(() => {
        throw new Error('Microphone start failed');
      });
    }
    for (const Constructor of [BrokenConstructor, BrokenStart]) {
      const callbacks = { state: vi.fn(), final: vi.fn(), error: vi.fn(), canStop: () => false };
      const controller = createHandsFree(Constructor, callbacks);
      controller.start();
      vi.advanceTimersByTime(10000);
      expect(controller.getState()).toMatchObject({ active: false, phase: 'idle' });
      expect(callbacks.error).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/off/));
      controller.dispose();
    }
  });
});
