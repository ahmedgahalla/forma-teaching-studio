// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TeachingCommandBar,
  TeachingProvider,
  useTeaching,
  useTeachingAdapter,
} from './TeachingController';
import { sceneAnalysisContext, type SceneAnalysis } from '../lib/scene-analysis';

let teaching: ReturnType<typeof useTeaching>, root: Root, container: HTMLDivElement;
const applied = vi.fn(),
  preflight = vi.fn(),
  paused = vi.fn();

function Harness() {
  teaching = useTeaching();
  const [roots, setRoots] = useState(false);
  useTeachingAdapter('case', {
    context: () => ({
      mode: 'case',
      workflowId: null,
      stepIndex: 0,
      selected: '11',
      selectedIds: ['11'],
      availableIds: ['11', '21'],
      synthetic: true,
      view: 'front',
      arch: 'both',
      speed: 1,
      playing: false,
      layers: { roots, gums: true },
    }),
    capture: () => ({ roots }),
    restore: value => setRoots((value as { roots: boolean }).roots),
    preflight,
    pause: paused,
    narration: () => '',
    apply: action => {
      applied(action);
      if (action.kind === 'toggle' && action.target === 'roots') setRoots(action.visible);
      return true;
    },
    analysisContext: () =>
      sceneAnalysisContext({
        synthetic: true,
        ids: ['11', '21'],
        selectedIds: ['11'],
        transforms: {},
        arch: 'both',
        roots,
        gums: true,
        bone: false,
      }),
  });
  return (
    <>
      <output data-testid="roots">{String(roots)}</output>
      <TeachingCommandBar />
    </>
  );
}

const answer = (): SceneAnalysis => ({
  observations: 'Tooth 11 is selected.',
  explanation: 'The supplied model has no calculated response.',
  limitations: 'This is an educational scene.',
  studentQuestion: 'Which structure would you reveal first?',
  model: 'openai/gpt-6-luna',
});
const response = (value: unknown = answer()) => ({ ok: true, json: async () => value });

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('speechSynthesis', { cancel: vi.fn() });
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
  await act(async () => {
    teaching.setConfig({ enabled: true, url: 'https://forma.example', provider: 'OpenRouter' });
    teaching.setAnalyzeMode(true);
  });
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe('read-only scene analysis controller', () => {
  it('posts the question and minimal facts to the configured analysis service without applying or preflighting edits', async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetcher);
    await act(async () => {
      await teaching.run('Why did those teeth move so little?');
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://forma.example/api/analyze-teaching');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(options.signal).toBeDefined();
    expect(JSON.parse(options.body as string)).toMatchObject({
      question: 'Why did those teeth move so little?',
      context: { selectedIds: ['11'], result: null, teeth: [{ id: '11' }, { id: '21' }] },
    });
    expect(teaching.analysis).toEqual(answer());
    expect(teaching.analysisPending).toBe(false);
    expect(container.querySelector('.teaching-analysis-card')?.textContent).toContain(
      'openai/gpt-6-luna',
    );
    expect(applied).not.toHaveBeenCalled();
    expect(preflight).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="roots"]')?.textContent).toBe('false');
  });

  it('does not turn an imperative in Analyze mode into a scene edit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
    await act(async () => {
      await teaching.run('Show roots and move tooth 11 one millimeter.');
    });
    expect(teaching.analysis).toEqual(answer());
    expect(applied).not.toHaveBeenCalled();
    expect(preflight).not.toHaveBeenCalled();
  });

  it('keeps manual controls local and reversible while Analyze and the AI preference are active', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await act(async () => {
      teaching.setPreferAI(true);
      teaching.setAnalyzeMode(true);
    });
    await act(async () => {
      await teaching.runControl('show roots');
    });
    expect(teaching.analyzeMode).toBe(true);
    expect(teaching.preferAI).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    expect(preflight).toHaveBeenCalledOnce();
    expect(applied).toHaveBeenCalledExactlyOnceWith({
      kind: 'toggle',
      target: 'roots',
      visible: true,
    });
    expect(container.querySelector('[data-testid="roots"]')?.textContent).toBe('true');
    expect(teaching.runtime.interpreter).toBe('local');
    expect(teaching.analysis).toBeNull();
    await act(async () => {
      await teaching.runControl('undo that');
    });
    expect(container.querySelector('[data-testid="roots"]')?.textContent).toBe('false');
    expect(fetcher).not.toHaveBeenCalled();
    expect(teaching.analyzeMode).toBe(true);
  });

  it.each(['Stop', 'Escape', 'scene interaction', 'pointing', 'settings', 'reset history'])(
    'cancels on %s and discards late explanations even if fetch ignores abort',
    async reason => {
      let resolve!: (value: unknown) => void, pending!: Promise<void>;
      const fetcher = vi.fn(
        (_url: string, _options: RequestInit) =>
          new Promise(done => {
            resolve = done;
          }),
      );
      vi.stubGlobal('fetch', fetcher);
      await act(async () => {
        pending = teaching.run('Explain this model.');
      });
      expect(teaching.analysisPending).toBe(true);
      await act(async () => {
        if (reason === 'Stop')
          container
            .querySelector<HTMLButtonElement>('[aria-label="Stop classroom action"]')!
            .click();
        else if (reason === 'Escape')
          document.body.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          );
        else if (reason === 'scene interaction') teaching.interact();
        else if (reason === 'pointing') teaching.referenceInteraction();
        else if (reason === 'settings')
          teaching.setConfig({ enabled: true, url: 'https://new-service.example' });
        else teaching.resetHistory();
      });
      expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
      await act(async () => {
        resolve(response());
        await pending;
      });
      expect(teaching.analysis).toBeNull();
      expect(teaching.analysisError).toBe('');
      expect(teaching.analysisPending).toBe(false);
      expect(applied).not.toHaveBeenCalled();
      expect(preflight).not.toHaveBeenCalled();
    },
  );

  it('a newer question supersedes the previous reply without stale error or pending state', async () => {
    const completions: ((value: unknown) => void)[] = [];
    const fetcher = vi.fn(
      (_url: string, _options: RequestInit) => new Promise(done => completions.push(done)),
    );
    vi.stubGlobal('fetch', fetcher);
    let first!: Promise<void>, second!: Promise<void>;
    await act(async () => {
      first = teaching.run('First question');
    });
    await act(async () => {
      second = teaching.run('Second question');
    });
    expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
    await act(async () => {
      completions[0]({ ok: false, json: async () => ({ detail: 'Stale error' }) });
      await first;
    });
    expect(teaching.analysisPending).toBe(true);
    expect(teaching.analysisError).toBe('');
    await act(async () => {
      completions[1](response({ ...answer(), explanation: 'The second answer.' }));
      await second;
    });
    expect(teaching.analysisQuestion).toBe('Second question');
    expect(teaching.analysis?.explanation).toBe('The second answer.');
  });

  it('does not display a stale transport error after the scene history is reset', async () => {
    let reject!: (error: unknown) => void, pending!: Promise<void>;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      ),
    );
    await act(async () => {
      pending = teaching.run('Explain the previous setup.');
    });
    await act(async () => {
      teaching.resetHistory();
      reject(new Error('Old network request failed.'));
      await pending;
    });
    expect(teaching.analysisError).toBe('');
    expect(teaching.analysis).toBeNull();
  });

  it('rejects provider actions in an analysis reply and leaves the model unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ ...answer(), actions: [{ kind: 'toggle', target: 'roots', visible: true }] }),
        ),
    );
    await act(async () => {
      await teaching.run('Explain this.');
    });
    expect(teaching.analysis).toBeNull();
    expect(teaching.analysisError).toMatch(/incomplete/i);
    expect(applied).not.toHaveBeenCalled();
    expect(preflight).not.toHaveBeenCalled();
  });

  it('keeps undo local in Analyze mode and adds no analysis entry to command history', async () => {
    await act(async () => {
      teaching.setAnalyzeMode(false);
    });
    await act(async () => {
      await teaching.run('show roots');
    });
    expect(container.querySelector('[data-testid="roots"]')?.textContent).toBe('true');
    await act(async () => {
      teaching.setAnalyzeMode(true);
    });
    const fetcher = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetcher);
    await act(async () => {
      await teaching.run('Explain this setup.');
    });
    await act(async () => {
      await teaching.run('undo that');
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(teaching.analysis).toBeNull();
    expect(container.querySelector('[data-testid="roots"]')?.textContent).toBe('false');
  });

  it('handles disabled service without sending a request and keeps ordinary controls available', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await act(async () => {
      teaching.setConfig({ enabled: false, url: '' });
    });
    await act(async () => {
      await teaching.run('Explain the selected tooth.');
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(teaching.analysisError).toMatch(/connect.*AI service/i);
    await act(async () => {
      teaching.setAnalyzeMode(false);
    });
    await act(async () => {
      await teaching.run('show roots');
    });
    expect(container.querySelector('[data-testid="roots"]')?.textContent).toBe('true');
  });
});
