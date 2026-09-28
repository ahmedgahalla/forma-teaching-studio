// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  BIOLOGY_LIMITS,
  BIOLOGY_SCOPE,
  BIOLOGY_SOURCES,
  type BiologyView,
} from '@/lib/teaching-biology';
import { BiologyIllustration, RemodelingDiagram } from './RemodelingDiagram';

let root: Root, container: HTMLDivElement;
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
function button(label: string) {
  const found = [...container.querySelectorAll('button')].find(item => item.textContent === label);
  expect(found, `button ${label}`).toBeDefined();
  return found!;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function diagramNames() {
  return [...container.querySelectorAll('svg title')].map(item => item.textContent);
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

it('switches between separate tissue examples and delegates closing independently', async () => {
  const close = vi.fn(),
    changed = vi.fn();
  function Harness() {
    const [view, setView] = useState<BiologyView>('overview');
    return (
      <RemodelingDiagram
        view={view}
        onClose={close}
        onViewChange={next => {
          changed(next);
          setView(next);
        }}
      />
    );
  }
  await render(<Harness />);
  expect(diagramNames()).toHaveLength(2);
  expect(button('Both').getAttribute('aria-pressed')).toBe('true');
  await click('Compression');
  expect(changed).toHaveBeenLastCalledWith('compression');
  expect(diagramNames()).toEqual(['Compression: local PDL and bone response']);
  await click('Tension');
  expect(changed).toHaveBeenLastCalledWith('tension');
  expect(diagramNames()).toEqual(['Tension: local PDL and bone response']);
  expect(close).not.toHaveBeenCalled();
  await click('Both');
  expect(diagramNames()).toHaveLength(2);
  await click('Close biology');
  expect(close).toHaveBeenCalledOnce();
  expect(changed).toHaveBeenCalledTimes(3);
});

it('leaves the view controlled by its parent until the requested change is supplied', async () => {
  const changed = vi.fn();
  await render(<RemodelingDiagram view="overview" onViewChange={changed} onClose={vi.fn()} />);
  await click('Compression');
  expect(changed).toHaveBeenCalledWith('compression');
  expect(diagramNames()).toHaveLength(2);
  expect(button('Both').getAttribute('aria-pressed')).toBe('true');
});

it.each(['overview', 'compression', 'tension'] as const)(
  'keeps scope, evidence and accessible descriptions in %s',
  async view => {
    await render(<BiologyIllustration view={view} />);
    expect(container.textContent).toContain(BIOLOGY_SCOPE);
    expect(container.textContent).toContain(BIOLOGY_LIMITS);
    expect(container.querySelector('button, input, select, canvas')).toBeNull();
    expect([...container.querySelectorAll('a')].map(link => link.href)).toEqual(
      BIOLOGY_SOURCES.map(source => source.url),
    );
    for (const graphic of container.querySelectorAll('svg')) {
      expect(graphic.getAttribute('role')).toBe('img');
      for (const id of graphic.getAttribute('aria-labelledby')!.split(' '))
        expect(document.getElementById(id)?.textContent).toBeTruthy();
    }
  },
);

it('renders public evidence as text with no interactive elements for the audience', async () => {
  await render(<BiologyIllustration view="overview" audience />);
  expect(container.querySelector('a, button, input, select, details, [tabindex]')).toBeNull();
  expect(container.textContent).toContain(BIOLOGY_SCOPE);
  expect(diagramNames()).toHaveLength(2);
  for (const source of BIOLOGY_SOURCES) {
    expect(container.textContent).toContain(source.label);
    expect(container.textContent).toContain(source.evidence);
  }
});

it('keeps SVG descriptions and pattern references unique when presenter and audience coexist', async () => {
  await render(
    <>
      <BiologyIllustration view="overview" />
      <BiologyIllustration view="overview" />
    </>,
  );
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const graphic of container.querySelectorAll('svg')) {
    for (const node of graphic.querySelectorAll('[fill^="url"], [marker-end]')) {
      const value = node.getAttribute('fill')?.startsWith('url')
        ? node.getAttribute('fill')!
        : node.getAttribute('marker-end')!;
      const target = document.getElementById(value.slice(5, -1));
      expect(target?.closest('svg')).toBe(graphic);
    }
  }
});
