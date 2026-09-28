// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { getGlossaryEntry, GLOSSARY_DISCLAIMER } from '@/lib/glossary';
import { glossaryActions } from '@/lib/glossary/plan';
import { parseTeachingPlan, type TeachingContext } from '@/lib/classroom';
import { advance } from '@/lib/classroom/advance';
import type { ToothStudyContext } from '@/lib/tooth-study/types';
import { GlossaryCard } from './GlossaryCard';

let root: Root, host: HTMLDivElement;
const execute = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  execute.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(
  glossaryId: string | null,
  toothStudy: Pick<ToothStudyContext, 'tooth' | 'view'> | null = null,
) {
  await act(async () =>
    root.render(<GlossaryCard api={{ glossaryId, toothStudy, teaching: { execute } }} />),
  );
}
it('renders the full authored definition, review status and related buttons', async () => {
  await render('cusp-of-carabelli');
  const entry = getGlossaryEntry('cusp-of-carabelli')!;
  expect(host.querySelector('h2')?.textContent).toBe(entry.term);
  expect(host.textContent).toContain(entry.definition);
  expect(host.textContent).toContain(GLOSSARY_DISCLAIMER);
  const related = [...host.querySelectorAll<HTMLButtonElement>('nav button')];
  expect(related).toHaveLength(entry.related.length);
  for (const button of related) await act(async () => button.click());
  expect(execute.mock.calls.map(call => call[0])).toEqual(entry.related.map(glossaryActions));
});
it('keeps the current tooth for related surfaces just like typed or spoken commands', async () => {
  const context: TeachingContext = {
    mode: 'case',
    workflowId: null,
    stepIndex: -1,
    selected: '46',
    selectedIds: ['46'],
    availableIds: ['11', '16', '46'],
    synthetic: true,
    revision: 0,
    view: 'perspective',
    arch: 'lower',
    speed: 1,
    toothStudy: { tooth: '46', view: 'mesial' },
    glossaryId: 'mesial',
  };
  await render('mesial');
  await render('mesial', context.toothStudy!);
  const distal = [...host.querySelectorAll<HTMLButtonElement>('nav button')].find(
    button => button.textContent === 'Distal',
  )!;
  await act(async () => distal.click());
  const actions = execute.mock.calls[0][0];
  expect(actions).toEqual(parseTeachingPlan('what is distal', context).actions);
  for (const action of actions)
    advance(context, action, { arch: false, view: false, selection: false });
  expect(context.toothStudy).toEqual({ tooth: '46', view: 'distal' });

  await render('mesial');
  await act(async () => distal.click());
  expect(execute.mock.calls[1][0]).toEqual([
    { kind: 'tooth-study', action: 'open', tooth: '16', view: 'distal' },
    { kind: 'glossary', id: 'distal' },
  ]);
});
it('closes through the shared runtime and unmounts when state clears', async () => {
  await render('torque');
  await act(async () => host.querySelector<HTMLButtonElement>('header button')!.click());
  expect(execute).toHaveBeenCalledWith([{ kind: 'glossary', id: null }], 'Close the definition');
  await render(null);
  expect(host.childElementCount).toBe(0);
});

it.each(['periodontal-ligament', 'alveolar-bone'])(
  'shows separate supported biology illustrations for %s',
  async id => {
    await render(id);
    expect(host.querySelector('[aria-label="Illustrative tissue biology"]')).not.toBeNull();
    expect(host.querySelectorAll('svg[role="img"]')).toHaveLength(2);
  },
);
