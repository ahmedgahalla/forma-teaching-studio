import { describe, expect, it } from 'vitest';
import { createTeachingRuntime } from '@/lib/teaching-runtime';
import { getTeachingCase } from '@/lib/teaching-cases';
import type { TeachingAction } from '@/lib/lecture';
import { setupToothStudy as setup } from './tooth-study.fixtures';

const open: TeachingAction = { kind: 'tooth-study', action: 'open', tooth: '16' };
const close: TeachingAction = { kind: 'tooth-study', action: 'close' };

describe('case tooth-study dispatch and snapshots', () => {
  it('opens an isolated rooted tooth, changes side, explains, and restores the exact prior mouth', async () => {
    const { api, refs, settle, camera } = setup();
    const before = api.captureClassroom();
    expect(api.applyTeaching(open)).toBe(true);
    expect(api.toothStudy).toMatchObject({
      tooth: '16',
      view: 'buccal',
      revision: 1,
      explanationVisible: false,
    });
    expect(api).toMatchObject({
      selected: '16',
      selectedIds: ['16'],
      isolated: true,
      roots: true,
      gums: false,
      labels: false,
      arch: 'upper',
    });
    expect(api.anatomy).toEqual({ bone: false, ligament: false, cutaway: false, opacity: 0.37 });
    expect(api.applyTeaching({ kind: 'tooth-study', action: 'view', view: 'mesial' })).toBe(true);
    expect(api.toothStudy).toMatchObject({ view: 'mesial', revision: 2 });
    expect(api.applyTeaching({ kind: 'tooth-study', action: 'explain' })).toBe(true);
    expect(api.toothStudy?.explanationVisible).toBe(true);
    expect(api.applyTeaching(close)).toBe(true);
    expect(refs.pendingCamera.current).toEqual(before.camera);
    await settle();
    expect(api.captureClassroom()).toEqual(before);
    expect(camera()).toEqual(before.camera);
  });

  it('keeps the original return view when changing the studied tooth or reopening it', () => {
    const { api } = setup();
    const before = api.captureClassroom();
    api.applyTeaching(open);
    const prior = api.toothStudy?.prior;
    api.applyTeaching({ kind: 'tooth-study', action: 'open', tooth: '46', view: 'apical' });
    expect(api.toothStudy).toMatchObject({ tooth: '46', view: 'apical', revision: 2 });
    expect(api.toothStudy?.prior).toBe(prior);
    expect(api.toothStudy?.prior.selectedIds).toEqual(before.lesson.selectedIds);
    expect(api.arch).toBe('lower');
  });

  it('explains the single selected tooth and refuses an ambiguous selection without changes', () => {
    const { api, preflight } = setup();
    const explain: TeachingAction = { kind: 'tooth-study', action: 'explain' };
    const before = api.captureClassroom();
    expect(() => preflight([explain])).toThrow(/Select one tooth/);
    expect(api.applyTeaching(explain)).toBe(false);
    expect(api.captureClassroom()).toEqual(before);
    api.setSelectedIds(['46']);
    expect(() => preflight([explain])).not.toThrow();
    expect(api.applyTeaching(explain)).toBe(true);
    expect(api.toothStudy).toMatchObject({ tooth: '46', view: 'buccal', explanationVisible: true });
  });

  it('preflights sequential selection/open/view and rejects unsupported models before mutation', () => {
    const { api, preflight } = setup();
    expect(() =>
      preflight([
        { kind: 'select', teeth: ['16'] },
        { kind: 'tooth-study', action: 'explain' },
      ]),
    ).not.toThrow();
    expect(() =>
      preflight([open, { kind: 'tooth-study', action: 'view', view: 'occlusal' }]),
    ).not.toThrow();
    expect(() => preflight([{ kind: 'tooth-study', action: 'view', view: 'mesial' }])).toThrow(
      /Select one tooth/,
    );
    api.setModel({ ...api.model, demo: false });
    const before = api.captureClassroom();
    expect(() => preflight([open])).toThrow(/synthetic model/);
    expect(api.applyTeaching(open)).toBe(false);
    expect(api.captureClassroom()).toEqual(before);
  });

  it('rejects close followed by explanation before any scene changes', () => {
    const { api, preflight } = setup();
    api.applyTeaching(open);
    const before = api.captureClassroom();
    expect(() => preflight([close, { kind: 'tooth-study', action: 'explain' }])).toThrow(
      /Close tooth study as the final action/,
    );
    expect(api.captureClassroom()).toEqual(before);
    expect(() => preflight([open, close])).not.toThrow();
  });

  it.each(['reset', 'variant', 'return'] as const)(
    'closes study before same-model prepared-case %s restores its display',
    async action => {
      const { api, settle } = setup();
      const definition = getTeachingCase('reference-occlusion');
      const variant = definition.variants[0];
      const previous = api.model;
      Object.assign(api, {
        scenario: {
          caseId: definition.id,
          variantId: variant.id,
          model: previous,
          returnProgress: 0,
          exploring: false,
          answerVisible: false,
        },
        caseDefinition: definition,
        caseVariant: variant,
      });
      api.applyTeaching(open);
      const prior = api.toothStudy?.prior;
      expect(
        api.applyTeaching(
          action === 'variant'
            ? { kind: 'case', action, id: variant.id }
            : { kind: 'case', action },
        ),
      ).toBe(true);
      await settle();
      expect(api.model).toBe(previous);
      expect(api.toothStudy).toBeNull();
      expect(api.isolated).toBe(prior?.isolated);
      expect(api.roots).toBe(prior?.roots);
      expect(api.gums).toBe(prior?.gums);
      expect(api.anatomy).toEqual(prior?.anatomy);
      expect(api.selectedIds).toEqual(definition.selectedIds);
    },
  );

  it('undoes and redoes a multi-action study request and its close as whole scene snapshots', async () => {
    const { api, host, settle } = setup();
    const before = api.captureClassroom();
    const runtime = createTeachingRuntime(host);
    try {
      await runtime.submitActions(
        [open, { kind: 'tooth-study', action: 'view', view: 'lingual' }],
        'Study tooth 16',
      );
      expect(runtime.getState().error).toBe(false);
      expect(api.toothStudy).toMatchObject({ tooth: '16', view: 'lingual' });
      const studied = api.captureClassroom();
      await runtime.submit('undo');
      await settle();
      expect(api.captureClassroom()).toEqual(before);
      await runtime.submit('redo');
      await settle();
      expect(api.captureClassroom()).toEqual(studied);
      await runtime.submitActions([close], 'Full mouth');
      expect(api.captureClassroom()).toEqual(before);
      await runtime.submit('undo');
      await settle();
      expect(api.captureClassroom()).toEqual(studied);
      await runtime.submit('redo');
      await settle();
      expect(api.captureClassroom()).toEqual(before);
    } finally {
      runtime.dispose();
    }
  });
});
