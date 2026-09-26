// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createOrthodonticDemo } from '@/lib/demo';
import { TOOTH_ANATOMY_DISCLAIMER, getToothAnatomy } from '@/lib/tooth-anatomy';
import { TOOTH_STUDY_VIEWS } from '@/lib/tooth-study/types';
import { ToothStudyCard } from './ToothStudyCard';
import type { ToothStudyState } from './tooth-study';

let root: Root, host: HTMLDivElement;
const execute = vi.fn().mockResolvedValue(undefined);
const model = createOrthodonticDemo();
const state = (tooth: string): ToothStudyState => ({
  tooth,
  view: 'buccal',
  revision: 1,
  explanationVisible: false,
  model,
  prior: {
    camera: null,
    selected: '11',
    selectedIds: ['11'],
    isolated: false,
    roots: false,
    gums: true,
    labels: true,
    arch: 'both',
    view: 'perspective',
    anatomy: { bone: false, ligament: false, cutaway: false, opacity: 0.45 },
  },
});

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  execute.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(toothStudy: ToothStudyState | null) {
  await act(async () =>
    root.render(<ToothStudyCard api={{ toothStudy, teaching: { execute } }} />),
  );
}

it('shows model-specific roots, surface wording and review status for the selected tooth', async () => {
  await render(state('16'));
  expect(host.querySelector('h2')?.textContent).toBe('Maxillary right first molar');
  expect(host.textContent).toContain('FDI 16');
  expect(host.textContent).toContain('Roots in this model: 3');
  expect(host.textContent).toContain(getToothAnatomy('16').roots.join(', '));
  expect(host.textContent).toContain(TOOTH_ANATOMY_DISCLAIMER);
  expect(host.querySelectorAll('li')).toHaveLength(getToothAnatomy('16').features.length);
  expect(
    [...host.querySelectorAll('.tooth-study-sides button')].map(button => button.textContent),
  ).toEqual(['Buccal', 'Mesial', 'Palatal', 'Distal', 'Occlusal', 'Apical']);
  await render(state('31'));
  expect(host.textContent).toContain('Labial');
  expect(host.textContent).toContain('Lingual');
  expect(host.textContent).toContain('Incisal');
});

it('sends every side, explain and close button through the teaching runtime', async () => {
  await render(state('16'));
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
  for (const button of buttons) await act(async () => button.click());
  expect(execute.mock.calls.map(call => call[0])).toEqual([
    ...TOOTH_STUDY_VIEWS.map(view => [{ kind: 'tooth-study', action: 'view', view }]),
    [{ kind: 'tooth-study', action: 'explain' }],
    [{ kind: 'tooth-study', action: 'close' }],
  ]);
  expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
});

it('shows the explanation after explain and removes the card on close', async () => {
  await render({ ...state('16'), explanationVisible: true });
  expect(host.querySelector('.tooth-study-explanation')?.textContent).toBe(
    getToothAnatomy('16').explanation,
  );
  await render(null);
  expect(host.childElementCount).toBe(0);
});
