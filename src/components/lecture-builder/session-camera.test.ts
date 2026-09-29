import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { createLectureSample, type LectureDocument } from '@/lib/lecture-documents';
import { createCaseJourneyLecture } from '@/lib/lecture-documents/sample-case-journey';
import type { PresentationAction } from '@/lib/classroom/presentation';
import type { ClassroomSnapshot } from '../case/types';
import { borrowJourneyModel } from './journey.fixtures';
import { lectureHarness } from './session.fixtures';
import { lectureStepSnapshot } from './scene-bridge';

let disposeModel: () => void;
beforeAll(() => {
  disposeModel = borrowJourneyModel('claude-atlas-v1');
});
afterAll(() => disposeModel());
const harnesses: ReturnType<typeof lectureHarness>[] = [];
afterEach(() => harnesses.splice(0).forEach(h => h.runtime.dispose()));
function setup(document = createCaseJourneyLecture(), others: LectureDocument[] = []) {
  const h = lectureHarness(document, others);
  harnesses.push(h);
  return h;
}
const camera: NonNullable<ClassroomSnapshot['camera']> = {
  position: [37, 21, 79],
  target: [4, -3, 2],
  up: [0, 1, 0],
  view: 'perspective',
  far: 12345,
  maxDistance: 2345,
};
function chooseCamera(h: ReturnType<typeof setup>, value = camera) {
  h.changeScene({
    ...h.snapshot,
    camera: structuredClone(value),
    lesson: { ...h.snapshot.lesson, view: value.view, camera: structuredClone(value) },
  });
}

it.each(['click', 'typed', 'voice'] as const)(
  'keeps the chosen 3D orbit, zoom and pan across every navigation control from %s',
  async input => {
    const h = setup();
    chooseCamera(h);
    const original = h.snapshot;
    await h.open();
    expect(h.snapshot.camera).toEqual(h.document.steps[0].scene.setup.camera);
    expect(h.snapshot.lesson.view).toBe(h.document.steps[0].scene.setup.view);
    chooseCamera(h);
    const controls: [string, PresentationAction, number][] = [
      ['next step', { kind: 'presentation', action: 'next' }, 1],
      ['go to step 4', { kind: 'presentation', action: 'go', index: 3 }, 3],
      ['previous step', { kind: 'presentation', action: 'previous' }, 2],
      ['go to step 9', { kind: 'presentation', action: 'go', index: 8 }, 8],
      ['go to step 12', { kind: 'presentation', action: 'go', index: 11 }, 11],
      ['go to step 17', { kind: 'presentation', action: 'go', index: 16 }, 16],
      ['restart lecture', { kind: 'presentation', action: 'restart' }, 0],
    ];
    for (const [text, action, index] of controls) {
      const authored = lectureStepSnapshot(h.document.steps[index], h.snapshot);
      if (input === 'click') await h.runtime.submitActions([action], text);
      else await h.runtime.submit(text, input === 'voice' ? { interpreter: 'local' } : {});
      expect(h.runtime.getState().error).toBe(false);
      expect(h.session.index).toBe(index);
      expect(h.snapshot.camera).toEqual(camera);
      expect(h.snapshot.lesson).toMatchObject({
        view: 'perspective',
        camera,
        arch: authored.lesson.arch,
        transforms: authored.lesson.transforms,
        jawOpen: authored.lesson.jawOpen,
        selectedIds: authored.lesson.selectedIds,
        roots: authored.lesson.roots,
        gums: authored.lesson.gums,
        stage: authored.lesson.stage,
      });
      expect(h.snapshot.applianceDisplay).toEqual(authored.applianceDisplay);
      expect(h.snapshot.mechanics).toEqual(authored.mechanics);
      expect(h.snapshot.anatomy).toEqual(authored.anatomy);
    }
    await h.runtime.submit('exit lecture');
    expect(h.snapshot).toEqual(original);
    expect(h.interpret).not.toHaveBeenCalled();
  },
);

it('uses the live camera view when the state label has not caught up, without aliasing it', async () => {
  const h = setup();
  await h.open();
  chooseCamera(h);
  h.changeScene({ ...h.snapshot, lesson: { ...h.snapshot.lesson, view: 'front' } });
  const before = h.snapshot;
  await h.runtime.submit('next step');
  expect(h.snapshot.lesson.view).toBe('perspective');
  expect(h.snapshot.camera).toEqual(camera);
  h.snapshot.camera!.target[0] = 999;
  expect(before.camera!.target).toEqual(camera.target);
  await h.runtime.submit('undo');
  expect(h.snapshot).toMatchObject(before);
});

it.each(['upper', 'lower'] as const)(
  'keeps the visible %s arch in occlusal view and resumes authored arch choices after choosing 3D',
  async arch => {
    const h = setup();
    await h.open();
    chooseCamera(h, { ...camera, view: 'occlusal' });
    h.changeScene({ ...h.snapshot, lesson: { ...h.snapshot.lesson, arch } });
    await h.runtime.submit('next step');
    expect(h.snapshot.lesson).toMatchObject({ view: 'occlusal', arch });
    expect(h.snapshot.camera).toEqual({ ...camera, view: 'occlusal' });
    chooseCamera(h);
    await h.runtime.submit('restart lecture');
    expect(h.snapshot.lesson.arch).toBe(h.document.steps[0].scene.setup.arch);
    expect(h.snapshot.camera).toEqual(camera);
  },
);

it('keeps a chosen preset without a viewer camera and preserves the single-control command rule', async () => {
  const h = setup();
  await h.open();
  h.changeScene({ ...h.snapshot, camera: null });
  const before = h.snapshot;
  await h.runtime.submit('3D view then next step');
  expect(h.runtime.getState()).toMatchObject({
    error: true,
    message: expect.stringMatching(/separate request/),
  });
  expect(h.snapshot).toBe(before);
  await h.runtime.submit('3D view');
  await h.runtime.submit('next step');
  expect(h.runtime.getState().error).toBe(false);
  expect(h.session.index).toBe(1);
  expect(h.snapshot.camera).toBeNull();
  expect(h.snapshot.lesson.view).toBe('perspective');
  expect(h.refs.pendingView.current).toBe('perspective');
  await h.runtime.submit('right view');
  await h.runtime.submit('next step');
  expect(h.runtime.getState().error).toBe(false);
  expect(h.session.index).toBe(2);
  expect(h.snapshot.lesson.view).toBe('right');
  expect(h.refs.pendingView.current).toBe('right');
});

it('opens a different lecture at its authored view and retains the independent Explore return point', async () => {
  const other = createLectureSample();
  const h = setup(createCaseJourneyLecture(), [other]);
  chooseCamera(h, { ...camera, view: 'right' });
  const original = h.snapshot;
  await h.open();
  chooseCamera(h);
  await h.runtime.submitActions([{ kind: 'presentation', action: 'open', id: other.id }], 'Open');
  expect(h.session.documentId).toBe(other.id);
  expect(h.snapshot.camera).toEqual(other.steps[0].scene.setup.camera);
  expect(h.snapshot.lesson.view).toBe(other.steps[0].scene.setup.view);
  chooseCamera(h, { ...camera, view: 'left' });
  const shown = h.snapshot;
  await h.runtime.submitActions([{ kind: 'presentation', action: 'open', id: other.id }], 'Open');
  expect(h.snapshot).toBe(shown);
  await h.runtime.submit('exit lecture');
  expect(h.snapshot).toEqual(original);
});

it.each(['authored', 'legacy'] as const)(
  'holds the chosen view and pose through %s comparisons, detours and exact return',
  async kind => {
    const h = setup(kind === 'authored' ? createCaseJourneyLecture() : createLectureSample());
    await h.open();
    chooseCamera(h);
    const paused = h.snapshot;
    await h.runtime.submit('compare start');
    await h.runtime.submit(kind === 'authored' ? 'compare finish' : 'compare tipping');
    expect(h.snapshot.lesson.view).toBe('perspective');
    expect(h.snapshot.lesson.camera).toEqual(camera);
    expect(h.snapshot.camera).toEqual(camera);
    chooseCamera(h, { ...camera, view: 'right', position: [99, 0, 0] });
    const comparison = h.snapshot;
    await h.runtime.submit('explore this step');
    chooseCamera(h, { ...camera, view: 'front' });
    await h.runtime.submit('return to lecture');
    expect(h.snapshot.lesson).toEqual(comparison.lesson);
    expect(h.snapshot.camera).toEqual(comparison.camera);
    await h.runtime.submit('close comparison');
    expect(h.snapshot).toEqual(paused);
    await h.runtime.submit('next step');
    expect(h.snapshot.camera).toEqual(camera);
  },
);

it('restores exact navigation history and leaves a canceled interpretation unable to replace the chosen view', async () => {
  const h = setup();
  await h.open();
  chooseCamera(h);
  const before = h.snapshot;
  await h.runtime.submit('next step');
  const after = h.snapshot;
  await h.runtime.submit('undo');
  expect(h.snapshot).toMatchObject(before);
  await h.runtime.submit('redo');
  expect(h.snapshot).toMatchObject(after);
  let resolve!: (result: unknown) => void;
  h.interpret.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  const pending = h.runtime.submit('make this easier to see', { interpreter: 'ai' });
  await vi.waitFor(() => expect(h.interpret).toHaveBeenCalledOnce());
  h.runtime.cancel();
  resolve({ actions: [{ kind: 'view', view: 'front' }], summary: 'Front', clarification: null });
  await pending;
  expect(h.snapshot).toMatchObject(after);
  expect(h.snapshot.camera).toEqual(camera);
  expect(h.snapshot.lesson.view).toBe('perspective');
});
