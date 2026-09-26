import { describe, expect, it } from 'vitest';
import {
  interpreterTeachingContext,
  parseTeachingPlan,
  teachingActionMode,
  validateTeachingPlan,
  type TeachingContext,
} from '../classroom';
import type { TeachingAction } from '../lecture';
import { TOOTH_STUDY_VIEWS, type ToothStudyView } from '../tooth-study/types';

const ids = [1, 2, 3, 4].flatMap(q => Array.from({ length: 7 }, (_, i) => `${q}${i + 1}`));
const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: -1,
  selected: '11',
  selectedIds: ['11'],
  availableIds: ids,
  synthetic: true,
  revision: 3,
  view: 'perspective',
  arch: 'both',
  speed: 1,
  stages: 10,
  stage: 10,
  canStepStages: false,
  layers: { gums: true },
};
const studying: TeachingContext = {
  ...context,
  selected: '16',
  selectedIds: ['16'],
  toothStudy: { tooth: '16', view: 'buccal' },
};
const open = (tooth: string, view?: ToothStudyView): TeachingAction => ({
  kind: 'tooth-study',
  action: 'open',
  tooth,
  ...(view ? { view } : {}),
});
const view = (side: ToothStudyView): TeachingAction => ({
  kind: 'tooth-study',
  action: 'view',
  view: side,
});
const explain: TeachingAction = { kind: 'tooth-study', action: 'explain' };
const close: TeachingAction = { kind: 'tooth-study', action: 'close' };
const actions = (text: string, scene = context) => parseTeachingPlan(text, scene).actions;

describe('deterministic tooth-study grammar', () => {
  it.each([
    ['show tooth 16', [open('16')]],
    ['study tooth 16', [open('16')]],
    ['tooth one six', [open('16')]],
    ['show tooth one six', [open('16')]],
    ['show me the upper right first molar', [open('16')]],
    ['show the lower left canine', [open('33')]],
    ['show the upper first molar', [open('16')]],
    ['show the maxillary left lateral incisor', [open('22')]],
    ['show the mandibular right second bicuspid', [open('45')]],
    ['show the lower six-year molar', [open('46')]],
    ['show the upper left eye tooth', [open('23')]],
    ['show tooth 16 from the mesial', [open('16', 'mesial')]],
    ['explain this tooth', [open('11'), explain]],
    ['tell me about this tooth', [open('11'), explain]],
    ['how many roots does it have?', [open('11'), explain]],
    ['what is this tooth', [open('11'), explain]],
    ['show tooth 16 and explain it', [open('16'), explain]],
    ['show the upper first molar then view it from the distal', [open('16'), view('distal')]],
  ])('parses %s', (text, expected) => expect(actions(text as string)).toEqual(expected));

  it.each([
    ['mesial', 'mesial'],
    ['distal', 'distal'],
    ['buccal', 'buccal'],
    ['labial', 'buccal'],
    ['cheek side', 'buccal'],
    ['lingual', 'lingual'],
    ['tongue side', 'lingual'],
    ['palatal', 'lingual'],
    ['occlusal', 'occlusal'],
    ['biting surface', 'occlusal'],
    ['incisal', 'occlusal'],
    ['top', 'occlusal'],
    ['apical', 'apical'],
    ['root tip', 'apical'],
  ] as const)('maps %s to %s', (spoken, side) => {
    expect(actions(`view it from the ${spoken}`, studying)).toEqual([view(side)]);
    expect(actions(`view from the ${spoken}`, studying)).toEqual([view(side)]);
  });

  it.each(['back to the full mouth', 'close tooth view', 'exit tooth study', 'show all teeth'])(
    'closes with %s',
    text => expect(actions(text, studying)).toEqual([close]),
  );
  it.each([
    'explain this tooth',
    'tell me about this tooth',
    'how many roots does it have',
    'what is this tooth',
  ])('explains the studied tooth with %s', text =>
    expect(actions(text, studying)).toEqual([explain]),
  );
  it.each(TOOTH_STUDY_VIEWS)('cycles from %s in both directions', side => {
    const scene = { ...studying, toothStudy: { tooth: '16', view: side } };
    const index = TOOTH_STUDY_VIEWS.indexOf(side);
    for (const command of ['turn it', 'next side', 'next', 'continue'])
      expect(actions(command, scene)).toEqual([view(TOOTH_STUDY_VIEWS[(index + 1) % 6])]);
    for (const command of ['back', 'previous', 'go back'])
      expect(actions(command, scene)).toEqual([view(TOOTH_STUDY_VIEWS[(index + 5) % 6])]);
  });
  it('uses the advanced view during compound navigation', () => {
    expect(actions('show tooth 16 then next then back')).toEqual([
      open('16'),
      view('mesial'),
      view('buccal'),
    ]);
  });
  it('requires close to finish the request before commands use the restored selection', () => {
    const before = structuredClone(studying);
    expect(parseTeachingPlan('close tooth view then explain this tooth', studying)).toEqual({
      actions: [],
      summary: '',
      clarification:
        'Close tooth study as the final action, then give commands for the restored view.',
    });
    expect(() =>
      validateTeachingPlan(
        { actions: [close, explain], summary: 'Close then explain', clarification: null },
        studying,
        { allowLocalActions: true },
      ),
    ).toThrow(/Close tooth study as the final action/);
    expect(studying).toEqual(before);
    expect(actions('show tooth 16 then close tooth view')).toEqual([open('16'), close]);
  });
  it.each([
    ['focus 16', [{ kind: 'focus', tooth: '16' }]],
    ['select 16', [{ kind: 'select', teeth: ['16'] }]],
    ['zoom to 16', [{ kind: 'focus', tooth: '16' }]],
    ['show roots', [{ kind: 'toggle', target: 'roots', visible: true }]],
    ['show occlusal view', [{ kind: 'view', view: 'occlusal' }]],
  ])('preserves %s', (text, expected) => {
    expect(actions(text as string)).toEqual(expected);
    expect(actions(text as string, studying)).toEqual(expected);
  });
  it('retains full-mouth aliases outside tooth study', () => {
    expect(actions('show all teeth')).toEqual([{ kind: 'arch', arch: 'both' }]);
    expect(actions('view from the top')).toEqual([{ kind: 'view', view: 'occlusal' }]);
  });
  it('clarifies missing references locally', () => {
    expect(parseTeachingPlan('show the canine', context).clarification).toMatch(/upper or lower/);
    expect(actions('show the canine', { ...context, arch: 'lower' })).toEqual([open('43')]);
    expect(
      parseTeachingPlan('explain this tooth', { ...context, selectedIds: [] }).clarification,
    ).toMatch(/Select one tooth/);
    expect(
      parseTeachingPlan('explain this tooth', { ...context, selectedIds: ['11', '21'] })
        .clarification,
    ).toMatch(/Select one tooth/);
    expect(parseTeachingPlan('turn it', context).clarification).toMatch(/Open a tooth first/);
    expect(parseTeachingPlan('back to the full mouth', context).clarification).toMatch(
      /No tooth study/,
    );
  });
  it('clarifies unsupported or unavailable model teeth locally', () => {
    expect(
      parseTeachingPlan('show tooth 16', { ...context, synthetic: false }).clarification,
    ).toMatch(/synthetic/);
    expect(
      parseTeachingPlan('show tooth 16', { ...context, availableIds: ['11'] }).clarification,
    ).toMatch(/current model/);
    expect(
      parseTeachingPlan('show tooth 18', { ...context, availableIds: [...ids, '18'] })
        .clarification,
    ).toMatch(/11–17/);
  });
  it('routes tooth study out of a workflow into the case workspace', () => {
    const scene: TeachingContext = {
      ...context,
      mode: 'workflow',
      workflowId: 'fixed-braces',
      stepIndex: 0,
    };
    expect(actions('show tooth 16', scene)).toEqual([open('16')]);
    expect(teachingActionMode(open('16'), 'workflow')).toBe('case');
  });
  it('navigates the destination workflow when leaving tooth study in one request', () => {
    expect(actions('start braces workflow then next', studying)).toEqual([
      { kind: 'workflow', action: 'start', id: 'fixed-braces' },
      { kind: 'workflow', action: 'next' },
    ]);
  });
  it.each(['next', 'back', 'continue', 'go back'])(
    'clarifies %s in an empty free workspace',
    text => {
      expect(parseTeachingPlan(text, context)).toEqual({
        actions: [],
        summary: '',
        clarification:
          'Nothing to step through here. Open a prepared case or lesson, or say “Forma, show tooth 16”.',
      });
    },
  );
});

describe('strict tooth-study schema and interpreter boundary', () => {
  const local = (action: unknown, scene = studying) =>
    validateTeachingPlan(
      { actions: [action], summary: 'Tooth study', clarification: null },
      scene,
      { allowLocalActions: true },
    ).actions;
  it('accepts only the defined action shapes', () => {
    for (const action of [open('16'), open('16', 'apical'), view('mesial'), explain, close])
      expect(local(action)).toEqual([action]);
  });
  it.each([
    { ...open('16'), extra: true },
    { kind: 'tooth-study', action: 'open' },
    { kind: 'tooth-study', action: 'open', tooth: 16 },
    { kind: 'tooth-study', action: 'open', tooth: '16', view: 'top' },
    { kind: 'tooth-study', action: 'open', tooth: '16', view: undefined },
    { kind: 'tooth-study', action: 'view', view: 'mesial', tooth: '16' },
    { kind: 'tooth-study', action: 'view' },
    { kind: 'tooth-study', action: 'explain', tooth: '16' },
    { kind: 'tooth-study', action: 'close', view: 'buccal' },
    { kind: 'tooth-study', action: 'zoom' },
  ])('rejects %j', action => expect(() => local(action)).toThrow());
  it('requires a study for view and close, and a single selection for direct explanation', () => {
    for (const action of [view('mesial'), close])
      expect(() => local(action, context)).toThrow(/Open a tooth first/);
    expect(local(explain, context)).toEqual([explain]);
    expect(() => local(explain, { ...context, selectedIds: [] })).toThrow(/Select one tooth/);
  });
  it('rejects tooth study from the AI interpreter', () => {
    expect(() =>
      validateTeachingPlan({ actions: [open('16')], summary: 'x', clarification: null }, context),
    ).toThrow(/local commands only/);
  });
  it('strips every local-only context field and mixed lastActions without mutating the caller', () => {
    const original = {
      ...studying,
      lastActions: [open('16'), { kind: 'view', view: 'front' } as TeachingAction],
    };
    const wire = interpreterTeachingContext(original);
    expect(wire).not.toHaveProperty('toothStudy');
    expect(wire).not.toHaveProperty('canStepStages');
    expect(wire).not.toHaveProperty('lastActions');
    expect(original.toothStudy).toEqual(studying.toothStudy);
    expect(original.lastActions).toHaveLength(2);
  });
  it('rejects stale tooth study state', () => {
    const stale = { ...studying, toothStudy: { tooth: '18', view: 'buccal' as const } };
    expect(() => local(explain, stale)).toThrow(/stale/);
    expect(parseTeachingPlan('turn it', stale).clarification).toMatch(/stale/);
  });
});
