// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useHoldToTalkKeys } from './useHoldToTalkKeys';

let root: Root, container: HTMLDivElement;
const start = vi.fn(),
  finish = vi.fn(),
  cancel = vi.fn(),
  cancelCapture = vi.fn();
function Harness() {
  useHoldToTalkKeys({ enabled: true, held: () => false, start, finish, cancel, cancelCapture });
  return null;
}
function press(target: EventTarget = document.body, key = ' ', code = 'Space') {
  const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true });
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
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it.each([
  '<details class="teaching-analysis-card" open></details>',
  '<details open></details>',
  '<div role="menu" hidden></div>',
  '<div style="display:none"><div role="dialog"></div></div>',
  '<dialog></dialog>',
])('preserves hold Space with ordinary disclosures and hidden overlays: %s', markup => {
  container.insertAdjacentHTML('beforeend', markup);
  expect(press().defaultPrevented).toBe(true);
  expect(start).toHaveBeenCalledOnce();
});
it.each([
  '<details class="opening-menu" open></details>',
  '<details class="opening-view-menu" open></details>',
  '<dialog open></dialog>',
  '<div role="menu"></div>',
])('does not start capture behind an open dialog or menu: %s', markup => {
  container.insertAdjacentHTML('beforeend', markup);
  expect(press().defaultPrevented).toBe(false);
  expect(start).not.toHaveBeenCalled();
});
it.each(['button', 'input', 'summary'])('leaves Space on %s unchanged', tag => {
  const target = container.appendChild(document.createElement(tag));
  expect(press(target).defaultPrevented).toBe(false);
  expect(start).not.toHaveBeenCalled();
});
it('retains Escape cancellation while a dialog is open', () => {
  container.insertAdjacentHTML('beforeend', '<dialog open></dialog>');
  press(document.body, 'Escape', 'Escape');
  expect(cancel).toHaveBeenCalledOnce();
});
it('blur still cancels hold capture only', () => {
  window.dispatchEvent(new Event('blur'));
  expect(cancelCapture).toHaveBeenCalledOnce();
  expect(cancel).not.toHaveBeenCalled();
});
