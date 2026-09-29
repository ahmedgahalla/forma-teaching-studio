import { afterAll, beforeAll, expect, it } from 'vitest';
import { Group, Object3D } from 'three';
import { createCaseJourneyLecture } from '@/lib/lecture-documents/sample-case-journey';
import type { ClassroomSnapshot } from '../case/types';
import { createToothPoseUpdater } from '../viewer/tooth-pose';
import { borrowJourneyModel } from './journey.fixtures';
import { lectureHarness } from './session.fixtures';

let dispose: () => void;
beforeAll(() => {
  dispose = borrowJourneyModel('claude-atlas-v1');
});
afterAll(() => dispose());

function lowerDisplay(snapshot: ClassroomSnapshot) {
  const tooth = snapshot.lesson.model.teeth.find(item => item.id === '31')!;
  const group = new Group();
  const update = createToothPoseUpdater(
    new Map([[tooth.id, group]]),
    new Map([[tooth.id, new Object3D()]]),
    new Map(),
    new Map(),
  );
  update(tooth, {
    transforms: snapshot.history.current,
    jawOpen: snapshot.lesson.jawOpen,
    opening: snapshot.lesson.opening,
    ghost: false,
    roots: false,
  });
  return group.matrixWorld.clone();
}

it('holds one jaw pose across initial/finished comparisons and exactly restores the closed paused scene', async () => {
  const document = createCaseJourneyLecture();
  const finishIndex = document.steps.findIndex(step => step.comparison === 'finish');
  const h = lectureHarness(document);
  try {
    await h.open();
    await h.runtime.submit(`go to step ${finishIndex + 1}`);
    expect(h.snapshot.lesson.jawOpen).toBe(false);
    const paused = {
      ...h.snapshot,
      camera: {
        position: [20, 30, 90] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
        up: [0, 1, 0] as [number, number, number],
        view: 'perspective' as const,
        far: 10000,
        maxDistance: 3000,
      },
    };
    h.changeScene(paused);
    await h.runtime.submit('compare start');
    const initial = h.snapshot;
    expect(initial.lesson.jawOpen).toBe(true);
    await h.runtime.submit('compare finish');
    const finished = h.snapshot;
    expect(finished.lesson.jawOpen).toBe(true);
    expect(finished.camera).toEqual(paused.camera);
    expect(initial.camera).toEqual(paused.camera);
    expect(lowerDisplay(finished).elements).toEqual(lowerDisplay(initial).elements);
    expect(lowerDisplay(finished).elements).not.toEqual(lowerDisplay(paused).elements);
    await h.runtime.submit('close comparison');
    expect(h.snapshot.lesson).toEqual(paused.lesson);
    expect(h.snapshot.camera).toEqual(paused.camera);
    expect(lowerDisplay(h.snapshot).elements).toEqual(lowerDisplay(paused).elements);
    expect(document.steps[finishIndex].scene.setup.jawOpen).toBe(false);
  } finally {
    h.runtime.dispose();
  }
});
