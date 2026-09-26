// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLayoutState } from './state';

let root: Root, container: HTMLDivElement;

function Harness() {
  const { mobilePanel, setMobilePanel, toolsOpen, setToolsOpen } = useLayoutState();
  return (
    <>
      <output>{JSON.stringify({ mobilePanel, toolsOpen })}</output>
      <button onClick={() => setToolsOpen(true)}>Open editing tools</button>
      <button onClick={() => setToolsOpen(false)}>Close editing tools</button>
      {(['model', 'selection', 'layers', 'tools'] as const).map(panel => (
        <button key={panel} onClick={() => setMobilePanel(panel)}>
          {panel}
        </button>
      ))}
    </>
  );
}

const state = () => JSON.parse(container.querySelector('output')!.textContent!);
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    item => item.textContent === label,
  )!;
  await act(async () => {
    button.click();
  });
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Harness />);
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

it('opens on the model with editing tools closed', () => {
  expect(state()).toEqual({ mobilePanel: 'model', toolsOpen: false });
});

it('coordinates opening and closing editing tools with the active panel', async () => {
  await click('Open editing tools');
  expect(state()).toEqual({ mobilePanel: 'tools', toolsOpen: true });
  await click('Close editing tools');
  expect(state()).toEqual({ mobilePanel: 'model', toolsOpen: false });
});

it.each(['selection', 'model'])('closes editing tools when switching to %s', async panel => {
  await click('Open editing tools');
  await click(panel);
  expect(state()).toEqual({ mobilePanel: panel, toolsOpen: false });
});

it('keeps the layers panel open when editing tools are closed elsewhere', async () => {
  await click('layers');
  await click('Close editing tools');
  expect(state()).toEqual({ mobilePanel: 'layers', toolsOpen: false });
});

it('enables editing tools when the panel navigation selects them', async () => {
  await click('tools');
  expect(state()).toEqual({ mobilePanel: 'tools', toolsOpen: true });
});
