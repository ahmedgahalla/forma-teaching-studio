import { afterEach, describe, expect, it, vi } from 'vitest';
import { lectureHarness } from './session.fixtures';

const harnesses: ReturnType<typeof lectureHarness>[] = [];
function setup() {
  const h = lectureHarness();
  harnesses.push(h);
  return h;
}
afterEach(() => {
  harnesses.forEach(h => h.runtime.dispose());
  harnesses.length = 0;
  vi.restoreAllMocks();
});

describe('teacher lecture journey through the shared runtime', () => {
  it('opens, teaches, navigates and replays absolute steps with hidden answers', async () => {
    const h = setup();
    await h.open();
    await h.runtime.submit('teach lecture');
    expect(h.session.mode).toBe('teach');
    await h.runtime.submit('next step');
    const first = h.snapshot.history.current;
    expect(h.snapshot.lesson.stage).toBe(0);
    await h.runtime.submit('reveal answer');
    expect(h.session.answerVisible).toBe(true);
    await h.runtime.submit('next step');
    expect(h.session.answerVisible).toBe(false);
    await h.runtime.submit('previous step');
    expect(h.snapshot.history.current).toEqual(first);
    expect(h.snapshot.lesson.stage).toBe(0);
    expect(h.interpret).not.toHaveBeenCalled();
  });

  it('restores the exact paused model, camera, layers and answer after a question', async () => {
    const h = setup();
    await h.open();
    await h.runtime.submit('teach lecture');
    await h.runtime.submit('next step');
    const mid = {
      ...h.snapshot,
      camera: {
        ...h.document.steps[0].scene.setup.camera!,
        position: [11, 22, 83] as [number, number, number],
      },
      lesson: { ...h.snapshot.lesson, stage: 4.3, roots: true, labels: true },
    };
    h.changeScene(mid);
    await h.runtime.submit('reveal answer');
    await h.runtime.submit('explore a question');
    expect(h.session.exploring).toBe(true);
    await h.runtime.submit('hide answer');
    await h.runtime.submit('show notes');
    h.changeScene({
      ...h.snapshot,
      camera: null,
      lesson: { ...h.snapshot.lesson, roots: false, labels: false },
    });
    await h.runtime.submit('return to lecture');
    expect(h.session.exploring).toBe(false);
    expect(h.session.answerVisible).toBe(true);
    expect(h.session.notesVisible).toBe(false);
    expect(h.snapshot.camera).toEqual(mid.camera);
    expect(h.snapshot.lesson).toEqual(mid.lesson);
    expect(h.document.steps[1].scene.setup.stage).toBe(0);
    expect(h.adapter().context().playing).toBe(false);
  });

  it('preserves the independent Explore workspace and undoes full lecture navigation', async () => {
    const h = setup(),
      original = h.snapshot;
    await h.open();
    await h.runtime.submit('next step');
    await h.runtime.submit('undo that');
    expect(h.session.index).toBe(0);
    await h.runtime.submit('redo');
    expect(h.session.index).toBe(1);
    await h.runtime.submit('exit lecture');
    expect(h.session.screen).toBe('explore');
    expect(h.snapshot.lesson).toEqual(original.lesson);
    await h.runtime.submit('undo that');
    expect(h.session.index).toBe(1);
    expect(h.session.screen).toBe('lecture');
  });

  it('protects pending previews and allows display-only notes without losing the preview', async () => {
    const h = setup();
    await h.open();
    const pending = { label: 'Unapplied' } as NonNullable<typeof h.snapshot.sandbox.pending>;
    h.changeScene({ ...h.snapshot, sandbox: { ...h.snapshot.sandbox, pending } });
    await h.runtime.submit('next step');
    expect(h.session.index).toBe(0);
    expect(h.runtime.getState().message).toMatch(/Apply or discard/i);
    await h.runtime.submit('show notes');
    expect(h.session.notesVisible).toBe(true);
    expect(h.snapshot.sandbox.pending).toBe(pending);
  });

  it('keeps clicks, typed requests and local speech controls on the same action', async () => {
    for (const input of ['click', 'typed', 'voice'] as const) {
      const h = setup();
      await h.open();
      if (input === 'click')
        await h.runtime.submitActions([{ kind: 'presentation', action: 'next' }], 'Next');
      else await h.runtime.submit('next step', input === 'voice' ? { interpreter: 'local' } : {});
      expect(h.session.index).toBe(1);
      expect(h.snapshot.scenario?.variantId).toBe(h.document.steps[1].demo?.variantId);
    }
  });

  it('blocks tooth study in Teach, but allows it in an explicit exploration', async () => {
    const h = setup();
    await h.open();
    await h.runtime.submit('teach lecture');
    const study = [{ kind: 'tooth-study', action: 'open', tooth: '46' }] as const;
    expect(() => h.adapter().preflight([...study])).toThrow(/Explore a question/);
    await h.runtime.submit('explore a question');
    expect(() => h.adapter().preflight([...study])).not.toThrow();
  });

  it('ignores a late interpretation after advancing the lecture', async () => {
    const h = setup();
    await h.open();
    let resolve!: (value: unknown) => void;
    h.interpret.mockReturnValue(
      new Promise(done => {
        resolve = done;
      }),
    );
    const late = h.runtime.submit('make this easier to see', { interpreter: 'ai' });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await h.runtime.submit('next step');
    resolve({
      actions: [{ kind: 'toggle', target: 'roots', visible: false }],
      summary: 'Hide roots',
      clarification: null,
    });
    await late;
    expect(h.session.index).toBe(1);
    expect(h.snapshot.lesson.roots).toBe(true);
  });
});
