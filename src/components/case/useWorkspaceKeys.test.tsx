// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWorkspaceKeys } from './useWorkspaceKeys';

let root: Root, container: HTMLDivElement;
const runControl = vi.fn(async () => {}),
  setMobilePanel = vi.fn(),
  setToolsOpen = vi.fn(),
  setCommandsOpen = vi.fn();
const frames: FrameRequestCallback[] = [];
function Harness({ active = true }: { active?: boolean }) {
  const commandInput = useRef<HTMLInputElement>(null);
  useWorkspaceKeys({
    active,
    runControl,
    setMobilePanel,
    setToolsOpen,
    setCommandsOpen,
    commandInput,
  });
  return <input ref={commandInput} aria-label="Teaching command" />;
}
function press(target: EventTarget, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  frames.length = 0;
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it.each(['window', 'document'] as const)(
  'preserves workspace shortcuts with %s as the keyboard event target',
  name => {
    const target = name === 'window' ? window : document;
    expect(press(target, 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(runControl).toHaveBeenLastCalledWith('undo that');
    expect(press(target, 'Z', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(runControl).toHaveBeenLastCalledWith('redo');
    expect(press(target, '/').defaultPrevented).toBe(true);
    expect(setCommandsOpen).toHaveBeenCalledExactlyOnceWith(true);
    expect(frames).toHaveLength(1);
    frames[0](0);
    expect(document.activeElement).toBe(container.querySelector('input'));
    press(target, 'Escape');
    expect(setMobilePanel).toHaveBeenCalledExactlyOnceWith('model');
    expect(setToolsOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(press(target, ' ').defaultPrevented).toBe(false);
    expect(runControl).toHaveBeenCalledTimes(2);
  },
);

it.each([
  '<input />',
  '<textarea></textarea>',
  '<select></select>',
  '<dialog><span></span></dialog>',
  '<div contenteditable="true"><span></span></div>',
  '<div contenteditable="false"><span></span></div>',
])('preserves native keys inside %s', markup => {
  const host = container.appendChild(document.createElement('div'));
  host.innerHTML = markup;
  const target = host.querySelector('span') || host.firstElementChild!;
  expect(press(target, 'z', { ctrlKey: true }).defaultPrevented).toBe(false);
  expect(press(target, '/').defaultPrevented).toBe(false);
  press(target, 'Escape');
  expect(runControl).not.toHaveBeenCalled();
  expect(setCommandsOpen).not.toHaveBeenCalled();
  expect(setMobilePanel).not.toHaveBeenCalled();
  expect(setToolsOpen).not.toHaveBeenCalled();
});

it('ignores composition and modified slash shortcuts', () => {
  press(window, 'z', { ctrlKey: true, isComposing: true });
  for (const options of [
    { isComposing: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
  ])
    expect(press(window, '/', options).defaultPrevented).toBe(false);
  expect(runControl).not.toHaveBeenCalled();
  expect(setCommandsOpen).not.toHaveBeenCalled();
});

it('detaches keyboard handling while inactive and after the hook unmounts', () => {
  act(() => root.render(<Harness active={false} />));
  expect(press(window, '/', {}).defaultPrevented).toBe(false);
  expect(setCommandsOpen).not.toHaveBeenCalled();
  act(() => root.render(<Harness />));
  expect(press(document, '/', {}).defaultPrevented).toBe(true);
  expect(setCommandsOpen).toHaveBeenCalledOnce();
  act(() => root.render(null));
  expect(press(window, '/', {}).defaultPrevented).toBe(false);
  expect(setCommandsOpen).toHaveBeenCalledOnce();
});
