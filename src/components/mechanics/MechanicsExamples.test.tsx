// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MechanicsExamples } from './MechanicsExamples';
import { parseTeachingPlan } from '@/lib/classroom';
import { DEMO_IDS } from '@/lib/classroom/types';

let root: Root, container: HTMLDivElement;
const load = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  load.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const render = (pending = false) =>
  act(() =>
    root.render(
      <MechanicsExamples
        selected="46"
        availableIds={DEMO_IDS}
        disabled={false}
        pending={pending}
        onLoad={load}
      />,
    ),
  );
const select = (label: string, value: string) =>
  act(() => {
    const input = container.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

it('starts collapsed and exposes eight choices with a visible target and click/type parity', () => {
  render();
  expect(container.querySelector('details')?.open).toBe(false);
  expect(container.querySelectorAll('[aria-label="Mechanics example"] option')).toHaveLength(8);
  select('Mechanics example', '4');
  select('Mechanics variation', '1');
  expect(container.textContent).toContain('Teeth: 46');
  act(() => container.querySelector('button')!.click());
  const source = container
    .querySelector('.mechanics-example-command')!
    .textContent!.match(/“(.+)”/)![1];
  const parsed = parseTeachingPlan(source, {
    mode: 'case',
    workflowId: null,
    stepIndex: 0,
    selected: '46',
    selectedIds: ['46'],
    availableIds: DEMO_IDS,
    synthetic: true,
    revision: 0,
    arch: 'both',
    view: 'front',
    speed: 1,
  });
  expect(load).toHaveBeenCalledWith(parsed.actions[0]);
  expect(parsed.actions[0]).toMatchObject({ id: 'vertical', variant: 'extrusion' });
});
it('shows fixed example teeth and blocks loading over an unresolved preview', () => {
  render(true);
  select('Mechanics example', '6');
  expect(container.textContent).toContain('Teeth: 13, 16');
  expect(container.querySelector('button')!.disabled).toBe(true);
  act(() => container.querySelector('button')!.click());
  expect(load).not.toHaveBeenCalled();
  expect(container.querySelector('[role="status"]')!.textContent).toMatch(/Apply or discard/);
});
