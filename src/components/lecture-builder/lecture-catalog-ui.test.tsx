// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { DEMO_LECTURES, createDemoLectures } from '@/lib/lecture-documents';
import { availableLectureComparisons } from './lecture-comparison';
import { LecturePicker } from './LecturePicker';

it('offers only supported comparison targets for each ready-made lecture', () => {
  expect(createDemoLectures().map(availableLectureComparisons)).toEqual([
    ['start', 'translation', 'tip'],
    [],
    ['start', 'translation'],
  ]);
});

it('shows all three demo choices, linked sources and no authoring control', () => {
  const html = renderToStaticMarkup(
    <LecturePicker lectures={DEMO_LECTURES} currentId={DEMO_LECTURES[2].id} onOpen={() => {}} />,
  );
  expect(html).toContain('Translation and tipping');
  expect(html).toContain('Space closure and anchorage');
  expect(html).toContain('Why teeth move');
  expect(html).toContain('https://pubmed.ncbi.nlm.nih.gov/26823650/');
  expect(html).toContain('Suggested pacing');
  expect(html).not.toMatch(/create lecture|new lecture|import lecture/i);
});

it('emits the selected stable ID and disables switching during a question detour', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'),
    root = createRoot(container),
    onOpen = vi.fn();
  try {
    await act(async () =>
      root.render(<LecturePicker lectures={DEMO_LECTURES} currentId={null} onOpen={onOpen} />),
    );
    const menu = container.querySelector('details')!;
    expect(menu.open).toBe(false);
    await act(async () => menu.querySelector('summary')!.click());
    expect(menu.open).toBe(true);
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(onOpen).toHaveBeenCalledWith(DEMO_LECTURES[1].id);
    expect(menu.open).toBe(false);
    await act(async () =>
      root.render(
        <LecturePicker
          lectures={DEMO_LECTURES}
          currentId={DEMO_LECTURES[1].id}
          onOpen={onOpen}
          disabled
        />,
      ),
    );
    expect([...container.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    expect(container.textContent).toContain('Return to the lecture');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
