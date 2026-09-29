// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCaseJourneyLecture } from '@/lib/lecture-documents/sample-case-journey';
import type { CaseStudioApi } from '../case/api';
import type { TeacherLectures } from './useTeacherLectures';
import { CaseMain } from '../case/CaseMain';

vi.mock('../case/OpeningCommandDock', () => ({ OpeningCommandDock: () => null }));
vi.mock('../teaching/TeachingController', () => ({ TeachingCommandBar: () => null }));
vi.mock('../case/CaseViewport', () => ({
  CaseViewport: () => <section className="viewport voice-viewport" aria-label="3D workspace" />,
}));

let host: HTMLDivElement, root: Root;
const document = createCaseJourneyLecture();
const execute = vi.fn().mockResolvedValue(undefined);
async function step(id: string) {
  const index = document.steps.findIndex(item => item.id === id);
  expect(index).toBeGreaterThanOrEqual(0);
  const current = document.steps[index];
  const api = {
    model: { demo: true },
    lecture: true,
    view: 'front',
    roots: true,
    sandbox: { pending: null },
    stage: 0,
    stages: 10,
    playbackSpeed: 1,
    moved: current.motion ? 1 : 0,
    mechanics: current.scene.mechanics,
    mechanicsFocus: { wireId: null },
    wirePreset: current.scene.setup.wirePreset,
    teaching: { execute, runtime: { phase: 'idle' } },
  } as unknown as CaseStudioApi;
  const teacher = {
    document,
    session: { index, exploring: false, comparison: null, focus: false },
    panelProps: {
      document,
      index,
      hasResponse: false,
      focus: false,
      onFocus: vi.fn(),
      comparison: null,
      onCompare: vi.fn(),
      onCloseComparison: vi.fn(),
      biology: 'off',
      onBiology: vi.fn(),
      onHideBiology: vi.fn(),
    },
  } as unknown as TeacherLectures;
  await act(async () => root.render(<CaseMain api={api} teacher={teacher} />));
  return current;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  execute.mockClear();
  host = window.document.createElement('div');
  window.document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it('mounts the brief explanation after the shared model and its single playback bar', async () => {
  const first = await step('assess-the-starting-bite');
  const model = host.querySelector('[aria-label="3D workspace"]')!;
  const caption = host.querySelector('[aria-label="Step explanation"]')!;
  expect(caption.closest('main')).not.toBeNull();
  expect(caption.parentElement).toBe(model.parentElement!.parentElement);
  expect(model.parentElement!.nextElementSibling).toBe(caption);
  expect(caption.textContent).toContain(first.answer);
  expect(host.querySelector('aside, .classroom-stage-bar')).toBeNull();
  const movement = await step('illustrate-transverse-change');
  expect(host.querySelector('[aria-label="3D workspace"]')).toBe(model);
  const playback = host.querySelectorAll('.classroom-stage-bar');
  expect(playback).toHaveLength(1);
  expect(playback[0].nextElementSibling?.getAttribute('aria-label')).toBe('Step explanation');
  expect(host.querySelector('.lecture-takeaway')?.textContent).toBe(movement.answer);
  expect(host.textContent).not.toMatch(/Review notes|Discuss with students|Reveal answer/);
});

it('offers direct response calculation before the explanation without a second playback bar', async () => {
  await step('test-wire-activation');
  const calculation = host.querySelector('.lecture-calculation')!;
  expect(calculation).not.toBeNull();
  expect(host.querySelector('.classroom-stage-bar')).toBeNull();
  expect(calculation.nextElementSibling?.getAttribute('aria-label')).toBe('Step explanation');
  expect(host.querySelector('.lecture-step-guide')?.textContent).toBe(
    'Calculate response below the model.',
  );
  await act(async () => calculation.querySelector('button')!.click());
  expect(execute).toHaveBeenCalledExactlyOnceWith(
    [{ kind: 'mechanics', action: { type: 'solve' } }],
    'Calculate response',
  );
});
