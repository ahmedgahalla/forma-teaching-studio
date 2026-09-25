import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSpeechController,
  speechConstructor,
  type SpeechRecognitionLike,
  type SpeechRecognitionConstructor,
  type SpeechResultEvent,
} from './speech';

class MockRecognition implements SpeechRecognitionLike {
  static instances: MockRecognition[] = [];
  static failStart = false;
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: SpeechRecognitionLike['onstart'] = null;
  onresult: SpeechRecognitionLike['onresult'] = null;
  onerror: SpeechRecognitionLike['onerror'] = null;
  onend: SpeechRecognitionLike['onend'] = null;
  constructor() {
    MockRecognition.instances.push(this);
  }
  start = vi.fn(() => {
    if (MockRecognition.failStart) throw new Error('Blocked');
    this.onstart?.();
  });
  stop = vi.fn();
  abort = vi.fn();
}
const event = (results: [string, boolean][], resultIndex = 0): SpeechResultEvent => ({
  resultIndex,
  results: results.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })),
});
const controllers: ReturnType<typeof createSpeechController>[] = [];
function setup(Recognition: SpeechRecognitionConstructor = MockRecognition) {
  const callbacks = { onFinal: vi.fn(), onError: vi.fn(), onState: vi.fn() };
  const controller = createSpeechController(Recognition, callbacks);
  controllers.push(controller);
  return { controller, callbacks };
}

beforeEach(() => {
  vi.useFakeTimers();
  MockRecognition.instances = [];
  MockRecognition.failStart = false;
});
afterEach(() => {
  controllers.splice(0).forEach(controller => controller.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('browser speech discovery and startup', () => {
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

  it('does not initialize the microphone until explicitly started and sets browser recognition options', () => {
    const { controller } = setup();
    expect(MockRecognition.instances).toHaveLength(0);
    expect(controller.getState()).toEqual({ supported: true, listening: false, transcript: '' });
    controller.start(true);
    const recognition = MockRecognition.instances[0];
    expect(recognition.lang).toBe('en-US');
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.maxAlternatives).toBe(1);
    expect(recognition.start).toHaveBeenCalledOnce();
    expect(controller.getState().listening).toBe(true);
    controller.start(true);
    expect(MockRecognition.instances).toHaveLength(1);
  });

  it('reports unsupported browsers without trying to capture audio', () => {
    const callbacks = { onFinal: vi.fn(), onError: vi.fn(), onState: vi.fn() };
    const controller = createSpeechController(undefined, callbacks);
    controllers.push(controller);
    controller.start(true);
    expect(controller.getState().supported).toBe(false);
    expect(controller.getState().listening).toBe(false);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringMatching(/unavailable.*browser/i));
    expect(MockRecognition.instances).toHaveLength(0);
  });

  it('handles constructor and start failures without leaving a restart loop', () => {
    class Broken extends MockRecognition {
      constructor() {
        super();
        throw new Error('Unavailable');
      }
    }
    const first = setup(Broken);
    first.controller.start(true);
    expect(first.callbacks.onError).toHaveBeenCalledOnce();
    expect(first.controller.getState().listening).toBe(false);
    MockRecognition.failStart = true;
    const second = setup();
    second.controller.start(true);
    expect(second.callbacks.onError).toHaveBeenCalledOnce();
    expect(second.controller.getState().listening).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(MockRecognition.instances).toHaveLength(2);
  });
});

describe('final result delivery', () => {
  it('displays interim revisions but executes a finalized segment only once', () => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const recognition = MockRecognition.instances[0];
    recognition.onresult!(event([['move eleven', false]]));
    expect(controller.getState().transcript).toBe('move eleven');
    expect(callbacks.onFinal).not.toHaveBeenCalled();
    recognition.onresult!(event([['move eleven buccally', false]]));
    expect(controller.getState().transcript).toBe('move eleven buccally');
    recognition.onresult!(event([[' move eleven buccally one millimeter ', true]]));
    recognition.onresult!(event([['move eleven buccally one millimeter', true]]));
    expect(callbacks.onFinal).toHaveBeenCalledExactlyOnceWith(
      'move eleven buccally one millimeter',
    );
  });

  it('uses resultIndex and skips already-final entries in cumulative continuous results', () => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const recognition = MockRecognition.instances[0];
    recognition.onresult!(
      event([
        ['select eleven', true],
        ['move', false],
      ]),
    );
    recognition.onresult!(
      event(
        [
          ['select eleven', true],
          ['move it buccally one millimeter', true],
        ],
        1,
      ),
    );
    recognition.onresult!(
      event(
        [
          ['select eleven', true],
          ['move it buccally one millimeter', true],
          ['show braces', true],
        ],
        1,
      ),
    );
    expect(callbacks.onFinal.mock.calls.map(call => call[0])).toEqual([
      'select eleven',
      'move it buccally one millimeter',
      'show braces',
    ]);
  });

  it('allows an intentionally repeated command at a new final index', () => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const recognition = MockRecognition.instances[0];
    recognition.onresult!(event([['next stage', true]]));
    recognition.onresult!(
      event(
        [
          ['next stage', true],
          ['next stage', true],
        ],
        1,
      ),
    );
    expect(callbacks.onFinal).toHaveBeenCalledTimes(2);
  });

  it('removes retracted interim text and ignores empty final results', () => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const recognition = MockRecognition.instances[0];
    recognition.onresult!(
      event([
        ['show original', true],
        ['unexpected words', false],
      ]),
    );
    recognition.onresult!(event([['show original', true]], 1));
    expect(controller.getState().transcript).toBe('show original');
    recognition.onresult!(
      event(
        [
          ['show original', true],
          ['   ', true],
        ],
        1,
      ),
    );
    expect(callbacks.onFinal).toHaveBeenCalledExactlyOnceWith('show original');
  });

  it('reads the latest callback state rather than capturing the initial selection', () => {
    let selected = '11';
    const changes: string[] = [];
    const callbacks = {
      onFinal: (text: string) => changes.push(`${selected}:${text}`),
      onError: vi.fn(),
      onState: vi.fn(),
    };
    const controller = createSpeechController(MockRecognition, callbacks);
    controllers.push(controller);
    controller.start(true);
    const recognition = MockRecognition.instances[0];
    recognition.onresult!(event([['move it', true]]));
    selected = '21';
    callbacks.onFinal = text => changes.push(`${selected}:latest:${text}`);
    recognition.onresult!(
      event(
        [
          ['move it', true],
          ['rotate it', true],
        ],
        1,
      ),
    );
    expect(changes).toEqual(['11:move it', '21:latest:rotate it']);
  });

  it('ends single-utterance mode after one final and allows starting again from the callback', () => {
    const { controller, callbacks } = setup();
    controller.start(false);
    const recognition = MockRecognition.instances[0],
      stale = recognition.onresult!;
    callbacks.onFinal.mockImplementation(() => controller.start(false));
    stale(event([['show braces', true]]));
    expect(callbacks.onFinal).toHaveBeenCalledOnce();
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(MockRecognition.instances).toHaveLength(2);
    expect(controller.getState().listening).toBe(true);
    stale(event([['show braces', true]]));
    expect(callbacks.onFinal).toHaveBeenCalledOnce();
  });
});

describe('continuous lifecycle and stopping', () => {
  it('restarts after browser onend with a fresh result index set', () => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const first = MockRecognition.instances[0];
    first.onresult!(event([['next stage', true]]));
    first.onend!();
    expect(controller.getState().listening).toBe(true);
    expect(MockRecognition.instances).toHaveLength(1);
    vi.advanceTimersByTime(299);
    expect(MockRecognition.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    const second = MockRecognition.instances[1];
    expect(second.continuous).toBe(true);
    second.onresult!(event([['next stage', true]]));
    expect(callbacks.onFinal).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending restart when stopped between browser sessions', () => {
    const { controller } = setup();
    controller.start(true);
    MockRecognition.instances[0].onend!();
    controller.stop();
    vi.advanceTimersByTime(5000);
    expect(MockRecognition.instances).toHaveLength(1);
    expect(controller.getState().listening).toBe(false);
  });

  it('ignores queued result/end events after stop and after a new session starts', () => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const first = MockRecognition.instances[0];
    const oldResult = first.onresult!,
      oldEnd = first.onend!,
      oldStart = first.onstart!;
    controller.stop();
    oldResult(event([['move all teeth', true]]));
    oldEnd();
    oldStart();
    expect(callbacks.onFinal).not.toHaveBeenCalled();
    expect(controller.getState().listening).toBe(false);
    controller.start(true);
    oldResult(event([['rotate all teeth', true]]));
    oldEnd();
    vi.advanceTimersByTime(1000);
    expect(MockRecognition.instances).toHaveLength(2);
    expect(callbacks.onFinal).not.toHaveBeenCalled();
  });

  it('stops immediately when the command callback asks to stop listening', () => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const recognition = MockRecognition.instances[0];
    callbacks.onFinal.mockImplementation(() => controller.stop());
    recognition.onresult!(
      event([
        ['stop listening', true],
        ['move it', true],
      ]),
    );
    expect(callbacks.onFinal).toHaveBeenCalledExactlyOnceWith('stop listening');
    expect(controller.getState().listening).toBe(false);
  });

  it('handles no-speech quietly in continuous mode and reports it in single mode', () => {
    const continuous = setup();
    continuous.controller.start(true);
    const first = MockRecognition.instances[0];
    first.onerror!({ error: 'no-speech' });
    first.onend!();
    vi.advanceTimersByTime(300);
    expect(continuous.callbacks.onError).not.toHaveBeenCalled();
    expect(MockRecognition.instances).toHaveLength(2);
    const single = setup();
    single.controller.start(false);
    MockRecognition.instances[2].onerror!({ error: 'no-speech' });
    expect(single.callbacks.onError).toHaveBeenCalledWith(
      expect.stringMatching(/No speech was detected/),
    );
    expect(single.controller.getState().listening).toBe(false);
  });

  it.each([
    'not-allowed',
    'service-not-allowed',
    'audio-capture',
    'network',
    'language-not-supported',
    'aborted',
    'unknown',
  ])('stops continuous restart after %s', error => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const recognition = MockRecognition.instances[0],
      oldEnd = recognition.onend!;
    recognition.onerror!({ error });
    oldEnd();
    vi.advanceTimersByTime(5000);
    expect(callbacks.onError).toHaveBeenCalledOnce();
    expect(controller.getState().listening).toBe(false);
    expect(MockRecognition.instances).toHaveLength(1);
    expect(recognition.abort).toHaveBeenCalledOnce();
  });

  it('disposes the microphone and pending work without notifying an unmounted component', () => {
    const { controller, callbacks } = setup();
    controller.start(true);
    const recognition = MockRecognition.instances[0];
    const oldResult = recognition.onresult!,
      oldEnd = recognition.onend!;
    callbacks.onState.mockClear();
    controller.dispose();
    controller.dispose();
    oldResult(event([['move it', true]]));
    oldEnd();
    controller.start(true);
    vi.advanceTimersByTime(5000);
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(callbacks.onState).not.toHaveBeenCalled();
    expect(callbacks.onFinal).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(MockRecognition.instances).toHaveLength(1);
  });

  it('cancels a restart timer on disposal and supports recognizers exposing stop without abort', () => {
    class StopOnly extends MockRecognition {
      abort = undefined as unknown as MockRecognition['abort'];
    }
    const first = setup(StopOnly);
    first.controller.start(true);
    first.controller.stop();
    expect(MockRecognition.instances[0].stop).toHaveBeenCalledOnce();
    const second = setup();
    second.controller.start(true);
    MockRecognition.instances[1].onend!();
    second.controller.dispose();
    vi.advanceTimersByTime(5000);
    expect(MockRecognition.instances).toHaveLength(2);
  });
});
