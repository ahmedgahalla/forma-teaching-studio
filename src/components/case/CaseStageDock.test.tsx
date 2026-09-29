// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { CaseStudioApi } from './api';
import { CaseStageDock } from './CaseStageDock';

it('uses the same Play, seek, reset and reverse controls for authored cumulative motion', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'),
    root = createRoot(container);
  const execute = vi.fn().mockResolvedValue(undefined),
    setStage = vi.fn(),
    setPlaying = vi.fn();
  const api = {
    prepared: false,
    moved: 2,
    sandbox: { pending: null },
    mechanics: null,
    stage: 3.7,
    stages: 10,
    playing: false,
    playbackSpeed: 1,
    teaching: { execute, interact: vi.fn() },
    setStage,
    setPlaying,
  } as unknown as CaseStudioApi;
  try {
    await act(async () => root.render(<CaseStageDock api={api} authored hideExplore />));
    expect(container.textContent).toContain('Authored demonstration');
    const play = container.querySelector<HTMLButtonElement>('[aria-label="Play demonstration"]')!;
    expect(play.disabled).toBe(false);
    await act(async () => play.click());
    expect(execute).toHaveBeenLastCalledWith(
      [{ kind: 'dental', command: { type: 'play' } }],
      'Play demonstration',
    );
    const slider = container.querySelector<HTMLInputElement>(
      '[aria-label="Demonstration progress"]',
    )!;
    expect(slider.disabled).toBe(false);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(slider, '0.62');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(setStage).toHaveBeenLastCalledWith(6.2);
    expect(setPlaying).toHaveBeenLastCalledWith(false);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Return to demonstration start"]')!
        .click(),
    );
    expect(setStage).toHaveBeenLastCalledWith(0);
    const reverse = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Play in reverse'),
    )!;
    await act(async () => reverse.click());
    expect(execute).toHaveBeenLastCalledWith(
      [{ kind: 'try-playback', direction: 'reverse' }],
      'Play in reverse',
    );
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
