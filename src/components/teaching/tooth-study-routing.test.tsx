// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TeachingProvider, useTeaching, useTeachingAdapter } from './TeachingController';
import type { ToothStudyContext } from '@/lib/tooth-study/types';

type CaseScene = { selected: string; camera: string; study?: ToothStudyContext };
type WorkflowScene = { step: number; selected: string };
let teaching: ReturnType<typeof useTeaching>, root: Root, container: HTMLDivElement;
let rejectStudy = false;
const caseApply = vi.fn(),
  workflowApply = vi.fn();
const casePreflight = vi.fn(),
  workflowPreflight = vi.fn();
const ids = ['11', '16', '21'];

function Harness() {
  // eslint-disable-next-line react-hooks/globals -- expose the real provider controller to this isolated integration harness
  teaching = useTeaching();
  const [caseScene, setCaseScene] = useState<CaseScene>({ selected: '21', camera: 'saved-mouth' });
  const [workflowScene, setWorkflowScene] = useState<WorkflowScene>({ step: 0, selected: '11' });
  useTeachingAdapter('case', {
    context: () => ({
      mode: 'case',
      workflowId: null,
      stepIndex: -1,
      selected: caseScene.selected,
      selectedIds: [caseScene.selected],
      availableIds: ids,
      synthetic: true,
      view: 'perspective',
      arch: 'both',
      speed: 1,
      canStepStages: false,
      toothStudy: caseScene.study,
    }),
    capture: () => structuredClone(caseScene),
    restore: snapshot => setCaseScene(snapshot as CaseScene),
    preflight: casePreflight,
    pause: () => {},
    narration: () => '',
    apply: action => {
      caseApply(action);
      if (action.kind !== 'tooth-study' || rejectStudy) return false;
      if (action.action === 'open')
        setCaseScene({
          selected: action.tooth,
          camera: `study-${action.view ?? 'buccal'}`,
          study: { tooth: action.tooth, view: action.view ?? 'buccal', explanationVisible: false },
        });
      if (action.action === 'view')
        setCaseScene(previous => ({
          ...previous,
          camera: `study-${action.view}`,
          study: previous.study && { ...previous.study, view: action.view },
        }));
      return true;
    },
  });
  useTeachingAdapter('workflow', {
    context: () => ({
      mode: 'workflow',
      workflowId: 'fixed-braces',
      stepIndex: workflowScene.step,
      selected: workflowScene.selected,
      selectedIds: [workflowScene.selected],
      availableIds: ids,
      synthetic: true,
      view: 'front',
      arch: 'both',
      speed: 1,
      lessonActive: true,
      playing: false,
    }),
    capture: () => structuredClone(workflowScene),
    restore: snapshot => setWorkflowScene(snapshot as WorkflowScene),
    preflight: workflowPreflight,
    pause: () => {},
    narration: () => '',
    apply: action => {
      workflowApply(action);
      if (action.kind !== 'workflow') return false;
      if (action.action === 'start') setWorkflowScene({ step: 0, selected: '11' });
      if (action.action === 'next')
        setWorkflowScene(previous => ({ ...previous, step: previous.step + 1 }));
      return true;
    },
  });
  return (
    <>
      <output data-testid="case">{JSON.stringify(caseScene)}</output>
      <output data-testid="workflow">{JSON.stringify(workflowScene)}</output>
    </>
  );
}

const scene = (id: 'case' | 'workflow') =>
  JSON.parse(container.querySelector(`[data-testid="${id}"]`)!.textContent!);

beforeEach(async () => {
  vi.clearAllMocks();
  rejectStudy = false;
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <TeachingProvider>
        <Harness />
      </TeachingProvider>,
    );
  });
  await act(async () => {
    teaching.setConfig({ enabled: true, url: 'https://forma.example' });
    teaching.setPreferAI(true);
  });
  vi.mocked(fetch).mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function enterWorkflow() {
  await act(async () =>
    teaching.execute(
      [
        { kind: 'workflow', action: 'start', id: 'fixed-braces' },
        { kind: 'workflow', action: 'next' },
      ],
      'Start a workflow and advance',
    ),
  );
  expect(teaching.mode).toBe('workflow');
}

it('routes a local study request to the case adapter and Undo/Redo restores both scenes and mode', async () => {
  await enterWorkflow();
  const beforeCase = scene('case'),
    beforeWorkflow = scene('workflow');
  await act(async () => teaching.run('show tooth 16 then view it from the mesial'));
  expect(teaching.runtime.error).toBe(false);
  expect(teaching.mode).toBe('case');
  expect(scene('case')).toEqual({
    selected: '16',
    camera: 'study-mesial',
    study: { tooth: '16', view: 'mesial', explanationVisible: false },
  });
  expect(scene('workflow')).toEqual(beforeWorkflow);
  expect(casePreflight).toHaveBeenLastCalledWith(
    [
      { kind: 'tooth-study', action: 'open', tooth: '16' },
      { kind: 'tooth-study', action: 'view', view: 'mesial' },
    ],
    undefined,
  );
  expect(caseApply.mock.calls.map(([action]) => action.kind)).toEqual([
    'tooth-study',
    'tooth-study',
  ]);
  expect(workflowApply).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
  const afterCase = scene('case');
  await act(async () => teaching.run('undo'));
  expect(teaching.mode).toBe('workflow');
  expect(scene('case')).toEqual(beforeCase);
  expect(scene('workflow')).toEqual(beforeWorkflow);
  await act(async () => teaching.run('redo'));
  expect(teaching.mode).toBe('case');
  expect(scene('case')).toEqual(afterCase);
  expect(scene('workflow')).toEqual(beforeWorkflow);
  expect(caseApply).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
});

it('restores the workflow mode and both snapshots when its destination rejects a study', async () => {
  await enterWorkflow();
  const beforeCase = scene('case'),
    beforeWorkflow = scene('workflow');
  rejectStudy = true;
  await act(async () => teaching.run('show tooth 16'));
  expect(teaching.runtime.error).toBe(true);
  expect(teaching.mode).toBe('workflow');
  expect(scene('case')).toEqual(beforeCase);
  expect(scene('workflow')).toEqual(beforeWorkflow);
  expect(fetch).not.toHaveBeenCalled();
});

it('clarifies empty-workspace navigation without applying an action or consulting AI', async () => {
  for (const text of ['next', 'back']) {
    await act(async () => teaching.run(text));
    expect(teaching.runtime.message).toMatch(/Nothing to step through here/);
  }
  expect(caseApply).not.toHaveBeenCalled();
  expect(workflowApply).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
