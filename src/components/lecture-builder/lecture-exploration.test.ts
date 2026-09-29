import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createDemo } from '@/lib/geometry';
import { createMechanicsExperiment, transitionMechanics } from '@/lib/mechanics/state';
import type { MechanicsResult } from '@/lib/mechanics/types';
import { validateLectureDocument } from '@/lib/lecture-documents';
import { lectureExploration } from './lecture-exploration';
import { lectureHarness } from './session.fixtures';
import { borrowJourneyModel, journeyFixture } from './journey.fixtures';

let dispose: () => void;
beforeAll(() => {
  dispose = borrowJourneyModel();
});
afterAll(() => dispose());
const sessions: ReturnType<typeof lectureHarness>[] = [];
afterEach(() => sessions.splice(0).forEach(h => h.runtime.dispose()));

function wireDocument() {
  const document = journeyFixture(),
    step = document.steps[1];
  delete step.motion;
  let experiment = createMechanicsExperiment(createDemo(), step.scene.transforms);
  experiment = transitionMechanics(experiment, {
    type: 'brackets',
    teeth: ['11', '21'],
    installed: true,
  });
  experiment = transitionMechanics(experiment, {
    type: 'wire',
    id: 'teaching-wire',
    teeth: ['11', '21'],
    material: 'stainless-steel',
    section: { shape: 'round', diameterMm: 0.35 },
    expansionMm: 0.1,
  });
  step.scene.mechanics = experiment;
  return validateLectureDocument(document);
}

describe('explicit static lecture mechanics exploration', () => {
  it('retains inputs at physical poses while dropping all computed results and prior stages', () => {
    const document = wireDocument(),
      step = document.steps[1],
      model = createDemo();
    const physical = {
      '11': {
        translation: [0.1, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      },
    };
    const magnified = {
      '11': {
        translation: [5, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      },
    };
    step.scene.mechanics!.result = {} as MechanicsResult;
    step.scene.mechanics!.applied = {} as MechanicsResult;
    step.scene.mechanics!.comparison = {} as MechanicsResult;
    step.scene.mechanics!.stages = [
      { label: 'Prior', config: structuredClone(step.scene.mechanics!.config) },
    ];
    step.scene.mechanics!.stageIndex = 0;
    const detour = lectureExploration(step, model, physical, magnified);
    expect(detour.transforms).toEqual(physical);
    expect(detour.mechanics!.reference.transforms['11']).toEqual(physical['11']);
    expect(detour.mechanics).toMatchObject({
      revision: 0,
      result: null,
      applied: null,
      comparison: null,
      stages: [],
      stageIndex: -1,
    });
    expect(detour.mechanics!.config).toEqual(step.scene.mechanics!.config);
    detour.mechanics!.config.wires[0].expansionMm = 0;
    expect(step.scene.mechanics!.config.wires[0].expansionMm).toBe(0.1);
  });

  it('opens the appliance controls, permits an explicit solve, and returns to the exact lecture', async () => {
    const h = lectureHarness(wireDocument());
    sessions.push(h);
    await h.open();
    await h.runtime.submit('next step');
    const paused = h.snapshot;
    await h.runtime.submit('explore this question');
    expect(h.session.exploring).toBe(true);
    expect(h.snapshot.mechanics!.config).toEqual(paused.mechanics!.config);
    expect(h.api.setToolsOpen).toHaveBeenLastCalledWith(true);
    expect(h.api.setMobilePanel).toHaveBeenLastCalledWith('tools');
    expect(h.api.setPanel).toHaveBeenLastCalledWith('braces');
    expect(() =>
      h.adapter().preflight([{ kind: 'mechanics', action: { type: 'solve' } }]),
    ).not.toThrow();
    h.snapshot.mechanics!.config.wires[0].expansionMm = 0;
    await h.runtime.submit('return to lecture');
    expect(h.snapshot.lesson).toEqual(paused.lesson);
    expect(h.snapshot.mechanics!.config.wires[0].expansionMm).toBe(0.1);
    expect(h.snapshot.mechanics!.result).toBeNull();
  });

  it('does not inherit a wire setup while exploring a static comparison', async () => {
    const h = lectureHarness(wireDocument());
    sessions.push(h);
    await h.open();
    await h.runtime.submit('next step');
    await h.runtime.submit('compare finish');
    await h.runtime.submit('explore this question');
    expect(h.snapshot.mechanics).toBeNull();
  });

  it('rejects a motion step with mechanics rather than silently choosing one playback source', () => {
    const document = wireDocument();
    document.steps[1].motion = { from: {} };
    expect(() => validateLectureDocument(document)).toThrow(/another demonstration or mechanics/);
  });
});
