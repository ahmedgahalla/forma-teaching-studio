// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AtlasCameraRail } from './AtlasCameraRail';
import { AtlasToothChart } from './AtlasToothChart';
import { AtlasToothInspector } from './AtlasToothInspector';
import { createWorkspaceActions } from './actions-workspace';
import { isWorkspaceInteraction } from './scene-interaction';
import type { CaseRefs, CaseStudioApi } from './api';

let root: Root, container: HTMLDivElement, api: CaseStudioApi;
const interact = vi.fn(),
  referenceInteraction = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  api = {
    ids: ['11', '21'],
    selected: '11',
    selectedIds: ['11'],
    tooth: { name: 'Central incisor', calibrated: false },
    model: { demo: true },
    arch: 'both',
    view: 'front',
    isolated: false,
    sandbox: { lockedIds: [] },
    toothMoved: () => false,
    setArch: vi.fn(),
    setCamera: vi.fn(),
    setSelected: vi.fn(),
    setSelectedIds: vi.fn(),
    setMeasureTo: vi.fn(),
    setIsolated: vi.fn(),
    viewer: { current: { focus: vi.fn() } },
    teaching: { interact, referenceInteraction, execute: vi.fn() },
  } as unknown as CaseStudioApi;
  api.selectTooth = createWorkspaceActions(api, {} as CaseRefs).selectTooth;
  const sceneInteraction = (event: { target: EventTarget }) => {
    if (isWorkspaceInteraction(event.target)) api.teaching.interact();
  };
  act(() =>
    root.render(
      <div onPointerDownCapture={sceneInteraction} onClickCapture={sceneInteraction}>
        <AtlasCameraRail api={api} />
        <AtlasToothChart api={api} />
        <AtlasToothInspector api={api} />
        <button data-workspace>Other scene control</button>
      </div>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function click(target: Element) {
  act(() => {
    target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

it('keeps capture alive when changing the camera through the atlas rail', () => {
  click(container.querySelector('[aria-label="Front view"]')!);
  expect(interact).not.toHaveBeenCalled();
  expect(referenceInteraction).toHaveBeenCalledOnce();
  expect(api.setCamera).toHaveBeenCalledWith('front');
});

it('keeps capture alive when pointing through a nested atlas tooth-chart symbol', () => {
  click(container.querySelector('[aria-label="Select tooth 21"] path')!);
  expect(interact).not.toHaveBeenCalled();
  expect(referenceInteraction).toHaveBeenCalledOnce();
  expect(api.setSelectedIds).toHaveBeenCalledWith(['21']);
  expect(api.setSelected).toHaveBeenCalledWith('21');
});

it.each(['Frame', 'Isolate'])('keeps capture alive for the inspector action %s', label => {
  const button = [...container.querySelectorAll('.atlas-tooth-inspector button')].find(
    element => element.textContent === label,
  )!;
  click(button);
  expect(interact).not.toHaveBeenCalled();
  expect(referenceInteraction).toHaveBeenCalledOnce();
  if (label === 'Frame') expect(api.viewer.current!.focus).toHaveBeenCalledOnce();
  else expect(api.setIsolated).toHaveBeenCalledWith(true);
});

it('still cancels capture for an ordinary scene control', () => {
  click(container.querySelector('[data-workspace]')!);
  expect(interact).toHaveBeenCalledTimes(2);
  expect(referenceInteraction).not.toHaveBeenCalled();
});
