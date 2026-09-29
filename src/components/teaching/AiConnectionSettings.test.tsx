// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AiConnectionSettings } from './AiConnectionSettings';
import type { CommandServiceConfig } from '@/lib/command-service';

let root: Root | null, container: HTMLDivElement;
const onChange = vi.fn(),
  fetcher = vi.fn();
const off: CommandServiceConfig = { enabled: false, url: '' };
const health = { status: 'ok', ai_enabled: true, provider: 'OpenAI' };
const hosted = { commandService: { enabled: true, url: 'same-origin', provider: 'OpenAI' } };
const response = (value: unknown) => ({ ok: true, status: 200, json: async () => value });
async function render(config = off) {
  await act(async () => {
    root!.render(<AiConnectionSettings config={config} onChange={onChange} />);
  });
}
function button(text: string) {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(node =>
    node.textContent?.includes(text),
  )!;
}
async function click(text: string) {
  await act(async () => {
    button(text).click();
  });
}
async function edit(value: string) {
  const input = container.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function pending() {
  let resolve!: (value: unknown) => void;
  fetcher.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  return (value: unknown = health) => resolve(response(value));
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  onChange.mockReset();
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await render();
});
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('leaves AI off without requesting anything until the teacher explicitly connects', () => {
  expect(fetcher).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
  expect(container.textContent).toContain('AI is off');
  expect(container.textContent).toContain('Local commands always available');
  expect(container.querySelector('details')!.open).toBe(false);
  expect(container.querySelectorAll('input')).toHaveLength(1);
  expect(container.querySelector('input')!.type).toBe('url');
});
it('reconnects an explicit opt-out through current app discovery and health', async () => {
  fetcher.mockResolvedValueOnce(response(hosted)).mockResolvedValueOnce(response(health));
  await click('Connect this app');
  expect(onChange).toHaveBeenCalledExactlyOnceWith({
    enabled: true,
    url: window.location.origin,
    provider: 'OpenAI',
  });
  expect(container.textContent).toContain('Provider access is checked when you ask AI');
  expect(container.textContent).not.toContain('provider verified');
});
it('shows backend setup recovery without enabling AI when its key is absent', async () => {
  fetcher
    .mockResolvedValueOnce(response(hosted))
    .mockResolvedValueOnce(response({ ...health, ai_enabled: false }));
  await click('Connect this app');
  expect(onChange).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')!.textContent).toContain('API key is missing');
  expect(button('Connect this app').disabled).toBe(false);
});
it('connects an explicitly entered advanced backend URL', async () => {
  fetcher.mockResolvedValue(response(health));
  await edit('https://backend.example/');
  await click('Connect backend');
  expect(fetcher.mock.calls[0][0]).toBe('https://backend.example/health');
  expect(onChange).toHaveBeenCalledWith({
    enabled: true,
    url: 'https://backend.example',
    provider: 'OpenAI',
  });
});
it('does not disclose a raw HTML response', async () => {
  fetcher.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error('<html>private-token</html>');
    },
  });
  await click('Connect this app');
  expect(container.textContent).toContain('no AI gateway configured');
  expect(container.textContent).not.toContain('private-token');
});
it.each(['Cancel check', 'Turn AI off'])('ignores a late connection after %s', async action => {
  const finish = pending();
  await click('Connect this app');
  const requestSignal = fetcher.mock.calls[0][1].signal;
  await click(action);
  await act(async () => {
    finish(hosted);
  });
  expect(requestSignal.aborted).toBe(true);
  expect(button('Connect this app').disabled).toBe(false);
  if (action === 'Turn AI off') expect(onChange).toHaveBeenCalledExactlyOnceWith(off);
  else expect(onChange).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledOnce();
});
it('aborts an old connection when the advanced URL is edited', async () => {
  const finish = pending();
  await click('Connect this app');
  await edit('https://new.example');
  await act(async () => {
    finish(hosted);
  });
  expect(onChange).not.toHaveBeenCalled();
  expect(container.querySelector('input')!.value).toBe('https://new.example');
  expect(button('Connect this app').disabled).toBe(false);
});
it('aborts stale configuration, clears pending, and uses the new backend URL', async () => {
  const finish = pending();
  await click('Connect this app');
  const next = { enabled: false, url: 'https://new.example' };
  await render(next);
  await act(async () => {
    finish(hosted);
  });
  expect(onChange).not.toHaveBeenCalled();
  expect(button('Connect this app').disabled).toBe(false);
  expect(container.querySelector('input')!.value).toBe(next.url);
  fetcher.mockResolvedValue(response(health));
  await click('Connect backend');
  expect(fetcher.mock.calls.at(-1)![0]).toBe(`${next.url}/health`);
});
it('does not enable AI after the settings panel is closed', async () => {
  const finish = pending();
  await click('Connect this app');
  await act(async () => {
    root!.unmount();
    root = null;
    finish(hosted);
  });
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
});
it('ends a connection timeout with a retry action', async () => {
  vi.useFakeTimers();
  pending();
  await click('Connect this app');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(container.querySelector('[role="alert"]')!.textContent).toContain('took too long');
  expect(button('Connect this app').disabled).toBe(false);
});
