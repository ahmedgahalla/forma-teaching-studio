// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTeachingPlan, type TeachingContext } from '../../lib/classroom';
import { usePresenterKeys } from './usePresenterKeys';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: 1,
  selected: '11',
  selectedIds: ['11'],
  availableIds: ['11'],
  synthetic: true,
  revision: 1,
  view: 'front',
  arch: 'both',
  speed: 1,
  stage: 3,
  stages: 10,
};
let root: Root, container: HTMLDivElement;
const run = vi.fn(),
  toggle = vi.fn();
function Harness({ state = context }: { state?: TeachingContext }) {
  usePresenterKeys(text => run(parseTeachingPlan(text, state).actions), toggle);
  return <button>Next step</button>;
}
function press(key: string, target: EventTarget = document.body, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  run.mockClear();
  toggle.mockClear();
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

describe.each([
  { label: 'case', state: context, kind: 'stage' },
  { label: 'lesson', state: { ...context, lessonActive: true }, kind: 'lesson-step' },
  {
    label: 'tooth tour',
    state: {
      ...context,
      lessonActive: true,
      toothStudy: { tooth: '11', view: 'lingual' as const },
    },
    kind: 'lesson-step',
  },
  {
    label: 'workflow',
    state: {
      ...context,
      mode: 'workflow' as const,
      workflowId: 'fixed-braces',
      lessonActive: true,
    },
    kind: 'workflow',
  },
])('presenter keys in $label', ({ state, kind }) => {
  it.each([
    ['PageDown', 'next'],
    ['ArrowRight', 'next'],
    ['PageUp', 'previous'],
    ['ArrowLeft', 'previous'],
  ])('%s maps through the current parser even with a button focused', (key, action) => {
    act(() => root.render(<Harness state={state} />));
    const button = container.querySelector('button')!;
    button.focus();
    const event = press(key, button);
    expect(event.defaultPrevented).toBe(true);
    expect(run).toHaveBeenCalledExactlyOnceWith([{ kind, action }]);
  });
});

it.each(['m', 'M', 'b', 'B', '.'])('toggles hands-free with %s', key => {
  expect(press(key).defaultPrevented).toBe(true);
  expect(toggle).toHaveBeenCalledOnce();
  expect(run).not.toHaveBeenCalled();
});
it.each([
  '<input />',
  '<textarea></textarea>',
  '<select></select>',
  '<div contenteditable="true"><span>Editable</span></div>',
  '<div contenteditable="plaintext-only"></div>',
  '<div role="textbox"></div>',
])('ignores editable targets %s', markup => {
  container.insertAdjacentHTML('beforeend', markup);
  const target = container.lastElementChild!;
  expect(press('PageDown', target).defaultPrevented).toBe(false);
  press('m', target);
  expect(run).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
});
it.each([
  '<dialog open></dialog>',
  '<div role="dialog"></div>',
  '<div role="alertdialog"></div>',
  '<div role="menu"></div>',
  '<details class="opening-menu" open></details>',
  '<details class="opening-view-menu" open></details>',
  '<button aria-haspopup="menu" aria-expanded="true">Menu</button>',
])('ignores keys while a visible dialog or menu is open: %s', markup => {
  container.insertAdjacentHTML('beforeend', markup);
  press('ArrowRight');
  press('b');
  expect(run).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
});
it.each([
  '<dialog></dialog>',
  '<div role="menu" hidden></div>',
  '<div style="display: none"><div role="dialog"></div></div>',
  '<div role="menu" aria-hidden="true"></div>',
  '<details class="teaching-analysis-card" open></details>',
])('keeps shortcuts available with closed/hidden overlays or ordinary disclosures: %s', markup => {
  container.insertAdjacentHTML('beforeend', markup);
  press('ArrowRight');
  expect(run).toHaveBeenCalledOnce();
});
it.each([
  { repeat: true },
  { ctrlKey: true },
  { altKey: true },
  { metaKey: true },
  { shiftKey: true },
])('ignores repeated or modified keys %s', options => {
  press('PageDown', document.body, options);
  press('m', document.body, options);
  expect(run).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
});
it('leaves Space and unrelated keys to their existing handlers', () => {
  expect(press(' ').defaultPrevented).toBe(false);
  expect(press('Escape').defaultPrevented).toBe(false);
  expect(run).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
});
