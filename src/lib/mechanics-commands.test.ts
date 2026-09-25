import { describe, expect, it } from 'vitest';
import {
  parseTeachingPlan,
  validateTeachingPlan,
  interpreterTeachingContext,
  teachingActionMode,
  type TeachingContext,
} from './classroom';
import {
  advanceMechanicsContext,
  reduceMechanicsFocus,
  type MechanicsCommandContext,
} from './mechanics-commands';
import type { TeachingAction } from './lecture';

const ids = ['13', '12', '11', '21', '22', '23', '16', '26', '31'];
function setup(): TeachingContext {
  const mechanics: MechanicsCommandContext = {
    config: {
      brackets: {},
      wires: [],
      tads: [],
      elastics: [],
      expanders: [],
      support: 'standard',
      fixedTeeth: [],
    },
    bracketAnchors: Object.fromEntries(ids.map(id => [id, [0, 0, 3]])),
    focus: {},
    stageIndex: 0,
    stageCount: 1,
    hasResult: false,
    wirePreset: { material: 'stainless-steel', section: { shape: 'round', diameterMm: 0.4 } },
  };
  return {
    mode: 'case',
    workflowId: null,
    stepIndex: 0,
    selected: '11',
    selectedIds: ['11', '21'],
    availableIds: [...ids],
    synthetic: true,
    revision: 2,
    view: 'perspective',
    arch: 'both',
    speed: 1,
    mechanics,
    pointed: { tooth: '11', localPoint: [1, 2, 3], worldPoint: [6, 7, 8] },
  };
}
const mechanical = (text: string, context: TeachingContext) =>
  parseTeachingPlan(text, context)
    .actions.filter(
      (action): action is Extract<TeachingAction, { kind: 'mechanics' }> =>
        action.kind === 'mechanics',
    )
    .map(action => action.action);
function withWire(): TeachingContext {
  const context = setup();
  context.mechanics!.config.brackets = { '11': [0, 0, 3], '21': [0, 0, 3] };
  context.mechanics!.config.wires.push({
    id: 'wire-1',
    teeth: ['11', '21'],
    material: 'stainless-steel',
    section: { shape: 'round', diameterMm: 0.4 },
    expansionMm: 0.1,
    torqueDeg: 0,
  });
  context.mechanics!.focus.wireId = 'wire-1';
  return context;
}

describe('conversational appliance configuration', () => {
  it('accepts a terminal courtesy phrase without changing the contextual bracket targets', () => {
    const context = setup(),
      sourceText = 'Could you put brackets on these teeth for me?';
    const expected: TeachingAction[] = [
      { kind: 'mechanics', action: { type: 'brackets', teeth: ['11', '21'], installed: true } },
    ];
    expect(parseTeachingPlan(sourceText, context).actions).toEqual(expected);
    expect(
      validateTeachingPlan(
        {
          actions: expected,
          summary: 'Install brackets on the selected teeth.',
          clarification: null,
        },
        context,
        { sourceText },
      ).actions,
    ).toEqual(expected);
    expect(() =>
      validateTeachingPlan(
        {
          actions: [
            { kind: 'mechanics', action: { type: 'brackets', teeth: ['16'], installed: true } },
          ],
          summary: '',
          clarification: null,
        },
        context,
        { sourceText },
      ),
    ).toThrow(/targets/);
    expect(
      parseTeachingPlan('put brackets on these teeth except 11 for me', context),
    ).toMatchObject({ actions: [], clarification: expect.any(String) });
    expect(
      parseTeachingPlan(sourceText, { ...context, selectedIds: [], selected: '' }),
    ).toMatchObject({ actions: [], clarification: expect.any(String) });
  });
  it.each([
    'Please thread a wire through these brackets.',
    'Could you put a wire through these brackets?',
    'Please install a wire through these brackets.',
  ])('accepts the single passive wire instruction: %s', sourceText => {
    const context = setup();
    context.mechanics!.config.brackets = { '11': [0, 0, 3], '21': [0, 0, 3] };
    const expected: TeachingAction[] = [
      {
        kind: 'mechanics',
        action: {
          type: 'wire',
          id: 'wire-1',
          teeth: ['11', '21'],
          material: 'stainless-steel',
          section: { shape: 'round', diameterMm: 0.4 },
        },
      },
    ];
    const plan = {
      actions: expected,
      summary: 'Install the selected wire preset.',
      clarification: null,
    };
    expect(parseTeachingPlan(sourceText, context).actions).toEqual(expected);
    expect(validateTeachingPlan(plan, context, { sourceText }).actions).toEqual(expected);
    expect(() =>
      validateTeachingPlan(
        { ...plan, actions: [...expected, { kind: 'mechanics', action: { type: 'solve' } }] },
        context,
        { sourceText },
      ),
    ).toThrow(/targets/);
    expect(() =>
      validateTeachingPlan(
        {
          ...plan,
          actions: [
            {
              kind: 'mechanics',
              action: {
                type: 'wire',
                id: 'wire-1',
                teeth: ['11', '21'],
                material: 'stainless-steel',
                section: { shape: 'round', diameterMm: 0.5 },
              },
            },
          ],
        },
        context,
        { sourceText },
      ),
    ).toThrow(/values/);
  });
  it('preserves gingiva pointing metadata and uses the associated tooth for brackets but the actual point for a TAD', () => {
    const context = setup();
    context.selectedIds = ['21'];
    context.pointed!.surface = 'gingiva';
    expect(mechanical('install brackets here', context)).toEqual([
      { type: 'brackets', teeth: ['11'], installed: true },
    ]);
    expect(mechanical('put a TAD here', context)).toEqual([
      { type: 'tad', id: 'tad-1', position: [6, 7, 8] },
    ]);
    expect(interpreterTeachingContext(context).pointed?.surface).toBe('gingiva');
    expect(() =>
      validateTeachingPlan(
        { actions: [{ kind: 'view', view: 'right' }], summary: '', clarification: null },
        { ...context, pointed: { ...context.pointed!, surface: 'unknown' as 'gingiva' } },
      ),
    ).toThrow(/valid location/);
  });
  it('uses the pointed highlighted group, then creates a wire through those brackets without movement', () => {
    const context = setup(),
      original = structuredClone(context);
    expect(
      mechanical('install brackets here and put a wire through these brackets', context),
    ).toEqual([
      { type: 'brackets', teeth: ['11', '21'], installed: true },
      {
        type: 'wire',
        id: 'wire-1',
        teeth: ['11', '21'],
        material: 'stainless-steel',
        section: { shape: 'round', diameterMm: 0.4 },
      },
    ]);
    expect(context).toEqual(original);
  });
  it('resolves a selection made earlier in the same request', () => {
    const actions = parseTeachingPlan(
      'select upper anterior teeth then install brackets on them and put a wire through these brackets',
      setup(),
    ).actions;
    expect(actions[0]).toEqual({ kind: 'select', teeth: ['13', '12', '11', '21', '22', '23'] });
    expect(actions[1]).toEqual({
      kind: 'mechanics',
      action: { type: 'brackets', teeth: ['13', '12', '11', '21', '22', '23'], installed: true },
    });
    expect(actions).toHaveLength(3);
    expect(mechanical('show upper arch then install brackets on molars', setup())).toEqual([
      { type: 'brackets', teeth: ['16', '26'], installed: true },
    ]);
    expect(
      mechanical(
        'install brackets on the upper anterior segment then put a wire through these brackets',
        setup(),
      ),
    ).toHaveLength(2);
  });
  it('keeps target reference and appliance focus stable after a camera change', () => {
    const context = withWire();
    expect(
      parseTeachingPlan('show right view and use a 0.5 mm wire instead', context).actions,
    ).toEqual([
      { kind: 'view', view: 'right' },
      {
        kind: 'mechanics',
        action: {
          type: 'wire-section',
          id: 'wire-1',
          section: { shape: 'round', diameterMm: 0.5 },
        },
      },
    ]);
    expect(
      mechanical('use a beta titanium wire instead', { ...context, view: 'occlusal' }),
    ).toEqual([{ type: 'wire-material', id: 'wire-1', material: 'beta-titanium' }]);
  });
  it('replaces wire dimensions and recalculates rather than adding an increment', () => {
    const context = withWire();
    context.mechanics!.hasResult = true;
    context.mechanics!.focus.lastParameter = 'wire-section';
    const actions = mechanical('make that 0.5 mm instead', context);
    expect(actions).toEqual([
      { type: 'wire-section', id: 'wire-1', section: { shape: 'round', diameterMm: 0.5 } },
      { type: 'solve' },
    ]);
    for (const action of actions) advanceMechanicsContext(context, action);
    expect(context.mechanics!.config.wires[0].section).toEqual({ shape: 'round', diameterMm: 0.5 });
    expect(context.mechanics!.config.wires[0].expansionMm).toBe(0.1);
  });
  it.each([false, true])(
    'uses one solve for replacement followed immediately by an explicit solve (existing result: %s)',
    hasResult => {
      const context = withWire();
      context.mechanics!.hasResult = hasResult;
      const sourceText = 'Use a 0.018 inch wire instead, then show me what happens.';
      const expected: TeachingAction[] = [
        {
          kind: 'mechanics',
          action: {
            type: 'wire-section',
            id: 'wire-1',
            section: { shape: 'round', diameterMm: 0.018 * 25.4 },
          },
        },
        { kind: 'mechanics', action: { type: 'solve' } },
      ];
      const plan = {
        actions: expected,
        summary: 'Replace the wire and recalculate.',
        clarification: null,
      };
      expect(parseTeachingPlan(sourceText, context).actions).toEqual(expected);
      expect(validateTeachingPlan(plan, context, { sourceText }).actions).toEqual(expected);
      expect(() =>
        validateTeachingPlan({ ...plan, actions: expected.slice(0, 1) }, context, { sourceText }),
      ).toThrow(/omitted/);
      expect(() =>
        validateTeachingPlan({ ...plan, actions: [...expected, expected[1]] }, context, {
          sourceText,
        }),
      ).toThrow(/must match/);
      expect(() =>
        validateTeachingPlan(
          {
            ...plan,
            actions: [
              {
                kind: 'mechanics',
                action: {
                  type: 'wire-section',
                  id: 'wire-1',
                  section: { shape: 'round', diameterMm: 0.5 },
                },
              },
              expected[1],
            ],
          },
          context,
          { sourceText },
        ),
      ).toThrow(/must match/);
    },
  );
  it('does not merge a later explicit solve across an intervening presentation instruction', () => {
    const context = withWire();
    context.mechanics!.hasResult = true;
    const sourceText = 'use a 0.018 inch wire instead then hide gums then show what happens';
    const plan = parseTeachingPlan(sourceText, context);
    expect(
      plan.actions.map(action => (action.kind === 'mechanics' ? action.action.type : action.kind)),
    ).toEqual(['wire-section', 'solve', 'toggle', 'solve']);
    expect(validateTeachingPlan(plan, context, { sourceText }).actions).toEqual(plan.actions);
    expect(() =>
      validateTeachingPlan({ ...plan, actions: plan.actions.slice(0, -1) }, context, {
        sourceText,
      }),
    ).toThrow(/omitted/);
  });
  it('resolves rectangle dimensions and inch conversion without guessing a thicker value', () => {
    const context = withWire();
    expect(mechanical('use a 0.016 by 0.022 inch wire instead', context)[0]).toEqual({
      type: 'wire-section',
      id: 'wire-1',
      section: { shape: 'rectangle', heightMm: 0.016 * 25.4, widthMm: 0.022 * 25.4 },
    });
    const rectangular = parseTeachingPlan('use a 0.019 × 0.025 inch wire instead', context);
    expect(rectangular.actions).toEqual([
      {
        kind: 'mechanics',
        action: {
          type: 'wire-section',
          id: 'wire-1',
          section: { shape: 'rectangle', heightMm: 0.019 * 25.4, widthMm: 0.025 * 25.4 },
        },
      },
    ]);
    expect(
      validateTeachingPlan(rectangular, context, {
        sourceText: 'use a 0.019 × 0.025 inch wire instead',
      }).actions,
    ).toEqual(rectangular.actions);
    expect(parseTeachingPlan('use a thicker wire instead', context)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/What wire size/),
    });
    context.mechanics!.config.wires[0].section = {
      shape: 'rectangle',
      widthMm: 0.5,
      heightMm: 0.4,
    };
    context.mechanics!.focus.lastParameter = 'wire-section';
    expect(parseTeachingPlan('make that 0.5 instead', context)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/both height and width/),
    });
  });
  it('does not execute earlier actions when brackets have no load to demonstrate', () => {
    expect(parseTeachingPlan('install brackets here and show what happens', setup())).toMatchObject(
      { actions: [], clarification: expect.stringMatching(/activation/) },
    );
    expect(
      mechanical('put a wire through these brackets', setup()).map(action => action.type),
    ).toEqual(['brackets', 'wire']);
  });
  it('creates a fixed TAD only at the actual pointed world coordinate and connects total tension equally', () => {
    const context = setup();
    context.mechanics!.config.brackets = { '11': [0, 0, 3], '21': [0, 0, 3] };
    expect(
      parseTeachingPlan(
        'put a TAD here and connect it to these teeth at 1 N then show what will happen',
        context,
      ).clarification,
    ).toBeNull();
    expect(
      mechanical(
        'put a TAD here and connect it to these teeth at 1 N then show what will happen',
        context,
      ),
    ).toEqual([
      { type: 'tad', id: 'tad-1', position: [6, 7, 8] },
      {
        type: 'elastic',
        id: 'elastic-1',
        from: { kind: 'tad', id: 'tad-1' },
        to: { kind: 'tooth', tooth: '11', local: [0, 0, 3] },
        law: { kind: 'constant', forceN: 0.5 },
      },
      {
        type: 'elastic',
        id: 'elastic-2',
        from: { kind: 'tad', id: 'tad-1' },
        to: { kind: 'tooth', tooth: '21', local: [0, 0, 3] },
        law: { kind: 'constant', forceN: 0.5 },
      },
      { type: 'solve' },
    ]);
    expect(parseTeachingPlan('put a TAD here', { ...context, pointed: undefined })).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/Point/),
    });
    expect(
      parseTeachingPlan('put a TAD here and connect it to these teeth', context),
    ).toMatchObject({ actions: [], clarification: expect.stringMatching(/tension/) });
  });
  it('rejects unavailable models, ambiguous wires and unsupported materials', () => {
    const context = withWire();
    expect(
      parseTeachingPlan('install brackets here', { ...context, synthetic: false }).actions,
    ).toEqual([]);
    expect(parseTeachingPlan('use a NiTi wire instead', context)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/NiTi/),
    });
    context.mechanics!.config.wires.push({ ...context.mechanics!.config.wires[0], id: 'wire-2' });
    delete context.mechanics!.focus.wireId;
    expect(parseTeachingPlan('use a 0.5 mm wire instead', context)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/Choose the wire/),
    });
  });
  it('independently rejects AI-created coordinates, sizes, omitted actions and repeated wire creation', () => {
    const context = setup(),
      plan = parseTeachingPlan(
        'install brackets here and put a wire through these brackets',
        context,
      );
    expect(
      validateTeachingPlan(plan, context, {
        sourceText: 'install brackets here and put a wire through these brackets',
      }).actions,
    ).toHaveLength(2);
    const forged = structuredClone(plan);
    (forged.actions[1] as Extract<TeachingAction, { kind: 'mechanics' }>).action = {
      type: 'wire',
      id: 'wire-1',
      teeth: ['11', '21'],
      material: 'stainless-steel',
      section: { shape: 'round', diameterMm: 0.5 },
    };
    expect(() =>
      validateTeachingPlan(forged, context, {
        sourceText: 'install brackets here and put a wire through these brackets',
      }),
    ).toThrow(/must match/);
    expect(() =>
      validateTeachingPlan({ ...plan, actions: plan.actions.slice(0, 1) }, context, {
        sourceText: 'install brackets here and put a wire through these brackets',
      }),
    ).toThrow(/omitted/);
    expect(() =>
      validateTeachingPlan(
        {
          actions: [
            { kind: 'mechanics', action: { type: 'tad', id: 'tad-1', position: [9, 9, 9] } },
          ],
          summary: '',
          clarification: null,
        },
        context,
        { sourceText: 'put a TAD here' },
      ),
    ).toThrow(/must match/);
    const repeated = [
      ...plan.actions,
      {
        kind: 'mechanics',
        action: {
          type: 'wire',
          id: 'wire-2',
          teeth: ['11', '21'],
          material: 'stainless-steel',
          section: { shape: 'round', diameterMm: 0.4 },
        },
      },
    ];
    expect(() =>
      validateTeachingPlan({ ...plan, actions: repeated }, context, {
        sourceText: 'install brackets here and put a wire through these brackets',
      }),
    ).toThrow(/must match/);
  });
  it('retains minimal appliance context for the interpreter without local saved arrangements', () => {
    const context = setup();
    context.savedArrangementNames = ['private title'];
    context.autoApply = true;
    const wire = interpreterTeachingContext(context);
    expect(wire.mechanics?.config).toEqual(context.mechanics!.config);
    expect(wire.pointed).toEqual(context.pointed);
    expect(wire.savedArrangementNames).toBeUndefined();
    expect(wire.autoApply).toBeUndefined();
  });
  it('updates conversation focus independently of camera and request history', () => {
    const focus = reduceMechanicsFocus(
      { tadId: 'tad-1' },
      { type: 'wire-section', id: 'wire-1', section: { shape: 'round', diameterMm: 0.5 } },
    );
    expect(focus).toEqual({ tadId: 'tad-1', wireId: 'wire-1', lastParameter: 'wire-section' });
    expect(
      reduceMechanicsFocus(focus, { type: 'remove', kind: 'wire', id: 'wire-1' }).wireId,
    ).toBeUndefined();
  });
  it('accepts ordinary polite wording without changing the selected target or preset', () => {
    expect(
      mechanical(
        'Could you attach brackets over here and thread a wire through these brackets?',
        setup(),
      ),
    ).toHaveLength(2);
    const context = withWire();
    expect(mechanical('switch that wire to beta titanium', context)).toEqual([
      { type: 'wire-material', id: 'wire-1', material: 'beta-titanium' },
    ]);
  });
  it('uses the previous wire length unit only for an unambiguous replacement', () => {
    const context = withWire();
    context.mechanics!.focus.lastParameter = 'wire-section';
    expect(mechanical('make that 0.5 instead', context)).toEqual([
      { type: 'wire-section', id: 'wire-1', section: { shape: 'round', diameterMm: 0.5 } },
    ]);
  });
  it('requires explicit expander settings then replaces activation on the existing device', () => {
    const context = setup();
    expect(parseTeachingPlan('install a palatal expander here', context)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/stiffness/),
    });
    const actions = mechanical(
      'install a palatal expander on upper molars with activation 0.1 mm and stiffness 10 N/mm then show what happens',
      context,
    );
    expect(actions).toEqual([
      {
        type: 'expander',
        id: 'expander-1',
        left: ['26'],
        right: ['16'],
        activationMm: 0.1,
        stiffnessNPerMm: 10,
      },
      { type: 'solve' },
    ]);
    actions.forEach(action => advanceMechanicsContext(context, action));
    expect(mechanical('activate the expander to 0.2 mm', context)).toEqual([
      {
        type: 'expander',
        id: 'expander-1',
        left: ['26'],
        right: ['16'],
        activationMm: 0.2,
        stiffnessNPerMm: 10,
      },
      { type: 'solve' },
    ]);
  });
  it('keeps activation, appliance stiffness and palate stiffness in one atomic expander instruction', () => {
    const text =
      'install a palatal expander on upper molars with activation 0.1 mm and stiffness 10 N/mm and palate stiffness 20 N/mm';
    const context = setup(),
      before = structuredClone(context);
    const action: TeachingAction = {
      kind: 'mechanics',
      action: {
        type: 'expander',
        id: 'expander-1',
        left: ['26'],
        right: ['16'],
        activationMm: 0.1,
        stiffnessNPerMm: 10,
        palateStiffnessNPerMm: 20,
      },
    };
    const plan = parseTeachingPlan(text, context);
    expect(plan.actions).toEqual([action]);
    expect(validateTeachingPlan(plan, context, { sourceText: text }).actions).toEqual([action]);
    expect(parseTeachingPlan(`${text} then show what happens`, context).actions).toEqual([
      action,
      { kind: 'mechanics', action: { type: 'solve' } },
    ]);
    expect(context).toEqual(before);
    expect(
      parseTeachingPlan(`${text} then connect the TAD to these teeth`, context).actions,
    ).toEqual([]);
  });
});

describe('everyday whole-arch appliance requests', () => {
  const upper = ['16', '13', '12', '11', '21', '22', '23', '26'];
  const passive = (teeth: string[], id = 'wire-1') => ({
    type: 'wire' as const,
    id,
    teeth,
    material: 'stainless-steel' as const,
    section: { shape: 'round' as const, diameterMm: 0.4 },
  });
  it.each([
    'put wire on all teeth',
    'fit a wire on every tooth',
    'thread wire through all the teeth',
    'place an archwire on the whole upper arch',
  ])('adds missing brackets and a passive wire for the visible arch: %s', sourceText => {
    const context = setup();
    context.arch = 'upper';
    context.mechanics!.config.brackets['11'] = [1, 2, 3];
    const before = structuredClone(context),
      actions = mechanical(sourceText, context);
    expect(actions).toEqual([
      { type: 'brackets', teeth: upper.filter(id => id !== '11'), installed: true },
      passive(upper),
    ]);
    const plan = parseTeachingPlan(sourceText, context);
    expect(validateTeachingPlan(plan, context, { sourceText }).actions).toEqual(plan.actions);
    expect(context).toEqual(before);
    actions.forEach(action => advanceMechanicsContext(context, action));
    expect(context.mechanics!.config.brackets['11']).toEqual([1, 2, 3]);
    expect(context.mechanics!.config.wires[0]).toMatchObject({ expansionMm: 0, torqueDeg: 0 });
  });
  it('splits a whole-mouth wire request into two ordered arches in one bounded request', () => {
    const context = setup();
    context.arch = 'upper';
    context.availableIds.push('41', '36', '46');
    for (const id of ['41', '36', '46']) context.mechanics!.bracketAnchors[id] = [0, 0, 3];
    const lower = ['46', '41', '31', '36'];
    for (const sourceText of ['put wires on both arches', 'put wire on the whole mouth']) {
      const actions = mechanical(sourceText, context);
      expect(actions).toEqual([
        { type: 'brackets', teeth: upper, installed: true },
        passive(upper),
        { type: 'brackets', teeth: lower, installed: true },
        passive(lower, 'wire-2'),
      ]);
      const plan = parseTeachingPlan(sourceText, context);
      expect(validateTeachingPlan(plan, context, { sourceText }).actions).toEqual(plan.actions);
      expect(actions).toHaveLength(4);
    }
    context.arch = 'both';
    expect(mechanical('put wire on all teeth', context)).toHaveLength(4);
    expect(mechanical('put wire on lower teeth', context)).toEqual([
      { type: 'brackets', teeth: lower, installed: true },
      passive(lower),
    ]);
  });
  it('uses explicit arch targets and ordinary braces wording without inventing movement', () => {
    const context = setup();
    context.arch = 'lower';
    expect(mechanical('put wire on all upper teeth', context)).toEqual([
      { type: 'brackets', teeth: upper, installed: true },
      passive(upper),
    ]);
    expect(mechanical('put braces on every upper tooth', context)).toEqual([
      { type: 'brackets', teeth: ids.filter(id => id !== '31'), installed: true },
    ]);
    context.arch = 'upper';
    expect(parseTeachingPlan('put wire on all teeth and show what happens', context)).toMatchObject(
      { actions: [], clarification: expect.stringMatching(/activation/) },
    );
    expect(parseTeachingPlan('put wire on all teeth except 11', context).actions).toEqual([]);
  });
  it('reuses an identical wire without changing activation or duplicating it', () => {
    const context = withWire();
    const actions = mechanical('put a wire on these teeth', context);
    expect(actions).toEqual([{ type: 'wire', ...context.mechanics!.config.wires[0] }]);
    actions.forEach(action => advanceMechanicsContext(context, action));
    expect(context.mechanics!.config.wires).toHaveLength(1);
    expect(context.mechanics!.config.wires[0].expansionMm).toBe(0.1);
    const extended = mechanical('put wire on all upper teeth', context);
    expect(extended).toEqual([
      { type: 'brackets', teeth: upper.filter(id => !['11', '21'].includes(id)), installed: true },
      { type: 'wire', ...context.mechanics!.config.wires[0], teeth: upper },
    ]);
    extended.forEach(action => advanceMechanicsContext(context, action));
    expect(context.mechanics!.config.wires).toHaveLength(1);
    expect(parseTeachingPlan('put wire on upper incisors', context)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/extend beyond/),
    });
  });
  it('rejects invented extra arches, activation, omitted prerequisites and incorrect wire paths', () => {
    const context = setup();
    context.arch = 'upper';
    const sourceText = 'put wire on all teeth',
      plan = parseTeachingPlan(sourceText, context);
    const forged = structuredClone(plan);
    const wire = forged.actions[1] as Extract<TeachingAction, { kind: 'mechanics' }>;
    wire.action = { ...passive([...upper].reverse()), expansionMm: 0.5 };
    expect(() => validateTeachingPlan(forged, context, { sourceText })).toThrow();
    expect(() =>
      validateTeachingPlan({ ...plan, actions: plan.actions.slice(1) }, context, { sourceText }),
    ).toThrow();
    expect(parseTeachingPlan('put wires on both arches', context)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(/at least two/),
    });
  });
  it('retains a referenced tooth group when only the camera changes and selection is cleared', () => {
    const context = setup();
    context.selectedIds = [];
    context.mechanics!.focus.teeth = ['11', '21'];
    expect(mechanical('put brackets on them', { ...context, view: 'occlusal' })).toEqual([
      { type: 'brackets', teeth: ['11', '21'], installed: true },
    ]);
    expect(parseTeachingPlan('put brackets on selected teeth', context).actions).toEqual([]);
  });
});

describe('immediate geometric classroom commands', () => {
  const context = { ...setup(), tryMode: true, autoApply: true };
  it('applies only after complete validation while explicit preview remains available', () => {
    expect(
      parseTeachingPlan('move selected teeth buccally 0.5 mm and show roots', context).actions,
    ).toMatchObject([
      { kind: 'dental' },
      { kind: 'try', action: { type: 'apply' } },
      { kind: 'toggle', target: 'roots' },
    ]);
    expect(
      parseTeachingPlan('preview move selected teeth buccally 0.5 mm', context).actions,
    ).toHaveLength(1);
    expect(
      parseTeachingPlan('move selected teeth buccally 0.5 mm then move them lingually', context)
        .actions,
    ).toEqual([]);
  });
  it('stops then undoes the complete previous request as one history command', () => {
    expect(parseTeachingPlan('Stop. Undo that.', context).actions).toEqual([
      { kind: 'dental', command: { type: 'undo' } },
    ]);
  });
  it('automatically applies an independently validated AI geometric command but not manual preview controls', () => {
    const action: TeachingAction = {
      kind: 'dental',
      command: { type: 'move_group', teeth: ['11', '21'], direction: 'buccal', amount: 0.5 },
    };
    const plan = {
      actions: [action],
      summary: 'Move the highlighted incisors',
      clarification: null,
    };
    expect(
      validateTeachingPlan(plan, context, { sourceText: 'move these teeth buccally 0.5 mm' })
        .actions,
    ).toEqual([action, { kind: 'try', action: { type: 'apply' } }]);
    expect(validateTeachingPlan(plan, context, { allowLocalActions: true }).actions).toEqual([
      action,
    ]);
    expect(
      parseTeachingPlan('show roots then preview move selected teeth buccally 0.5 mm', context)
        .actions,
    ).toHaveLength(2);
  });
  it('revises the last geometric amount in its existing unit without applying another increment', () => {
    const prior = { ...context, tryLastMovement: true, tryLastIds: ['11', '21'] };
    expect(parseTeachingPlan('make that 0.5 instead', prior).actions).toEqual([
      { kind: 'try', action: { type: 'revise', amount: 0.5 } },
      { kind: 'try', action: { type: 'apply' } },
    ]);
  });
});

describe('bounded dental arrangements', () => {
  it.each([
    ['load dental class I', 'dental-class-i'],
    ['load dental class II division 1', 'dental-class-ii-division-1'],
    ['show class two division two', 'dental-class-ii-division-2'],
    ['open dental class III arrangement', 'dental-class-iii'],
  ])('loads %s locally as an explicit synthetic arrangement', (text, id) => {
    const plan = parseTeachingPlan(text, setup());
    expect(plan.actions).toEqual([{ kind: 'dental-arrangement', id }]);
    expect(teachingActionMode(plan.actions[0], 'workflow')).toBe('case');
    expect(() => validateTeachingPlan(plan, setup())).toThrow(/local commands/);
  });
  it('clarifies missing division, pending edits and compound changes before changing the model', () => {
    for (const source of [
      'load dental class II',
      'load dental class I division 1',
      'show roots and load dental class III',
      'load dental class III then hide gums',
    ])
      expect(parseTeachingPlan(source, setup()).actions).toEqual([]);
    expect(
      parseTeachingPlan('load dental class I', { ...setup(), tryPreview: true }),
    ).toMatchObject({ actions: [], clarification: expect.stringMatching(/Apply or discard/) });
  });
});
