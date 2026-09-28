import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiProvider, createLocalAiGateway, localPort } from './local-ai-gateway.mjs';

const options = { host: '127.0.0.1', port: 3012, backendPort: 8002, provider: 'OpenAI' };
const origin = 'http://127.0.0.1:3012';
function request(url = '/health', method = 'GET', body, headers = {}) {
  const req = new Readable({ read() {} });
  Object.assign(req, {
    url,
    method,
    headers: {
      host: '127.0.0.1:3012',
      ...(method === 'POST' ? { origin, 'content-type': 'application/json' } : {}),
      ...headers,
    },
  });
  if (body !== undefined) req.push(Buffer.from(body));
  req.push(null);
  return req;
}
function response() {
  const res = new EventEmitter();
  return Object.assign(res, {
    writableEnded: false,
    destroyed: false,
    status: 0,
    value: undefined,
    headers: {},
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.writableEnded = true;
      this.value = body ? JSON.parse(body) : undefined;
    },
  });
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
async function run(gateway, req) {
  const res = response();
  const handled = await gateway(req, res);
  return { res, handled };
}
afterEach(() => vi.useRealTimers());

describe('opt-in local AI gateway without a listening server', () => {
  it('serves only safe same-origin discovery and leaves ordinary assets to the static server', async () => {
    const transport = vi.fn();
    const gateway = createLocalAiGateway(options, transport);
    const { res } = await run(gateway, request('/forma-runtime-config.json'));
    expect(res.value).toEqual({
      commandService: { enabled: true, url: 'same-origin', provider: 'OpenAI' },
    });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect((await run(gateway, request('/favicon.svg'))).handled).toBe(false);
    expect(
      (await run(gateway, request('/forma-runtime-config.json', 'HEAD'))).res.value,
    ).toBeUndefined();
    expect(transport).not.toHaveBeenCalled();
  });

  it.each(['/api/interpret-teaching', '/api/analyze-teaching'])(
    'forwards only the JSON body to fixed loopback %s',
    async route => {
      const answer = { actions: [], summary: '', clarification: 'Name a tooth.' };
      const transport = vi.fn().mockResolvedValue(json(answer));
      const gateway = createLocalAiGateway(options, transport);
      const body = JSON.stringify({ text: 'show roots', context: { mode: 'case' } });
      const { res } = await run(
        gateway,
        request(route, 'POST', body, {
          authorization: 'private',
          cookie: 'private',
          'x-target': 'https://elsewhere.invalid',
        }),
      );
      expect(res.value).toEqual(answer);
      const [url, init] = transport.mock.calls[0];
      expect(url).toBe(`http://127.0.0.1:8002${route}`);
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(init.body.toString()).toBe(body);
      expect(init.redirect).toBe('error');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    },
  );

  it('forwards health as GET without incoming headers and keeps HEAD bodyless', async () => {
    const transport = vi
      .fn()
      .mockImplementation(async () => json({ status: 'ok', ai_enabled: true, provider: 'OpenAI' }));
    const gateway = createLocalAiGateway(options, transport);
    const { res } = await run(
      gateway,
      request('/health', 'HEAD', undefined, { cookie: 'private' }),
    );
    expect(res.status).toBe(200);
    expect(res.value).toBeUndefined();
    expect(transport.mock.calls[0][1]).toMatchObject({ method: 'GET', headers: {} });
  });

  it.each([
    { host: 'evil.invalid:3012' },
    { host: 'localhost:3012' },
    { origin: 'http://127.0.0.1:3000' },
    { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' },
  ])('rejects wrong host/origin even for discovery and assets: %j', async headers => {
    const transport = vi.fn();
    const gateway = createLocalAiGateway(options, transport);
    for (const route of ['/health', '/forma-runtime-config.json', '/index.html'])
      expect((await run(gateway, request(route, 'GET', undefined, headers))).res.status).toBe(403);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, '{}', 403, { origin: undefined }],
    ['text/plain', '{}', 415, {}],
    ['application/json', '{}', 415, { 'content-encoding': 'gzip' }],
    ['application/json', '{}', 413, { 'content-length': '65537' }],
    ['application/json', 'x'.repeat(65537), 413, {}],
    ['application/json', '{invalid', 400, {}],
    ['application/json', '[]', 400, {}],
    ['application/json', 'null', 400, {}],
  ])(
    'rejects invalid or oversized teaching input (%s / %i)',
    async (type, body, status, headers) => {
      const transport = vi.fn();
      const gateway = createLocalAiGateway(options, transport);
      const { res } = await run(
        gateway,
        request('/api/interpret-teaching', 'POST', body, { 'content-type': type, ...headers }),
      );
      expect(res.status).toBe(status);
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it('does not proxy query strings, arbitrary paths, encoded routes or wrong methods', async () => {
    const transport = vi.fn();
    const gateway = createLocalAiGateway(options, transport);
    for (const path of ['/health?target=elsewhere', '/api/models', '//health', '/%68ealth'])
      expect((await run(gateway, request(path))).handled).toBe(false);
    expect((await run(gateway, request('/api/interpret-teaching'))).res.status).toBe(405);
    expect((await run(gateway, request('/health', 'POST', '{}'))).res.status).toBe(405);
    expect(transport).not.toHaveBeenCalled();
  });

  it('preserves the trusted backend sanitized provider status and detail', async () => {
    const detail = 'OpenAI has no available quota.';
    const gateway = createLocalAiGateway(options, async () => json({ detail }, 429));
    const { res } = await run(gateway, request('/health'));
    expect(res.status).toBe(429);
    expect(res.value).toEqual({ detail });
  });

  it.each(['throw', 'html', 'oversize', 'array'])(
    'sanitizes an unavailable or invalid backend (%s)',
    async kind => {
      const gateway = createLocalAiGateway(options, async () => {
        if (kind === 'throw') throw new Error('private backend credentials');
        if (kind === 'html') return new Response('<html>private backend credentials</html>');
        if (kind === 'oversize') return json({ detail: 'x'.repeat(65537) });
        return json([]);
      });
      const { res } = await run(gateway, request('/health'));
      expect(res.status).toBe(503);
      expect(res.value).toEqual({
        detail: 'The local AI backend is unavailable. Check its terminal, then try again.',
      });
    },
  );

  it.each(['request', 'response'])(
    'propagates caller %s cancellation and releases its slot',
    async source => {
      let started;
      const ready = new Promise(resolve => {
        started = resolve;
      });
      const transport = vi.fn(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
            started();
          }),
      );
      const gateway = createLocalAiGateway(options, transport);
      const req = request(),
        res = response();
      const pending = gateway(req, res);
      await ready;
      if (source === 'request') req.emit('aborted');
      else res.emit('close');
      await pending;
      expect(transport.mock.calls[0][1].signal.aborted).toBe(true);
      expect(res.status).toBe(0);
      transport.mockResolvedValue(json({ status: 'ok' }));
      expect((await run(gateway, request())).res.status).toBe(200);
    },
  );

  it('times out the upstream request and releases all listeners and timers', async () => {
    vi.useFakeTimers();
    const transport = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('private timeout')), {
            once: true,
          });
        }),
    );
    const gateway = createLocalAiGateway(options, transport);
    const req = request(),
      res = response();
    const pending = gateway(req, res);
    await vi.advanceTimersByTimeAsync(23000);
    await pending;
    expect(res.status).toBe(503);
    expect(res.value.detail).toContain('timed out');
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('limits concurrent requests and cancels response streaming on disconnect', async () => {
    const cancelled = vi.fn();
    const transport = vi.fn(async () => new Response(new ReadableStream({ cancel: cancelled })));
    const gateway = createLocalAiGateway(options, transport);
    const first = response(),
      second = response();
    const pending = [gateway(request(), first), gateway(request(), second)];
    await new Promise(resolve => setImmediate(resolve));
    expect((await run(gateway, request())).res.status).toBe(429);
    first.emit('close');
    second.emit('close');
    await Promise.all(pending);
    expect(cancelled).toHaveBeenCalledTimes(2);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
  });

  it('refuses exposed binds, ambiguous ports and unsupported provider labels', () => {
    for (const host of ['0.0.0.0', '::', 'localhost'])
      expect(() => createLocalAiGateway({ ...options, host })).toThrow(/127.0.0.1/);
    expect(() => createLocalAiGateway({ ...options, backendPort: 3012 })).toThrow(/differ/);
    expect(() => createLocalAiGateway({ ...options, provider: 'secret-value' })).toThrow(
      /provider label/,
    );
    for (const port of [0, -1, 80, 8000.5, 65536, 'bad'])
      expect(() => localPort(port, 'PORT')).toThrow(/integer/);
    expect(aiProvider()).toBe('OpenAI');
    expect(aiProvider('https://openrouter.ai/api/v1')).toBe('OpenRouter');
    expect(aiProvider('https://private.invalid')).toBe('Configured AI provider');
  });
});
