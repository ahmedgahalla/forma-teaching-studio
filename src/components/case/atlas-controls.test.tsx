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

const fullArchIds = Array.from({ length: 4 }, (_, quadrant) =>
  Array.from({ length: 7 }, (_, tooth) => `${quadrant + 1}${tooth + 1}`),
).flat();
function chartApi(ids = fullArchIds) {
  return {
    ids,
    selectedIds: [],
    arch: 'both',
    sandbox: { lockedIds: [] },
    toothMoved: () => false,
    selectTooth: vi.fn(),
  } as unknown as CaseStudioApi;
}

it('shows Claude crown/root drawings facing the midline in the 28-tooth chart', async () => {
  const host = await mount(<AtlasToothChart api={chartApi()} />);
  expect(host.querySelectorAll('button')).toHaveLength(28);
  expect(host.querySelectorAll('[data-tooth-gap]')).toHaveLength(0);
  const quadrants = [...host.querySelectorAll('.atlas-chart-half')].map(half =>
    [...half.querySelectorAll('button')].map(button => button.textContent),
  );
  expect(quadrants).toEqual([
    ['17', '16', '15', '14', '13', '12', '11'],
    ['21', '22', '23', '24', '25', '26', '27'],
    ['47', '46', '45', '44', '43', '42', '41'],
    ['31', '32', '33', '34', '35', '36', '37'],
  ]);
  const upper = host.querySelector('[aria-label="Select tooth 16"]')!;
  const lower = host.querySelector('[aria-label="Select tooth 46"]')!;
  expect(upper.querySelectorAll('.atlas-chart-root')).toHaveLength(3);
  expect(lower.querySelectorAll('.atlas-chart-root')).toHaveLength(2);
  expect(upper.querySelector('g')?.hasAttribute('transform')).toBe(false);
  expect(lower.querySelector('g')?.getAttribute('transform')).toBe('matrix(1 0 0 -1 0 21)');
  expect(upper.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(upper.querySelector('.atlas-chart-crown')?.getAttribute('d')).toContain('C');
  expect(host.querySelector('[title="Patient\'s right"]')?.textContent).toBe('R');
  expect(host.querySelector('[title="Patient\'s left"]')?.textContent).toBe('L');
});

it('keeps extraction spaces and quadrant boundaries without adding selectable teeth', async () => {
  const host = await mount(
    <AtlasToothChart api={chartApi(fullArchIds.filter(id => id !== '14' && id !== '24'))} />,
  );
  expect(host.querySelectorAll('button')).toHaveLength(26);
  expect(host.querySelectorAll('[data-tooth-gap]')).toHaveLength(2);
  for (const id of ['14', '24']) {
    const gap = host.querySelector<HTMLElement>(`[data-tooth-gap="${id}"]`)!;
    expect(gap.tagName).toBe('SPAN');
    expect(gap.getAttribute('aria-hidden')).toBe('true');
    expect(gap.hasAttribute('tabindex')).toBe(false);
    expect(gap.style.getPropertyValue('--tooth-width')).not.toBe('');
    expect(gap.parentElement?.children).toHaveLength(7);
  }
});

it('allows imported wisdom teeth while leaving unavailable wisdom positions empty', async () => {
  const api = chartApi([...fullArchIds, '18']);
  const host = await mount(<AtlasToothChart api={api} />);
  expect(host.querySelectorAll('button')).toHaveLength(29);
  expect(host.querySelectorAll('[data-tooth-gap]')).toHaveLength(3);
  expect(host.querySelector('.atlas-chart-half')?.firstElementChild?.textContent).toBe('18');
  expect(host.querySelector('[aria-label="Select tooth 28"]')).toBeNull();
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Select tooth 18"]')!.click(),
  );
  expect(api.selectTooth).toHaveBeenCalledWith('18', false);
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

it.each([false, true])(
  'routes the Explore jaw control through the runtime: open=%s',
  async jawOpen => {
    const execute = vi.fn();
    const api = {
      model: { asset: 'claude-atlas-v1' },
      opening: 0,
      jawOpen,
      arch: 'both',
      view: 'front',
      teaching: { execute },
    } as unknown as CaseStudioApi;
    const host = await mount(<AtlasDisplayPanel api={api} />);
    const label = jawOpen ? 'Close jaw' : 'Open jaw';
    const buttons = [...host.querySelectorAll('button')].filter(
      button => button.textContent === label,
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-pressed')).toBe(String(jawOpen));
    await act(async () => buttons[0].click());
    expect(execute).toHaveBeenCalledExactlyOnceWith([{ kind: 'jaw', open: !jawOpen }], label);
  },
);
