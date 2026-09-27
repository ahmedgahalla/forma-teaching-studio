// @vitest-environment jsdom
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CaseStudioApi } from './api';
import type { TeacherLectures } from '../lecture-builder/useTeacherLectures';
import { CaseShell } from './CaseShell';

const calls = vi.hoisted(() => ({
  mount: vi.fn(),
  unmount: vi.fn(),
  openSample: vi.fn(),
  exit: vi.fn(),
  save: vi.fn(),
  importCase: vi.fn(),
  modal: vi.fn(),
}));
vi.mock('./CaseMain', async () => {
  const { useEffect } = await import('react');
  return {
    CaseMain: function Main() {
      useEffect(() => {
        calls.mount();
        return () => calls.unmount();
      }, []);
      return <main data-testid="model-workspace">Mounted model</main>;
    },
  };
});
vi.mock('./CaseInspector', () => ({
  CaseInspector: () => <aside data-testid="tools">Editing tools</aside>,
}));
vi.mock('./CaseSidebar', () => ({ CaseSidebar: () => <aside data-testid="sidebar" /> }));
vi.mock('./CaseDialogs', () => ({ CaseDialogs: () => null }));
vi.mock('./StudioExperience', () => ({ MobileStudioDock: () => null }));
vi.mock('../try/PreviewDecisionBar', () => ({ PreviewDecisionBar: () => null }));
vi.mock('../lecture-builder/LecturePanel', () => ({
  LecturePanel: () => <aside data-testid="lecture-panel">Sample lecture</aside>,
}));
vi.mock('../lecture-builder/LectureNavigation', () => ({
  LectureNavigation: () => <nav aria-label="Lecture controls" />,
}));

type Screen = 'explore' | 'lecture';
function Harness({
  initialScreen = 'lecture',
  mode = 'teach',
  busy = false,
  error = '',
  exploring = false,
}: {
  initialScreen?: Screen;
  mode?: 'rehearse' | 'teach';
  busy?: boolean;
  error?: string;
  exploring?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [lecture, setLecture] = useState(mode === 'teach');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState('model');
  const caseInput = useRef<HTMLInputElement | null>(null);
  const api = {
    lecture,
    toolsOpen,
    mobilePanel,
    setLecture,
    setToolsOpen,
    setMobilePanel,
    caseInput,
    sandbox: { pending: null },
    active: true,
    busy,
    setModal: calls.modal,
    apiUrl: '',
    setApiDraft: vi.fn(),
    tryActive: false,
    setPanel: vi.fn(),
    teaching: { cancel: vi.fn(), runtime: { error: !!error, message: error } },
    aiEnabled: false,
    sceneInteraction: vi.fn(),
    save: calls.save,
    importCase: calls.importCase,
  } as unknown as CaseStudioApi;
  const teacher = {
    session: { screen, mode, exploring },
    active: screen !== 'explore',
    error: '',
    document: screen === 'lecture' ? { title: 'Lecture', steps: [{}] } : undefined,
    panelProps: screen === 'lecture' ? {} : null,
    navigationProps: {},
    openSample: () => {
      calls.openSample();
      setScreen('lecture');
    },
    exit: () => {
      calls.exit();
      setScreen('explore');
    },
  } as unknown as TeacherLectures;
  return <CaseShell api={api} teacher={teacher} />;
}

let root: Root, container: HTMLDivElement;
const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`);
function findButton(name: string) {
  return [...container.querySelectorAll('button')].find(
    button => (button.getAttribute('aria-label') || button.textContent?.trim()) === name,
  );
}
async function click(name: string) {
  const button = findButton(name);
  expect(button, `button ${name}`).toBeDefined();
  await act(async () => button!.click());
}
async function render(props: Parameters<typeof Harness>[0] = {}) {
  await act(async () => root.render(<Harness {...props} />));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('shows editing tools only during an explicit question exploration', async () => {
  await render({ exploring: true });
  const model = byTestId('model-workspace');
  expect(byTestId('lecture-panel')).toBeNull();
  await click('Tools');
  expect(findButton('Tools')?.getAttribute('aria-pressed')).toBe('true');
  expect(byTestId('tools')).not.toBeNull();
  await click('Tools');
  expect(findButton('Tools')?.getAttribute('aria-pressed')).toBe('false');
  expect(byTestId('model-workspace')).toBe(model);
  expect(calls.mount).toHaveBeenCalledOnce();
  expect(calls.unmount).not.toHaveBeenCalled();
});

it('opens the ready lecture directly without remounting the shared model', async () => {
  await render({ initialScreen: 'explore' });
  const model = byTestId('model-workspace');
  await click('Lecture');
  expect(calls.openSample).toHaveBeenCalledOnce();
  expect(container.querySelectorAll('[data-testid="lecture-panel"]')).toHaveLength(1);
  expect(findButton('Tools')).toBeUndefined();
  expect(findButton('Create lecture')).toBeUndefined();
  expect(byTestId('model-workspace')).toBe(model);
  await click('Explore');
  expect(calls.exit).toHaveBeenCalledOnce();
  expect(byTestId('lecture-panel')).toBeNull();
  expect(byTestId('model-workspace')).toBe(model);
  expect(calls.mount).toHaveBeenCalledOnce();
  expect(calls.unmount).not.toHaveBeenCalled();
});

it('keeps a rejected lecture opening visible from Explore', async () => {
  await render({ initialScreen: 'explore', error: 'Apply or discard the preview first.' });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    'Apply or discard the preview first.',
  );
});

it('keeps experience tabs available in Teach while hiding editing and case-file actions', async () => {
  await render({ mode: 'teach' });
  const tabs = container.querySelector('[aria-label="Workspace"]');
  expect(tabs?.textContent).toContain('Explore');
  expect(tabs?.textContent).toContain('Lecture');
  expect(findButton('Lecture')?.getAttribute('aria-pressed')).toBe('true');
  expect(findButton('Tools')).toBeUndefined();
  expect(findButton('Teaching library')).toBeUndefined();
  expect(findButton('Open case')).toBeUndefined();
  expect(findButton('Save case')).toBeUndefined();
  expect(findButton('Selection')).toBeUndefined();
  expect(findButton('Layers')).toBeUndefined();
  expect(byTestId('lecture-panel')).not.toBeNull();
  await click('Explore');
  expect(calls.exit).toHaveBeenCalledOnce();
  expect(findButton('Explore')?.getAttribute('aria-pressed')).toBe('true');
  expect(findButton('Tools')).toBeDefined();
});

it('preserves case opening, saving and the busy import guard in Explore', async () => {
  await render({ initialScreen: 'explore', busy: true });
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const openFile = vi.spyOn(input, 'click').mockImplementation(() => {});
  expect(findButton('Open case')?.disabled).toBe(true);
  await click('Open case');
  expect(openFile).not.toHaveBeenCalled();
  await render({ initialScreen: 'explore', busy: false });
  await click('Open case');
  await click('Save case');
  expect(openFile).toHaveBeenCalledOnce();
  expect(calls.save).toHaveBeenCalledOnce();
  const file = new File(['{}'], 'case.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  expect(calls.importCase).toHaveBeenCalledExactlyOnceWith(file);
});
