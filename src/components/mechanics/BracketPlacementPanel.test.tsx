// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BoxGeometry } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DentalTooth } from '@/lib/geometry';
import type { MechanicsConfig } from '@/lib/mechanics/types';
import {
  bracketPlacementLocal,
  bracketPlacementOffsets,
  bracketSlotLocal,
} from '@/lib/bracket-placement';
import { BracketPlacementPanel } from './BracketPlacementPanel';

let root: Root, container: HTMLDivElement;
let teeth: DentalTooth[], config: MechanicsConfig;
const onActions = vi.fn();
const geometries: BoxGeometry[] = [];
const tooth = (id: string, size = 6): DentalTooth => {
  const geometry = new BoxGeometry(size, size, 2);
  geometries.push(geometry);
  return {
    id,
    name: `Tooth ${id}`,
    geometry,
    position: [0, 0, 0],
    buccal: [0, 0, 1],
    mesial: [1, 0, 0],
    occlusal: [0, 1, 0],
    calibrated: true,
  };
};
const render = (selectedIds = ['11'], hasResult = false, disabled = false) =>
  act(async () =>
    root.render(
      <BracketPlacementPanel
        teeth={teeth}
        config={config}
        referenceTeeth={teeth.map(tooth => ({
          id: tooth.id,
          bracketLocal: bracketSlotLocal(tooth),
        }))}
        selectedIds={selectedIds}
        hasResult={hasResult}
        disabled={disabled}
        onActions={onActions}
      />,
    ),
  );
const input = (label: string) =>
  container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
const mesialLabel = 'Bracket mesial offset in millimetres',
  heightLabel = 'Bracket height offset in millimetres',
  angleLabel = 'Bracket angle on crown in degrees';
const edit = (label: string, value: string) =>
  act(async () => {
    const element = input(label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
const button = (text: string) =>
  [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === text)!;
const click = (text: string) => act(async () => button(text).click());

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  teeth = [tooth('11'), tooth('21')];
  config = {
    brackets: Object.fromEntries(teeth.map(item => [item.id, bracketSlotLocal(item)])),
    wires: [],
    elastics: [],
    tads: [],
    expanders: [],
    fixedTeeth: [],
    support: 'standard',
  };
  onActions.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  geometries.splice(0).forEach(geometry => geometry.dispose());
  vi.unstubAllGlobals();
});

it('keeps placement advanced and only exposes it for one installed bracket', async () => {
  expect(container.querySelector('details')!.open).toBe(false);
  expect(input(mesialLabel).value).toBe('0');
  expect(container.textContent).toContain('Positive: toward the biting edge');
  expect(container.textContent).toContain('not a wire torque prescription');
  expect(container.textContent).toContain('Placement alone applies no force');
  await render(['11', '21']);
  expect(container.querySelector('details')).toBeNull();
  await click('Install brackets');
  expect(onActions).toHaveBeenLastCalledWith(
    [{ type: 'brackets', teeth: ['11', '21'], installed: true }],
    expect.any(String),
  );
  config = { ...config, brackets: {} };
  await render();
  expect(container.querySelector('input')).toBeNull();
});

it('submits the surface-conforming slot and angle together without inventing a calculation', async () => {
  await edit(mesialLabel, '0.7');
  await edit(heightLabel, '-0.5');
  await edit(angleLabel, '4');
  await click('Apply position');
  const actions = onActions.mock.calls[0][0];
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({ type: 'bracket-position', tooth: '11', angleDeg: 4 });
  const offsets = bracketPlacementOffsets(teeth[0], actions[0].local);
  expect(offsets.mesialMm).toBeCloseTo(0.7);
  expect(offsets.occlusalMm).toBeCloseTo(-0.5);
  expect(config.brackets['11']).toEqual(bracketSlotLocal(teeth[0]));
});

it('recalculates only an existing result in the same request', async () => {
  config = {
    ...config,
    wires: [
      {
        id: 'wire',
        teeth: ['11', '21'],
        material: 'beta-titanium',
        section: { shape: 'round', diameterMm: 0.3 },
        expansionMm: 0,
        torqueDeg: 0,
      },
    ],
  };
  await render(['11'], true);
  await edit(angleLabel, '-6');
  await click('Apply position');
  expect(onActions).toHaveBeenCalledOnce();
  expect(onActions.mock.calls[0][0]).toEqual([
    { type: 'bracket-position', tooth: '11', local: bracketSlotLocal(teeth[0]), angleDeg: -6 },
    { type: 'solve' },
  ]);
});

it('preserves unfinished typing through unrelated updates and refreshes selection or committed changes', async () => {
  await act(async () => container.querySelector('summary')!.click());
  await edit(mesialLabel, '1.2');
  await edit(heightLabel, '');
  config = { ...config, brackets: { ...config.brackets }, fixedTeeth: ['21'] };
  await render();
  expect(input(mesialLabel).value).toBe('1.2');
  expect(input(heightLabel).value).toBe('');
  expect(button('Apply position').disabled).toBe(true);
  await render(['21']);
  expect(input(mesialLabel).value).toBe('0');
  config = {
    ...config,
    brackets: { ...config.brackets, '21': bracketPlacementLocal(teeth[1], -0.4, 0.6) },
    bracketAngles: { '21': 3 },
  };
  await render(['21']);
  expect(input(mesialLabel).value).toBe('-0.4');
  expect(input(heightLabel).value).toBe('0.6');
  expect(input(angleLabel).value).toBe('3');
  expect(container.querySelector('details')!.open).toBe(true);
  // Undo restores the old committed configuration, including the default angle.
  config = {
    ...config,
    brackets: { ...config.brackets, '21': bracketSlotLocal(teeth[1]) },
    bracketAngles: {},
  };
  await render(['21']);
  expect(input(mesialLabel).value).toBe('0');
  expect(input(angleLabel).value).toBe('0');
});

it('resets both authored placement and angle as one request', async () => {
  config = {
    ...config,
    brackets: { ...config.brackets, '11': bracketPlacementLocal(teeth[0], 0.8, -0.3) },
    bracketAngles: { '11': 5 },
  };
  await render(['11'], true);
  await click('Reset position & angle');
  expect(onActions.mock.calls[0][0]).toEqual([
    { type: 'bracket-position', tooth: '11', local: bracketSlotLocal(teeth[0]), angleDeg: 0 },
  ]);
});

it('rejects out-of-range and off-crown drafts without sending an action', async () => {
  await edit(angleLabel, '11');
  expect(button('Apply position').disabled).toBe(true);
  await click('Apply position');
  expect(onActions).not.toHaveBeenCalled();
  teeth = [tooth('11', 2)];
  config = { ...config, brackets: { '11': bracketSlotLocal(teeth[0]) } };
  await render();
  await edit(mesialLabel, '1.5');
  await click('Apply position');
  expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/crown|surface/i);
  expect(onActions).not.toHaveBeenCalled();
});

it('locks edits while busy and preserves install/remove without automatic solve', async () => {
  await render(['11'], true, true);
  expect(
    [...container.querySelectorAll('input, button')].every(
      element => (element as HTMLInputElement).disabled,
    ),
  ).toBe(true);
  await render(['11'], true);
  await click('Remove');
  expect(onActions.mock.calls[0][0]).toEqual([
    { type: 'brackets', teeth: ['11'], installed: false },
  ]);
});
