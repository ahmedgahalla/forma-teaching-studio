import { describe, expect, it } from 'vitest';
import { advanceMechanicsContext, type MechanicsSceneContext } from './mechanics-commands';
import { validateMechanicsAction } from './mechanics';

function scene(): MechanicsSceneContext {
  return {
    mode: 'case',
    synthetic: true,
    selected: '11',
    selectedIds: ['11'],
    availableIds: ['11', '21', '12'],
    mechanics: {
      config: {
        brackets: { '11': [0, 0, 3], '21': [0, 0, 3] },
        wires: [
          {
            id: 'wire-1',
            teeth: ['11', '21'],
            material: 'stainless-steel',
            section: { shape: 'round', diameterMm: 0.4 },
            expansionMm: 0,
            torqueDeg: 0,
          },
        ],
        tads: [],
        elastics: [],
        expanders: [],
        support: 'standard',
        fixedTeeth: [],
      },
      bracketAnchors: { '11': [0, 0, 3], '21': [0, 0, 3], '12': [0, 0, 3] },
      focus: {},
      stageIndex: -1,
      stageCount: 0,
      hasResult: false,
    },
  };
}

describe('bracket configuration in compound request preflight', () => {
  it.each([
    { local: [0, 0.5, 3], angleDeg: 0 },
    { local: [0, 0, 3], angleDeg: 5 },
  ])('allows calculating a reference wire activated by a bracket edit %j', input => {
    const current = scene();
    const anchors = structuredClone(current.mechanics!.bracketAnchors);
    const action = validateMechanicsAction({ type: 'bracket-position', tooth: '11', ...input });
    advanceMechanicsContext(current, action);
    advanceMechanicsContext(current, { type: 'solve' });
    expect(current.mechanics!.hasResult).toBe(true);
    expect(current.mechanics!.bracketAnchors).toEqual(anchors);
  });
  it('preserves angle on a position-only edit and removes it on explicit reset', () => {
    const current = scene();
    advanceMechanicsContext(current, {
      type: 'bracket-position',
      tooth: '11',
      local: [0, 0, 3],
      angleDeg: 4,
    });
    advanceMechanicsContext(current, { type: 'bracket-position', tooth: '11', local: [0, 0.5, 3] });
    expect(current.mechanics!.config.bracketAngles).toEqual({ '11': 4 });
    advanceMechanicsContext(current, {
      type: 'bracket-position',
      tooth: '11',
      local: [0, 0, 3],
      angleDeg: 0,
    });
    expect(current.mechanics!.config.bracketAngles).toBeUndefined();
    expect(() => advanceMechanicsContext(current, { type: 'solve' })).toThrow(
      /activation|placement/,
    );
  });
  it('does not treat an unwired bracket as an active wire', () => {
    const current = scene();
    advanceMechanicsContext(current, { type: 'brackets', teeth: ['12'], installed: true });
    advanceMechanicsContext(current, {
      type: 'bracket-position',
      tooth: '12',
      local: [0, 1, 3],
      angleDeg: 8,
    });
    expect(() => advanceMechanicsContext(current, { type: 'solve' })).toThrow(
      /activation|placement/,
    );
    advanceMechanicsContext(current, { type: 'brackets', teeth: ['12'], installed: false });
    expect(current.mechanics!.config.bracketAngles).toBeUndefined();
    expect(current.mechanics!.config.brackets['12']).toBeUndefined();
  });
});
