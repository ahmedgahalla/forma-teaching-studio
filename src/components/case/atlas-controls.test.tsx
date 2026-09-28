// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AtlasCameraRail } from './AtlasCameraRail';
import { AtlasToothChart } from './AtlasToothChart';
import { AtlasDisplayPanel } from './AtlasDisplayPanel';
import type { CaseRefs, CaseStudioApi } from './api';
import { createIoActions } from './actions-io';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const mounted: (() => Promise<void>)[] = [];
async function mount(element: React.ReactNode) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  mounted.push(async () => {
    await act(async () => root.unmount());
    host.remove();
  });
  return host;
}
afterEach(async () => {
  for (const clean of mounted.splice(0)) await clean();
});

it.each([
  ['11', 'Lower', 'lower'],
  ['31', 'Upper', 'upper'],
] as const)(
  'keeps the requested arch with the real camera action when tooth %s is selected',
  async (selected, label, expectedArch) => {
    let finalArch = 'both';
    const setView = vi.fn();
    const api = {
      view: 'front',
      arch: 'both',
      selected,
      teaching: { referenceInteraction: vi.fn() },
      setArch: (arch: string) => {
        finalArch = arch;
      },
      setView,
    } as unknown as CaseStudioApi;
    const viewer = { setView: vi.fn() };
    api.setCamera = createIoActions(api, {
      viewer: { current: viewer },
    } as unknown as CaseRefs).setCamera;
    const host = await mount(<AtlasCameraRail api={api} />);
    await act(async () =>
      host.querySelector<HTMLButtonElement>(`[aria-label="${label} view"]`)!.click(),
    );
    expect(finalArch).toBe(expectedArch);
    expect(setView).toHaveBeenLastCalledWith('occlusal');
    expect(viewer.setView).toHaveBeenLastCalledWith('occlusal');
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[aria-label="Three-quarter view"]')!.click(),
    );
    expect(finalArch).toBe('both');
    expect(setView).toHaveBeenLastCalledWith('perspective');
    expect(viewer.setView).toHaveBeenLastCalledWith('perspective');
    expect(api.teaching.referenceInteraction).toHaveBeenCalledTimes(2);
  },
);

it('maps every chart button to the current model and preserves additive selection', async () => {
  const selectTooth = vi.fn();
  const api = {
    ids: ['11', '21', '31', '41'],
    selectedIds: ['21'],
    arch: 'both',
    sandbox: { lockedIds: ['41'] },
    toothMoved: () => false,
    selectTooth,
  } as unknown as CaseStudioApi;
  const host = await mount(<AtlasToothChart api={api} />);
  expect(host.querySelectorAll('button')).toHaveLength(4);
  expect(host.querySelector('[aria-label="Select tooth 21"]')?.getAttribute('aria-pressed')).toBe(
    'true',
  );
  await act(async () =>
    host
      .querySelector('[aria-label="Select tooth 41"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })),
  );
  expect(selectTooth).toHaveBeenCalledWith('41', true);
});

it('reveals a chart tooth from a hidden arch and keeps mixed selection visible', async () => {
  const setArch = vi.fn(),
    setCamera = vi.fn(),
    selectTooth = vi.fn();
  const api = {
    ids: ['11', '31'],
    selectedIds: ['11'],
    arch: 'upper',
    view: 'occlusal',
    sandbox: { lockedIds: [] },
    toothMoved: () => false,
    selectTooth,
    setArch,
    setCamera,
  } as unknown as CaseStudioApi;
  const host = await mount(<AtlasToothChart api={api} />);
  const lower = host.querySelector<HTMLButtonElement>('[aria-label="Select tooth 31"]')!;
  await act(async () => lower.click());
  expect(setArch).toHaveBeenLastCalledWith('lower');
  await act(async () =>
    lower.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })),
  );
  expect(setArch).toHaveBeenLastCalledWith('both');
  expect(setCamera).toHaveBeenLastCalledWith('perspective');
});

it('routes atlas tissue display controls through validated teaching actions', async () => {
  const execute = vi.fn();
  const api = {
    opening: 0,
    arch: 'both',
    view: 'front',
    gums: true,
    roots: false,
    labels: false,
    teaching: { execute, referenceInteraction: vi.fn() },
  } as unknown as CaseStudioApi;
  const host = await mount(<AtlasDisplayPanel api={api} />);
  const rootSwitch = [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(
    button => button.textContent === 'Roots',
  )!;
  await act(async () => rootSwitch.click());
  expect(execute).toHaveBeenCalledWith(
    [{ kind: 'toggle', target: 'roots', visible: true }],
    'Show roots',
  );
});
