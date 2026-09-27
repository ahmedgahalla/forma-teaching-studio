import { expect, it, vi } from 'vitest';
import { createTeachingRuntime } from '@/lib/teaching-runtime';
import { getGlossaryEntry } from '@/lib/glossary';
import { setupToothStudy } from './tooth-study.fixtures';
import { caseNarration } from './narration';
import { getTeachingCase } from '@/lib/teaching-cases';

it('shows the model before narration and undoes/redoes the whole glossary request', async () => {
  const { api, host, settle } = setupToothStudy();
  const entry = getGlossaryEntry('cusp-of-carabelli')!;
  host.narration = target => caseNarration(api, target);
  host.speak = vi.fn(async text => {
    expect(api.toothStudy).toMatchObject({ tooth: '16', view: 'lingual' });
    expect(api.glossaryId).toBe(entry.id);
    expect(text).toBe(`${entry.term}. ${entry.definition}`);
  });
  const runtime = createTeachingRuntime(host);
  const before = api.captureClassroom();
  await runtime.submit('what is the cusp of Carabelli', { interpreter: 'ai' });
  expect(runtime.getState()).toMatchObject({ error: false, interpreter: 'local' });
  expect(host.speak).toHaveBeenCalledOnce();
  expect(host.interpret).not.toHaveBeenCalled();
  const shown = api.captureClassroom();
  await runtime.submit('undo');
  await settle();
  expect(api.captureClassroom()).toEqual(before);
  await runtime.submit('redo');
  await settle();
  expect(api.captureClassroom()).toEqual(shown);
  await runtime.submit('close the definition');
  expect(api.glossaryId).toBeNull();
  expect(api.toothStudy?.tooth).toBe('16');
  await runtime.submit('undo');
  expect(api.glossaryId).toBe(entry.id);
  runtime.dispose();
});

it('unknown explanation terms remain local even with AI preference enabled', async () => {
  const { host } = setupToothStudy();
  const runtime = createTeachingRuntime(host);
  await runtime.submit('what is quantum enamel', { interpreter: 'ai' });
  expect(runtime.getState()).toMatchObject({
    phase: 'idle',
    interpreter: 'local',
    message: expect.stringContaining('Try'),
  });
  expect(host.interpret).not.toHaveBeenCalled();
  runtime.dispose();
});

it('loads a case and matching variant before narrating, paused at zero, as one request', async () => {
  const { api, host, settle, preflight } = setupToothStudy();
  Object.defineProperties(api, {
    caseDefinition: { get: () => (api.scenario ? getTeachingCase(api.scenario.caseId) : null) },
    caseVariant: {
      get: () => api.caseDefinition?.variants.find(item => item.id === api.scenario?.variantId),
    },
  });
  host.narration = target => caseNarration(api, target);
  host.speak = vi.fn(async () => {
    expect(api.scenario).toMatchObject({ caseId: 'movement-types', variantId: 'torque' });
    expect(api.stage).toBe(0);
    expect(api.playing).toBe(false);
    expect(api.glossaryId).toBe('torque');
  });
  const runtime = createTeachingRuntime(host);
  const before = api.captureClassroom();
  const { glossaryActions } = await import('@/lib/glossary/plan');
  expect(() => preflight(glossaryActions('torque'))).not.toThrow();
  await runtime.submit('what is torque', { interpreter: 'ai' });
  expect(runtime.getState().error).toBe(false);
  expect(host.speak).toHaveBeenCalledOnce();
  expect(host.interpret).not.toHaveBeenCalled();
  const shown = api.captureClassroom();
  await runtime.submit('undo');
  await settle();
  expect(api.captureClassroom()).toEqual(before);
  await runtime.submit('redo');
  await settle();
  expect(api.captureClassroom()).toEqual(shown);
  runtime.dispose();
  for (const tooth of shown.lesson.model.teeth) {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  }
  for (const gum of shown.lesson.model.gums) gum.geometry.dispose();
});

it('preflight and dispatch reject invented glossary ids without changing state', () => {
  const { api, preflight } = setupToothStudy();
  const before = api.captureClassroom();
  expect(() => preflight([{ kind: 'glossary', id: 'invented' }])).toThrow(/authored/);
  expect(api.applyTeaching({ kind: 'glossary', id: 'invented' })).toBe(false);
  expect(api.captureClassroom()).toEqual(before);
});
