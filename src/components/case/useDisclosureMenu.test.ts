// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDisclosureMenu } from './useDisclosureMenu';

let root: Root | null, container: HTMLDivElement;

function Menu({ closeOnAction, onAction }: { closeOnAction?: boolean; onAction?: () => void }) {
  const { menuRef, summaryRef } = useDisclosureMenu({ closeOnAction });
  return createElement(
    'details',
    { ref: menuRef },
    createElement('summary', { ref: summaryRef }, 'More'),
    createElement('button', { onClick: onAction }, createElement('span', null, 'Action')),
  );
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(closeOnAction?: boolean, onAction?: () => void) {
  await act(async () => root?.render(createElement(Menu, { closeOnAction, onAction })));
  const menu = container.querySelector('details')!;
  const summary = container.querySelector('summary')!;
  const button = container.querySelector('button')!;
  menu.open = true;
  return { menu, summary, button };
}

it('dismisses an open menu on Escape and restores focus to its summary', async () => {
  const { menu, summary, button } = await render();
  const cancelClassroom = vi.fn();
  window.addEventListener('keydown', cancelClassroom);
  button.focus();
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  button.dispatchEvent(escape);
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(summary);
  expect(escape.defaultPrevented).toBe(true);
  expect(cancelClassroom).toHaveBeenCalledWith(escape);
  window.removeEventListener('keydown', cancelClassroom);

  const closedEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  document.dispatchEvent(closedEscape);
  expect(closedEscape.defaultPrevented).toBe(false);
});

it('keeps action choices open by default and closes them when requested without losing the action', async () => {
  const onAction = vi.fn();
  const { menu, summary, button } = await render(undefined, onAction);
  button.focus();
  await act(async () => button.querySelector('span')!.click());
  expect(menu.open).toBe(true);
  expect(document.activeElement).toBe(button);
  expect(onAction).toHaveBeenCalledTimes(1);

  await render(true, onAction);
  await act(async () => button.querySelector('span')!.click());
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(summary);
  expect(onAction).toHaveBeenCalledTimes(2);
});

it('ignores inside pointers and dismisses outside pointers without stealing focus', async () => {
  const { menu, button } = await render();
  button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(menu.open).toBe(true);
  const outside = document.createElement('button');
  container.appendChild(outside);
  outside.focus();
  outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(outside);
});

it('removes document and action listeners when the menu unmounts', async () => {
  const { menu, button } = await render(true);
  await act(async () => {
    root?.unmount();
    root = null;
  });
  menu.open = true;
  const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  document.dispatchEvent(escape);
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  button.click();
  expect(menu.open).toBe(true);
  expect(escape.defaultPrevented).toBe(false);
});
