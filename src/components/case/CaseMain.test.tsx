// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CaseStudioApi } from './api';
import type { TeacherLectures } from '../lecture-builder/useTeacherLectures';
import { CaseMain } from './CaseMain';

vi.mock('./OpeningCommandDock', () => ({ OpeningCommandDock: () => null }));
vi.mock('../teaching/TeachingController', () => ({ TeachingCommandBar: () => null }));
vi.mock('./CaseViewport', () => ({ CaseViewport: () => <section data-testid="model" /> }));
vi.mock('./CaseLectureOverlay', () => ({ CaseLectureOverlay: () => null }));
vi.mock('./CaseStageDock', () => ({ CaseStageDock: () => <div data-testid="playback" /> }));

let root: Root, container: HTMLDivElement;
const execute = vi.fn().mockResolvedValue(undefined);
function api(prepared = false): CaseStudioApi {
  return {
    prepared,
    tryActive: !prepared,
    view: 'front',
    roots: true,
    sandbox: { pending: null, lockedIds: [] },
    model: { demo: true },
    selected: '11',
    selectedIds: ['11'],
    ids: ['11'],
    tooth: { id: '11', name: 'Maxillary right central incisor', calibrated: false },
    toothMoved: () => false,
    opening: 0,
    gums: true,
    labels: false,
    arch: 'both',
    stage: 0,
    stages: 10,
    teaching: { execute },
  } as unknown as CaseStudioApi;
}
function teacher({
  mode = 'teach',
  index = 0,
  comparison = null,
  exploring = false,
}: Partial<TeacherLectures['session']> = {}): TeacherLectures {
  return {
    document: {
      title: 'Translation vs tipping: follow the crown and root',
      steps: [{ title: 'Predict: position or orientation?' }, { title: 'Translation' }],
    },
    session: { mode, index, comparison, exploring, focus: true },
  } as unknown as TeacherLectures;
}
async function render(props: Parameters<typeof CaseMain>[0]) {
  await act(async () => root.render(<CaseMain {...props} />));
}
beforeEach(() => {
  execute.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it.each(['teach', 'rehearse'] as const)(
  'keeps one usable view toolbar and the complete title on static, animated and comparison %s steps',
  async mode => {
    for (const scene of [
      { index: 0, prepared: false, comparison: null, title: 'Predict: position or orientation?' },
      { index: 1, prepared: true, comparison: null, title: 'Translation' },
      {
        index: 1,
        prepared: false,
        comparison: 'tip' as const,
        title: 'Comparison · Tipping example',
      },
    ]) {
      await render({ api: api(scene.prepared), teacher: teacher({ mode, ...scene }) });
      expect(container.querySelector('.teacher-step-title > span')?.textContent).toBe(
        'Translation vs tipping: follow the crown and root',
      );
      expect(container.querySelector('h1')?.textContent).toBe(scene.title);
      expect(container.querySelectorAll('[aria-label="Lecture model view"]')).toHaveLength(1);
      expect(container.querySelector('.workspace-heading')).toBeNull();
      expect(container.querySelectorAll('[data-testid="playback"]')).toHaveLength(
        scene.prepared ? 1 : 0,
      );
      const fit = container.querySelector<HTMLButtonElement>('[aria-label="Fit model"]')!;
      await act(async () => fit.click());
      expect(execute).toHaveBeenLastCalledWith(
        [{ kind: 'presentation', action: 'fit-view' }],
        'Fit model',
      );
    }
  },
);

it('uses the existing Explore heading during a question detour without duplicating the toolbar', async () => {
  await render({ api: api(), teacher: teacher() });
  const model = container.querySelector('[data-testid="model"]');
  for (const current of [teacher({ exploring: true }), undefined]) {
    await render({ api: api(), teacher: current });
    expect(container.querySelector('.teacher-step-heading')).toBeNull();
    expect(container.querySelector('[aria-label="Lecture model view"]')).toBeNull();
    expect(container.querySelectorAll('.workspace-heading')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-label="Fit model"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="model"]')).toBe(model);
  }
});

it('shows one playback bar for authored cumulative movement and hides it in held comparisons', async () => {
  const value = { ...api(), moved: 1 };
  await render({ api: value, teacher: teacher() });
  expect(container.querySelectorAll('[data-testid="playback"]')).toHaveLength(1);
  await render({ api: { ...value, moved: 0 }, teacher: teacher({ comparison: 'finish' }) });
  expect(container.querySelectorAll('[data-testid="playback"]')).toHaveLength(0);
  expect(container.querySelector('h1')?.textContent).toBe('Comparison · Finished arrangement');
});

it('bounds the lecture popup to its full heading instead of inheriting the narrow-screen View offset', async () => {
  container.className = 'app-shell studio-experience teaching-studio lecture-opening';
  await render({ api: api(), teacher: teacher() });
  const inherited = document.createElement('style');
  const scoped = document.createElement('style');
  inherited.textContent = readFileSync('src/components/case/lecture-opening.css', 'utf8');
  document.head.append(inherited);
  try {
    // JSDOM has no viewport layout. Activate the actual mobile rule to test the CSS contract.
    const mobile = [...inherited.sheet!.cssRules].find(
      rule => 'conditionText' in rule && rule.conditionText === '(max-width: 700px)',
    ) as CSSMediaRule;
    expect(mobile).toBeDefined();
    inherited.textContent += [...mobile.cssRules].map(rule => rule.cssText).join('\n');
    const menu = container.querySelector<HTMLDetailsElement>('.opening-view-menu')!;
    const popup = container.querySelector<HTMLElement>('.opening-view-content')!;
    await act(async () => menu.querySelector('summary')!.click());
    expect(getComputedStyle(menu).position).toBe('relative');
    expect(getComputedStyle(popup).right).toBe('-48px');

    scoped.textContent = readFileSync(
      'src/components/lecture-builder/teacher-workspace.css',
      'utf8',
    );
    document.head.append(scoped);
    expect(getComputedStyle(container.querySelector('.teacher-step-heading')!).position).toBe(
      'relative',
    );
    expect(getComputedStyle(menu).position).toBe('static');
    expect(getComputedStyle(popup).position).toBe('absolute');
    expect(getComputedStyle(popup).right).toBe('0px');
    expect(getComputedStyle(popup).width).toBe('min(320px, 100%)');
  } finally {
    scoped.remove();
    inherited.remove();
  }
});
