// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BoxGeometry } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DentalCase } from '@/lib/geometry';
import type { MechanicsAction, MechanicsExperiment } from '@/lib/mechanics/types';
import { createMechanicsExperiment, transitionMechanics } from '@/lib/mechanics/state';
import { solveMechanics } from '@/lib/mechanics/solver';
import { bracketPlacementLocal } from '@/lib/bracket-placement';
import { BracketPlacementPanel } from './BracketPlacementPanel';

let root: Root, host: HTMLDivElement, model: DentalCase, experiment: MechanicsExperiment;
const onActions = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  model = {
    name: 'Placement UI rig',
    demo: true,
    gums: [],
    teeth: ['11', '21'].map((id, index) => ({
      id,
      name: id,
      geometry: new BoxGeometry(4, 6, 2),
      position: [index * 10, 0, 0],
      buccal: [0, 0, 1],
      mesial: [1, 0, 0],
      occlusal: [0, 1, 0],
      calibrated: true,
    })),
  };
  experiment = createMechanicsExperiment(model);
  const setup: MechanicsAction[] = [
    { type: 'brackets', teeth: ['11', '21'], installed: true },
    {
      type: 'wire',
      id: 'wire',
      teeth: ['11', '21'],
      material: 'beta-titanium',
      section: { shape: 'round', diameterMm: 0.3 },
    },
    {
      type: 'bracket-position',
      tooth: '11',
      local: bracketPlacementLocal(model.teeth[0], 0, 0.1),
      angleDeg: 1,
    },
  ];
  experiment = setup.reduce(transitionMechanics, experiment);
  experiment = { ...experiment, result: solveMechanics(experiment) };
  onActions.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  model.teeth.forEach(tooth => tooth.geometry.dispose());
  vi.unstubAllGlobals();
});
const render = () =>
  act(async () =>
    root.render(
      <BracketPlacementPanel
        config={experiment.config}
        referenceTeeth={experiment.reference.teeth}
        teeth={model.teeth}
        selectedIds={['11']}
        hasResult={!!experiment.result}
        onActions={onActions}
      />,
    ),
  );
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(
    item => item.textContent?.trim() === label,
  )!;
  await act(async () => button.click());
}
async function edit(label: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it.each(['Reset position & angle', 'Apply position'])(
  'allows %s to remove the sole solved activation without a passive solve rollback',
  async button => {
    expect(experiment.result!.diagnostics.maxDisplacementMm).toBeGreaterThan(0);
    const reference = structuredClone(experiment.reference);
    await render();
    if (button === 'Apply position') {
      await edit('Bracket height offset in millimetres', '0');
      await edit('Bracket angle on crown in degrees', '0');
    }
    await click(button);
    const actions = onActions.mock.calls[0][0] as MechanicsAction[];
    expect(() => actions.reduce(transitionMechanics, experiment)).not.toThrow();
    expect(actions).toHaveLength(1);
    const neutral = actions.reduce(transitionMechanics, experiment);
    expect(neutral.result).toBeNull();
    expect(neutral.config.brackets['11']).toEqual(reference.teeth[0].bracketLocal);
    expect(neutral.config.bracketAngles).toBeUndefined();
    expect(neutral.reference).toEqual(reference);
    expect(solveMechanics(neutral).diagnostics.maxDisplacementMm).toBe(0);
  },
);

it.each(['wire', 'elastic', 'expander', 'other-bracket'] as const)(
  'retains recalculation when %s activation remains after reset',
  async kind => {
    const remaining: Record<typeof kind, MechanicsAction> = {
      wire: { type: 'wire-activation', id: 'wire', expansionMm: 0.1 },
      elastic: {
        type: 'elastic',
        id: 'elastic',
        from: { kind: 'tooth', tooth: '11', local: experiment.config.brackets['11'] },
        to: { kind: 'tooth', tooth: '21', local: experiment.config.brackets['21'] },
        law: { kind: 'constant', forceN: 0.01 },
      },
      expander: {
        type: 'expander',
        id: 'expander',
        left: ['21'],
        right: ['11'],
        activationMm: 0.1,
        stiffnessNPerMm: 1,
      },
      'other-bracket': {
        type: 'bracket-position',
        tooth: '21',
        local: experiment.config.brackets['21'],
        angleDeg: 0.5,
      },
    };
    experiment = transitionMechanics(experiment, remaining[kind]);
    experiment = { ...experiment, result: solveMechanics(experiment) };
    await render();
    await click('Reset position & angle');
    const actions = onActions.mock.calls[0][0] as MechanicsAction[];
    expect(actions.map(action => action.type)).toEqual(['bracket-position', 'solve']);
    expect(() => actions.reduce(transitionMechanics, experiment)).not.toThrow();
  },
);

it('preserves the exact committed slot when only an angle field changes', async () => {
  const exactLocal = bracketPlacementLocal(model.teeth[0], 0.123456789, 0.100000000004);
  experiment = transitionMechanics(experiment, {
    type: 'bracket-position',
    tooth: '11',
    local: exactLocal,
    angleDeg: 1,
  });
  await render();
  await edit('Bracket angle on crown in degrees', '2');
  await click('Apply position');
  expect(onActions.mock.calls[0][0][0].local).toEqual(exactLocal);
});

it('keeps an untouched coordinate and angle exact when changing the other position field', async () => {
  const local = bracketPlacementLocal(model.teeth[0], 0.123456789123, 0.1);
  experiment = transitionMechanics(experiment, {
    type: 'bracket-position',
    tooth: '11',
    local,
    angleDeg: 1.123456789123,
  });
  await render();
  await edit('Bracket height offset in millimetres', '0.2');
  await click('Apply position');
  const action = onActions.mock.calls[0][0][0];
  expect(action.local[0]).toBe(local[0]);
  expect(action.angleDeg).toBe(1.123456789123);
});

it('does not treat floating-point noise at the placement boundary as an invalid offset', async () => {
  const local = bracketPlacementLocal(model.teeth[0], 2, 0.1);
  local[0] += Number.EPSILON * 2;
  experiment = transitionMechanics(experiment, { type: 'bracket-position', tooth: '11', local });
  await render();
  await edit('Bracket height offset in millimetres', '0.2');
  await click('Apply position');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(onActions).toHaveBeenCalledOnce();
  expect(onActions.mock.calls[0][0][0].local[0]).toBe(2);
});
