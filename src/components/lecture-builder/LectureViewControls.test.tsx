// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { parseTeachingPlan } from '@/lib/classroom/plan-build';
import { DEMO_IDS, type TeachingContext } from '@/lib/classroom/types';
import { parseLocalVoicePlan } from '@/lib/teaching-runtime-local';
import { LectureViewControls, type LectureViewControlsProps } from './LectureViewControls';

let root: Root, container: HTMLDivElement;
const execute = vi.fn().mockResolvedValue(undefined);
const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: -1,
  selected: '11',
  selectedIds: ['11'],
  availableIds: DEMO_IDS,
  synthetic: true,
  revision: 1,
  view: 'front',
  arch: 'both',
  speed: 1,
  jawAvailable: true,
  presentation: { documentId: 'sample', index: 0, count: 4, mode: 'teach', exploring: false },
};

async function render(props: Partial<LectureViewControlsProps> = {}) {
  await act(async () =>
    root.render(<LectureViewControls view="front" roots execute={execute} {...props} />),
  );
}
function button(name: string) {
  const found = [...container.querySelectorAll('button')].find(
    item => (item.getAttribute('aria-label') || item.textContent?.trim()) === name,
  );
  expect(found, `button ${name}`).toBeDefined();
  return found!;
}
async function openMenu() {
  await act(async () => container.querySelector('summary')!.click());
  expect(container.querySelector('details')?.open).toBe(true);
}
function expectInputParity(text: string) {
  const actions = execute.mock.lastCall![0];
  expect(parseTeachingPlan(text, context).actions).toEqual(actions);
  expect(parseLocalVoicePlan(text, context, vi.fn())?.actions).toEqual(actions);
}

beforeEach(() => {
  execute.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

it.each([false, true])(
  'offers one jaw toggle with click/typed/voice parity: open=%s',
  async jawOpen => {
    await render({ jawAvailable: true, jawOpen });
    const label = jawOpen ? 'Close jaw' : 'Open jaw';
    expect(button(label).getAttribute('aria-pressed')).toBe(String(jawOpen));
    await openMenu();
    await act(async () => button(label).click());
    expect(execute).toHaveBeenCalledExactlyOnceWith([{ kind: 'jaw', open: !jawOpen }], label);
    expectInputParity(label);
  },
);

it('omits the jaw control for unsupported lecture models', async () => {
  await render({ jawAvailable: false });
  expect(container.textContent).not.toMatch(/Open jaw|Close jaw/);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it.each([
  ['3D view', 'perspective'],
  ['Front', 'front'],
  ['Occlusal', 'occlusal'],
  ['Right', 'right'],
  ['Left', 'left'],
] as const)(
  'runs %s through the same action as typing and recognized speech',
  async (label, view) => {
    await render({ view });
    const currentLabel = view === 'perspective' ? label : `${label} view`;
    expect(container.querySelector('summary')?.textContent?.trim()).toBe(currentLabel);
    expect(container.querySelector('summary')?.getAttribute('aria-label')).toBe(
      `Lecture view controls: ${currentLabel}`,
    );
    expect(button(label).getAttribute('aria-pressed')).toBe('true');
    expect(
      container.querySelectorAll('[aria-label="Camera views"] [aria-pressed="true"]'),
    ).toHaveLength(1);
    await openMenu();
    await act(async () => button(label).click());
    expect(execute).toHaveBeenCalledExactlyOnceWith([{ kind: 'view', view }], `Show ${view} view`);
    expectInputParity(label);
    expect(container.querySelector('details')?.open).toBe(false);
  },
);

it.each([true, false])(
  'reflects roots=%s and routes its toggle through shared commands',
  async roots => {
    await render({ roots });
    const label = roots ? 'Hide roots' : 'Show roots';
    expect(button(label).getAttribute('aria-pressed')).toBe(String(roots));
    await openMenu();
    await act(async () => button(label).click());
    expect(execute).toHaveBeenCalledExactlyOnceWith(
      [{ kind: 'toggle', target: 'roots', visible: !roots }],
      label,
    );
    expectInputParity(label);
    await render({ roots: !roots });
    expect(button(roots ? 'Show roots' : 'Hide roots').getAttribute('aria-pressed')).toBe(
      String(!roots),
    );
  },
);

it('keeps Fit directly available and equivalent to its local command without editing controls', async () => {
  await render();
  expect(container.querySelector('details')?.open).toBe(false);
  expect(button('Fit model').closest('details')).toBeNull();
  await act(async () => button('Fit model').click());
  expect(execute).toHaveBeenCalledExactlyOnceWith(
    [{ kind: 'presentation', action: 'fit-view' }],
    'Fit model',
  );
  expectInputParity('fit model');
  expect(container.textContent).not.toMatch(/Study|Measure|Before|After|Overlay|Tools|Play/);
});

it('returns keyboard focus to View after Escape or a menu action', async () => {
  await render();
  const summary = container.querySelector('summary')!;
  await openMenu();
  button('Front').focus();
  await act(async () =>
    button('Front').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  expect(container.querySelector('details')?.open).toBe(false);
  expect(document.activeElement).toBe(summary);
  expect(execute).not.toHaveBeenCalled();
  await openMenu();
  button('Hide roots').focus();
  await act(async () => button('Hide roots').click());
  expect(container.querySelector('details')?.open).toBe(false);
  expect(document.activeElement).toBe(summary);
});
