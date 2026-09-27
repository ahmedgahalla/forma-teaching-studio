import { describe, expect, it } from 'vitest';
import { parseTeachingPlan, teachingActionMode, type TeachingContext } from '../classroom';
import { UnrecognizedCommandError } from '../commands';
import { DEMO_IDS } from '../classroom/types';
import { advanceCase } from '../classroom/advance-case';
import { advance } from '../classroom/advance';
import { glossaryActions } from './plan';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: -1,
  selected: '11',
  selectedIds: ['11'],
  availableIds: [...DEMO_IDS],
  synthetic: true,
  revision: 0,
  view: 'perspective',
  arch: 'both',
  speed: 1,
};
const mechanics: TeachingContext = {
  ...context,
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
    bracketAnchors: {},
    focus: {},
    stageIndex: 0,
    stageCount: 1,
    hasResult: true,
  },
};
const workflow: TeachingContext = {
  ...context,
  mode: 'workflow',
  workflowId: 'fixed-braces',
  stepIndex: 0,
};

describe('glossary defers to the complete local grammar', () => {
  it.each([
    'explain that movement',
    'explain the result',
    'explain the response aloud',
    'explain this movement',
  ])('keeps %s in mechanics when a response exists', text => {
    expect(parseTeachingPlan(text, mechanics)).toMatchObject({
      actions: [{ kind: 'mechanics', action: { type: 'explain' } }],
      clarification: null,
    });
  });
  it('preserves mechanics clarification when the response is missing', () => {
    expect(
      parseTeachingPlan('explain that movement', {
        ...mechanics,
        mechanics: { ...mechanics.mechanics!, hasResult: false },
      }),
    ).toMatchObject({
      actions: [],
      clarification: expect.stringContaining('Calculate a valid mechanical response'),
    });
  });
  it.each([
    ['load movement types', context, { kind: 'case', action: 'load', id: 'movement-types' }],
    ['show dental class i', context, { kind: 'dental-arrangement', id: 'dental-class-i' }],
    [
      'restore my workspace',
      { ...context, canRestoreWorkspace: true },
      { kind: 'workspace', action: 'restore' },
    ],
    ['enter try mode', context, { kind: 'try', action: { type: 'enter' } }],
    ['explain this step', workflow, { kind: 'narrate', target: 'step' }],
    ['explain the answer', workflow, { kind: 'narrate', target: 'answer' }],
    ['explain this step', { ...context, lessonActive: true }, { kind: 'narrate', target: 'step' }],
    [
      'explain this tooth',
      { ...context, toothStudy: { tooth: '11', view: 'buccal' } },
      { kind: 'tooth-study', action: 'explain' },
    ],
  ] as const)('preserves the existing action for %s', (text, scene, action) => {
    expect(parseTeachingPlan(text, scene as TeachingContext)).toMatchObject({
      actions: [action],
      clarification: null,
    });
  });
  it.each([
    ['show dental class ii', context, /division/],
    ['load unknown case', context, /Choose a prepared case/],
    ['restore my workspace', context, /no saved workspace/],
    ['apply preview', context, /Try Mode/],
    ['explain this tooth', { ...context, selectedIds: [] }, /Select one tooth/],
  ] as const)('preserves the existing clarification for %s', (text, scene, message) => {
    expect(parseTeachingPlan(text, scene as TeachingContext)).toMatchObject({
      actions: [],
      clarification: expect.stringMatching(message),
    });
  });
});

describe('context-sensitive glossary actions', () => {
  it('does not claim hide that in a workflow without a definition', () => {
    expect(() => parseTeachingPlan('hide that', workflow)).toThrow(UnrecognizedCommandError);
  });
  it('leaves close the definition to existing close clarification without a definition', () => {
    expect(parseTeachingPlan('close the definition', workflow)).toMatchObject({
      actions: [],
      clarification: expect.stringContaining('Which two teeth and allocation rule'),
    });
  });
  it.each(['hide that', 'close the definition'])(
    'closes %s without routing away from a workflow',
    text => {
      const action = { kind: 'glossary', id: null } as const;
      expect(parseTeachingPlan(text, { ...workflow, glossaryId: 'torque' }).actions).toEqual([
        action,
      ]);
      expect(teachingActionMode(action, 'workflow')).toBe('workflow');
      const next = { ...workflow, glossaryId: 'torque' as string | null };
      advance(next, action, { arch: false, view: false, selection: false });
      expect(next).toMatchObject({
        mode: 'workflow',
        workflowId: 'fixed-braces',
        glossaryId: null,
      });
    },
  );
  it.each([
    ['mesial surface', 'mesial', 'mesial'],
    ['distal surface', 'distal', 'distal'],
    ['buccal surface', 'buccal', 'buccal'],
    ['labial surface', 'labial', 'buccal'],
    ['lingual surface', 'lingual', 'lingual'],
    ['palatal surface', 'palatal', 'lingual'],
    ['occlusal surface', 'occlusal', 'occlusal'],
    ['incisal surface', 'incisal', 'occlusal'],
    ['apex', 'apex', 'apical'],
  ])('keeps the studied tooth for show me the %s', (term, id, view) => {
    expect(
      parseTeachingPlan(`show me the ${term}`, {
        ...context,
        toothStudy: { tooth: '21', view: 'buccal' },
      }),
    ).toMatchObject({
      actions: [
        { kind: 'tooth-study', action: 'view', view },
        { kind: 'glossary', id },
      ],
      clarification: null,
    });
  });
  it.each(['periodontal-ligament', 'alveolar-bone'])(
    'loads synthetic anatomy before explaining %s from an imported case',
    id => {
      expect(
        parseTeachingPlan(`define ${id.replaceAll('-', ' ')}`, {
          ...context,
          synthetic: false,
          availableIds: ['48'],
          selected: '48',
          selectedIds: ['48'],
        }),
      ).toMatchObject({ actions: glossaryActions(id), clarification: null });
    },
  );
  it('advances prepared-case model capabilities and IDs before subsequent validation', () => {
    const next = { ...context, synthetic: false, availableIds: ['48'] };
    advanceCase(next, { kind: 'case', action: 'load', id: 'reference-occlusion' });
    expect(next.synthetic).toBe(true);
    expect(next.availableIds).toEqual(DEMO_IDS);
  });
});
