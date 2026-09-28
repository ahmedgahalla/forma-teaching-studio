import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { lectureHarness } from './session.fixtures';
import type { PresentationAction } from '@/lib/classroom/presentation';
import type { ClassroomSnapshot } from '../case/types';
import { lectureStepSnapshot } from './scene-bridge';
import * as assets from '@/lib/anatomy-assets';
import * as geometry from '@/lib/geometry';

let base: geometry.DentalCase;
beforeAll(() => {
  base = geometry.createDemo();
  const copy = (): geometry.DentalCase => ({
    ...base,
    teeth: base.teeth.map(({ geometry, rootGeometry, ...metadata }) => ({
      ...structuredClone(metadata),
      geometry,
      rootGeometry,
    })),
    gums: base.gums.map(gum => ({ ...gum, position: [...gum.position] })),
  });
  vi.spyOn(geometry, 'createDemo').mockImplementation(copy);
  vi.spyOn(assets, 'getTeachingAssetCase').mockImplementation(copy);
});
afterAll(() => {
  vi.restoreAllMocks();
  base.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  base.gums.forEach(gum => gum.geometry.dispose());
});
const harnesses: ReturnType<typeof lectureHarness>[] = [];
const setup = () => {
  const h = lectureHarness();
  harnesses.push(h);
  return h;
};
afterEach(() => harnesses.splice(0).forEach(h => h.runtime.dispose()));
const camera: NonNullable<ClassroomSnapshot['camera']> = {
  position: [10, 20, 60],
  target: [0, 1, 0],
  up: [0, 1, 0],
  view: 'perspective',
  far: 10000,
  maxDistance: 3000,
};
const fitted = { ...camera, position: [0, 0, 40] as [number, number, number] };
type Input = 'click' | 'typed' | 'voice' | 'ai-preference';
async function control(
  h: ReturnType<typeof setup>,
  input: Input,
  text: string,
  action: PresentationAction,
) {
  if (input === 'click') await h.runtime.submitActions([action], text);
  else
    await h.runtime.submit(text, {
      interpreter: input === 'voice' ? 'local' : input === 'ai-preference' ? 'ai' : 'auto',
    });
  expect(h.runtime.getState().error).toBe(false);
}

describe('lecture workspace controls through the runtime', () => {
  it.each(['click', 'typed', 'voice', 'ai-preference'] as const)(
    'leaves playback, Undo and Redo untouched when %s reopens the active lecture',
    async input => {
      const h = setup();
      await h.open();
      await h.runtime.submit('next step');
      await h.runtime.submit('undo');
      expect(h.session.index).toBe(0);
      h.api.setPlaying(true);
      const before = h.adapter().capture(),
        status = h.runtime.getState();
      await control(h, input, 'open lecture', {
        kind: 'presentation',
        action: 'open',
        id: h.document.id,
      });
      expect(h.adapter().context().playing).toBe(true);
      expect(h.adapter().capture()).toEqual(before);
      expect(h.runtime.getState()).toEqual(status);
      await h.runtime.submit('redo');
      expect(h.session.index).toBe(1);
      await control(h, input, 'Lecture', {
        kind: 'presentation',
        action: 'open',
        id: h.document.id,
      });
      await h.runtime.submit('undo');
      expect(h.session.index).toBe(0);
      await h.runtime.submit('undo');
      expect(h.session.screen).toBe('explore');
      expect(h.interpret).not.toHaveBeenCalled();
    },
  );

  it.each(['click', 'typed', 'voice', 'ai-preference'] as const)(
    'opens, fits and exits the same sample through %s, with whole-request undo/redo',
    async input => {
      const h = setup();
      h.changeScene({ ...h.snapshot, camera });
      const original = h.snapshot;
      await control(h, input, 'Lecture', {
        kind: 'presentation',
        action: 'open',
        id: h.document.id,
      });
      expect(h.session).toMatchObject({ screen: 'lecture', index: 0, answerVisible: false });
      expect(h.original.current).toBe(original);
      await h.runtime.submit('next step');
      const beforeFit = h.snapshot,
        session = h.session;
      const fit = vi.mocked(h.refs.viewer.current!.fit).mockImplementation(() => {
        h.changeScene({ ...h.snapshot, camera: fitted });
      });
      await control(h, input, 'Fit model', { kind: 'presentation', action: 'fit-view' });
      expect(fit).toHaveBeenCalledOnce();
      expect(h.snapshot.camera).toEqual(fitted);
      expect(h.session).toEqual(session);
      await h.runtime.submit('undo');
      expect(h.snapshot).toMatchObject(beforeFit);
      await h.runtime.submit('redo');
      expect(h.snapshot.camera).toEqual(fitted);
      await control(h, input, 'Explore', { kind: 'presentation', action: 'exit' });
      expect(h.session.screen).toBe('explore');
      expect(h.snapshot).toMatchObject(original);
      await h.runtime.submit('undo');
      expect(h.session.index).toBe(1);
      expect(h.snapshot.camera).toEqual(fitted);
      await h.runtime.submit('redo');
      expect(h.snapshot).toMatchObject(original);
      expect(h.interpret).not.toHaveBeenCalled();
    },
  );

  it('undoes and redoes opening without losing the original prepared case', async () => {
    const h = setup();
    const original = lectureStepSnapshot(h.document.steps[1], h.snapshot);
    h.changeScene(original);
    expect(h.adapter().context().caseId).toBe('movement-types');
    await h.runtime.submit('open sample lecture');
    expect(h.session.screen).toBe('lecture');
    const opened = h.snapshot;
    await h.runtime.submit('undo');
    expect(h.session.screen).toBe('explore');
    expect(h.snapshot).toMatchObject(original);
    await h.runtime.submit('redo');
    expect(h.snapshot).toMatchObject(opened);
    await h.runtime.submit('return to explore');
    expect(h.snapshot).toMatchObject(original);
  });

  it('keeps an already open sample and its paused detour intact for text and submitted actions', async () => {
    const h = setup();
    await h.open();
    await h.runtime.submit('next step');
    await h.runtime.submit('reveal answer');
    await h.runtime.submit('show notes');
    for (const exploring of [false, true]) {
      if (exploring) await h.runtime.submit('explore this question');
      const before = h.adapter().capture();
      for (const input of ['typed', 'click'] as const) {
        await control(h, input, 'Lecture', {
          kind: 'presentation',
          action: 'open',
          id: h.document.id,
        });
        expect(h.adapter().capture()).toEqual(before);
      }
    }
    await h.runtime.submit('return to lecture');
    expect(h.session).toMatchObject({
      index: 1,
      answerVisible: true,
      notesVisible: true,
      exploring: false,
    });
  });

  it.each(['preview', 'drag', 'import'] as const)(
    'protects the scene from entry and exit while a %s is pending',
    async guard => {
      const h = setup();
      const applyGuard = (enabled: boolean) => {
        if (guard === 'preview')
          h.changeScene({
            ...h.snapshot,
            sandbox: {
              ...h.snapshot.sandbox,
              pending: enabled
                ? ({ label: 'Unapplied' } as NonNullable<typeof h.snapshot.sandbox.pending>)
                : null,
            },
          });
        if (guard === 'drag') h.api.dragPreview = enabled ? {} : null;
        if (guard === 'import') h.api.busy = enabled;
      };
      applyGuard(true);
      const before = h.snapshot;
      await h.runtime.submit('open lecture', { interpreter: 'ai' });
      expect(h.runtime.getState()).toMatchObject({
        error: true,
        message: expect.stringMatching(/Apply or discard/),
      });
      expect(h.snapshot).toBe(before);
      expect(h.original.current).toBeNull();
      applyGuard(false);
      await h.open();
      applyGuard(true);
      const lecture = h.adapter().capture();
      await h.runtime.submit('Explore');
      expect(h.runtime.getState().error).toBe(true);
      expect(h.adapter().capture()).toEqual(lecture);
      expect(h.interpret).not.toHaveBeenCalled();
    },
  );

  it('fits a comparison without changing its return point, and restores detour cameras separately', async () => {
    const h = setup();
    await h.open();
    await h.runtime.submit('next step');
    h.changeScene({ ...h.snapshot, camera });
    const paused = h.snapshot;
    await h.runtime.submit('compare translation');
    vi.mocked(h.refs.viewer.current!.fit).mockImplementation(() =>
      h.changeScene({ ...h.snapshot, camera: fitted }),
    );
    await h.runtime.submit('fit view');
    expect(h.session.comparison).toBe('translation');
    await h.runtime.submit('explore this question');
    h.changeScene({ ...h.snapshot, camera });
    const pending = { label: 'Unapplied' } as NonNullable<typeof h.snapshot.sandbox.pending>;
    h.changeScene({ ...h.snapshot, sandbox: { ...h.snapshot.sandbox, pending } });
    await h.runtime.submit('fit model');
    expect(h.snapshot.sandbox.pending).toBe(pending);
    expect(h.session).toMatchObject({ exploring: true, comparison: 'translation' });
    h.changeScene({ ...h.snapshot, sandbox: { ...h.snapshot.sandbox, pending: null } });
    await h.runtime.submit('return to lecture');
    expect(h.snapshot.camera).toEqual(fitted);
    await h.runtime.submit('close comparison');
    expect(h.snapshot).toEqual(paused);
  });
});
