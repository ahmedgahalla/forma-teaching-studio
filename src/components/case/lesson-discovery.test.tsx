// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LESSONS } from '@/lib/lessons';
import type { CaseStudioApi } from './api';
import { DialogsInfo } from './DialogsInfo';
import { DialogsLibrary } from './DialogsLibrary';
import { CaseArchToolbar } from './CaseArchToolbar';

let root: Root, container: HTMLDivElement;
const execute = vi.fn().mockResolvedValue(undefined);
const api = (modal: string) =>
  ({
    modal,
    setModal: vi.fn(),
    sandbox: {},
    busy: false,
    teaching: { execute },
    currentLesson: LESSONS[0],
    lessonStep: 0,
  }) as unknown as CaseStudioApi;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = vi.fn();
  execute.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it.each(['guide', 'workflows'])('discovers glossary and tour phrases in %s', modal => {
  act(() =>
    root.render(
      modal === 'guide' ? <DialogsInfo api={api(modal)} /> : <DialogsLibrary api={api(modal)} />,
    ),
  );
  const examples = document.querySelector('[aria-label="Ask Forma"]');
  expect(examples?.textContent).toContain('Forma, what is the cusp of Carabelli?');
  expect(examples?.textContent).toContain('Forma, what is torque?');
  expect(examples?.textContent).toContain('Forma, start the tooth anatomy tour');
  expect(examples?.textContent).toContain('Teaching draft — pending educator review');
});

it('starts the tour from the Library through validated actions', () => {
  act(() => root.render(<DialogsLibrary api={api('lessons')} />));
  const tour = [...document.querySelectorAll<HTMLButtonElement>('.lesson-cards button')].find(
    button => button.textContent?.includes('Tooth anatomy tour'),
  )!;
  act(() => tour.click());
  expect(execute).toHaveBeenCalledWith(
    [{ kind: 'lesson', action: 'start', id: 'tooth-anatomy-tour' }],
    'Start Tooth anatomy tour',
  );
});

it('closes the lesson ribbon through the undoable runtime', () => {
  act(() => root.render(<CaseArchToolbar api={api('')} />));
  act(() => document.querySelector<HTMLButtonElement>('[aria-label="Close lesson"]')!.click());
  expect(execute).toHaveBeenCalledWith([{ kind: 'lesson', action: 'close' }], 'Close lesson');
});
