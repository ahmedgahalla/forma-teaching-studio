import { describe, expect, it } from 'vitest';
import { normalizeClassroomLanguage } from './classroom-language';
import fixtures from './classroom-language.fixtures.json';
import { normalizeSpeechCommand, parseTeachingCommand } from './lecture';
import { parseTeachingPlan, validateTeachingPlan, type TeachingContext } from './classroom';

describe('bounded everyday classroom wording', () => {
  it.each(fixtures)('normalizes without filling missing intent: %s', (input, expected) => {
    expect(normalizeClassroomLanguage(input)).toBe(expected);
    expect(normalizeClassroomLanguage(expected)).toBe(expected);
  });
  it('retains original numerical evidence through the existing number parser', () => {
    expect(
      normalizeSpeechCommand(
        'Would you mind moving the upper front teeth buccally minus half a millimeter',
      ),
    ).toBe('move the upper anterior teeth buccally -0.5 mm');
    expect(
      normalizeSpeechCommand('For this lecture, could you rotate tooth eleven minus three degrees'),
    ).toBe('rotate tooth 11 -3 degrees');
  });
  it('supports explicit camera and layer wording through the shared executor parser', () => {
    expect(parseTeachingCommand('Let’s look from above', '11', ['11'])).toEqual({
      kind: 'view',
      view: 'occlusal',
    });
    expect(parseTeachingCommand('Could you make the gums disappear?', '11', ['11'])).toEqual({
      kind: 'toggle',
      target: 'gums',
      visible: false,
    });
  });
  it('does not turn unknown or negated wording into an executable camera action', () => {
    expect(() => parseTeachingCommand('Do not look from above', '11', ['11'])).toThrow();
    expect(() =>
      parseTeachingCommand('Please look from above and invent a response', '11', ['11']),
    ).toThrow();
  });
  it('normalizes casual appliance arch targets without depending on the displayed arch', () => {
    const ids = ['11', '21', '31', '41'];
    const context: TeachingContext = {
      mode: 'case',
      workflowId: null,
      stepIndex: 0,
      selected: '31',
      selectedIds: ['31'],
      availableIds: ids,
      synthetic: true,
      revision: 1,
      view: 'occlusal',
      arch: 'lower',
      speed: 1,
      mechanics: {
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
        stageIndex: -1,
        stageCount: 0,
        hasResult: false,
      },
    };
    for (const sourceText of ['put brackets in top', 'install brackets on the top teeth']) {
      const plan = parseTeachingPlan(sourceText, context);
      expect(plan.actions).toEqual([
        { kind: 'mechanics', action: { type: 'brackets', teeth: ['11', '21'], installed: true } },
      ]);
      expect(validateTeachingPlan(plan, context, { sourceText }).actions).toEqual(plan.actions);
      const wrong = {
        ...plan,
        actions: [
          { kind: 'mechanics', action: { type: 'brackets', teeth: ['31', '41'], installed: true } },
        ],
      };
      expect(() => validateTeachingPlan(wrong, context, { sourceText })).toThrow(/targets/);
    }
    expect(parseTeachingPlan('put brackets in bottom', context).actions).toEqual([
      { kind: 'mechanics', action: { type: 'brackets', teeth: ['31', '41'], installed: true } },
    ]);
  });
  it('resolves front six before quantities, then resolves them against that selection', () => {
    const context: TeachingContext = {
      mode: 'case',
      workflowId: null,
      stepIndex: 0,
      selected: '11',
      selectedIds: ['11'],
      availableIds: [1, 2, 3, 4].flatMap(q =>
        Array.from({ length: 7 }, (_, index) => `${q}${index + 1}`),
      ),
      synthetic: true,
      revision: 1,
      view: 'front',
      arch: 'upper',
      speed: 1,
    };
    const sourceText = 'Select the upper front six teeth and move them buccally by one millimeter.';
    const teeth = ['11', '12', '13', '21', '22', '23'];
    expect(normalizeSpeechCommand(sourceText)).toBe(
      'select the upper anterior teeth and move them buccally by 1 mm',
    );
    const plan = parseTeachingPlan(sourceText, context);
    expect(plan.actions).toEqual([
      { kind: 'select', teeth },
      { kind: 'dental', command: { type: 'move_group', teeth, direction: 'buccal', amount: 1 } },
    ]);
    expect(validateTeachingPlan(plan, context, { sourceText }).actions).toEqual(plan.actions);
    const wrong = structuredClone(plan);
    wrong.actions[1] = {
      kind: 'dental',
      command: { type: 'move_group', teeth, direction: 'buccal', amount: 2 },
    };
    expect(() => validateTeachingPlan(wrong, context, { sourceText })).toThrow();
    expect(
      parseTeachingPlan('Select upper front six teeth and move them buccally', context).actions,
    ).toEqual([]);
  });
});
