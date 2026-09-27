// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CaseRefs, CaseStudioApi } from '../case/api';
import { useTeacherLectures, type TeacherLectures } from './useTeacherLectures';
import { lectureHarness } from './session.fixtures';

let root: Root, container: HTMLDivElement, teacher: TeacherLectures;
let harness: ReturnType<typeof lectureHarness>;
const refs = { pendingView: { current: null } } as unknown as CaseRefs;
function Harness() {
  const current = useTeacherLectures(harness.api, refs);
  useEffect(() => {
    teacher = current;
  });
  return null;
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  harness = lectureHarness();
  harness.api.teaching = {
    execute: vi.fn(async actions => {
      for (const action of actions) await teacher.decorate(harness.adapter()).apply(action);
    }),
  } as unknown as CaseStudioApi['teaching'];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  harness.runtime.dispose();
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('opens one ready-made lecture in Teach and leaves a repeated Lecture click at the current step', async () => {
  expect(teacher.active).toBe(false);
  await act(async () => teacher.openSample());
  expect(teacher.session).toMatchObject({
    screen: 'lecture',
    mode: 'teach',
    index: 0,
    answerVisible: false,
    notesVisible: false,
  });
  const document = teacher.document;
  expect(document?.steps).toHaveLength(4);
  await act(async () => teacher.navigationProps.onNext());
  expect(teacher.session.index).toBe(1);
  const execute = harness.api.teaching.execute;
  vi.mocked(execute).mockClear();
  await act(async () => teacher.openSample());
  expect(execute).not.toHaveBeenCalled();
  expect(teacher.session.index).toBe(1);
  expect(teacher.document).toBe(document);
  await act(async () => teacher.exit());
  await act(async () => teacher.openSample());
  expect(teacher.document).toBe(document);
  expect(teacher.session.index).toBe(0);
});

it('keeps previously saved lecture data untouched and works without browser storage', async () => {
  const key = 'forma-lecture-library-v1',
    existing = '{previous local lecture data}';
  localStorage.setItem(key, existing);
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  await act(async () => {
    root.unmount();
    root = createRoot(container);
    root.render(<Harness />);
  });
  await act(async () => teacher.openSample());
  await act(async () => teacher.navigationProps.onNext());
  expect(teacher.session.index).toBe(1);
  expect(get).not.toHaveBeenCalled();
  expect(set).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  get.mockRestore();
  expect(localStorage.getItem(key)).toBe(existing);
});
