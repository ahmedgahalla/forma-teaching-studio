// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LectureDocument } from '@/lib/lecture-documents';
import { TEACHING_CASES } from '@/lib/teaching-cases';
import { LectureLibrary } from './LectureLibrary';
import { LectureNavigation, type LectureNavigationProps } from './LectureNavigation';
import { LecturePanel, type LecturePanelProps } from './LecturePanel';

let root: Root, container: HTMLDivElement;
const lecture = {
  version: 1,
  id: 'test-lecture',
  title: 'Movement lesson',
  updatedAt: '2026-09-27T10:00:00.000Z',
  steps: ['Observe', 'Predict', 'Compare'].map((title, index) => ({
    id: `step-${index}`,
    title,
    notes: `Notes for ${title}`,
    question: 'What changes?',
    answer: 'The model illustrates movement.',
    scene: {},
  })),
} as LectureDocument;

async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
function button(label: string) {
  const found = [...container.querySelectorAll('button')].find(
    item => (item.getAttribute('aria-label') || item.textContent?.trim()) === label,
  );
  expect(found, `button ${label}`).toBeDefined();
  return found!;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function panelProps(patch: Partial<LecturePanelProps> = {}): LecturePanelProps {
  return {
    document: lecture,
    index: 0,
    mode: 'prepare',
    answerVisible: false,
    notesVisible: false,
    saveStatus: 'Saved in this browser',
    onTitle: vi.fn(),
    onPatchStep: vi.fn(),
    onCapture: vi.fn(),
    onAdd: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onAttachDemo: vi.fn(),
    onDetachDemo: vi.fn(),
    onGo: vi.fn(),
    onReveal: vi.fn(),
    onNotes: vi.fn(),
    onExport: vi.fn(),
    ...patch,
  };
}
function navigationProps(patch: Partial<LectureNavigationProps> = {}): LectureNavigationProps {
  return {
    mode: 'teach',
    index: 0,
    count: 3,
    exploring: false,
    onMode: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onExplore: vi.fn(),
    onReturn: vi.fn(),
    onLibrary: vi.fn(),
    ...patch,
  };
}

beforeEach(() => {
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

it('offers a clear start and sample in an empty library', async () => {
  const onCreate = vi.fn(),
    onSample = vi.fn();
  await render(
    <LectureLibrary
      documents={[]}
      error=""
      onCreate={onCreate}
      onSample={onSample}
      onOpen={vi.fn()}
      onImport={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  await click('Create lecture');
  await click('Open a three-step sample');
  expect(onCreate).toHaveBeenCalledOnce();
  expect(onSample).toHaveBeenCalledOnce();
  expect(container.textContent).toContain('Lectures save in this browser');
});

it('requires explicit inline confirmation before deleting a saved lecture', async () => {
  const onDelete = vi.fn();
  await render(
    <LectureLibrary
      documents={[lecture]}
      error=""
      onCreate={vi.fn()}
      onSample={vi.fn()}
      onOpen={vi.fn()}
      onImport={vi.fn()}
      onDelete={onDelete}
    />,
  );
  await click('Delete Movement lesson');
  expect(onDelete).not.toHaveBeenCalled();
  await click('Keep lecture');
  expect(onDelete).not.toHaveBeenCalled();
  await click('Delete Movement lesson');
  await click('Delete lecture');
  expect(onDelete).toHaveBeenCalledExactlyOnceWith(lecture.id);
});

it('passes an imported backup to the owner and keeps import available', async () => {
  const onImport = vi.fn(),
    file = new File(['{}'], 'lecture.json', { type: 'application/json' });
  await render(
    <LectureLibrary
      documents={[]}
      error="Invalid backup"
      onCreate={vi.fn()}
      onSample={vi.fn()}
      onOpen={vi.fn()}
      onImport={onImport}
      onDelete={vi.fn()}
    />,
  );
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  expect(onImport).toHaveBeenCalledExactlyOnceWith(file);
  expect(input.value).toBe('');
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Invalid backup');
});

it('keeps answers and notes hidden in teaching until the presenter requests them', async () => {
  const props = panelProps({ mode: 'teach' });
  await render(<LecturePanel {...props} />);
  expect(container.textContent).toContain('What changes?');
  expect(container.textContent).not.toContain(lecture.steps[0].answer);
  expect(container.textContent).not.toContain(lecture.steps[0].notes);
  expect(container.querySelector('input, textarea')).toBeNull();
  await click('Reveal answer');
  await click('Show notes');
  expect(props.onReveal).toHaveBeenCalledOnce();
  expect(props.onNotes).toHaveBeenCalledOnce();
  await render(<LecturePanel {...props} answerVisible notesVisible />);
  expect(container.querySelector('.lecture-answer')?.textContent).toBe(lecture.steps[0].answer);
  expect(container.querySelector('.lecture-notes')?.textContent).toContain(
    'VISIBLE ON THIS SCREEN',
  );
});

it('captures the shown setup explicitly and identifies the current ordered step', async () => {
  const props = panelProps();
  await render(<LecturePanel {...props} />);
  expect(container.querySelector('[aria-current="step"]')?.textContent).toBe('1Observe');
  await click('Capture shown model setup');
  await click('Move step later');
  await click('2Predict');
  expect(props.onCapture).toHaveBeenCalledOnce();
  expect(props.onMove).toHaveBeenCalledExactlyOnceWith(1);
  expect(props.onGo).toHaveBeenCalledExactlyOnceWith(1);
  expect(button('Move step earlier').disabled).toBe(true);
  await render(<LecturePanel {...props} document={{ ...lecture, steps: [lecture.steps[0]] }} />);
  expect(button('Delete step').disabled).toBe(true);
});

it('selects compatible authored variants and does not attach one until requested', async () => {
  const props = panelProps(),
    example = TEACHING_CASES.find(item => item.id === 'movement-types')!;
  await render(<LecturePanel {...props} />);
  const selects = container.querySelectorAll('select');
  await act(async () => {
    selects[0].value = example.id;
    selects[0].dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(selects[1].value).toBe(example.variants[0].id);
  expect(props.onAttachDemo).not.toHaveBeenCalled();
  await act(async () => {
    selects[1].value = example.variants[1].id;
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));
  });
  await click('Attach demonstration');
  expect(props.onAttachDemo).toHaveBeenCalledExactlyOnceWith(example.id, example.variants[1].id);
  expect(container.textContent).toContain('Uses this example’s starting model');
});

it('confirms step deletion and keeps authoring fields within saved document limits', async () => {
  const props = panelProps();
  await render(<LecturePanel {...props} />);
  await click('Delete step');
  expect(props.onDelete).not.toHaveBeenCalled();
  expect(container.querySelector('[aria-label="Delete step confirmation"]')?.textContent).toContain(
    'Observe',
  );
  await click('Keep step');
  expect(props.onDelete).not.toHaveBeenCalled();
  await click('Delete step');
  await click('Confirm delete');
  expect(props.onDelete).toHaveBeenCalledOnce();
  expect([...container.querySelectorAll('input')].map(input => input.maxLength)).toEqual([
    160, 160,
  ]);
  expect([...container.querySelectorAll('textarea')].map(input => input.maxLength)).toEqual([
    20000, 2000, 10000,
  ]);
  const full = {
    ...lecture,
    steps: Array.from({ length: 100 }, (_, index) => ({
      ...lecture.steps[0],
      id: `full-${index}`,
    })),
  };
  await render(<LecturePanel {...props} document={full} />);
  expect(button('Add step').disabled).toBe(true);
  expect(button('Duplicate').disabled).toBe(true);
  await click('Add step');
  await click('Duplicate');
  expect(props.onAdd).not.toHaveBeenCalled();
  expect(props.onDuplicate).not.toHaveBeenCalled();
});

it('keeps a clear return path while exploring and prevents navigation to another step', async () => {
  const props = navigationProps({ index: 1, exploring: true });
  await render(<LectureNavigation {...props} />);
  expect(button('Previous lecture step').disabled).toBe(true);
  expect(button('Next lecture step').disabled).toBe(true);
  expect(button('Prepare').disabled).toBe(true);
  await click('Next lecture step');
  expect(props.onNext).not.toHaveBeenCalled();
  await click('Return to lecture');
  expect(props.onReturn).toHaveBeenCalledOnce();
});

it('separates lecture step navigation from the shared model playback', async () => {
  const props = navigationProps();
  await render(<LectureNavigation {...props} />);
  expect(button('Previous lecture step').disabled).toBe(true);
  await click('Next lecture step');
  expect(props.onNext).toHaveBeenCalledOnce();
  expect(container.textContent).not.toMatch(/Play|Pause|Replay/);
  await render(<LectureNavigation {...props} index={2} />);
  expect(button('Next lecture step').disabled).toBe(true);
});
