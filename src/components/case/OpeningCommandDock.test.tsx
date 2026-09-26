// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { useTeaching } from '../teaching/TeachingController';
import { OpeningCommandDock } from './OpeningCommandDock';

type DockController = Pick<
  ReturnType<typeof useTeaching>,
  'capture' | 'runtime' | 'analysisPending' | 'analysis' | 'analysisError' | 'cancel' | 'runControl'
>;
let teaching: DockController, root: Root, container: HTMLDivElement;

vi.mock('../teaching/TeachingController', () => ({ useTeaching: () => teaching }));

function DraftInput() {
  const [draft, setDraft] = useState('');
  return (
    <input
      aria-label="Draft command"
      value={draft}
      onChange={event => setDraft(event.target.value)}
    />
  );
}

function Harness({ playing = false, notice }: { playing?: boolean; notice?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <OpeningCommandDock open={open} onOpenChange={setOpen} playing={playing} notice={notice}>
      <DraftInput />
    </OpeningCommandDock>
  );
}

async function render(playing = false, notice?: string) {
  await act(async () => {
    root.render(<Harness playing={playing} notice={notice} />);
  });
}
const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
const content = () => document.getElementById(toggle().getAttribute('aria-controls')!)!;
const status = () => container.querySelector<HTMLElement>('[role="status"]')!;
const stop = () =>
  container.querySelector<HTMLButtonElement>('[aria-label="Stop classroom action"]');
async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
  });
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  teaching = {
    capture: { supported: true, phase: 'idle', transcript: '' },
    runtime: {
      phase: 'idle',
      message: 'Ready for your instruction.',
      error: false,
      transcript: '',
    },
    analysisPending: false,
    analysis: null,
    analysisError: '',
    cancel: vi.fn(),
    runControl: vi.fn().mockResolvedValue(undefined),
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await render();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

it('preserves the mounted input and its draft through collapse and reopen', async () => {
  expect(content().hidden).toBe(true);
  const input = container.querySelector('input')!;
  await click(toggle());
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      'show roots and hide gums',
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click(toggle());
  expect(content().hidden).toBe(true);
  expect(container.querySelector('input')).toBe(input);
  await click(toggle());
  expect(content().hidden).toBe(false);
  expect(container.querySelector('input')).toBe(input);
  expect(input.value).toBe('show roots and hide gums');
});

it('announces live speech while closed and keeps cancellation reachable', async () => {
  teaching.capture = { supported: true, phase: 'listening', transcript: 'show the roots' };
  await render();
  expect(content().hidden).toBe(true);
  expect(status().textContent).toContain('listening');
  expect(status().textContent).toContain('show the roots');
  expect(status().closest('[hidden]')).toBeNull();
  await click(stop()!);
  expect(teaching.cancel).toHaveBeenCalledOnce();
  expect(teaching.runControl).not.toHaveBeenCalled();
});

it('keeps a local case error visible when commands are expanded', async () => {
  const notice = 'Apply or discard the preview before saving the case.';
  const alert = () => container.querySelector<HTMLElement>('[role="alert"]')!;
  await render(false, notice);
  expect(content().hidden).toBe(true);
  expect(alert().textContent).toBe(notice);
  await click(toggle());
  expect(content().hidden).toBe(false);
  expect(alert().textContent).toBe(notice);
  expect(alert().closest('[hidden]')).toBeNull();
  await click(toggle());
  teaching.capture = { supported: true, phase: 'listening', transcript: 'show roots' };
  await render(false, notice);
  expect(alert().textContent).toBe(notice);
  expect(status().textContent).toContain('listening: show roots');
  expect(stop()).not.toBeNull();
  expect(teaching.cancel).not.toHaveBeenCalled();
});

it('reports analysis progress, a ready answer and errors without requiring an open dock', async () => {
  teaching.analysisPending = true;
  await render();
  expect(status().textContent).toContain('Analyzing');
  expect(stop()).not.toBeNull();

  teaching.analysisPending = false;
  teaching.analysis = {
    observations: 'Tooth 11 is selected.',
    explanation: 'No mechanical response has been calculated.',
    limitations: 'Synthetic educational model.',
    studentQuestion: 'Which structure would you reveal?',
    model: 'test-provider',
  };
  await render();
  expect(status().textContent).toMatch(/explanation ready.*open commands/i);
  expect(stop()).toBeNull();

  teaching.analysis = null;
  teaching.analysisError = 'The explanation service is unavailable.';
  await render();
  expect(status().textContent).toContain(teaching.analysisError);
  expect(status().classList.contains('error')).toBe(true);

  teaching.analysisError = '';
  teaching.runtime = {
    ...teaching.runtime,
    error: true,
    message: 'Choose a movement amount before continuing.',
  };
  await render();
  expect(content().hidden).toBe(true);
  expect(status().textContent).toContain(teaching.runtime.message);
  expect(status().classList.contains('error')).toBe(true);
});

it('opens and closes during analysis without cancelling or submitting a request', async () => {
  teaching.analysisPending = true;
  await render();
  await click(toggle());
  expect(content().hidden).toBe(false);
  await click(toggle());
  expect(content().hidden).toBe(true);
  expect(status().textContent).toContain('Analyzing');
  expect(teaching.cancel).not.toHaveBeenCalled();
  expect(teaching.runControl).not.toHaveBeenCalled();
});

it('delegates undo and redo to the shared runtime while commands are closed', async () => {
  await click(container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!);
  await click(container.querySelector<HTMLButtonElement>('[aria-label="Redo"]')!);
  expect(teaching.runControl).toHaveBeenNthCalledWith(1, 'undo that');
  expect(teaching.runControl).toHaveBeenNthCalledWith(2, 'redo');
  expect(teaching.runControl).toHaveBeenCalledTimes(2);
  expect(teaching.cancel).not.toHaveBeenCalled();
  expect(content().hidden).toBe(true);
});

it.each(['execution', 'playback'])(
  'keeps Stop reachable during %s with commands closed',
  async mode => {
    if (mode === 'execution') teaching.runtime.phase = 'executing';
    await render(mode === 'playback');
    await click(stop()!);
    expect(teaching.cancel).toHaveBeenCalledOnce();
    expect(content().hidden).toBe(true);
  },
);
