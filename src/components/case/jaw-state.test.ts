import { describe, expect, it, vi } from 'vitest';
import { createTeachingRuntime } from '@/lib/teaching-runtime';
import { validateLectureSetup } from '@/lib/planning';
import { createLectureSample } from '@/lib/lecture-documents';
import { validateLectureScene } from '@/lib/lecture-documents/scene';
import { DEMO_IDS } from '@/lib/classroom/types';
import { createWorkspaceActions } from './actions-workspace';
import { createIoActions } from './actions-io';
import { setupToothStudy } from './tooth-study.fixtures';
import {
  createLectureSessionActions,
  EMPTY_LECTURE_SESSION,
  type LectureSession,
} from '../lecture-builder/session';
import type { ClassroomSnapshot } from './types';

function atlasSetup() {
  const value = setupToothStudy();
  value.api.setModel({ ...value.api.model, asset: 'claude-atlas-v1' });
  return value;
}
describe('jaw display state lifecycle', () => {
  it('allows lecture reference changes and restores opening after exploring a question', () => {
    const { api, refs, host, preflight } = atlasSetup();
    const document = createLectureSample();
    let session: LectureSession = {
      ...EMPTY_LECTURE_SESSION,
      screen: 'lecture',
      documentId: document.id,
    };
    const original = { current: null as ClassroomSnapshot | null };
    const paused = { current: null as ClassroomSnapshot | null };
    const comparison = { current: null as ClassroomSnapshot | null };
    Object.assign(api, { shown: api.plan.current });
    const actions = () =>
      createLectureSessionActions(
        api,
        refs,
        session,
        next => {
          session = next;
        },
        id => (id === document.id ? document : undefined),
        document,
        original,
        paused,
        comparison,
      );
    const adapter = actions().decorate({
      ...host,
      preflight,
      apply: api.applyTeaching,
      restore: value => api.restoreClassroom(value as ClassroomSnapshot),
    });
    expect(() => adapter.preflight([{ kind: 'jaw', open: true }])).not.toThrow();
    expect(adapter.apply({ kind: 'jaw', open: true })).toBe(true);
    expect(api.jawOpen).toBe(true);
    actions().apply({ kind: 'presentation', action: 'explore' });
    api.setJawOpen(false);
    actions().apply({ kind: 'presentation', action: 'return' });
    expect(api.jawOpen).toBe(true);
    actions().apply({ kind: 'presentation', action: 'next' });
    expect(api.jawOpen).toBe(false);
  });
  it('uses real request history and keeps the solver/tooth poses unchanged', async () => {
    const { api, host } = atlasSetup();
    const runtime = createTeachingRuntime(host);
    const poses = api.plan.current;
    const before = api.captureClassroom();
    await runtime.submit('open jaw', { interpreter: 'ai' });
    expect(host.interpret).not.toHaveBeenCalled();
    expect(api.jawOpen).toBe(true);
    expect(api.plan.current).toBe(poses);
    expect(api.mechanics).toBe(before.mechanics);
    await runtime.submit('undo');
    expect(api.jawOpen).toBe(false);
    await runtime.submit('redo');
    expect(api.jawOpen).toBe(true);
    await runtime.submit('close jaw');
    expect(api.jawOpen).toBe(false);
    runtime.dispose();
  });
  it('restores jaw opening with a snapshot and defaults legacy snapshots to closed', () => {
    const { api } = atlasSetup();
    api.setJawOpen(true);
    const saved = api.captureClassroom();
    api.setJawOpen(false);
    api.restoreClassroom(saved);
    expect(api.jawOpen).toBe(true);
    const legacy = { ...saved, lesson: { ...saved.lesson } };
    delete legacy.lesson.jawOpen;
    api.restoreClassroom(legacy);
    expect(api.jawOpen).toBe(false);
  });
  it('preserves open state through tooth study and forbids changing it in the isolated view', () => {
    const { api, preflight } = atlasSetup();
    api.setJawOpen(true);
    api.applyTeaching({ kind: 'tooth-study', action: 'open', tooth: '16' });
    expect(() => preflight([{ kind: 'jaw', open: false }])).toThrow(/Return to the mouth/);
    expect(api.applyTeaching({ kind: 'jaw', open: false })).toBe(false);
    api.applyTeaching({ kind: 'tooth-study', action: 'close' });
    expect(api.jawOpen).toBe(true);
  });
  it('rejects unsupported models in preflight and dispatch before mutation', () => {
    const { api, preflight } = setupToothStudy();
    expect(() => preflight([{ kind: 'jaw', open: true }])).toThrow(/Atlas mouth/);
    expect(api.applyTeaching({ kind: 'jaw', open: true })).toBe(false);
    expect(api.jawOpen).toBe(false);
  });
  it('saves and reloads display opening, while old or unsupported models stay closed', () => {
    const { api, refs } = atlasSetup();
    Object.assign(api, { teaching: { cancel: vi.fn(), resetHistory: vi.fn() } });
    api.setJawOpen(true);
    const saved = createWorkspaceActions(api, refs).session();
    expect(saved.lectureSetup?.jawOpen).toBe(true);
    const { load } = createIoActions(api, refs);
    const model = api.model;
    load(model, {}, JSON.parse(JSON.stringify(saved)));
    expect(api.jawOpen).toBe(true);
    delete saved.lectureSetup!.jawOpen;
    load(model, {}, saved);
    expect(api.jawOpen).toBe(false);
    saved.lectureSetup!.jawOpen = true;
    load({ ...model, asset: undefined }, {}, saved);
    expect(api.jawOpen).toBe(false);
  });
  it('validates optional saved lecture state without breaking older authored scenes', () => {
    const scene = createLectureSample().steps[0].scene;
    expect(validateLectureSetup(scene.setup, new Set(DEMO_IDS), 10).jawOpen).toBe(false);
    const open = { ...scene, setup: { ...scene.setup, jawOpen: true } };
    expect(validateLectureScene(open).setup.jawOpen).toBe(true);
    expect(() =>
      validateLectureScene({ ...open, setup: { ...open.setup, jawOpen: 'yes' } }),
    ).toThrow();
  });
});
