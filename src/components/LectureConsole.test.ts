import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LectureConsole, type LectureConsoleProps } from './LectureConsole';

function props(overrides: Partial<LectureConsoleProps> = {}): LectureConsoleProps {
  return {
    title: 'Compare tooth movements',
    objective: 'Observe crown and root movement.',
    question: 'Does the root stay still?',
    answer: 'The crown and root move together.',
    answerVisible: false,
    onToggleAnswer: vi.fn(),
    playing: false,
    progress: 0.25,
    onPlayPause: vi.fn(),
    onRestart: vi.fn(),
    onHalf: vi.fn(),
    onProgress: vi.fn(),
    speed: 1,
    onSpeed: vi.fn(),
    ...overrides,
  };
}
const render = (value: LectureConsoleProps) =>
  renderToStaticMarkup(createElement(LectureConsole, value));
function button(html: string, label: string) {
  const match = html.match(
    new RegExp(
      `<button\\b[^>]*>(?:(?!</button>)[\\s\\S])*${label}(?:(?!</button>)[\\s\\S])*</button>`,
    ),
  );
  expect(match, `Button ${label} should be present`).not.toBeNull();
  return match![0];
}
function range(html: string) {
  return html.match(/<input\b[^>]*type="range"[^>]*>/)![0];
}

describe('professor lecture console', () => {
  it('shows a question before an initially hidden, labelled explanation without starting any action', () => {
    const value = props(),
      html = render(value);
    expect(html).toContain('Professor lecture controls');
    expect(html).toContain('Observe crown and root movement.');
    const reveal = button(html, 'Reveal explanation');
    expect(reveal).toContain('aria-expanded="false"');
    const answerId = reveal.match(/aria-controls="([^"]+)"/)![1];
    expect(html).toContain(`id="${answerId}" class="lecture-console-answer" hidden=""`);
    expect(html.indexOf('Does the root stay still?')).toBeLessThan(
      html.indexOf('The crown and root move together.'),
    );
    for (const handler of [
      value.onPlayPause,
      value.onRestart,
      value.onHalf,
      value.onProgress,
      value.onSpeed,
      value.onToggleAnswer,
    ])
      expect(handler).not.toHaveBeenCalled();
  });

  it('reveals the controlled answer and gives the professor an explicit hide action', () => {
    const html = render(props({ answerVisible: true }));
    expect(button(html, 'Hide explanation')).toContain('aria-expanded="true"');
    expect(html).not.toContain('class="lecture-console-answer" hidden');
    expect(html).toContain('The crown and root move together.');
  });

  it.each([
    [false, 0.25, 'Play'],
    [true, 0.5, 'Pause'],
    [false, 1, 'Replay'],
  ] as const)(
    'reflects playing=%s at progress %s without changing the host',
    (playing, progress, label) => {
      const html = render(props({ playing, progress }));
      expect(button(html, label)).not.toContain('disabled');
      expect(range(html)).toContain(`value="${progress}"`);
      expect(range(html)).toContain(
        `aria-valuetext="${Math.round(progress * 100)} percent of demonstration"`,
      );
    },
  );

  it('keeps every owned mutation control disabled when the host is busy or reviewing a preview', () => {
    const html = render(
      props({
        disabled: true,
        variants: [{ id: 'translation', label: 'Translation' }],
        onVariant: vi.fn(),
        explorationAction: { label: 'Explore arrangement', onClick: vi.fn() },
      }),
    );
    for (const label of [
      'Play',
      'Restart',
      'Pause at 50%',
      'Reveal explanation',
      'Explore arrangement',
    ])
      expect(button(html, label)).toContain('disabled');
    expect(range(html)).toContain('disabled');
    expect(html).toMatch(/<select\b[^>]*disabled/);
    expect(html).toMatch(/<fieldset\b[^>]*disabled/);
  });

  it('does not offer animation on a static teaching step while retaining Restart and question controls', () => {
    const html = render(props({ canPlay: false }));
    expect(button(html, 'Play')).toContain('disabled');
    expect(button(html, 'Pause at 50%')).toContain('disabled');
    expect(range(html)).toContain('disabled');
    expect(button(html, 'Restart')).not.toContain('disabled');
    expect(button(html, 'Reveal explanation')).not.toContain('disabled');
  });

  it('identifies the selected authored variant and requires a host handler to change variants', () => {
    const value = props({
      variants: [
        { id: 'a', label: 'Translation' },
        { id: 'b', label: 'Tipping' },
      ],
      variantId: 'b',
    });
    let html = render(value);
    expect(button(html, 'Tipping')).toContain('aria-pressed="true"');
    expect(button(html, 'Translation')).toContain('aria-pressed="false"');
    expect(html).toMatch(/<fieldset\b[^>]*disabled/);
    value.onVariant = vi.fn();
    html = render(value);
    expect(html).not.toMatch(/<fieldset\b[^>]*disabled/);
    expect(value.onVariant).not.toHaveBeenCalled();
  });

  it('omits empty question, variant and exploration controls', () => {
    const html = render(props({ question: undefined, answer: undefined }));
    expect(html).not.toContain('ASK THE CLASS');
    expect(html).not.toContain('Reveal explanation');
    expect(html).not.toContain('lecture-console-variants');
    expect(html).not.toContain('lecture-console-explore');
  });

  it('does not reveal a nonexistent answer when a question has no authored explanation', () => {
    const html = render(props({ answer: undefined }));
    expect(html).toContain('Does the root stay still?');
    expect(html).not.toContain('Reveal explanation');
  });

  it('keeps caller-supplied display controls and teaching limitations visible', () => {
    const html = render(
      props({
        children: createElement('button', { type: 'button', 'aria-pressed': true }, 'Roots'),
      }),
    );
    expect(html).toContain('aria-label="Lecture model display"');
    expect(button(html, 'Roots')).toContain('aria-pressed="true"');
    expect(html).toContain('no treatment time scale');
    expect(html).toContain('educator review pending');
  });

  it('allows the host to explain a free variation without calling it an authored result', () => {
    const html = render(props({ note: 'Free geometric variation · source lesson preserved' }));
    expect(html).toContain('Free geometric variation · source lesson preserved');
    expect(html).not.toContain('Authored illustration');
  });
});
