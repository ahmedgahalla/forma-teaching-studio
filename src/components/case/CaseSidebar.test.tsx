// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { parseTeachingPlan, validateTeachingPlan, type TeachingContext } from '@/lib/classroom';
import type { CaseStudioApi } from './api';
import { CaseSidebar } from './CaseSidebar';

vi.mock('./StudioExperience', () => ({ MobilePanelHeading: () => null }));
vi.mock('../viewer/AnatomyPanel', () => ({ default: () => null }));

it('routes the displacement toggle through the same undoable action as text controls', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container);
  const context: TeachingContext = {
    mode: 'case',
    workflowId: null,
    stepIndex: 0,
    selected: '11',
    selectedIds: ['11'],
    availableIds: ['11'],
    synthetic: true,
    revision: 0,
    view: 'perspective',
    arch: 'both',
    speed: 1,
    tryMode: false,
    caseId: 'crowding',
  };
  const execute = vi.fn(async (actions, summary) =>
    validateTeachingPlan({ actions, summary, clarification: null }, context, {
      allowLocalActions: true,
    }),
  );
  const setTraces = vi.fn();
  const api = {
    model: { name: 'Teaching model', teeth: [], demo: true },
    ids: [],
    selectedIds: [],
    sandbox: { lockedIds: [] },
    applianceDisplay: { preset: 'none' },
    teaching: { execute },
    setTraces,
    traces: false,
  } as unknown as CaseStudioApi;
  try {
    for (const traces of [false, true]) {
      await act(async () => root.render(<CaseSidebar api={{ ...api, traces }} />));
      const toggle = [...container.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(
        button => button.textContent?.includes('Displacement traces'),
      )!;
      expect(toggle.getAttribute('aria-checked')).toBe(String(traces));
      await act(async () => toggle.click());
      const command = `${traces ? 'hide' : 'show'} displacement traces`;
      expect(execute).toHaveBeenLastCalledWith(
        parseTeachingPlan(command, context).actions,
        `${traces ? 'Hide' : 'Show'} displacement traces`,
      );
    }
    expect(setTraces).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
