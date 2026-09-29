import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aiServiceUrl,
  connectAiService,
  connectThisApp,
  requestTeachingAi,
} from './ai-service-client';
import { publicAiError } from './ai-service-errors';

const origin = 'https://nael.example';
const hosted = { commandService: { enabled: true, url: 'same-origin', provider: 'OpenRouter' } };
const health = { status: 'ok', ai_enabled: true, provider: 'OpenRouter' };
const response = (value: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => value,
});
const fetcher = vi.fn();
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const signal = () => new AbortController().signal;

it('resolves this app strictly and checks its backend without redirects', async () => {
  fetcher.mockResolvedValueOnce(response(hosted)).mockResolvedValueOnce(response(health));
  expect(await connectThisApp(origin, signal())).toEqual({
    enabled: true,
    url: origin,
    provider: 'OpenRouter',
  });
  expect(fetcher.mock.calls.map(call => call[0])).toEqual([
    '/forma-runtime-config.json',
    `${origin}/health`,
  ]);
  for (const [, init] of fetcher.mock.calls)
    expect(init).toMatchObject({ redirect: 'error', cache: 'no-store' });
});
it('does not follow an external address nominated by hosted discovery', async () => {
  fetcher.mockResolvedValue(
    response({ commandService: { ...hosted.commandService, url: 'https://other.example' } }),
  );
  await expect(connectThisApp(origin, signal())).rejects.toThrow('no AI gateway configured');
  expect(fetcher).toHaveBeenCalledOnce();
});
it('explains missing backend credentials without declaring provider verification', async () => {
  fetcher.mockResolvedValue(response({ ...health, ai_enabled: false }));
  await expect(connectAiService(origin, signal())).rejects.toThrow('API key is missing');
});
it.each([{ status: 'ok' }, { ...health, provider: '<script>secret</script>' }, 'unrelated'])(
  'rejects unrelated health response %j',
  async value => {
    fetcher.mockResolvedValue(response(value));
    await expect(connectAiService(origin, signal())).rejects.toThrow('not the Nael AI service');
  },
);
it.each([
  'https://key:secret@example.test',
  'file:///secret',
  'https://host.test?key=secret',
  'https://host.test#secret',
])('rejects unsafe backend URL %s before fetch', value => {
  expect(() => aiServiceUrl(value)).toThrow('without a password, query or fragment');
  expect(fetcher).not.toHaveBeenCalled();
});
it('normalizes a manual URL and posts only to the selected route', async () => {
  fetcher.mockResolvedValue(response({ actions: [] }));
  await requestTeachingAi(' https://nael.example/ ', 'interpret', { text: 'show roots' }, signal());
  expect(fetcher).toHaveBeenCalledWith(
    `${origin}/api/interpret-teaching`,
    expect.objectContaining({ method: 'POST', body: '{"text":"show roots"}', redirect: 'error' }),
  );
});

describe.each(['interpret', 'analyze'] as const)('%s failures', route => {
  it.each([404, 405])('explains a wrong endpoint (%s)', async status => {
    fetcher.mockResolvedValue(response({ detail: 'secret' }, status));
    await expect(requestTeachingAi(origin, route, {}, signal())).rejects.toThrow(
      'not the Nael AI service',
    );
  });
  it('does not leak HTML or JSON decoding exceptions', async () => {
    fetcher.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('<html>secret key</html>');
      },
    });
    await expect(requestTeachingAi(origin, route, {}, signal())).rejects.toThrow(
      'check the advanced backend URL',
    );
  });
  it('does not leak network exception text', async () => {
    fetcher.mockRejectedValue(new Error('https://secret:key@provider/'));
    await expect(requestTeachingAi(origin, route, {}, signal())).rejects.toThrow(
      'Cannot reach the AI service',
    );
  });
  it('preserves an approved provider recovery message', async () => {
    const detail =
      "OpenRouter needs available API credits. Check the provider's billing settings. Local commands still work.";
    fetcher.mockResolvedValue(response({ detail }, 402));
    await expect(requestTeachingAi(origin, route, {}, signal())).rejects.toThrow(detail);
  });
  it('replaces arbitrary backend errors with a safe recovery message', async () => {
    fetcher.mockResolvedValue(response({ detail: 'secret raw upstream request' }, 500));
    await expect(requestTeachingAi(origin, route, {}, signal())).rejects.toThrow(
      'could not complete the request',
    );
  });
  it('bounds even a fetch that ignores abort', async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(() => new Promise(() => {}));
    const result = requestTeachingAi(origin, route, {}, signal());
    const check = expect(result).rejects.toThrow('took too long');
    await vi.advanceTimersByTimeAsync(25000);
    await check;
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds a stalled JSON body too', async () => {
    vi.useFakeTimers();
    fetcher.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) });
    const check = expect(requestTeachingAi(origin, route, {}, signal())).rejects.toThrow(
      'took too long',
    );
    await vi.advanceTimersByTimeAsync(25000);
    await check;
  });
  it('cancels immediately and ignores a late response', async () => {
    let resolve!: (value: unknown) => void;
    fetcher.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const controller = new AbortController();
    const result = requestTeachingAi(origin, route, {}, controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    resolve(response({ actions: [] }));
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('never starts a cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(requestTeachingAi(origin, route, {}, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
it('checks health within five seconds', async () => {
  vi.useFakeTimers();
  fetcher.mockImplementation(() => new Promise(() => {}));
  const check = expect(connectAiService(origin, signal())).rejects.toThrow('took too long');
  await vi.advanceTimersByTimeAsync(5000);
  await check;
});
it('keeps the frontend provider-message allowlist in sync with the backend', () => {
  const source = readFileSync('backend/core.py', 'utf8');
  const templates = [...source.matchAll(/f"(\{provider\}[^"\n]+)"/g)].map(match => match[1]);
  expect(templates.length).toBeGreaterThanOrEqual(9);
  for (const provider of ['OpenAI', 'OpenRouter', 'Configured AI provider'])
    for (const template of templates) {
      const detail = template.replace('{provider}', provider);
      expect(publicAiError({ detail })).toBe(detail);
    }
});

it.each(['404', 'HTML'])(
  'explains how to start the gateway when discovery returns %s',
  async kind => {
    fetcher.mockResolvedValue(
      kind === '404'
        ? response({}, 404)
        : {
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError('<html>static app</html>');
            },
          },
    );
    await expect(connectThisApp(origin, signal())).rejects.toThrow(
      'Start it with npm run start:ai',
    );
    expect(fetcher).toHaveBeenCalledOnce();
  },
);
it('keeps unreachable discovery distinct from missing gateway configuration', async () => {
  fetcher.mockRejectedValue(new TypeError('Offline'));
  await expect(connectThisApp(origin, signal())).rejects.toThrow('Cannot reach the AI service');
});
