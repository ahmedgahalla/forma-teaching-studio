// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RuntimeState } from '@/lib/teaching-runtime';
import { VoiceHudView } from './VoiceHud';

let root: Root, container: HTMLDivElement;
const idle: RuntimeState = { phase: 'idle', message: 'Ready.', error: false, transcript: '' };
type HudProps = Parameters<typeof VoiceHudView>[0];
let props: HudProps;

async function render(patch: Partial<HudProps> = {}) {
  props = { ...props, ...patch };
  await act(async () => root.render(<VoiceHudView {...props} />));
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms));
}
const caption = () => container.querySelector('.voice-hud-caption');

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  props = { active: false, interim: '', narration: '', runtime: idle };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('stays empty before a request and exposes a polite non-focusable status region', async () => {
  await render();
  expect(container.textContent).toBe('');
  expect(container.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  expect(container.querySelector('button, input, [tabindex]')).toBeNull();
});

it('keeps its listening indicator while active and marks pauses for narration', async () => {
  await render({ active: true });
  await advance(20000);
  expect(container.textContent).toBe(' Listening');
  await render({ paused: true, narration: 'Observe the root movement.' });
  expect(container.textContent).toContain('Listening · paused while Forma speaks');
  expect(caption()?.textContent).toBe('Observe the root movement.');
});

it('shows transient interim captions without adding them to the heard request', async () => {
  await render({ active: true, interim: 'ordinary lecture speech' });
  expect(caption()?.textContent).toBe('ordinary lecture speech');
  expect(container.textContent).not.toContain('Heard:');
  await render({ interim: '' });
  expect(caption()).toBeNull();
  expect(container.textContent).not.toContain('ordinary lecture speech');
});

it('shows successful heard text and summary for four seconds, retaining the listening pill', async () => {
  await render({
    active: true,
    runtime: { ...idle, transcript: 'show roots', message: 'Roots shown.' },
  });
  expect(caption()?.textContent).toBe('✓ Roots shown.Heard: show roots');
  await advance(3999);
  expect(caption()).not.toBeNull();
  await advance(1);
  expect(caption()).toBeNull();
  expect(container.textContent).toBe(' Listening');
});

it('shows clarification and microphone errors with an exclamation', async () => {
  await render({
    runtime: { ...idle, error: true, transcript: 'move', message: 'Choose a tooth.' },
  });
  expect(caption()?.textContent).toBe('! Choose a tooth.Heard: move');
  await render({
    runtime: { ...idle, error: true, message: 'Hands-free stopped: microphone permission denied.' },
  });
  expect(caption()?.textContent).toBe('! Hands-free stopped: microphone permission denied.');
});

it('keeps pending requests visible and starts the fade after completion', async () => {
  const pending: RuntimeState = {
    ...idle,
    phase: 'executing',
    transcript: 'play demonstration',
    message: 'Playing demonstration…',
  };
  await render({ runtime: pending });
  await advance(20000);
  expect(caption()?.textContent).toContain('Playing demonstration');
  await render({ runtime: { ...pending, phase: 'idle', message: 'Demonstration played.' } });
  await advance(3999);
  expect(caption()?.textContent).toContain('✓ Demonstration played.');
  await advance(1);
  expect(caption()).toBeNull();
});

it('prioritizes narrated text over interim and keeps it visible throughout narration', async () => {
  await render({ narration: 'The tooth tips around its support.', interim: 'stale interim' });
  await advance(20000);
  expect(caption()?.textContent).toBe('The tooth tips around its support.');
  await render({ narration: '', interim: '' });
  expect(caption()).toBeNull();
});

it('shows a fresh result after the previous result has faded', async () => {
  await render({ runtime: { ...idle, transcript: 'show roots', message: 'Roots shown.' } });
  await advance(4000);
  await render({ runtime: { ...idle, transcript: 'hide roots', message: 'Roots hidden.' } });
  expect(caption()?.textContent).toBe('✓ Roots hidden.Heard: hide roots');
});

it('does not revive a faded request when non-wake interim speech clears', async () => {
  await render({ runtime: { ...idle, transcript: 'show roots', message: 'Roots shown.' } });
  await advance(4000);
  await render({ interim: 'this is ordinary lecture speech' });
  expect(caption()?.textContent).toBe('this is ordinary lecture speech');
  await render({ interim: '' });
  expect(caption()).toBeNull();
});

it('continues expiring a result while a higher-priority narration caption is displayed', async () => {
  await render({
    narration: 'Roots shown.',
    runtime: { ...idle, transcript: 'show roots', message: 'Roots shown.' },
  });
  await advance(4000);
  await render({ narration: '' });
  expect(caption()).toBeNull();
});

it('separates a compact primary confirmation from the secondary heard text', async () => {
  await render({ runtime: { ...idle, transcript: 'next step', message: 'next step' } });
  expect(caption()?.classList.contains('voice-hud-request')).toBe(true);
  expect(caption()?.firstElementChild?.className).toBe('voice-hud-summary');
  expect(caption()?.firstElementChild?.textContent).toBe('✓ next step');
  expect(caption()?.lastElementChild?.className).toBe('voice-hud-heard');
  expect(caption()?.lastElementChild?.textContent).toBe('Heard: next step');
});

it('uses the narration presentation alone while keeping full text accessible', async () => {
  const narration = 'Observe the crown and root. '.repeat(8);
  await render({
    active: true,
    paused: true,
    narration,
    interim: 'next step',
    runtime: { ...idle, transcript: 'next step', message: 'next step' },
  });
  expect(container.querySelectorAll('.voice-hud-caption')).toHaveLength(1);
  expect(caption()?.classList.contains('voice-hud-narration')).toBe(true);
  expect(caption()?.textContent).toBe(narration);
  expect(container.querySelector('.voice-hud-request, .voice-hud-interim')).toBeNull();
  expect(container.querySelector('[role="status"]')?.getAttribute('aria-atomic')).toBe('true');
});

it('marks interim and error feedback separately from narration', async () => {
  await render({ interim: 'Forma show roots' });
  expect(caption()?.classList.contains('voice-hud-interim')).toBe(true);
  await render({
    interim: '',
    runtime: { ...idle, error: true, message: 'Choose a tooth.' },
  });
  expect(container.querySelector('.voice-hud-error')?.textContent).toBe('! Choose a tooth.');
  expect(container.querySelector('.voice-hud-narration, .voice-hud-interim')).toBeNull();
});

it('keeps speech-unavailable text in the normal narration card with a secondary note', async () => {
  await render({
    active: true,
    narration: 'The root apex is the tip of the root.',
    narrationFallback: true,
  });
  expect(caption()?.classList.contains('voice-hud-narration')).toBe(true);
  expect(caption()?.textContent).toBe('The root apex is the tip of the root.');
  expect(container.querySelector('.voice-hud-speech-note')?.textContent).toBe(
    'Speech unavailable — showing text',
  );
  expect(container.querySelector('.voice-hud-error')).toBeNull();
  expect(container.textContent).not.toContain('paused while Forma speaks');
  await render({ narration: '', narrationFallback: false });
  expect(caption()).toBeNull();
  expect(container.querySelector('.voice-hud-speech-note')).toBeNull();
  expect(container.textContent).toBe(' Listening');
});
