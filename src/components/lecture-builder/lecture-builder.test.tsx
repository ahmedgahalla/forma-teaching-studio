// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createLectureSample, type LectureDocument } from '@/lib/lecture-documents';
import { createCaseJourneyLecture } from '@/lib/lecture-documents/sample-case-journey';
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
    answer: `Takeaway for ${title}`,
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
    index: 0,
    count: 3,
    stepTitles: lecture.steps.map(step => step.title),
    exploring: false,
    onStep: vi.fn(),
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

it('shows the takeaway directly without presenter controls, hidden answers or lecture authoring', async () => {
  await render(<LecturePanel {...panelProps()} />);
  expect(container.querySelector('.lecture-takeaway')?.textContent).toBe('Takeaway for Observe');
  expect(container.textContent).not.toMatch(
    /Question for|Notes for|Reveal answer|Present|Rehearse|Review notes|Create lecture/i,
  );
  expect(container.querySelector('input, textarea, select, [contenteditable], aside')).toBeNull();
  expect(container.querySelector('details')?.open).toBe(false);
});

it('updates the brief explanation with the current step and hides absent content', async () => {
  await render(<LecturePanel {...panelProps({ index: 1 })} />);
  expect(container.textContent).toContain('Takeaway for Predict');
  expect(container.textContent).not.toContain('Takeaway for Observe');
  const empty = { ...lecture, steps: [{ ...lecture.steps[0], answer: '' }] };
  await render(<LecturePanel {...panelProps({ document: empty })} />);
  expect(container.querySelector('.lecture-takeaway')).toBeNull();
});

it.each(['rehearse', 'teach'])(
  'keeps one learner caption under the legacy %s session state',
  async mode => {
    const teacher = {
      panelProps: { ...panelProps(), mode, answerVisible: false, notesVisible: true },
    } as unknown as TeacherLectures;
    await render(<TeacherWorkspace teacher={teacher} />);
    expect(container.querySelectorAll('[aria-label="Step explanation"]')).toHaveLength(1);
    expect(container.textContent).toContain('Takeaway for Observe');
    expect(container.textContent).not.toContain('Notes for Observe');
    await render(<TeacherWorkspace teacher={{ ...teacher, panelProps: null }} />);
    expect(container.innerHTML).toBe('');
  },
);

it('keeps bounded previous/next and exploration without a view split or another playback bar', async () => {
  const props = navigationProps();
  await render(<LectureNavigation {...props} />);
  expect(container.querySelector('[aria-label="Lecture view"]')).toBeNull();
  expect(container.textContent).not.toMatch(/Present|Review notes|Rehearse|Play|Pause|Replay/);
  expect(button('Previous lecture step').disabled).toBe(true);
  await click('Previous lecture step');
  expect(props.onPrevious).not.toHaveBeenCalled();
  await click('Next lecture step');
  expect(props.onNext).toHaveBeenCalledOnce();
  await click('Explore this step');
  expect(props.onExplore).toHaveBeenCalledOnce();
  await render(<LectureNavigation {...props} index={2} />);
  expect(button('Next lecture step').disabled).toBe(true);
  await click('Previous lecture step');
  expect(props.onPrevious).toHaveBeenCalledOnce();
});

it('disables step switching during exploration while keeping the exact return action available', async () => {
  const props = navigationProps({ index: 1, exploring: true });
  await render(<LectureNavigation {...props} />);
  expect(button('Previous lecture step').disabled).toBe(true);
  expect(button('Next lecture step').disabled).toBe(true);
  expect(container.querySelector('select')?.disabled).toBe(true);
  await click('Next lecture step');
  expect(props.onNext).not.toHaveBeenCalled();
  await click('Return to lecture');
  expect(props.onReturn).toHaveBeenCalledOnce();
});

it('offers every named step and reports its current progress', async () => {
  const props = navigationProps({ index: 1 });
  await render(<LectureNavigation {...props} />);
  const picker = container.querySelector<HTMLSelectElement>('[aria-label="Lecture step"]')!;
  expect([...picker.options].map(option => option.text)).toEqual(['Observe', 'Predict', 'Compare']);
  expect(picker.value).toBe('1');
  expect(container.querySelector('progress')?.value).toBe(2);
  expect(container.querySelector('progress')?.max).toBe(3);
  await act(async () => {
    picker.value = '2';
    picker.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(props.onStep).toHaveBeenCalledExactlyOnceWith(2);
});

it('keeps optional focus, comparison and tissue controls on their existing callbacks', async () => {
  const props = panelProps({ document: createLectureSample() });
  await render(<LecturePanel {...props} />);
  const details = container.querySelector('details')!;
  expect(details.querySelector('summary')?.textContent).toBe('Inspect and compare');
  await act(async () => details.querySelector('summary')!.click());
  await click('Focus on these teeth');
  expect(props.onFocus).toHaveBeenCalledOnce();
  await click('Starting arrangement');
  await click('Translation example');
  await click('Tipping example');
  expect(props.onCompare).toHaveBeenNthCalledWith(1, 'start');
  expect(props.onCompare).toHaveBeenNthCalledWith(2, 'translation');
  expect(props.onCompare).toHaveBeenNthCalledWith(3, 'tip');
  await click('Explain tissue response');
  expect(props.onBiology).toHaveBeenCalledExactlyOnceWith('overview');
});

it('keeps the comparison return outside collapsed options and does not describe the wrong step', async () => {
  const props = panelProps({ document: createLectureSample(), comparison: 'tip' });
  await render(<LecturePanel {...props} />);
  expect(container.querySelector('details')?.open).toBe(false);
  expect(container.querySelector('.lecture-takeaway')).toBeNull();
  expect(container.querySelector('.lecture-step-guide')?.textContent).toContain('Comparison view');
  expect(button('Close comparison').closest('details')).toBeNull();
  await click('Close comparison');
  expect(props.onCloseComparison).toHaveBeenCalledOnce();
});

it('keeps a displayed biology diagram and its exit independent of collapsed options', async () => {
  const props = panelProps({ biology: 'compression' });
  await render(<LecturePanel {...props} />);
  const details = container.querySelector('details')!;
  await act(async () => details.querySelector('summary')!.click());
  await act(async () => details.querySelector('summary')!.click());
  expect(details.open).toBe(false);
  expect(button('Close biology').closest('details')).toBeNull();
  await click('Tension');
  expect(props.onBiology).toHaveBeenLastCalledWith('tension');
  await click('Close biology');
  expect(props.onHideBiology).toHaveBeenCalledOnce();
});

it('does not add instructions to ordinary static inspection steps', async () => {
  await render(<LecturePanel {...panelProps()} />);
  expect(container.querySelector('.lecture-step-guide')).toBeNull();
  expect(container.querySelector('.lecture-caption')?.textContent).toBe('Takeaway for Observe');
});

it('points authored motion at the single model playback bar', async () => {
  const document = createCaseJourneyLecture();
  const index = document.steps.findIndex(step => step.motion);
  expect(index).toBeGreaterThanOrEqual(0);
  await render(<LecturePanel {...panelProps({ document, index })} />);
  expect(container.querySelector('.lecture-step-guide')?.textContent).toContain(
    'Press Play below the model',
  );
  expect(container.querySelector('[aria-label="Play demonstration"]')).toBeNull();
});

it('distinguishes calculating a response from replaying the available result', async () => {
  const document = createCaseJourneyLecture();
  const index = document.steps.findIndex(step => step.id === 'test-wire-activation');
  expect(index).toBeGreaterThanOrEqual(0);
  await render(<LecturePanel {...panelProps({ document, index })} />);
  expect(container.querySelector('.lecture-step-guide')?.textContent).toBe(
    'Calculate response below the model.',
  );
  await render(<LecturePanel {...panelProps({ document, index, hasResponse: true })} />);
  expect(container.querySelector('.lecture-step-guide')?.textContent).toContain(
    'replay the response',
  );
});

it('marks the final step without suggesting an unavailable next step', async () => {
  await render(<LecturePanel {...panelProps({ index: 2 })} />);
  expect(container.querySelector('.lecture-step-guide')?.textContent).toContain(
    'Walkthrough complete',
  );
  expect(container.textContent).not.toContain('choose Next');
});
