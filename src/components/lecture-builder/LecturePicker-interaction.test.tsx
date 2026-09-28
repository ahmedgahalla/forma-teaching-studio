// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEMO_LECTURES } from '@/lib/lecture-documents';
import { usePresenterKeys } from '../teaching/usePresenterKeys';
import { useHoldToTalkKeys } from '../teaching/useHoldToTalkKeys';
import { LecturePicker } from './LecturePicker';

let root: Root, container: HTMLDivElement;
const run = vi.fn(),
  toggle = vi.fn(),
  start = vi.fn(),
  open = vi.fn();
function Harness() {
  usePresenterKeys(run, toggle);
  useHoldToTalkKeys({
    enabled: true,
    held: () => false,
    start,
    finish: vi.fn(),
    cancel: vi.fn(),
    cancelCapture: vi.fn(),
  });
  return <LecturePicker lectures={DEMO_LECTURES} currentId={null} onOpen={open} />;
}
function press(key: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key === ' ' ? 'Space' : key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it.each(['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp', 'm', 'M', 'b', 'B', '.', ' '])(
  'does not run the lecture or microphone shortcut %s beneath the open chooser',
  key => {
    act(() => container.querySelector('summary')!.click());
    expect(container.querySelector('details')!.open).toBe(true);
    const target = key === ' ' ? document.body : container.querySelector('button')!;
    expect(press(key, target).defaultPrevented).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  },
);

it.each(['choose', 'escape'])('restores shortcuts after closing the chooser with %s', action => {
  act(() => container.querySelector('summary')!.click());
  if (action === 'choose') {
    act(() => container.querySelector('button')!.click());
    expect(open).toHaveBeenCalledWith(DEMO_LECTURES[0].id);
  } else press('Escape');
  expect(container.querySelector('details')!.open).toBe(false);
  expect(press('ArrowRight').defaultPrevented).toBe(true);
  expect(run).toHaveBeenCalledWith('next step');
  press('m');
  press(' ');
  expect(toggle).toHaveBeenCalledOnce();
  expect(start).toHaveBeenCalledOnce();
});

it('ignores an open chooser in an inactive hidden workspace', () => {
  act(() => container.querySelector('summary')!.click());
  container.style.display = 'none';
  press('ArrowRight');
  expect(run).toHaveBeenCalledWith('next step');
});
