// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createLectureSample, type LectureDocument } from '@/lib/lecture-documents';
import type { TeacherLectures } from './useTeacherLectures';
import { LectureNavigation, type LectureNavigationProps } from './LectureNavigation';
import { LecturePanel, type LecturePanelProps } from './LecturePanel';
import { TeacherWorkspace } from './TeacherWorkspace';

let root: Root, container: HTMLDivElement;
const lecture = {
  version: 1,
  id: 'sample-lecture',
  title: 'Movement lesson',
  updatedAt: '2026-09-27T10:00:00.000Z',
  steps: ['Observe', 'Predict', 'Compare'].map((title, index) => ({
    id: `step-${index}`,
    title,
    notes: `Notes for ${title}`,
    question: `Question for ${title}`,
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
    mode: 'teach',
    answerVisible: false,
    notesVisible: false,
    onReveal: vi.fn(),
    onNotes: vi.fn(),
    focus: false,
    onFocus: vi.fn(),
    comparison: null,
    onCompare: vi.fn(),
    onCloseComparison: vi.fn(),
    biology: 'off',
    onBiology: vi.fn(),
    onHideBiology: vi.fn(),
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

it('shows the ready-made lecture without creation or editing controls in either view', async () => {
  for (const mode of ['rehearse', 'teach'] as const) {
    await render(<LecturePanel {...panelProps({ mode })} />);
    expect(container.querySelector('h2')).toBeNull();
    expect(container.textContent).not.toMatch(/STEP 1/);
    expect(container.querySelector('input, textarea, select, [contenteditable]')).toBeNull();
    expect(button('Reveal answer')).toBeDefined();
    expect(button('Show notes')).toBeDefined();
    expect(container.querySelector('details')).toBeNull();
    expect(container.textContent).not.toMatch(
      /Create lecture|Add step|Capture|Export|Import|Delete/,
    );
  }
});

it('keeps answers and notes hidden until the presenter requests them', async () => {
  const props = panelProps();
  await render(<LecturePanel {...props} />);
  expect(container.textContent).toContain('Question for Observe');
  expect(container.textContent).not.toContain(lecture.steps[0].answer);
  expect(container.textContent).not.toContain(lecture.steps[0].notes);
  await click('Reveal answer');
  await click('Show notes');
  expect(props.onReveal).toHaveBeenCalledOnce();
  expect(props.onNotes).toHaveBeenCalledOnce();
  await render(<LecturePanel {...props} answerVisible notesVisible />);
  expect(container.querySelector('.lecture-answer')?.textContent).toBe(lecture.steps[0].answer);
  expect(container.querySelector('.lecture-notes')?.textContent).toContain(
    'VISIBLE ON THIS SCREEN',
  );
  expect(button('Hide answer').getAttribute('aria-expanded')).toBe('true');
  expect(button('Hide notes').getAttribute('aria-expanded')).toBe('true');
  await click('Hide answer');
  await click('Hide notes');
  expect(props.onReveal).toHaveBeenCalledTimes(2);
  expect(props.onNotes).toHaveBeenCalledTimes(2);
});

it('renders the current rehearsal notes read-only and hides absent optional content', async () => {
  await render(
    <LecturePanel {...panelProps({ mode: 'rehearse', index: 1, notesVisible: true })} />,
  );
  expect(container.querySelector('.lecture-question')?.textContent).toBe('Question for Predict');
  expect(container.textContent).toContain('Notes for Predict');
  expect(container.textContent).not.toContain('Notes for Observe');
  expect(container.querySelector('textarea')).toBeNull();
  const empty = {
    ...lecture,
    steps: [{ ...lecture.steps[0], question: '', answer: '', notes: '' }],
  };
  await render(<LecturePanel {...panelProps({ document: empty })} />);
  expect(container.querySelector('.lecture-question, .lecture-answer, .lecture-notes')).toBeNull();
});

it('provides only Rehearse and Teach with bounded step navigation and separate playback', async () => {
  const props = navigationProps();
  await render(<LectureNavigation {...props} />);
  const modes = container.querySelector('[aria-label="Lecture view"]');
  expect(modes?.textContent).toBe('RehearseTeach');
  expect(container.textContent).not.toMatch(/Prepare|My lectures|Create|Play|Pause|Replay/);
  expect(button('Previous lecture step').disabled).toBe(true);
  await click('Previous lecture step');
  expect(props.onPrevious).not.toHaveBeenCalled();
  await click('Rehearse');
  await click('Next lecture step');
  await click('Explore this question');
  expect(props.onMode).toHaveBeenCalledExactlyOnceWith('rehearse');
  expect(props.onNext).toHaveBeenCalledOnce();
  expect(props.onExplore).toHaveBeenCalledOnce();
  await render(<LectureNavigation {...props} index={2} />);
  expect(button('Next lecture step').disabled).toBe(true);
  await click('Previous lecture step');
  expect(props.onPrevious).toHaveBeenCalledOnce();
});

it('keeps a clear return path during exploration and prevents accidental lecture navigation', async () => {
  const props = navigationProps({ index: 1, exploring: true });
  await render(<LectureNavigation {...props} />);
  expect(button('Previous lecture step').disabled).toBe(true);
  expect(button('Next lecture step').disabled).toBe(true);
  expect(button('Rehearse').disabled).toBe(true);
  expect(button('Teach').disabled).toBe(true);
  await click('Next lecture step');
  await click('Rehearse');
  expect(props.onNext).not.toHaveBeenCalled();
  expect(props.onMode).not.toHaveBeenCalled();
  await click('Return to lecture');
  expect(props.onReturn).toHaveBeenCalledOnce();
});

it('renders one context panel when a lecture is active and no library overlay', async () => {
  const teacher = { panelProps: panelProps() } as unknown as TeacherLectures;
  await render(<TeacherWorkspace teacher={teacher} />);
  expect(container.querySelectorAll('[aria-label="Lecture step"]')).toHaveLength(1);
  expect(container.querySelector('.teacher-library-screen')).toBeNull();
  await render(<TeacherWorkspace teacher={{ ...teacher, panelProps: null }} />);
  expect(container.innerHTML).toBe('');
});

it('only labels notes as private when the separate audience window is open', async () => {
  const teacher = { panelProps: panelProps({ notesVisible: true }) } as unknown as TeacherLectures;
  await render(<TeacherWorkspace teacher={teacher} audienceOpen />);
  expect(container.querySelector('.lecture-notes')?.textContent).toContain(
    'NOT IN AUDIENCE WINDOW',
  );
  await render(<TeacherWorkspace teacher={teacher} audienceOpen={false} />);
  expect(container.querySelector('.lecture-notes')?.textContent).toContain(
    'VISIBLE ON THIS SCREEN',
  );
  expect(container.textContent).not.toContain('NOT IN AUDIENCE WINDOW');
});

it('uses bounded focus, comparison and tissue-response controls without another playback bar', async () => {
  const props = panelProps({ document: createLectureSample() });
  await render(<LecturePanel {...props} />);
  await click('Focus teaching teeth');
  expect(props.onFocus).toHaveBeenCalledOnce();
  const disclosure = container.querySelector('details')!;
  await act(async () => disclosure.querySelector('summary')!.click());
  expect(disclosure.open).toBe(true);
  await click('Starting arrangement');
  await click('Translation example');
  await click('Tipping example');
  expect(props.onCompare).toHaveBeenNthCalledWith(1, 'start');
  expect(props.onCompare).toHaveBeenNthCalledWith(2, 'translation');
  expect(props.onCompare).toHaveBeenNthCalledWith(3, 'tip');
  await click('Explain tissue response');
  expect(props.onBiology).toHaveBeenCalledExactlyOnceWith('overview');
  await render(<LecturePanel {...props} focus comparison="tip" biology="compression" />);
  expect(button('Show surrounding teeth').getAttribute('aria-pressed')).toBe('true');
  expect(button('Tipping example').getAttribute('aria-pressed')).toBe('true');
  await click('Close comparison');
  await click('Tension');
  await click('Close biology');
  expect(props.onCloseComparison).toHaveBeenCalledOnce();
  expect(props.onBiology).toHaveBeenLastCalledWith('tension');
  expect(props.onHideBiology).toHaveBeenCalledOnce();
  expect(container.textContent).not.toMatch(/Play|Pause|Replay/);
});
