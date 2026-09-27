// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { getGlossaryEntry, GLOSSARY_DISCLAIMER } from '@/lib/glossary';
import { glossaryActions } from '@/lib/glossary/plan';
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
async function render(glossaryId: string | null) {
  await act(async () => root.render(<GlossaryCard api={{ glossaryId, teaching: { execute } }} />));
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
it('closes through the shared runtime and unmounts when state clears', async () => {
  await render('torque');
  await act(async () => host.querySelector<HTMLButtonElement>('header button')!.click());
  expect(execute).toHaveBeenCalledWith([{ kind: 'glossary', id: null }], 'Close the definition');
  await render(null);
  expect(host.childElementCount).toBe(0);
});
