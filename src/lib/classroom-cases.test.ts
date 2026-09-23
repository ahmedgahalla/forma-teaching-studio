import { describe, expect, it } from 'vitest';
import { interpreterTeachingContext, parseTeachingPlan, teachingActionMode, validateTeachingPlan, type TeachingContext } from './classroom';
import { TEACHING_CASES } from './teaching-cases';
import type { TeachingAction } from './lecture';

const context: TeachingContext = { mode: 'case', workflowId: null, stepIndex: 0, selected: '11', selectedIds: ['11'], availableIds: ['11', '21'], synthetic: true, revision: 3, view: 'front', arch: 'both', speed: 1 };
const active: TeachingContext = { ...context, caseId: 'deepbite', caseVariantId: 'anterior-intrusion', caseExploring: false, lessonActive: true };
const workflow: TeachingContext = { ...context, mode: 'workflow', workflowId: 'fixed-braces', stepIndex: 1 };
const plan = (actions: unknown[]) => ({ actions, summary: 'Prepared case command', clarification: null });
const local = { allowLocalActions: true };

describe('authored case commands', () => {
  it.each(TEACHING_CASES.flatMap(item => [item.id, item.title, ...(item.aliases || [])].map(alias => [item.id, alias])))('loads %s using catalog name %s without mutating the current model context', (id, alias) => {
    const before = structuredClone(context);
    expect(parseTeachingPlan(`load ${alias}`, context).actions).toEqual([{ kind: 'case', action: 'load', id }]);
    expect(context).toEqual(before);
  });

  it.each(['load deep bite case', 'load case deep bite', 'open teaching case deep bite', 'start prepared case deep bite'])('supports the explicit form %s', text => {
    expect(parseTeachingPlan(text, context).actions).toEqual([{ kind: 'case', action: 'load', id: 'deepbite' }]);
  });

  it('routes a load request from a workflow to the case editor', () => {
    const action = parseTeachingPlan('load anterior crowding', workflow).actions[0];
    expect(action).toEqual({ kind: 'case', action: 'load', id: 'crowding' });
    expect(teachingActionMode(action, 'workflow')).toBe('case');
    expect(teachingActionMode({ kind: 'workflow', action: 'start', id: 'fixed-braces' }, 'case')).toBe('workflow');
    expect(teachingActionMode({ kind: 'toggle', target: 'gums', visible: false }, 'workflow')).toBe('workflow');
  });

  it.each(TEACHING_CASES.flatMap(item => item.variants.flatMap(variant => [variant.id, variant.title, ...(variant.aliases || [])].map(alias => [item.id, variant.id, alias]))))('chooses an authored variant %s / %s by %s without silently playing', (caseId, id, alias) => {
    expect(parseTeachingPlan(`choose ${alias}`, { ...context, caseId }).actions).toEqual([{ kind: 'case', action: 'variant', id }]);
  });

  it('resolves common movement aliases within the current prepared case', () => {
    expect(parseTeachingPlan('demonstrate intrusion', active).actions).toEqual([{ kind: 'case', action: 'variant', id: 'anterior-intrusion' }]);
    expect(parseTeachingPlan('choose posterior extrusion', active).actions).toEqual([{ kind: 'case', action: 'variant', id: 'posterior-extrusion' }]);
    expect(parseTeachingPlan('demonstrate tipping', { ...context, caseId: 'movement-types' }).actions).toEqual([{ kind: 'case', action: 'variant', id: 'tip' }]);
    expect(parseTeachingPlan('demonstrate rotation', { ...context, caseId: 'movement-types' }).actions).toEqual([{ kind: 'case', action: 'variant', id: 'axial-rotation' }]);
    expect(parseTeachingPlan('demonstrate translation', context).actions[0]).toEqual({ kind: 'anatomy-lesson', action: 'translation' });
  });

  it.each([
    ['play case', 'play'], ['pause the case', 'pause'], ['reset prepared case', 'reset'], ['restart case', 'reset'],
    ['play demonstration', 'play'], ['pause demonstration', 'pause'],
    ['explore this arrangement', 'explore'], ['try this setup', 'explore'], ['return to prepared case', 'return'], ['return to the lesson', 'return'],
  ])('maps %s to the local case action %s', (text, action) => {
    expect(parseTeachingPlan(text, active).actions).toEqual([{ kind: 'case', action }]);
  });

  it('accepts prepared lecture suggestions without enabling Try Mode or requiring even stages', () => {
    const prepared = { ...active, stages: 9, tryMode: false };
    expect(parseTeachingPlan('pause halfway', prepared).actions).toEqual([{ kind: 'case', action: 'progress', value: .5 }]);
    expect(parseTeachingPlan('reveal answer', prepared).actions).toEqual([{ kind: 'question', visible: true }]);
    expect(parseTeachingPlan('play demonstration', workflow).actions).toEqual([{ kind: 'workflow', action: 'play' }]);
    expect(parseTeachingPlan('pause halfway', { ...prepared, caseExploring: true }).actions).toEqual([{ kind: 'progress', value: .5 }]);
    expect(parseTeachingPlan('play demonstration then reveal answer', prepared)).toMatchObject({ actions: [], clarification: expect.stringMatching(/separate request/) });
  });

  it('retains legacy workflow transfer meanings without an active prepared case', () => {
    expect(parseTeachingPlan('try this setup', workflow).actions).toEqual([{ kind: 'workspace', action: 'explore' }]);
    expect(parseTeachingPlan('return to lesson', { ...context, hasWorkflowOrigin: true }).actions).toEqual([{ kind: 'workspace', action: 'lesson' }]);
  });

  it.each([['set case progress to 50 percent', .5], ['show case progress 100%', 1], ['set case progress 0', 0], ['set case progress to .25', .25]])('parses explicit progress %s', (text, value) => {
    expect(parseTeachingPlan(text as string, active).actions).toEqual([{ kind: 'case', action: 'progress', value }]);
  });

  it.each(['treat this case', 'correct the deep bite', 'how should i treat deep bite', 'choose the best treatment', 'demonstrate bite correction'])('clarifies %s by listing current authored choices without inventing mechanics', text => {
    const result = parseTeachingPlan(text, active);
    expect(result.actions).toEqual([]);
    expect(result.clarification).toContain('Upper-incisor intrusion');
    expect(result.clarification).toContain('Posterior extrusion concept');
  });

  it.each(['load missing case', 'load patient 52', 'play case', 'choose intrusion', 'explore this arrangement', 'return to prepared case'])('clarifies unavailable case requests: %s', text => {
    expect(parseTeachingPlan(text, context)).toMatchObject({ actions: [], clarification: expect.any(String) });
  });

  it.each(['load deep bite then move tooth 99 x 1 mm', 'hide gums then load deep bite', 'choose intrusion and play case', 'play case and hide roots', 'return to prepared case then move it x 1 mm'])('requires %s to be split into separate requests before touching any scene', text => {
    expect(parseTeachingPlan(text, active)).toMatchObject({ actions: [], clarification: expect.stringMatching(/separate request/) });
  });

  it('blocks every prepared edit during a pending Try preview while leaving pause available', () => {
    const pending = { ...active, tryPreview: true, caseExploring: true };
    for (const text of ['load crowding', 'choose intrusion', 'play case', 'reset case', 'set case progress .5', 'explore this arrangement', 'return to prepared case']) {
      expect(parseTeachingPlan(text, pending)).toMatchObject({ actions: [], clarification: expect.stringMatching(/Apply or discard/) });
    }
    expect(parseTeachingPlan('pause case', pending).actions).toEqual([{ kind: 'case', action: 'pause' }]);
  });

  it('does not rerun prepared trajectories on free exploration edits', () => {
    const editing = { ...active, caseExploring: true };
    for (const text of ['choose intrusion', 'play case', 'reset case', 'set case progress .5']) expect(parseTeachingPlan(text, editing).clarification).toMatch(/Return to the prepared case/);
    expect(parseTeachingPlan('explore this arrangement', editing).clarification).toMatch(/already open/);
    expect(parseTeachingPlan('return to lesson', editing).actions).toEqual([{ kind: 'case', action: 'return' }]);
  });
});

describe('case action trust boundary', () => {
  const actions: TeachingAction[] = [{ kind: 'case', action: 'load', id: 'deepbite' }, { kind: 'case', action: 'variant', id: 'anterior-intrusion' }, ...(['play', 'pause', 'reset', 'explore', 'return'] as const).map(action => ({ kind: 'case' as const, action })), { kind: 'case', action: 'progress', value: .5 }];
  it.each(actions)('never accepts generated case action %j', action => {
    expect(() => validateTeachingPlan(plan([action]), active)).toThrow(/local commands only/);
    expect(validateTeachingPlan(plan([action]), active, local).actions).toEqual([action]);
  });
  it.each(actions)('requires one whole request for %j even from local controls', action => {
    expect(() => validateTeachingPlan(plan([action, { kind: 'toggle', target: 'gums', visible: false }]), active, local)).toThrow(/separate request/);
  });
  it.each([
    { kind: 'case', action: 'load', id: 'patient-1' }, { kind: 'case', action: 'variant', id: 'translation' },
    { kind: 'case', action: 'progress', value: -1 }, { kind: 'case', action: 'progress', value: 1.1 },
    { kind: 'case', action: 'progress', value: NaN }, { kind: 'case', action: 'progress', value: Infinity },
    { kind: 'case', action: 'progress', value: '.5' }, { kind: 'case', action: 'play', id: 'deepbite' },
    { kind: 'case', action: 'load', id: 'deepbite', script: 'run()' }, { kind: 'case', action: 'solve' },
  ])('rejects unknown targets or unsupported case input %j', action => {
    expect(() => validateTeachingPlan(plan([action]), active, local)).toThrow();
  });
  it('requires the destination case context for controls and validates saved case metadata', () => {
    expect(() => validateTeachingPlan(plan([{ kind: 'case', action: 'play' }]), workflow, local)).toThrow(/Load a prepared/);
    for (const extra of [{ caseId: 'missing' }, { caseId: 'deepbite', caseVariantId: 'translation' }, { caseVariantId: 'translation' }, { caseExploring: true }]) {
      expect(() => validateTeachingPlan(plan([{ kind: 'case', action: 'play' }]), { ...context, ...extra }, local)).toThrow();
    }
    expect(() => validateTeachingPlan(plan([actions[0]]), active, { ...local, expectedRevision: 2 })).toThrow(/context changed/);
  });
  it('removes local case and history context before interpretation without altering the caller', () => {
    const original: TeachingContext = { ...active, tryMode: true, tryPreview: false, lockedIds: ['11'], canRestoreWorkspace: true, hasWorkflowOrigin: true, lastActions: [{ kind: 'case', action: 'variant', id: 'anterior-intrusion' }] };
    const before = structuredClone(original), wire = interpreterTeachingContext(original);
    for (const field of ['caseId', 'caseVariantId', 'caseExploring', 'tryMode', 'tryPreview', 'lockedIds', 'canRestoreWorkspace', 'hasWorkflowOrigin', 'lastActions']) expect(Object.hasOwn(wire, field)).toBe(false);
    expect(wire.availableIds).toEqual(context.availableIds);
    expect(wire.revision).toBe(3);
    expect(original).toEqual(before);
    const view: TeachingAction = { kind: 'view', view: 'front' };
    expect(interpreterTeachingContext({ ...active, lastActions: [view] }).lastActions).toEqual([view]);
  });
});
