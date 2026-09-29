import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ClassroomSnapshot } from '../case/types';
import { lectureStepSnapshot } from './scene-bridge';
import { lectureHarness } from './session.fixtures';
import { availableLectureComparisons, lectureComparisonSnapshot } from './lecture-comparison';
import { borrowJourneyModel, journeyFixture, snapshotMotion } from './journey.fixtures';

let dispose: () => void;
beforeAll(() => {
  dispose = borrowJourneyModel();
});
afterAll(() => dispose());
const sessions: ReturnType<typeof lectureHarness>[] = [];
afterEach(() => sessions.splice(0).forEach(h => h.runtime.dispose()));
function setup() {
  const h = lectureHarness(journeyFixture());
  sessions.push(h);
  return h;
}

describe('one cumulative authored case journey', () => {
  it('uses the existing deterministic path for start, intermediate seek, reverse and finish', () => {
    const document = journeyFixture(),
      step = document.steps[1];
    const snapshot = lectureStepSnapshot(step, {} as ClassroomSnapshot);
    expect(snapshot.scenario).toBeNull();
    expect(snapshot.lesson.stage).toBe(0);
    expect(snapshot.history.current).toEqual(step.scene.transforms);
    expect(snapshot.sandbox.original).toEqual(step.motion!.from);
    const motion = snapshotMotion(snapshot);
    const middle = motion.sample(0.37);
    expect(middle['11'].translation[0]).toBeCloseTo(0.63);
    expect(middle['11'].rotation[1]).toBeCloseTo(12.6);
    for (const progress of [0, 0.1, 0.8, 1, 0.8, 0.1, 0, 0.37]) {
      const replayed = lectureStepSnapshot(step, snapshot);
      expect(snapshotMotion(replayed).sample(progress)).toEqual(motion.sample(progress));
    }
    expect(motion.sample(1)).toEqual(step.scene.transforms);
    snapshot.history.current['11'].translation[0] = 90;
    snapshot.sandbox.original!['11'].translation[0] = 80;
    expect(lectureStepSnapshot(step, snapshot).history.current).toEqual(step.scene.transforms);
    expect(step.motion!.from['11'].translation[0]).toBe(1);
  });

  it('navigates repeatedly and directly to absolute scenes and resets answers and hardware', async () => {
    const h = setup();
    await h.open();
    expect(h.snapshot.applianceDisplay.preset).toBe('none');
    for (let i = 0; i < 3; i++) {
      await h.runtime.submit('next step');
      expect(h.snapshot.lesson.stage).toBe(0);
      expect(h.snapshot.applianceDisplay.preset).toBe('braces');
      expect(h.snapshot.sandbox.original).toEqual(h.document.steps[0].scene.transforms);
      await h.runtime.submit('reveal answer');
      await h.runtime.submit('previous step');
      expect(h.session.answerVisible).toBe(false);
      expect(h.snapshot.applianceDisplay.preset).toBe('none');
    }
    await h.runtime.submit('go to step 3');
    expect(h.snapshot.lesson.stage).toBe(10);
    expect(h.snapshot.history.current).toEqual(h.document.steps[2].scene.transforms);
    await h.runtime.submit('undo');
    expect(h.session.index).toBe(0);
    await h.runtime.submit('redo');
    expect(h.session.index).toBe(2);
    expect(h.interpret).not.toHaveBeenCalled();
  });

  it('compares initial/finished arrangements with one camera and restores the paused path', async () => {
    const h = setup();
    await h.open();
    await h.runtime.submit('next step');
    const paused = { ...h.snapshot, lesson: { ...h.snapshot.lesson, stage: 3.7 } };
    h.changeScene(paused);
    expect(availableLectureComparisons(h.document)).toEqual(['start', 'finish']);
    for (const [input, target, index] of [
      ['compare finish', 'finish', 2],
      ['starting arrangement', 'start', 0],
      ['finished arrangement', 'finish', 2],
    ] as const) {
      await h.runtime.submit(input, { interpreter: 'local' });
      expect(h.session.comparison).toBe(target);
      expect(h.snapshot.history.current).toEqual(h.document.steps[index].scene.transforms);
      expect(h.snapshot.camera).toEqual(paused.camera);
      expect(h.snapshot.sandbox.original).toEqual(h.snapshot.history.current);
    }
    await h.runtime.submit('close comparison');
    expect(h.snapshot.lesson).toEqual(paused.lesson);
    expect(h.snapshot.sandbox.original).toEqual(paused.sandbox.original);
    await h.runtime.submit('undo');
    expect(h.session.comparison).toBe('finish');
    await h.runtime.submit('redo');
    expect(h.snapshot.lesson).toEqual(paused.lesson);
    expect(() => lectureComparisonSnapshot(h.document, 'tip', h.snapshot)).toThrow();
    expect(h.interpret).not.toHaveBeenCalled();
  });

  it('returns from question exploration to the exact authored path and then restores Explore', async () => {
    const h = setup(),
      original = h.snapshot;
    await h.open();
    await h.runtime.submit('next step');
    const paused = { ...h.snapshot, lesson: { ...h.snapshot.lesson, stage: 6.2, roots: false } };
    h.changeScene(paused);
    await h.runtime.submit('explore this question');
    expect(h.snapshot.mechanics).toBeNull();
    await h.runtime.submit('return to lecture');
    expect(h.snapshot.lesson).toEqual(paused.lesson);
    expect(h.snapshot.sandbox).toEqual(paused.sandbox);
    await h.runtime.submit('exit lecture');
    expect(h.snapshot.lesson).toEqual(original.lesson);
  });
});
