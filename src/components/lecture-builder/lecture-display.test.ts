import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { lectureHarness } from './session.fixtures';
import { sampleCaseDemonstration } from '@/lib/teaching-cases';
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
function setup() {
  const h = lectureHarness();
  harnesses.push(h);
  return h;
}
afterEach(() => {
  harnesses.splice(0).forEach(h => h.runtime.dispose());
});

describe('lecture focus, comparison and biology through the shared runtime', () => {
  it('compares absolute endpoints from one camera and returns to the exact paused frame', async () => {
    const h = setup();
    await h.open();
    await h.runtime.submit('next step');
    const before = {
      ...h.snapshot,
      camera: {
        position: [20, 10, 55] as [number, number, number],
        target: [0, 2, 0] as [number, number, number],
        up: [0, 1, 0] as [number, number, number],
        view: 'perspective' as const,
        far: 10000,
        maxDistance: 3000,
      },
      lesson: { ...h.snapshot.lesson, stage: 4.25 },
    };
    h.changeScene(before);
    await h.runtime.submit('compare translation');
    expect(h.session.comparison).toBe('translation');
    expect(h.snapshot.camera).toEqual(before.camera);
    expect(h.snapshot.scenario).toBeNull();
    expect(h.snapshot.history.current).toEqual(
      sampleCaseDemonstration('movement-types', 'translation', 1),
    );
    await h.runtime.submit('compare tipping');
    expect(h.snapshot.camera).toEqual(before.camera);
    expect(h.snapshot.history.current).toEqual(sampleCaseDemonstration('movement-types', 'tip', 1));
    await h.runtime.submit('compare start');
    expect(h.snapshot.history.current).toEqual(
      sampleCaseDemonstration('movement-types', 'translation', 0),
    );
    await h.runtime.submit('close comparison');
    expect(h.session.comparison).toBeNull();
    expect(h.snapshot.lesson).toEqual(before.lesson);
    expect(h.snapshot.camera).toEqual(before.camera);
    expect(h.snapshot.scenario).toEqual(before.scenario);
  });

  it('undoes and redoes comparison return points, without accumulating endpoint transforms', async () => {
    const h = setup();
    await h.open();
    const before = h.snapshot;
    await h.runtime.submit('compare tipping');
    const endpoint = h.snapshot.history.current;
    await h.runtime.submit('repeat that');
    expect(h.snapshot.history.current).toEqual(endpoint);
    await h.runtime.submit('close comparison');
    await h.runtime.submit('undo');
    expect(h.session.comparison).toBe('tip');
    expect(h.snapshot.history.current).toEqual(endpoint);
    await h.runtime.submit('close comparison');
    expect(h.snapshot.lesson).toEqual(before.lesson);
    await h.runtime.submit('undo');
    await h.runtime.submit('redo');
    expect(h.session.comparison).toBeNull();
    expect(h.snapshot.lesson).toEqual(before.lesson);
  });

  it('restores focus, tissue view and comparison after a question exploration', async () => {
    const h = setup();
    await h.open();
    const before = h.snapshot;
    await h.runtime.submit('show surrounding teeth');
    await h.runtime.submit('show tension');
    await h.runtime.submit('compare translation');
    await h.runtime.submit('explore this question');
    await h.runtime.submit('hide biology');
    await h.runtime.submit('focus teaching tooth');
    await h.runtime.submit('return to lecture');
    expect(h.session).toMatchObject({
      focus: false,
      biology: 'tension',
      comparison: 'translation',
    });
    await h.runtime.submit('close comparison');
    expect(h.snapshot.lesson).toEqual(before.lesson);
    await h.runtime.submit('next step');
    expect(h.session).toMatchObject({ biology: 'off', comparison: null });
  });

  it('keeps biology separate from the model and preserves pending previews', async () => {
    const h = setup();
    await h.open();
    const pending = { label: 'Unapplied' } as NonNullable<typeof h.snapshot.sandbox.pending>;
    const before = { ...h.snapshot, sandbox: { ...h.snapshot.sandbox, pending } };
    h.changeScene(before);
    await h.runtime.submit('show biology');
    expect(h.session.biology).toBe('overview');
    expect(h.snapshot).toBe(before);
    await h.runtime.submit('compare translation');
    expect(h.session.comparison).toBeNull();
    expect(h.snapshot).toBe(before);
    expect(h.runtime.getState().message).toMatch(/Apply or discard/);
    await h.runtime.submit('hide biology');
    expect(h.session.biology).toBe('off');
  });

  it('blocks mechanics example loading until the teacher explicitly explores', async () => {
    const h = setup();
    await h.open();
    const action = { kind: 'mechanics-example', id: 'crown-pull', variant: 'buccal' } as const;
    // Adapter guard runs before catalogue validation; no recipe is applied in this test.
    expect(() => h.adapter().preflight([action])).toThrow(/Explore this question/);
    await h.runtime.submit('explore this question');
    expect(() => h.adapter().preflight([action])).not.toThrow();
  });
});
