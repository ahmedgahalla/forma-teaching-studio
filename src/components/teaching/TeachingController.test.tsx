// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TeachingCommandBar,
  TeachingProvider,
  useTeaching,
  useTeachingAdapter,
} from './TeachingController';
import type { SpeechRecognitionLike, SpeechResultEvent } from '../../lib/speech';
import type { TeachingAction } from '../../lib/lecture';
import { sceneAnalysisContext } from '../../lib/scene-analysis';

class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn();
  abort = vi.fn();
  result(text: string, final = true, index = 0) {
    this.onresult?.({
      resultIndex: index,
      results: Array.from({ length: index + 1 }, (_, i) => ({
        isFinal: i === index && final,
        0: { transcript: i === index ? text : '' },
      })),
    });
  }
}
class FakeUtterance {
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}
type Scene = { selected: string; roots: boolean; gums: boolean };
let teaching: ReturnType<typeof useTeaching>, root: Root, container: HTMLDivElement;
let asyncSelection: Promise<void> | undefined;
let playing = false;
const applied = vi.fn(),
  paused = vi.fn(),
  preflight = vi.fn();
const captured: Scene[] = [],
  spoken: FakeUtterance[] = [];
const synthesis = {
  cancel: vi.fn(),
  speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)),
};

function Harness() {
  // eslint-disable-next-line react-hooks/globals -- test harness intentionally reassigns a module-level double between renders
  teaching = useTeaching();
  const [scene, setScene] = useState<Scene>({ selected: '11', roots: false, gums: true });
  useTeachingAdapter('case', {
    context: () => ({
      mode: 'case',
      workflowId: null,
      stepIndex: 0,
      selected: scene.selected,
      selectedIds: [scene.selected],
      availableIds: ['11', '21'],
      synthetic: true,
      view: 'front',
      arch: 'both',
      speed: 1,
      playing,
      lessonActive: true,
      layers: { roots: scene.roots, gums: scene.gums },
    }),
    capture: () => {
      const value = { ...scene };
      captured.push(value);
      return value;
    },
    restore: snapshot => setScene(snapshot as Scene),
    preflight,
    pause: paused,
    narration: () => `Current target is tooth ${scene.selected}.`,
    analysisContext: () =>
      sceneAnalysisContext({
        synthetic: true,
        ids: ['11', '21'],
        transforms: {},
        selectedIds: [scene.selected],
        arch: 'both',
        roots: scene.roots,
        gums: scene.gums,
        bone: false,
      }),
    apply: action => {
      applied(action);
      if (action.kind === 'select') {
        if (asyncSelection)
          return asyncSelection.then(() => {
            // Production's async mechanics adapter commits React state before resolving.
            flushSync(() => setScene(previous => ({ ...previous, selected: action.teeth[0] })));
            return true;
          });
        setScene(previous => ({ ...previous, selected: action.teeth[0] }));
      }
      if (action.kind === 'toggle' && (action.target === 'roots' || action.target === 'gums'))
        setScene(previous => ({ ...previous, [action.target]: action.visible }));
      return true;
    },
  });
  return (
    <>
      <output data-testid="scene">{JSON.stringify(scene)}</output>
      <button
        data-testid="reference"
        onClick={() => {
          teaching.referenceInteraction();
          setScene(previous => ({ ...previous, selected: '21' }));
        }}
      >
        Point at tooth 21
      </button>
      <TeachingCommandBar />
    </>
  );
}
function key(type: 'keydown' | 'keyup', code = 'Space', options: KeyboardEventInit = {}) {
  document.body.dispatchEvent(
    new KeyboardEvent(type, {
      key: code === 'Space' ? ' ' : code,
      code,
      bubbles: true,
      cancelable: true,
      ...options,
    }),
  );
}
async function start() {
  await act(async () => {
    key('keydown');
  });
  return FakeRecognition.instances.at(-1)!;
}
async function finish(recognition: FakeRecognition, text = 'show roots') {
  await act(async () => {
    recognition.result(text);
    key('keyup');
    recognition.onend?.();
  });
}
function scene(): Scene {
  return JSON.parse(container.querySelector('[data-testid="scene"]')!.textContent!);
}

beforeEach(async () => {
  vi.clearAllMocks();
  FakeRecognition.instances = [];
  captured.length = 0;
  spoken.length = 0;
  asyncSelection = undefined;
  playing = false;
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', synthesis);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <TeachingProvider>
        <Harness />
      </TeachingProvider>,
    );
  });
});

describe('hosted command service discovery', () => {
  it('lets a professor explicitly use AI and shows its real reply while Undo stays local', async () => {
    await act(async () => {
      teaching.setConfig({ enabled: true, url: 'https://forma.example', provider: 'OpenRouter' });
    });
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Use AI interpreter"]')!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      button.click();
    });
    expect(teaching.preferAI).toBe(true);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        actions: [{ kind: 'toggle', target: 'roots', visible: true }],
        summary: 'Roots are now visible for your students.',
        clarification: null,
      }),
    });
    vi.stubGlobal('fetch', fetcher);
    await act(async () => {
      await teaching.run('show roots');
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(scene().roots).toBe(true);
    expect(container.querySelector('.command-status')!.textContent).toContain(
      'AI replyRoots are now visible for your students.',
    );
    await act(async () => {
      await teaching.run('undo');
    });
    expect(scene().roots).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  const hosted = { commandService: { enabled: true, url: 'same-origin', provider: 'OpenRouter' } };
  async function remount() {
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <TeachingProvider>
          <Harness />
        </TeachingProvider>,
      );
    });
  }
  it('automatically connects the same-origin gateway on a fresh phone', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => hosted });
    vi.stubGlobal('fetch', fetcher);
    await remount();
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      '/forma-runtime-config.json',
      expect.objectContaining({ cache: 'no-store', redirect: 'error' }),
    );
    expect(teaching.config).toEqual({
      enabled: true,
      url: window.location.origin,
      provider: 'OpenRouter',
    });
    expect(localStorage.getItem('forma-command-service')).toBeNull();
  });
  it.each([true, false])('preserves saved settings when enabled is %s', async enabled => {
    const saved = { enabled, url: 'http://127.0.0.1:8000', provider: 'OpenRouter' };
    localStorage.setItem('forma-command-service', JSON.stringify(saved));
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await remount();
    expect(teaching.config).toEqual(saved);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not replace a user choice made while discovery is pending', async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise(done => {
            resolve = done;
          }),
      ),
    );
    await remount();
    await act(async () => {
      teaching.setConfig({ enabled: false, url: '' });
      resolve({ ok: true, json: async () => hosted });
    });
    expect(teaching.config).toEqual({ enabled: false, url: '' });
    expect(JSON.parse(localStorage.getItem('forma-command-service')!)).toEqual({
      enabled: false,
      url: '',
    });
  });
  it('keeps local commands usable when discovery fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
    await remount();
    await act(async () => {
      await teaching.run('show roots');
    });
    expect(teaching.config.enabled).toBe(false);
    expect(scene().roots).toBe(true);
    expect(teaching.runtime.error).toBe(false);
  });
  it('aborts discovery after five seconds and ignores a late response', async () => {
    vi.useFakeTimers();
    try {
      let resolve!: (value: unknown) => void;
      const fetcher = vi.fn(
        (_url: string, _options: RequestInit) =>
          new Promise(done => {
            resolve = done;
          }),
      );
      vi.stubGlobal('fetch', fetcher);
      await remount();
      await act(async () => {
        vi.advanceTimersByTime(5000);
        resolve({ ok: true, json: async () => hosted });
      });
      expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
      expect(teaching.config.enabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe('persistent teaching speech controller integration', () => {
  it('holds Space, displays interim speech and executes a repeated final exactly once after release/end', async () => {
    expect(FakeRecognition.instances).toHaveLength(0);
    const recognition = await start();
    expect(teaching.capture.phase).toBe('listening');
    expect(recognition.start).toHaveBeenCalledTimes(1);
    await act(async () => {
      key('keydown', 'Space', { repeat: true });
      recognition.result('show ro', false);
    });
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(teaching.capture.transcript).toBe('show ro');
    expect(applied).not.toHaveBeenCalled();
    const lateEnd = recognition.onend!;
    await act(async () => {
      recognition.result('show roots');
      recognition.result('show roots');
      key('keyup');
    });
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(teaching.capture.phase).toBe('finishing');
    expect(applied).not.toHaveBeenCalled();
    await act(async () => {
      recognition.onend?.();
      lateEnd();
    });
    expect(applied).toHaveBeenCalledExactlyOnceWith({
      kind: 'toggle',
      target: 'roots',
      visible: true,
    });
    expect(scene().roots).toBe(true);
    expect(teaching.capture.phase).toBe('idle');
    expect(teaching.runtime.error).toBe(false);
  });
  it('keeps capture alive during a pointing reference and resolves the released command against the new target', async () => {
    const recognition = await start();
    await act(async () => {
      recognition.result('move it', false);
      (container.querySelector('[data-testid="reference"]') as HTMLButtonElement).click();
    });
    expect(recognition.abort).not.toHaveBeenCalled();
    expect(teaching.capture.phase).toBe('listening');
    expect(scene().selected).toBe('21');
    await finish(recognition, 'move it buccally one millimeter');
    expect(teaching.runtime.error, teaching.runtime.message).toBe(false);
    expect(applied).toHaveBeenCalledTimes(1);
    const action = applied.mock.calls[0][0] as TeachingAction;
    expect(action.kind).toBe('dental');
    if (action.kind === 'dental')
      expect(action.command).toMatchObject({
        type: 'move',
        tooth: '21',
        direction: 'buccal',
        amount: 1,
      });
  });
  it.each(['Escape', 'blur'] as const)(
    'discards capture on %s and ignores late recognizer callbacks',
    async reason => {
      const recognition = await start(),
        lateResult = recognition.onresult!,
        lateEnd = recognition.onend!;
      await act(async () => {
        recognition.result('show roots');
        if (reason === 'Escape') key('keydown', 'Escape');
        else window.dispatchEvent(new Event('blur'));
      });
      expect(recognition.abort).toHaveBeenCalledTimes(1);
      expect(teaching.capture.phase).toBe('idle');
      await act(async () => {
        key('keyup');
        lateResult({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: 'show roots' } }],
        });
        lateEnd();
      });
      expect(applied).not.toHaveBeenCalled();
      expect(scene().roots).toBe(false);
      const next = await start();
      expect(next).not.toBe(recognition);
      await finish(next);
      expect(scene().roots).toBe(true);
    },
  );
  it('cancels unfinished speech on a manual scene interaction while preserving the pointing exception', async () => {
    const recognition = await start();
    await act(async () => {
      recognition.result('show roots');
      teaching.interact();
      key('keyup');
    });
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(teaching.capture.phase).toBe('idle');
    expect(applied).not.toHaveBeenCalled();
  });
  it('interrupts narration before starting the microphone and does not execute the remaining narrated request', async () => {
    let narration!: Promise<void>;
    await act(async () => {
      narration = teaching.run('explain this step then hide gums');
    });
    expect(teaching.runtime.phase).toBe('speaking');
    expect(spoken).toHaveLength(1);
    const before = synthesis.cancel.mock.calls.length;
    const recognition = await start();
    expect(synthesis.cancel.mock.calls.length).toBeGreaterThan(before);
    expect(teaching.capture.phase).toBe('listening');
    await act(async () => {
      spoken[0].onend?.();
      await narration;
    });
    expect(applied).not.toHaveBeenCalled();
    expect(scene().gums).toBe(true);
    await finish(recognition);
    expect(scene().roots).toBe(true);
  });
  it('awaits async adapter completion before reading narration context and recording the completed snapshot', async () => {
    let resolve!: () => void;
    asyncSelection = new Promise<void>(done => {
      resolve = done;
    });
    let request!: Promise<void>;
    await act(async () => {
      request = teaching.execute(
        [
          { kind: 'select', teeth: ['21'] },
          { kind: 'narrate', target: 'step' },
        ],
        'Select and explain',
      );
    });
    expect(teaching.runtime.phase).toBe('executing');
    expect(scene().selected).toBe('11');
    expect(spoken).toHaveLength(0);
    await act(async () => {
      resolve();
    });
    expect(scene().selected).toBe('21');
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe('Current target is tooth 21.');
    await act(async () => {
      spoken[0].onend?.();
      await request;
    });
    expect(teaching.runtime.phase).toBe('idle');
    expect(captured.at(-1)?.selected).toBe('21');
    await act(async () => {
      await teaching.run('undo that');
    });
    expect(scene().selected).toBe('11');
    await act(async () => {
      await teaching.run('redo that');
    });
    expect(scene().selected).toBe('21');
  });
  it.each(['input', 'summary'])(
    'does not hijack Space on %s and retains one recognizer across provider rerenders',
    async tag => {
      const target =
        tag === 'input'
          ? container.querySelector('input')!
          : container
              .appendChild(document.createElement('details'))
              .appendChild(document.createElement('summary'));
      const event = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        target.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
      expect(FakeRecognition.instances).toHaveLength(0);
      const recognition = await start();
      await act(async () => {
        (container.querySelector('[data-testid="reference"]') as HTMLButtonElement).click();
        recognition.result('show roots', false);
      });
      expect(FakeRecognition.instances).toHaveLength(1);
      expect(recognition.abort).not.toHaveBeenCalled();
      await finish(recognition);
      expect(applied).toHaveBeenCalledTimes(1);
    },
  );
});

describe('hands-free teaching integration', () => {
  async function listen() {
    await act(async () => {
      teaching.toggleHandsFree();
    });
    return FakeRecognition.instances.at(-1)!;
  }
  it('requires session opt-in, ignores non-wake finals without AI or stored transcripts, and survives blur', async () => {
    expect(teaching.voice.active).toBe(false);
    expect(FakeRecognition.instances).toHaveLength(0);
    const recognition = await listen();
    const initial = teaching.runtime;
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await act(async () => {
      recognition.result('students should consider the roots', false);
    });
    expect(teaching.voice.transcript).toContain('students');
    await act(async () => {
      recognition.result('students should consider the roots');
      window.dispatchEvent(new Event('blur'));
    });
    expect(teaching.voice.active).toBe(true);
    expect(teaching.voice.transcript).toBe('');
    expect(teaching.runtime).toEqual(initial);
    expect(recognition.abort).not.toHaveBeenCalled();
    expect(applied).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => {
      recognition.result('Forma, show roots', true, 1);
    });
    expect(scene().roots).toBe(true);
    expect(teaching.runtime.transcript).toBe('show roots');
    expect(teaching.runtime.interpreter).toBe('local');
    await act(async () => {
      recognition.result('Forma undo', true, 2);
    });
    expect(scene().roots).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('stops listening at controller level even with Analyze enabled', async () => {
    await act(async () => {
      teaching.setAnalyzeMode(true);
    });
    const recognition = await listen();
    await act(async () => {
      recognition.result('Forma stop listening');
    });
    expect(teaching.voice.active).toBe(false);
    expect(teaching.runtime.message).toBe('Hands-free is off.');
    expect(applied).not.toHaveBeenCalled();
  });
  it('accepts bare stop during playback but ignores it when idle', async () => {
    const recognition = await listen();
    const before = paused.mock.calls.length;
    await act(async () => {
      recognition.result('stop');
    });
    expect(paused).toHaveBeenCalledTimes(before);
    playing = true;
    await act(async () => {
      recognition.result('stop', true, 1);
    });
    expect(paused.mock.calls.length).toBeGreaterThan(before);
    expect(teaching.runtime.message).toContain('Stopped');
  });
  it('pauses recognition for narration, shows the caption, and resumes after speech', async () => {
    const recognition = await listen();
    await act(async () => {
      recognition.result('Forma explain this step');
    });
    expect(teaching.voice.phase).toBe('paused');
    expect(teaching.voice.active).toBe(true);
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(teaching.narration).toBe('Current target is tooth 11.');
    await act(async () => {
      spoken[0].onend?.();
    });
    expect(teaching.narration).toBe('');
    expect(teaching.voice.phase).toBe('listening');
    expect(FakeRecognition.instances).toHaveLength(2);
  });
  it('speaks only voice confirmations when opted in and interrupts them with new hold speech', async () => {
    await act(async () => {
      teaching.setVoiceSettings({ mode: 'hold', language: 'en-GB', spokenReplies: true });
      await teaching.run('hide roots');
    });
    expect(spoken).toHaveLength(0);
    const recognition = await listen();
    expect(recognition.lang).toBe('en-GB');
    await act(async () => {
      recognition.result('Forma show roots');
    });
    expect(scene().roots).toBe(true);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(spoken[0].lang).toBe('en-GB');
    expect(teaching.voice.phase).toBe('paused');
    await act(async () => {
      teaching.start();
    });
    expect(teaching.narration).toBe('');
    expect(teaching.capture.phase).toBe('listening');
    expect(teaching.voice.phase).toBe('paused');
    await act(async () => {
      teaching.cancel();
    });
    expect(teaching.capture.phase).toBe('idle');
    expect(teaching.voice.phase).toBe('listening');
  });
  it('does not repeat authored narration as a spoken confirmation', async () => {
    await act(async () => {
      teaching.setVoiceSettings({ mode: 'hold', language: 'en-US', spokenReplies: true });
    });
    const recognition = await listen();
    await act(async () => {
      recognition.result('Forma explain this step');
    });
    await act(async () => {
      spoken[0].onend?.();
    });
    expect(spoken).toHaveLength(1);
  });
  it('turns off on pagehide and setting changes without restarting on focus', async () => {
    await listen();
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(teaching.voice.active).toBe(false);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(teaching.voice.active).toBe(false);
    await listen();
    await act(async () => {
      teaching.setVoiceSettings({ mode: 'hands-free', language: 'en-GB', spokenReplies: false });
    });
    expect(teaching.voice.active).toBe(false);
    expect(JSON.parse(localStorage.getItem('forma-voice-settings')!)).toEqual({
      mode: 'hands-free',
      language: 'en-GB',
      spokenReplies: false,
    });
    await act(async () => {
      key('keydown', 'm');
    });
    expect(teaching.voice.active).toBe(true);
  });
  it('hydrates a hands-free preference without activating the microphone', async () => {
    localStorage.setItem(
      'forma-voice-settings',
      JSON.stringify({
        mode: 'hands-free',
        language: 'en-GB',
        spokenReplies: false,
      }),
    );
    await act(async () => {
      root.unmount();
    });
    FakeRecognition.instances = [];
    root = createRoot(container);
    await act(async () => {
      root.render(
        <TeachingProvider>
          <Harness />
        </TeachingProvider>,
      );
    });
    expect(teaching.voiceSettings.mode).toBe('hands-free');
    expect(teaching.voice.active).toBe(false);
    expect(FakeRecognition.instances).toHaveLength(0);
  });
  it('keeps spoken replies off by default', async () => {
    const recognition = await listen();
    await act(async () => {
      recognition.result('Forma show roots');
    });
    expect(spoken).toHaveLength(0);
  });
  it('shows and speaks an Analyze clarification for an accepted voice request', async () => {
    await act(async () => {
      teaching.setAnalyzeMode(true);
      teaching.setVoiceSettings({ mode: 'hold', language: 'en-US', spokenReplies: true });
    });
    const recognition = await listen();
    await act(async () => {
      recognition.result('Forma explain the model');
    });
    expect(teaching.runtime.transcript).toBe('explain the model');
    expect(teaching.runtime.error).toBe(true);
    expect(teaching.runtime.message).toContain('Connect the AI service');
    expect(spoken[0].text).toContain('Connect the AI service');
    expect(teaching.voice.phase).toBe('paused');
    await act(async () => {
      teaching.cancel();
    });
    expect(teaching.voice.phase).toBe('listening');
  });
  it.each(['listening off', 'history reset', 'new control'])(
    'does not speak a stale voice confirmation after %s',
    async reason => {
      await act(async () => {
        teaching.setVoiceSettings({ mode: 'hold', language: 'en-US', spokenReplies: true });
        teaching.setConfig({ enabled: true, url: 'https://forma.example' });
        teaching.setPreferAI(true);
      });
      let resolve!: (value: unknown) => void;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise(done => {
              resolve = done;
            }),
        ),
      );
      const recognition = await listen();
      await act(async () => {
        recognition.result('Forma show roots');
      });
      expect(teaching.runtime.phase).toBe('interpreting');
      await act(async () => {
        if (reason === 'listening off') teaching.toggleHandsFree();
        else if (reason === 'history reset') teaching.resetHistory();
        else await teaching.runControl('hide gums');
        resolve({
          ok: true,
          json: async () => ({
            actions: [{ kind: 'toggle', target: 'roots', visible: true }],
            summary: 'Roots are visible.',
            clarification: null,
          }),
        });
      });
      expect(spoken).toHaveLength(0);
    },
  );
  it('clears pending Analyze feedback when the scene changes and ignores a late reply', async () => {
    await act(async () => {
      teaching.setConfig({ enabled: true, url: 'https://forma.example' });
      teaching.setAnalyzeMode(true);
    });
    let resolve!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise(done => {
            resolve = done;
          }),
      ),
    );
    const recognition = await listen();
    await act(async () => {
      recognition.result('Forma explain the model');
    });
    expect(teaching.runtime.phase).toBe('interpreting');
    await act(async () => {
      teaching.interact();
      resolve({ ok: true, json: async () => ({}) });
    });
    expect(teaching.runtime.phase).toBe('idle');
    expect(teaching.analysisPending).toBe(false);
    expect(teaching.analysis).toBeNull();
    expect(spoken).toHaveLength(0);
  });
});
