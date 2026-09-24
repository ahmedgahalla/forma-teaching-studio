import { describe, expect, it } from 'vitest';
import { parseTeachingPlan, validateTeachingPlan, type TeachingContext } from './classroom';
import type { TeachingAction } from './lecture';

const ids = [1, 2, 3, 4].flatMap(q => Array.from({ length: 7 }, (_, i) => `${q}${i + 1}`));
const context: TeachingContext = { mode: 'case', workflowId: null, stepIndex: 0, selected: '11', selectedIds: ['11'], availableIds: ids, synthetic: true, revision: 7, view: 'perspective', arch: 'both', speed: 1, stages: 10, stage: 10, layers: { gums: true } };
const workflow: TeachingContext = { ...context, mode: 'workflow', workflowId: 'fixed-braces', stepIndex: 2, canReturnToLesson: true, lessonActive: true };
const plan = (actions: unknown[]) => ({ actions, summary: 'A classroom instruction', clarification: null });
const move = (teeth: string[], amount = 1): TeachingAction => ({ kind: 'dental', command: { type: 'move_group', teeth, amount, direction: 'buccal' } });

describe('authored answer display and left camera commands', () => {
  it('supports the left camera in local and independently validated external plans', () => {
    const actions: TeachingAction[] = [{ kind: 'view', view: 'left' }];
    expect(parseTeachingPlan('show left view', context).actions).toEqual(actions);
    expect(validateTeachingPlan(plan(actions), { ...context, view: 'left' }).actions).toEqual(actions);
  });

  it.each([workflow, { ...workflow, workflowId: 'anatomy', stepIndex: 3 }, { ...context, caseId: 'crowding' }])('shows and hides only existing authored answers %#', state => {
    const actions: TeachingAction[] = [{ kind: 'question', visible: true }, { kind: 'question', visible: false }];
    expect(parseTeachingPlan('reveal answer and hide explanation', state).actions).toEqual(actions);
    expect(validateTeachingPlan(plan(actions), state).actions).toEqual(actions);
  });

  it.each([context, { ...context, lessonActive: true }, { ...context, hasWorkflowOrigin: true }])('clarifies an unavailable answer before any part of a request runs %#', state => {
    const before = structuredClone(state);
    expect(parseTeachingPlan('show left view then reveal answer', state)).toMatchObject({ actions: [], clarification: expect.stringMatching(/authored question/) });
    expect(parseTeachingPlan('hide explanation', state)).toMatchObject({ actions: [], clarification: expect.stringMatching(/authored question/) });
    expect(() => validateTeachingPlan(plan([{ kind: 'question', visible: true }]), state)).toThrow(/authored question/);
    expect(state).toEqual(before);
  });

  it('preflights answer availability after starting a workflow and keeps narration distinct', () => {
    expect(parseTeachingPlan('start anatomy lesson and reveal answer then explain answer aloud', context).actions).toEqual([
      { kind: 'anatomy-lesson', action: 'start' }, { kind: 'question', visible: true }, { kind: 'narrate', target: 'answer' },
    ]);
    expect(parseTeachingPlan('reveal answer then start anatomy lesson', context).actions).toEqual([]);
    expect(parseTeachingPlan('explain this step', { ...context, lessonActive: true }).actions).toEqual([{ kind: 'narrate', target: 'step' }]);
  });
});

describe('direct presentation progress', () => {
  it.each([context, { ...workflow, stepIndex: 0 }, { ...workflow, workflowId: 'anatomy', stepIndex: 2 }])('pauses halfway in one display action in context %#', state => {
    expect(parseTeachingPlan('pause halfway', { ...state, stages: 9 }).actions).toEqual([{ kind: 'progress', value: .5 }]);
    expect(validateTeachingPlan(plan([{ kind: 'progress', value: .375 }]), state).actions).toEqual([{ kind: 'progress', value: .375 }]);
  });
  it('preflights the progress destination before consecutive anatomy navigation', () => {
    const atComparison = { ...workflow, workflowId: 'anatomy', stepIndex: 3 };
    expect(validateTeachingPlan(plan([{ kind: 'progress', value: .5 }, { kind: 'lesson-step', action: 'next' }, { kind: 'lesson-step', action: 'next' }]), atComparison).actions).toHaveLength(3);
    expect(() => validateTeachingPlan(plan([{ kind: 'progress', value: .5 }, { kind: 'lesson-step', action: 'next' }, { kind: 'lesson-step', action: 'next' }]), { ...atComparison, stepIndex: 2 })).toThrow(/outside/);
    expect(() => validateTeachingPlan(plan([{ kind: 'stage', action: 'exact', stage: 5 }]), workflow)).toThrow(/workflow steps/);
  });
  it.each([undefined, null, '0.5', true, -.01, 1.01, NaN, Infinity])('rejects invalid independent progress %s', value => {
    expect(() => validateTeachingPlan(plan([{ kind: 'progress', value }]), context)).toThrow();
  });
  it('rejects provider-supplied progress content beyond the bounded value', () => {
    expect(() => validateTeachingPlan(plan([{ kind: 'progress', value: .5, force: 100 }]), context)).toThrow(/unexpected/);
  });
  it('independently checks external progress against the explicit requested position', () => {
    expect(validateTeachingPlan(plan([{ kind: 'progress', value: .375 }]), context, { sourceText: 'show progress thirty seven point five percent' }).actions).toHaveLength(1);
    expect(validateTeachingPlan(plan([{ kind: 'progress', value: .5 }]), workflow, { sourceText: 'pause halfway' }).actions).toHaveLength(1);
    for (const sourceText of ['show progress', 'show progress 25 percent', 'pause halfway']) {
      expect(() => validateTeachingPlan(plan([{ kind: 'progress', value: .75 }]), context, { sourceText })).toThrow(/requested fraction/);
    }
  });
});

describe('local workspace transfers and appliance displays', () => {
  const origin = { ...context, hasWorkflowOrigin: true, canRestoreWorkspace: true };
  it('routes only source-linked case returns to the workspace bridge', () => {
    expect(parseTeachingPlan('try this setup', workflow).actions).toEqual([{ kind: 'workspace', action: 'explore' }]);
    expect(parseTeachingPlan('restore my workspace', origin).actions).toEqual([{ kind: 'workspace', action: 'restore' }]);
    expect(parseTeachingPlan('back to my saved case', { ...workflow, canRestoreWorkspace: true }).actions).toEqual([{ kind: 'workspace', action: 'restore' }]);
    expect(parseTeachingPlan('return to source lesson', origin).actions).toEqual([{ kind: 'workspace', action: 'lesson' }]);
    expect(parseTeachingPlan('return to lesson', origin).actions).toEqual([{ kind: 'workspace', action: 'lesson' }]);
    expect(parseTeachingPlan('return to lesson', workflow).actions).toEqual([{ kind: 'return-lesson' }]);
    expect(parseTeachingPlan('return to lesson', { ...context, canReturnToLesson: true }).actions).toEqual([{ kind: 'return-lesson' }]);
    expect(parseTeachingPlan('return to try mode', workflow).actions).toEqual([{ kind: 'workflow', action: 'exit' }, { kind: 'try', action: { type: 'enter' } }]);
  });
  it('keeps every transfer standalone before parsing destination tooth IDs', () => {
    for (const [text, state] of [
      ['try this setup then move tooth 99 x 1 mm', workflow],
      ['show front view and explore this lesson', workflow],
      ['restore my workspace and highlight molars', origin],
      ['hide gums then return to lesson', origin],
    ] as const) expect(parseTeachingPlan(text, state)).toMatchObject({ actions: [], clarification: expect.stringMatching(/separate request/) });
    expect(() => validateTeachingPlan(plan([{ kind: 'view', view: 'front' }, { kind: 'workspace', action: 'explore' }]), workflow, { allowLocalActions: true })).toThrow(/separate request/);
  });
  it('clarifies unavailable transfers and pending previews without changing the input context', () => {
    expect(parseTeachingPlan('explore this setup', context).clarification).toMatch(/Open a teaching workflow/);
    expect(parseTeachingPlan('restore my workspace', context).clarification).toMatch(/no saved workspace/);
    expect(parseTeachingPlan('return to source lesson', context).clarification).toMatch(/no source lesson/);
    expect(parseTeachingPlan('return to source lesson', { ...workflow, hasWorkflowOrigin: true }).clarification).toMatch(/no source lesson/);
    const pending = { ...origin, tryPreview: true, tryMode: false }, before = structuredClone(pending);
    for (const text of ['explore this setup', 'restore my workspace', 'return to source lesson', 'return to lesson']) {
      expect(parseTeachingPlan(text, pending)).toMatchObject({ actions: [], clarification: expect.stringMatching(/Apply or discard/) });
    }
    expect(pending).toEqual(before);
  });
  it('permits case appliance displays without generating tooth movement actions', () => {
    const before = structuredClone(context);
    expect(parseTeachingPlan('place brackets only then show front view', context).actions).toEqual([{ kind: 'appliance-display', preset: 'brackets' }, { kind: 'view', view: 'front' }]);
    expect(parseTeachingPlan('hide gums and place palatal expander', context).actions).toEqual([{ kind: 'toggle', target: 'gums', visible: false }, { kind: 'appliance-display', preset: 'palatal-expander' }]);
    expect(parseTeachingPlan('remove teaching appliance', context).actions).toEqual([{ kind: 'appliance-display', preset: 'none' }]);
    expect(parseTeachingPlan('place braces', workflow).clarification).toMatch(/workspace/);
    expect(context).toEqual(before);
  });
  it('limits imported appliance displays to braces or removal', () => {
    const imported = { ...context, synthetic: false };
    for (const text of ['place brackets only', 'place expander bands', 'place palatal expander', 'place fixed retainer']) {
      expect(parseTeachingPlan(text, imported)).toMatchObject({ actions: [], clarification: expect.stringMatching(/synthetic model/) });
    }
    for (const text of ['place braces', 'remove teaching appliance']) expect(parseTeachingPlan(text, imported).actions).toHaveLength(1);
  });
  it('preserves optional local appliance display metadata while keeping preset-only commands unchanged', () => {
    for (const metadata of [{}, { progress: 0 }, { progress: 1 }, { palate: false }, { progress: .37, palate: true }]) {
      const action = { kind: 'appliance-display', preset: 'palatal-expander', ...metadata };
      expect(validateTeachingPlan(plan([action]), context, { allowLocalActions: true }).actions).toEqual([action]);
    }
    expect(parseTeachingPlan('place palatal expander', context).actions).toEqual([{ kind: 'appliance-display', preset: 'palatal-expander' }]);
    expect(() => validateTeachingPlan(plan([{ kind: 'appliance-display', preset: 'palatal-expander', progress: .37, palate: true }]), context)).toThrow(/local commands only/);
  });
  it.each([
    { progress: -.01 }, { progress: 1.01 }, { progress: NaN }, { progress: Infinity }, { progress: -Infinity },
    { progress: '.5' }, { progress: null }, { progress: undefined }, { palate: 'true' }, { palate: 1 }, { palate: null }, { palate: undefined },
  ])('rejects malformed appliance metadata %j', metadata => {
    expect(() => validateTeachingPlan(plan([{ kind: 'appliance-display', preset: 'palatal-expander', ...metadata }]), context, { allowLocalActions: true })).toThrow();
  });
  it('strictly rejects new kinds from external plans and extra data from local buttons', () => {
    for (const action of [{ kind: 'workspace', action: 'explore' }, { kind: 'appliance-display', preset: 'braces' }]) {
      expect(() => validateTeachingPlan(plan([action]), workflow)).toThrow(/local commands only/);
    }
    for (const action of [
      { kind: 'workspace', action: 'restore', tooth: '11' }, { kind: 'workspace', action: 'copy' },
      { kind: 'appliance-display', preset: 'braces', amount: 1 }, { kind: 'appliance-display', preset: 'aligner' },
    ]) expect(() => validateTeachingPlan(plan([action]), origin, { allowLocalActions: true })).toThrow();
  });
});

describe('local Try Mode planning', () => {
  const active: TeachingContext = { ...context, tryMode: true, tryPreview: false, tryLastMovement: false, lockedIds: [], savedArrangementNames: [] };
  const mechanics = (text: string, state = active) => parseTeachingPlan(text, state);
  it('enters before locking a patient-side group and keeps the source context unchanged', () => {
    const before = structuredClone(context);
    expect(mechanics('enter try mode then lock upper left molars', context).actions).toEqual([
      { kind: 'try', action: { type: 'enter' } }, { kind: 'try', action: { type: 'lock', teeth: ['26', '27'], locked: true } },
    ]);
    expect(mechanics('unlock selection', { ...active, selectedIds: ['11', '21'] }).actions).toEqual([{ kind: 'try', action: { type: 'lock', teeth: ['11', '21'], locked: false } }]);
    expect(context).toEqual(before);
  });
  it('maps posterior and upward to fixed case axes independent of camera and arch', () => {
    const text = 'select upper front six then move selected segment posterior one millimeter';
    const expected = { kind: 'try', action: { type: 'preview', edit: { type: 'segment-translate', teeth: ['11', '12', '13', '21', '22', '23'], axis: 'z', amount: -1 } } };
    for (const view of ['front', 'right', 'left', 'occlusal', 'perspective'] as const) expect(mechanics(text, { ...active, view }).actions[1]).toEqual(expected);
    expect(mechanics('move segment upward half a millimeter', { ...active, arch: 'lower' }).actions[0]).toMatchObject({ action: { edit: { axis: 'y', amount: .5 } } });
  });
  it('requires a segment rotation axis and builds a rigid segment preview', () => {
    expect(mechanics('rotate segment teeth 11,21 five degrees around z').actions[0]).toEqual({ kind: 'try', action: { type: 'preview', edit: { type: 'segment-rotate', teeth: ['11', '21'], axis: 'z', amount: 5 } } });
    expect(mechanics('rotate selected segment five degrees')).toMatchObject({ actions: [], clarification: expect.stringMatching(/which fixed case axis/) });
  });
  it.each(['equal', 'first', 'second'] as const)('uses an explicit %s gap allocation and preserves pair order', rule => {
    expect(mechanics(`close selected gap with ${rule}`, { ...active, selectedIds: ['21', '11'] }).actions[0]).toEqual({ kind: 'try', action: { type: 'preview', edit: { type: 'close-gap', teeth: ['21', '11'], rule, gap: 0 } } });
  });
  it('clarifies an unspecified gap allocation and all missing quantities before earlier actions run', () => {
    for (const text of ['hide gums then close selected gap', 'hide gums then move segment posterior', 'increase width between teeth 16,26 by 1 mm', 'fit selected teeth to arch curve', 'save arrangement']) {
      const result = mechanics(text); expect(result.actions).toEqual([]); expect(result.clarification).toBeTruthy();
    }
  });
  it('uses a symmetric total width delta and explicit target arch dimensions', () => {
    expect(mechanics('decrease width between teeth 16,26 by 2 mm symmetrically').actions[0]).toMatchObject({ action: { edit: { type: 'change-width', teeth: ['16', '26'], amount: -2 } } });
    expect(mechanics('fit upper front six to arch curve width 54 mm and depth 34 mm').actions).toEqual([
      { kind: 'try', action: { type: 'set-arch', arch: 'upper', width: 54, depth: 34 } },
      { kind: 'try', action: { type: 'preview', edit: { type: 'fit-arch', arch: 'upper', teeth: ['11', '12', '13', '21', '22', '23'] } } },
    ]);
    expect(mechanics('fit upper incisors to arch width 54 mm depth 34 mm', { ...active, synthetic: false }).clarification).toMatch(/synthetic/);
  });
  it('keeps compare actions as overlays and never silently previews a restoration', () => {
    expect(mechanics('save arrangement first setup then compare saved arrangement first setup').actions).toEqual([
      { kind: 'try', action: { type: 'save-snapshot', name: 'first setup' } }, { kind: 'try', action: { type: 'compare-snapshot', name: 'first setup' } },
    ]);
    expect(mechanics('compare original').actions).toEqual([{ kind: 'comparison', mode: 'overlay' }]);
    expect(mechanics('compare with original').actions).toEqual([{ kind: 'comparison', mode: 'overlay' }]);
    expect(mechanics('compare saved arrangement setup a', { ...active, savedArrangementNames: ['Setup A'] }).actions[0]).toMatchObject({ action: { name: 'Setup A' } });
    expect(mechanics('compare saved arrangement missing').clarification).toMatch(/saved arrangement/);
  });
  it('omits optional as from saved names and returns to the preserved case before entering Try Mode', () => {
    expect(mechanics('save arrangement as example one').actions).toEqual([{ kind: 'try', action: { type: 'save-snapshot', name: 'example 1' } }]);
    expect(mechanics('save group as upper molars', { ...active, arch: 'lower', selectedIds: ['11', '21'] }).actions).toEqual([{ kind: 'try', action: { type: 'save-group', name: 'upper molars', teeth: ['11', '21'] } }]);
    expect(mechanics('return to try mode', workflow).actions).toEqual([{ kind: 'workflow', action: 'exit' }, { kind: 'try', action: { type: 'enter' } }]);
    expect(mechanics('return to try mode', context).actions).toEqual([{ kind: 'try', action: { type: 'enter' } }]);
    expect(mechanics('return to try mode then move it x 1 mm', workflow).clarification).toMatch(/separate request/);
  });
  it('requires pending previews to be resolved before leaving or saving the arrangement', () => {
    const pending = { ...active, tryPreview: true };
    expect(mechanics('leave try mode', pending).clarification).toMatch(/Apply or discard/);
    expect(mechanics('save arrangement baseline', pending).clarification).toMatch(/Apply or discard/);
    expect(mechanics('discard preview then leave try mode', pending).actions).toHaveLength(2);
  });
  it('represents smaller as a baseline factor, and explicit revisions carry their unit', () => {
    const state = { ...active, tryLastMovement: true, tryPreview: true };
    expect(mechanics('make last movement smaller', state).actions).toEqual([{ kind: 'try', action: { type: 'revise', factor: .5 } }]);
    expect(mechanics('change last movement to 0.5 mm', state).actions).toEqual([{ kind: 'try', action: { type: 'revise', amount: .5, unit: 'mm' } }]);
    expect(mechanics('make last movement smaller').clarification).toMatch(/numeric movement/);
  });
  it('preflights preview/apply/discard sequentially and prevents accidental preview replacement', () => {
    expect(mechanics('move tooth 11 x 1 mm then apply preview').actions).toHaveLength(2);
    expect(mechanics('move segment x 1 mm then discard preview then move segment y 1 mm').actions).toHaveLength(3);
    expect(mechanics('move segment x 1 mm then move segment y 1 mm')).toMatchObject({ actions: [], clarification: expect.stringMatching(/Apply or discard/) });
    expect(mechanics('apply preview').clarification).toMatch(/preview first/);
  });
  it('tracks the actual preview selection and allows a locked stationary gap reference', () => {
    const result = mechanics('move segment upper front six x 1 mm then apply preview then move them y 1 mm');
    expect(result.actions[2]).toMatchObject({ kind: 'dental', command: { teeth: ['11', '12', '13', '21', '22', '23'], direction: 'y' } });
    expect(mechanics('close selected gap with first', { ...active, selectedIds: ['11', '21'], lockedIds: ['21'] }).actions).toHaveLength(1);
    expect(mechanics('close selected gap with equal', { ...active, selectedIds: ['11', '21'], lockedIds: ['21'] }).clarification).toMatch(/Unlock 21/);
    expect(mechanics('lock tooth 11 then move segment x 1 mm').clarification).toMatch(/Unlock 11/);
    expect(mechanics('make last movement smaller then apply preview then move them x 1 mm', { ...active, tryLastMovement: true, tryLastIds: ['21'] }).actions[2]).toMatchObject({ kind: 'dental', command: { teeth: ['21'] } });
  });
  it('requires case Try Mode, validates bounds, and keeps new mechanics outside AI plans', () => {
    expect(mechanics('lock molars', context).clarification).toMatch(/Enter Try Mode/);
    expect(mechanics('enter try mode', workflow).clarification).toMatch(/Return to your case/);
    expect(mechanics('move segment x 11 mm').actions).toEqual([]);
    expect(() => validateTeachingPlan(plan([{ kind: 'try', action: { type: 'enter' } }]), context)).toThrow(/local commands/);
    expect(() => validateTeachingPlan(plan([{ kind: 'try', action: { type: 'preview', edit: { type: 'segment-translate', teeth: ['11'], axis: 'x', amount: NaN } } }]), active, { allowLocalActions: true })).toThrow();
  });
  it('leaves unfamiliar legacy wording available to AI while keeping known invalid local commands local', () => {
    expect(() => mechanics('show me the frontal camera')).toThrow();
    expect(() => mechanics('display gingival tissue invisibly')).toThrow();
    expect(mechanics('move tooth 18 x 1 mm').clarification).toMatch(/not present/);
    expect(mechanics('move selected teeth x 1 mm', { ...active, selectedIds: [] }).clarification).toMatch(/No teeth match/);
    expect(mechanics('move tooth 11 x 11 mm').clarification).toMatch(/nonzero amount/);
    expect(mechanics('move tooth 11 x 1 mm', { ...active, tryPreview: true }).clarification).toMatch(/Apply or discard/);
  });
  it('parses counted history only as a bounded standalone request', () => {
    expect(mechanics('undo the last two changes', context).actions).toEqual([{ kind: 'history', action: 'undo', count: 2 }]);
    expect(mechanics('redo 10 requests', context).actions).toEqual([{ kind: 'history', action: 'redo', count: 10 }]);
    expect(mechanics('undo 11 changes', context).clarification).toMatch(/1 and 10/);
    expect(mechanics('hide gums then undo 2 changes', context).actions).toEqual([]);
  });
  it('validates local display controls and positions any stage-count preview halfway', () => {
    expect(mechanics('show displacement traces then hide arch curve then play in reverse').actions).toEqual([
      { kind: 'try-display', target: 'traces', visible: true }, { kind: 'try-display', target: 'curve', visible: false }, { kind: 'try-playback', direction: 'reverse' },
    ]);
    expect(mechanics('pause halfway').actions).toEqual([{ kind: 'progress', value: 0.5 }]);
    expect(mechanics('pause halfway', { ...active, stages: 9 }).actions).toEqual([{ kind: 'progress', value: 0.5 }]);
    expect(mechanics('show arch curve', context).clarification).toMatch(/Enter Try Mode/);
    expect(() => validateTeachingPlan(plan([{ kind: 'try-playback', direction: 'reverse' }]), active)).toThrow(/local commands/);
  });
});

describe('local compound classroom planning', () => {
  it('preserves textual order and visible-arch group meaning in the professor example', () => {
    expect(parseTeachingPlan('Show upper jaw, hide gums, highlight molars, and demonstrate palatal expansion slowly', context).actions).toEqual([
      { kind: 'arch', arch: 'upper' }, { kind: 'toggle', target: 'gums', visible: false },
      { kind: 'select', teeth: ['16', '17', '26', '27'] },
      { kind: 'workflow', action: 'start', id: 'palatal-expansion' }, { kind: 'speed', value: 0.5 }, { kind: 'workflow', action: 'play' },
    ]);
  });

  it('resolves group and single pronouns against preceding actions, without changing the input', () => {
    const before = structuredClone(context);
    const result = parseTeachingPlan('select upper incisors then move them buccally half a millimeter, focus tooth twenty one and rotate it five degrees', context);
    expect(result.actions).toEqual([
      { kind: 'select', teeth: ['11', '12', '21', '22'] }, move(['11', '12', '21', '22'], 0.5),
      { kind: 'focus', tooth: '21' }, { kind: 'dental', command: { type: 'rotate', tooth: '21', axis: 'y', amount: 5 } },
    ]);
    expect(context).toEqual(before);
  });

  it('does not split ID lists, number words, or brackets and wires into different actions', () => {
    expect(parseTeachingPlan('select teeth eleven, twelve and twenty one, then move them x one and a half millimeters and show brackets and wires', context).actions).toEqual([
      { kind: 'select', teeth: ['11', '12', '21'] }, { kind: 'dental', command: { type: 'move_group', teeth: ['11', '12', '21'], direction: 'x', amount: 1.5 } },
      { kind: 'toggle', target: 'braces', visible: true },
    ]);
  });

  it('uses an explicit arch selector even when the displayed arch differs', () => {
    expect(parseTeachingPlan('show upper jaw and highlight lower molars', context).actions[1]).toEqual({ kind: 'select', teeth: ['36', '37', '46', '47'] });
    expect(parseTeachingPlan('highlight molars', { ...context, arch: 'lower' }).actions[0]).toEqual({ kind: 'select', teeth: ['36', '37', '46', '47'] });
  });

  it('preflights the whole request before returning any action', () => {
    const before = structuredClone(context);
    expect(() => parseTeachingPlan('hide gums and move tooth 99 x 1 mm', context)).toThrow();
    expect(context).toEqual(before);
    expect(() => parseTeachingPlan('hide gums and fly to Mars', context)).toThrow();
  });

  it('allows exactly eight actions and counts expanded demonstrations toward that bound', () => {
    expect(parseTeachingPlan(Array(8).fill('show roots').join(' then '), context).actions).toHaveLength(8);
    expect(() => parseTeachingPlan(Array(9).fill('show roots').join(' then '), context)).toThrow(/eight/);
    expect(() => parseTeachingPlan([...Array(6).fill('show roots'), 'demonstrate braces slowly'].join(' then '), context)).toThrow(/eight/);
  });

  it('allows a free movement experiment within a workflow, then returning to the lesson', () => {
    expect(parseTeachingPlan('move tooth eleven buccally one millimeter and return to the lesson', workflow).actions).toEqual([
      { kind: 'dental', command: { type: 'move', tooth: '11', direction: 'buccal', amount: 1 } }, { kind: 'return-lesson' },
    ]);
  });

  it.each(['fixed-braces', 'palatal-expansion', 'archwire-expansion', 'anatomy'])('allows reversible attachment variations within %s', workflowId => {
    const active = { ...workflow, workflowId, canReturnToLesson: false };
    expect(parseTeachingPlan('add rectangular attachment to tooth eleven then return to the lesson', active).actions).toEqual([
      { kind: 'attachment', action: 'add', teeth: ['11'], shape: 'rectangle' }, { kind: 'return-lesson' },
    ]);
    expect(validateTeachingPlan(plan([{ kind: 'attachment', action: 'remove', teeth: ['11', '21'] }, { kind: 'return-lesson' }]), active).actions).toEqual([
      { kind: 'attachment', action: 'remove', teeth: ['11', '21'] }, { kind: 'return-lesson' },
    ]);
    expect(() => parseTeachingPlan('add attachment to tooth eighteen', active)).toThrow(/present/);
  });

  it('can enter a fresh anatomy lesson before showing synthetic structures', () => {
    const imported = { ...context, availableIds: ['11'], synthetic: false };
    expect(parseTeachingPlan('start anatomy lesson then show bone then show periodontal ligament and explain this step', imported).actions).toEqual([
      { kind: 'anatomy-lesson', action: 'start' }, { kind: 'anatomy', action: 'bone', visible: true },
      { kind: 'anatomy', action: 'ligament', visible: true }, { kind: 'narrate', target: 'step' },
    ]);
    expect(parseTeachingPlan('demonstrate tipping then next step', imported).actions).toHaveLength(3);
    expect(() => parseTeachingPlan('demonstrate tipping then next step then next step', imported)).toThrow(/outside/);
    expect(parseTeachingPlan('compare translation and tipping then show bone', imported).actions).toEqual([
      { kind: 'anatomy-lesson', action: 'translation' }, { kind: 'workflow', action: 'play' },
      { kind: 'anatomy-lesson', action: 'tipping' }, { kind: 'workflow', action: 'play' }, { kind: 'anatomy', action: 'bone', visible: true },
    ]);
  });

  it.each(['translation', 'tipping'] as const)('expands demonstrate %s into step selection followed by playback', action => {
    expect(parseTeachingPlan(`demonstrate ${action}`, context).actions).toEqual([{ kind: 'anatomy-lesson', action }, { kind: 'workflow', action: 'play' }]);
    expect(parseTeachingPlan(`show ${action}`, context).actions).toEqual([{ kind: 'anatomy-lesson', action }]);
  });

  it('keeps tipping selected when playback begins, while selection-only anatomy actions do not imply playback', () => {
    const actions: TeachingAction[] = [{ kind: 'anatomy-lesson', action: 'tipping' }, { kind: 'dental', command: { type: 'play' } }, { kind: 'lesson-step', action: 'next' }];
    expect(validateTeachingPlan(plan(actions), context).actions).toEqual(actions);
    expect(() => validateTeachingPlan(plan([...actions, { kind: 'lesson-step', action: 'next' }]), context)).toThrow(/outside/);
  });

  it.each([
    ['show upper arch and move tooth 11 buccally', 'millimetres'],
    ['select upper incisors then intrude them', 'millimetres'],
    ['hide gums then rotate tooth 11', 'degrees'],
    ['torque upper incisors', 'degrees'],
  ])('clarifies a missing movement amount locally, without returning a partial plan: %s', (text, unit) => {
    const result = parseTeachingPlan(text, context);
    expect(result.actions).toEqual([]); expect(result.clarification).toContain(unit);
  });

  it('uses the documented bone display presets locally in a compound request', () => {
    expect(parseTeachingPlan('show the root and make the bone transparent', context).actions).toEqual([
      { kind: 'toggle', target: 'roots', visible: true }, { kind: 'anatomy', action: 'opacity', value: 0.25 },
    ]);
    expect(parseTeachingPlan('make bone opaque', context).actions).toEqual([{ kind: 'anatomy', action: 'opacity', value: 1 }]);
    expect(() => parseTeachingPlan('make bone transparent', { ...context, synthetic: false })).toThrow(/synthetic/);
  });

  it.each([
    'show gums and', 'show gums then', 'show gums; hack the scene', 'show roots, delete the patient',
    'show expansion', 'demonstrate expansion slowly',
    'move teeth eleven to eighteen x one millimeter', 'show bone then prescribe treatment',
    'do not hide gums', 'what if I move tooth eleven buccally one millimeter',
  ])('rejects incomplete, ambiguous, hypothetical or unsupported request: %s', text => {
    expect(() => parseTeachingPlan(text, context)).toThrow();
  });

  it('requires an actual group for them and a prior demonstration for replay', () => {
    expect(() => parseTeachingPlan('move them x 1 mm', { ...context, selectedIds: [] })).toThrow(/group/);
    expect(() => parseTeachingPlan('repeat that', context)).toThrow(/completed/);
    expect(parseTeachingPlan('repeat that more slowly', { ...context, lastActions: [move(['11'])] }).actions).toEqual([{ kind: 'replay', slower: true }]);
    expect(parseTeachingPlan('repeat that', workflow).actions).toEqual([{ kind: 'replay', slower: false }]);
  });
});

describe('strict external classroom plans', () => {
  it('validates every new action and returns independent arrays', () => {
    const actions: TeachingAction[] = [
      { kind: 'anatomy', action: 'bone', visible: true }, { kind: 'anatomy', action: 'cutaway', visible: true },
      { kind: 'anatomy', action: 'ligament', visible: true }, { kind: 'anatomy', action: 'opacity', value: 0.35 },
      { kind: 'speed', value: 0.5 }, { kind: 'select', teeth: ['11', '21'] }, move(['11', '21']), { kind: 'narrate', target: 'answer' },
    ];
    const before = structuredClone(actions), result = validateTeachingPlan(plan(actions), workflow);
    expect(result.actions).toEqual(actions); expect(result.actions).not.toBe(actions);
    (result.actions[5] as Extract<TeachingAction, { kind: 'select' }>).teeth.push('12');
    expect(actions).toEqual(before);
  });

  it('accepts a clarification only when it contains no actions', () => {
    const value = { actions: [], summary: '', clarification: 'Palatal expansion or archwire expansion?' };
    expect(validateTeachingPlan(value, context)).toEqual(value);
    expect(() => validateTeachingPlan({ ...value, actions: [{ kind: 'stop' }] }, context)).toThrow(/clarification/);
  });

  it('rejects a response for an earlier scene revision even when its action is otherwise valid', () => {
    expect(() => validateTeachingPlan(plan([{ kind: 'toggle', target: 'gums', visible: false }]), context, { expectedRevision: 6 })).toThrow(/changed/);
    expect(validateTeachingPlan(plan([{ kind: 'stop' }]), context, { expectedRevision: 7 }).actions).toEqual([{ kind: 'stop' }]);
  });

  it.each([
    null, [], {}, { actions: [], summary: '', clarification: null },
    { actions: [{ kind: 'stop' }], summary: '', clarification: null, code: 'alert(1)' },
    { actions: [{ kind: 'stop' }], summary: 123, clarification: null },
    { actions: [], summary: '', clarification: '' },
    { actions: [], summary: '', clarification: false },
    plan(Array(9).fill({ kind: 'stop' })),
  ])('rejects malformed plan envelope %#', value => expect(() => validateTeachingPlan(value, context)).toThrow());

  it.each([
    { kind: 'script', code: 'mesh.position.x = 99' }, { kind: 'stop', extra: true },
    { kind: 'select', teeth: ['11', '11'] }, { kind: 'select', teeth: ['99'] }, { kind: 'select', teeth: [] },
    { kind: 'view', view: 'inside' }, { kind: 'arch', arch: 'left' },
    { kind: 'toggle', target: 'gums', visible: 1 }, { kind: 'toggle', target: 'bone', visible: true },
    { kind: 'anatomy', action: 'bone' }, { kind: 'anatomy', action: 'bone', visible: 'true' },
    { kind: 'anatomy', action: 'opacity', value: -0.1 }, { kind: 'anatomy', action: 'opacity', value: 1.1 },
    { kind: 'anatomy', action: 'opacity', value: NaN }, { kind: 'anatomy', action: 'opacity', value: '0.5' },
    { kind: 'anatomy', action: 'opacity', value: 0.5, visible: true }, { kind: 'anatomy', action: 'nerve', visible: true },
    { kind: 'speed', value: 0 }, { kind: 'speed', value: 3 }, { kind: 'speed', value: '0.5' },
    { kind: 'narrate', target: 'invented' }, { kind: 'narrate', target: 'step', text: 'Arbitrary instructions' },
    { kind: 'question' }, { kind: 'question', visible: 'true' }, { kind: 'question', visible: 1 }, { kind: 'question', visible: null },
    { kind: 'question', visible: true, answer: 'Invented answer' },
    { kind: 'replay', slower: 1 }, { kind: 'return-lesson', id: 'other' }, { kind: 'anatomy-lesson', action: 'root-reconstruction' },
    { kind: 'workflow', action: 'start', id: 'anatomy' }, { kind: 'workflow', action: 'phase', phase: 'surgery' },
    { kind: 'attachment', action: 'remove', teeth: ['11'], shape: 'rectangle' },
    { kind: 'dental', command: { type: 'move_group', teeth: ['11', '11'], amount: 1, direction: 'x' } },
    { kind: 'dental', command: { type: 'move', tooth: '11', amount: 11, direction: 'x' } },
  ])('rejects missing, unknown, mistyped, or out-of-range action %#', action => {
    expect(() => validateTeachingPlan(plan([action]), workflow)).toThrow();
  });

  it('preflights capability changes in order, rather than checking only the starting scene', () => {
    const imported = { ...context, synthetic: false, availableIds: ['11'] };
    const start = { kind: 'workflow', action: 'start', id: 'fixed-braces' };
    expect(validateTeachingPlan(plan([start, { kind: 'anatomy', action: 'bone', visible: true }, move(['12'])]), imported).actions).toHaveLength(3);
    expect(() => validateTeachingPlan(plan([{ kind: 'anatomy', action: 'bone', visible: true }, start]), imported)).toThrow(/synthetic/);
    expect(() => validateTeachingPlan(plan([move(['12']), start]), imported)).toThrow(/present/);
    expect(validateTeachingPlan(plan([{ kind: 'anatomy', action: 'bone', visible: false }]), imported).actions).toHaveLength(1);
    expect(() => validateTeachingPlan(plan([{ kind: 'anatomy', action: 'opacity', value: 0.5 }]), imported)).toThrow(/synthetic/);
  });

  it('never silently drops a selected tooth when entering a smaller synthetic set', () => {
    const withWisdom = { ...context, availableIds: [...ids, '18'] };
    expect(() => validateTeachingPlan(plan([{ kind: 'select', teeth: ['11', '18'] }, { kind: 'workflow', action: 'start', id: 'fixed-braces' }]), withWisdom)).toThrow(/selected teeth/);
  });

  it('validates consecutive navigation against the intermediate step and exact retention destination', () => {
    const atEnd = { ...workflow, stepIndex: 5 };
    expect(() => validateTeachingPlan(plan([{ kind: 'workflow', action: 'next' }, { kind: 'workflow', action: 'next' }]), atEnd)).toThrow(/outside/);
    expect(() => validateTeachingPlan(plan([{ kind: 'workflow', action: 'phase', phase: 'retention' }, { kind: 'workflow', action: 'next' }]), workflow)).toThrow(/outside/);
    expect(validateTeachingPlan(plan([{ kind: 'workflow', action: 'phase', phase: 'retention' }, { kind: 'workflow', action: 'next' }]), { ...workflow, workflowId: 'palatal-expansion' }).actions).toHaveLength(2);
  });

  it('keeps undo/redo standalone and prevents dependent requests after restoring an unknown scene', () => {
    expect(validateTeachingPlan(plan([{ kind: 'dental', command: { type: 'undo' } }]), context).actions).toHaveLength(1);
    expect(() => validateTeachingPlan(plan([{ kind: 'dental', command: { type: 'undo' } }, { kind: 'stop' }]), context)).toThrow(/separate/);
    expect(() => validateTeachingPlan(plan([{ kind: 'replay', slower: false }, { kind: 'stop' }]), workflow)).toThrow(/separate/);
    expect(() => validateTeachingPlan(plan([{ kind: 'speed', value: 0.5 }, { kind: 'replay', slower: false }]), workflow)).toThrow(/separate/);
    expect(() => validateTeachingPlan(plan([{ kind: 'return-lesson' }, move(['11'])]), workflow)).toThrow(/before/);
    expect(() => validateTeachingPlan(plan([{ kind: 'workflow', action: 'exit' }, move(['11'])]), workflow)).toThrow(/before/);
  });

  it('requires lesson context for narration and return, and current stage bounds', () => {
    expect(() => validateTeachingPlan(plan([{ kind: 'narrate', target: 'step' }]), context)).toThrow(/lesson/);
    expect(() => validateTeachingPlan(plan([{ kind: 'return-lesson' }]), context)).toThrow(/lesson/);
    expect(() => validateTeachingPlan(plan([{ kind: 'stage', action: 'next' }]), context)).toThrow(/stage/);
    expect(validateTeachingPlan(plan([{ kind: 'dental', command: { type: 'stages', count: 20 } }, { kind: 'stage', action: 'exact', stage: 15 }]), context).actions).toHaveLength(2);
  });

  it('requires each numeric movement to use an explicit source quantity, including sign and units', () => {
    expect(validateTeachingPlan(plan([move(['11'], 0.5)]), context, { sourceText: 'move tooth eleven buccally half a millimeter' }).actions).toHaveLength(1);
    expect(validateTeachingPlan(plan([move(['11'], 1)]), context, { sourceText: 'move tooth 11 buccally 0.1 cm' }).actions).toHaveLength(1);
    for (const sourceText of ['move tooth eleven buccally', 'move tooth 11 buccally 1 degree', 'move tooth 11 buccally 2 mm', 'move tooth 11 buccally -1 mm']) expect(() => validateTeachingPlan(plan([move(['11'])]), context, { sourceText })).toThrow(/explicit/);
    expect(() => validateTeachingPlan(plan([move(['11']), move(['21'])]), context, { sourceText: 'move teeth 11 and 21 buccally 1 mm' })).toThrow(/explicit/);
    expect(() => validateTeachingPlan(plan([move(['11'])]), context, { sourceText: 'do not move tooth 11 buccally 1 mm' })).toThrow(/explicit/);
  });

  it('rejects stale selections and unsupported workflow contexts before validating an action', () => {
    expect(() => validateTeachingPlan(plan([{ kind: 'stop' }]), { ...context, selected: '18' })).toThrow(/stale/);
    expect(() => validateTeachingPlan(plan([{ kind: 'stop' }]), { ...workflow, workflowId: 'unknown' })).toThrow(/unsupported/);
    expect(() => validateTeachingPlan(plan([{ kind: 'stop' }]), { ...workflow, workflowId: 'anatomy', stepIndex: 4 })).toThrow(/stale/);
  });
});
