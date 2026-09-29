// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AtlasToothChart } from './AtlasToothChart';
import type { CaseStudioApi } from './api';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root, host: HTMLDivElement;
const hover = vi.fn();
const api = {
  ids: ['11', '21', '31'],
  selectedIds: ['11'],
  arch: 'both',
  view: 'front',
  sandbox: { lockedIds: [] },
  toothMoved: () => false,
  selectTooth: vi.fn(),
  setArch: vi.fn(),
  setCamera: vi.fn(),
  teaching: { execute: vi.fn(), interact: vi.fn(), referenceInteraction: vi.fn() },
} as unknown as CaseStudioApi;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(value = api) {
  await act(async () => root.render(<AtlasToothChart api={value} onHoverTooth={hover} />));
}
function tooth(id: string) {
  return host.querySelector<HTMLButtonElement>(`[aria-label="Select tooth ${id}"]`)!;
}
async function mouse(id: string, type: string) {
  await act(async () => tooth(id).dispatchEvent(new MouseEvent(type, { bubbles: true })));
}

it('previews on hover and keyboard focus without selecting or changing the case', async () => {
  await render();
  await mouse('21', 'mouseover');
  expect(hover).toHaveBeenLastCalledWith('21');
  expect(tooth('11').getAttribute('aria-pressed')).toBe('true');
  expect(tooth('21').getAttribute('aria-pressed')).toBe('false');
  await mouse('21', 'mouseout');
  expect(hover).toHaveBeenLastCalledWith(null);
  await act(async () => tooth('31').focus());
  expect(hover).toHaveBeenLastCalledWith('31');
  await act(async () => tooth('31').blur());
  expect(hover).toHaveBeenLastCalledWith(null);
  expect(api.selectedIds).toEqual(['11']);
  for (const fn of [
    api.selectTooth,
    api.setArch,
    api.setCamera,
    api.teaching.execute,
    api.teaching.interact,
    api.teaching.referenceInteraction,
  ])
    expect(fn).not.toHaveBeenCalled();
});

it('does not preview or reveal hidden arches and keeps click-to-reveal explicit', async () => {
  await render({ ...api, arch: 'upper' });
  await mouse('31', 'mouseover');
  expect(hover).toHaveBeenLastCalledWith(null);
  expect(tooth('31').title).toContain('click to show lower arch');
  await act(async () => tooth('31').focus());
  expect(hover).toHaveBeenLastCalledWith(null);
  expect(api.setArch).not.toHaveBeenCalled();
  expect(api.selectTooth).not.toHaveBeenCalled();
  await act(async () => tooth('31').click());
  expect(api.setArch).toHaveBeenCalledExactlyOnceWith('lower');
  expect(api.selectTooth).toHaveBeenCalledExactlyOnceWith('31', false);
});

it('clears preview when the window blurs, arch or inventory changes, and the chart unmounts', async () => {
  await render();
  await mouse('21', 'mouseover');
  await act(async () => window.dispatchEvent(new Event('blur')));
  expect(hover).toHaveBeenLastCalledWith(null);
  await mouse('21', 'mouseover');
  await render({ ...api, arch: 'upper' });
  expect(hover).toHaveBeenLastCalledWith(null);
  await mouse('21', 'mouseover');
  await render({ ...api, ids: ['11', '31'], arch: 'upper' });
  expect(hover).toHaveBeenLastCalledWith(null);
  await mouse('11', 'mouseover');
  await act(async () => root.render(null));
  expect(hover).toHaveBeenLastCalledWith(null);
});
