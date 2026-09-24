// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LectureConsole, type LectureConsoleProps } from './LectureConsole';

let root: Root, container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  container.className = 'workspace-scene';
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.unstubAllGlobals();
});

it('opens a collapsed lecture card when an external reveal arrives and still allows manual closing', async () => {
  const props: LectureConsoleProps = {
    title: 'Translation and tipping', collapsible: true, showPlayback: false,
    question: 'Which part of the tooth moves?', answer: 'Compare the crown and root positions.',
    answerVisible: false, onToggleAnswer: vi.fn(), playing: false, progress: 0,
    onPlayPause: vi.fn(), onRestart: vi.fn(), onHalf: vi.fn(), onProgress: vi.fn(), speed: 1, onSpeed: vi.fn(),
  };
  const render = async (answerVisible: boolean) => {
    await act(async () => { root.render(createElement(LectureConsole, { ...props, answerVisible })); });
  };
  await render(false);
  const toggle = container.querySelector<HTMLButtonElement>('.lecture-console-toggle')!;
  const card = container.querySelector<HTMLElement>('[aria-label="Professor lecture controls"]')!;
  const answer = container.querySelector<HTMLElement>('.lecture-console-answer')!;
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(card.dataset.expanded).toBe('false');
  expect(answer.hidden).toBe(true);
  expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBe(container.querySelector('.lecture-console-content'));
  // JSDOM has no layout: model a card below the scene's visible area and an answer
  // below the card's fold. Only these local containers should move on reveal.
  const bounds = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) });
  Object.defineProperties(card, { scrollHeight: { value: 500 }, clientHeight: { value: 200 } });
  Object.defineProperties(container, { scrollHeight: { value: 600 }, clientHeight: { value: 300 } });
  card.getBoundingClientRect = () => bounds(220, 420);
  answer.getBoundingClientRect = () => bounds(400, 500);
  container.getBoundingClientRect = () => bounds(0, 300);
  const windowScroll = vi.spyOn(window, 'scrollTo');

  // Voice commands update answerVisible through the host, without clicking this card.
  await render(true);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(card.dataset.expanded).toBe('true');
  expect(answer.hidden).toBe(false);
  expect(answer.textContent).toContain(props.answer);
  expect(card.scrollTop).toBe(172);
  expect(container.scrollTop).toBe(120);
  expect(windowScroll).not.toHaveBeenCalled();

  await render(true);
  expect(card.scrollTop).toBe(172);
  expect(container.scrollTop).toBe(120);

  await act(async () => { toggle.click(); });
  await render(true);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(card.dataset.expanded).toBe('false');
  expect(props.onToggleAnswer).not.toHaveBeenCalled();
  windowScroll.mockRestore();
});
