import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ exists: vi.fn(), read: vi.fn(), spawn: vi.fn() }));
vi.mock('node:fs', () => ({ existsSync: mocks.exists, readFileSync: mocks.read }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
let children, signals, previousExitCode;
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  children = [];
  signals = {};
  previousExitCode = process.exitCode;
  for (const name of Object.keys(process.env))
    if (/^OPENAI_/i.test(name)) vi.stubEnv(name, undefined);
  vi.stubEnv('PORT', '3012');
  vi.stubEnv('FORMA_AI_PORT', '8002');
  vi.stubEnv('FORMA_HOST', undefined);
  mocks.exists.mockReturnValue(true);
  mocks.read.mockReturnValue('OPENAI_API_KEY=fixture-only-key\nOPENAI_MODEL=fixture-model\n');
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: vi.fn() });
    children.push(child);
    return child;
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('Startup stopped');
  });
  vi.spyOn(process, 'on').mockImplementation((name, handler) => {
    signals[name] = handler;
    return process;
  });
});
afterEach(() => {
  signals.SIGINT?.();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  Object.defineProperty(process, 'platform', originalPlatform);
  vi.useRealTimers();
  process.exitCode = previousExitCode;
  mocks.spawn.mockReset();
  mocks.read.mockReset();
  mocks.exists.mockReset();
});

describe('local AI launcher with mocked files and child processes', () => {
  it('waits for a successful backend bind and keeps credentials out of frontend configuration', async () => {
    await import('./start-ai.mjs');
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    const [, args, backend] = mocks.spawn.mock.calls[0];
    expect(args).toContain('8002');
    expect(args).not.toContain('fixture-only-key');
    expect(backend.env).toMatchObject({
      OPENAI_API_KEY: 'fixture-only-key',
      CORS_ORIGINS: 'http://127.0.0.1:3012',
    });
    children[0].stderr.emit('data', Buffer.from('Application startup complete.'));
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    children[0].stderr.emit('data', Buffer.from('Uvicorn running on http://127.0.0.1:8002'));
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    const frontend = mocks.spawn.mock.calls[1][2];
    expect(frontend.env).toMatchObject({
      PORT: '3012',
      FORMA_HOST: '127.0.0.1',
      FORMA_LOCAL_AI_PORT: '8002',
      FORMA_LOCAL_AI_PROVIDER: 'OpenAI',
    });
    expect(Object.keys(frontend.env).some(name => /^OPENAI_/i.test(name))).toBe(false);
    expect(JSON.stringify(console.log.mock.calls)).not.toContain('fixture-only-key');
    expect(vi.getTimerCount()).toBe(0);
    signals.SIGINT();
    expect(children[0].kill).toHaveBeenCalledOnce();
    expect(children[1].kill).toHaveBeenCalledOnce();
  });

  it('retains explicit environment overrides only in the backend and publishes a safe provider label', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'inherited-fixture-key');
    vi.stubEnv('OPENAI_BASE_URL', 'https://openrouter.ai/api/v1');
    await import('./start-ai.mjs');
    children[0].stderr.emit('data', Buffer.from('Uvicorn running on http://127.0.0.1:8002'));
    expect(mocks.spawn.mock.calls[0][2].env.OPENAI_API_KEY).toBe('inherited-fixture-key');
    expect(mocks.spawn.mock.calls[1][2].env.FORMA_LOCAL_AI_PROVIDER).toBe('OpenRouter');
    expect(mocks.spawn.mock.calls[1][2].env.OPENAI_BASE_URL).toBeUndefined();
  });

  it('canonicalizes Windows provider names before inherited settings override the private file', async () => {
    Object.defineProperty(process, 'platform', { ...originalPlatform, value: 'win32' });
    mocks.read.mockReturnValue(
      'OPENAI_API_KEY=private-fixture-key\nOPENAI_BASE_URL=https://api.openai.com/v1\nOpenAI_Model=private-fixture-model\n',
    );
    vi.stubEnv('openai_api_key', 'mixed-fixture-key');
    vi.stubEnv('OpenAI_Base_URL', 'https://openrouter.ai/api/v1');
    vi.stubEnv('oPeNaI_mOdEl', 'inherited-fixture-model');
    await import('./start-ai.mjs');
    children[0].stderr.emit('data', Buffer.from('Uvicorn running on http://127.0.0.1:8002'));
    const backend = mocks.spawn.mock.calls[0][2].env;
    expect(backend).toMatchObject({
      OPENAI_API_KEY: 'mixed-fixture-key',
      OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
      OPENAI_MODEL: 'inherited-fixture-model',
    });
    expect(
      Object.keys(backend)
        .filter(name => /^OPENAI_/i.test(name))
        .sort(),
    ).toEqual(['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL']);
    const frontend = mocks.spawn.mock.calls[1][2].env;
    expect(frontend.FORMA_LOCAL_AI_PROVIDER).toBe('OpenRouter');
    expect(Object.keys(frontend).some(name => /^OPENAI_/i.test(name))).toBe(false);
  });

  it('preserves POSIX case sensitivity while removing every provider-key casing from the frontend', async () => {
    Object.defineProperty(process, 'platform', { ...originalPlatform, value: 'linux' });
    vi.stubEnv('openai_api_key', 'lowercase-fixture-key');
    vi.stubEnv('OpenAI_Base_URL', 'https://openrouter.ai/api/v1');
    await import('./start-ai.mjs');
    children[0].stderr.emit('data', Buffer.from('Uvicorn running on http://127.0.0.1:8002'));
    expect(mocks.spawn.mock.calls[0][2].env.OPENAI_API_KEY).toBe('fixture-only-key');
    const frontend = mocks.spawn.mock.calls[1][2].env;
    expect(frontend.FORMA_LOCAL_AI_PROVIDER).toBe('OpenAI');
    expect(Object.keys(frontend).some(name => /^OPENAI_/i.test(name))).toBe(false);
  });

  it.each(['missing-key', 'missing-build', 'remote-bind', 'same-port', 'invalid-provider'])(
    'stops safely before spawning for %s',
    async kind => {
      if (kind === 'missing-key') mocks.read.mockReturnValue('OPENAI_API_KEY=\n');
      if (kind === 'missing-build') mocks.exists.mockReturnValue(false);
      if (kind === 'remote-bind') vi.stubEnv('FORMA_HOST', '0.0.0.0');
      if (kind === 'same-port') vi.stubEnv('FORMA_AI_PORT', '3012');
      if (kind === 'invalid-provider')
        mocks.read.mockReturnValue(
          'OPENAI_API_KEY=fixture-only-key\nOPENAI_BASE_URL=private-credential-text\n',
        );
      await expect(import('./start-ai.mjs')).rejects.toThrow('Startup stopped');
      expect(mocks.spawn).not.toHaveBeenCalled();
      expect(JSON.stringify(console.error.mock.calls)).not.toMatch(
        /fixture-only-key|private-credential-text/,
      );
    },
  );

  it('does not start the frontend if Python exits or cannot bind', async () => {
    await import('./start-ai.mjs');
    children[0].stderr.emit(
      'data',
      Buffer.from('Application startup complete.\nAddress already in use.'),
    );
    children[0].emit('exit', 1);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops both children if the frontend exits', async () => {
    await import('./start-ai.mjs');
    children[0].stderr.emit('data', Buffer.from('Uvicorn running on http://127.0.0.1:8002'));
    children[1].emit('exit', 1);
    expect(children.every(child => child.kill.mock.calls.length === 1)).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('bounds startup without a readiness request', async () => {
    await import('./start-ai.mjs');
    await vi.advanceTimersByTimeAsync(20000);
    expect(children[0].kill).toHaveBeenCalledOnce();
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
  });
});
