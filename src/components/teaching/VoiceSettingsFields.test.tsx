// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { useTeaching } from './TeachingController';
import { VoiceSettingsFields } from './VoiceSettingsFields';
import { HandsFreeToggle } from './HandsFreeToggle';

type VoiceController = Pick<
  ReturnType<typeof useTeaching>,
  'voice' | 'voiceSettings' | 'toggleHandsFree' | 'setVoiceSettings'
>;
let teaching: VoiceController, root: Root, container: HTMLDivElement;
vi.mock('./TeachingController', () => ({ useTeaching: () => teaching }));
async function render() {
  await act(async () =>
    root.render(
      <>
        <VoiceSettingsFields />
        <HandsFreeToggle />
      </>,
    ),
  );
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  teaching = {
    voice: { active: false, phase: 'idle', transcript: '', supported: true },
    voiceSettings: { mode: 'hold', language: 'en-US', spokenReplies: false },
    toggleHandsFree: vi.fn(),
    setVoiceSettings: vi.fn(),
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('discloses audio processing and requires an explicit session toggle', async () => {
  expect(container.textContent).toContain('speech service receives audio while listening');
  expect(container.textContent).toContain('Listening never starts on page load');
  expect(teaching.toggleHandsFree).not.toHaveBeenCalled();
  const button = container.querySelector('button')!;
  expect(button.getAttribute('aria-label')).toBe('Hands-free');
  expect(button.getAttribute('aria-pressed')).toBe('false');
  await act(async () => button.click());
  expect(teaching.toggleHandsFree).toHaveBeenCalledOnce();
  teaching.voice.active = true;
  await render();
  expect(button.getAttribute('aria-label')).toBe('Listening');
  expect(button.getAttribute('aria-pressed')).toBe('true');
});

it('saves preference changes through the controller without starting recognition', async () => {
  const [mode, language] = container.querySelectorAll('select');
  await act(async () => {
    mode.value = 'hands-free';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(teaching.setVoiceSettings).toHaveBeenLastCalledWith({
    mode: 'hands-free',
    language: 'en-US',
    spokenReplies: false,
  });
  await act(async () => {
    language.value = 'en-GB';
    language.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(teaching.setVoiceSettings).toHaveBeenLastCalledWith({
    mode: 'hold',
    language: 'en-GB',
    spokenReplies: false,
  });
  const replies = container.querySelector('input')!;
  expect(replies.checked).toBe(false);
  await act(async () => replies.click());
  expect(teaching.setVoiceSettings).toHaveBeenLastCalledWith({
    mode: 'hold',
    language: 'en-US',
    spokenReplies: true,
  });
  expect(teaching.toggleHandsFree).not.toHaveBeenCalled();
});

it('disables the hands-free control if browser recognition is unsupported', async () => {
  teaching.voice.supported = false;
  await render();
  expect(container.querySelector('button')!.disabled).toBe(true);
});
