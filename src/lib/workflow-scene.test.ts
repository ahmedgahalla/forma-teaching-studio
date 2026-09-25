import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createOrthodonticDemo } from './demo';
import {
  applyWorkflowAction,
  classroomDefinition,
  initialWorkflowScene,
  workflowSceneFrame,
  workflowSceneStep,
  type WorkflowScene,
} from './workflow-scene';
import { getWorkflowFrame } from './workflows';
import { toothMatrix } from './analysis';
import { perspectiveFitDistance } from './camera-fit';

const model = createOrthodonticDemo();
const visibleTransforms = (scene: WorkflowScene) =>
  scene.variation || workflowSceneFrame(scene).transforms;
const move = (scene: WorkflowScene, tooth = '11', amount = 0.6) =>
  applyWorkflowAction(
    scene,
    { kind: 'dental', command: { type: 'move', tooth, direction: 'buccal', amount } },
    model,
  );
afterAll(() => {
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

describe('reversible classroom variations', () => {
  it.each(['fixed-braces', 'palatal-expansion', 'archwire-expansion', 'anatomy'])(
    'positions %s directly on its authored movement path without playing first',
    id => {
      const initial = initialWorkflowScene(model, id),
        moved = applyWorkflowAction(initial, { kind: 'progress', value: 0.375 }, model);
      expect(moved.step).toBe(id === 'anatomy' ? 1 : 4);
      expect(moved.progress).toBe(0.375);
      expect(moved.playing).toBe(false);
      expect(moved.variation).toBeNull();
      expect(workflowSceneFrame(moved)).toEqual(
        workflowSceneFrame({ ...workflowSceneStep(initial, moved.step, model), progress: 0.375 }),
      );
      expect(initial.step).toBe(0);
      expect(initial.progress).toBe(0);
    },
  );

  it('keeps anatomy tipping and its chosen camera while discarding temporary edits for authored progress', () => {
    const current = move({
      ...workflowSceneStep(initialWorkflowScene(model, 'anatomy'), 2, model),
      view: 'left',
      playing: true,
    } as WorkflowScene);
    const shown = applyWorkflowAction(current, { kind: 'progress', value: 0.5 }, model);
    expect(shown).toMatchObject({
      step: 2,
      view: 'left',
      playing: false,
      progress: 0.5,
      variation: null,
    });
    expect(workflowSceneFrame(shown).transforms['11'].translation).toEqual([0, 0, 0]);
  });

  it('changes to the left view without changing poses, selection or lesson progress', () => {
    const current = move({
      ...workflowSceneStep(initialWorkflowScene(model), 4, model),
      progress: 0.35,
    });
    const left = applyWorkflowAction(current, { kind: 'view', view: 'left' }, model);
    expect(left).toEqual({ ...current, view: 'left' });
    expect(left.variation).toBe(current.variation);
    expect(left.model).toBe(current.model);
  });

  it('accepts authored answer display as a geometry no-op for component-owned visibility', () => {
    for (const id of ['fixed-braces', 'anatomy']) {
      const current = move(initialWorkflowScene(model, id));
      for (const visible of [true, false])
        expect(applyWorkflowAction(current, { kind: 'question', visible }, model)).toBe(current);
    }
  });

  it('starts a free movement from the displayed authored frame, preserves the current lesson step, and does not alter its base', () => {
    const base = {
      ...workflowSceneStep(initialWorkflowScene(model), 4, model),
      progress: 0.4,
      playing: true,
    };
    const before = workflowSceneFrame(base),
      snapshot = JSON.stringify(before),
      varied = move(base);
    expect(varied.id).toBe(base.id);
    expect(varied.step).toBe(base.step);
    expect(varied.progress).toBe(0.4);
    expect(varied.playing).toBe(false);
    expect(varied.model).toBe(model);
    expect(base.variation).toBeNull();
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(workflowSceneFrame(base)).toEqual(before);
    const direction = new THREE.Vector3(
      ...model.teeth.find(t => t.id === '11')!.buccal,
    ).multiplyScalar(0.6);
    const difference = new THREE.Vector3(...varied.variation!['11'].translation).sub(
      new THREE.Vector3(...before.transforms['11'].translation),
    );
    expect(difference.distanceTo(direction)).toBeLessThan(1e-10);
    expect(varied.variation!['11'].rotation).toEqual(before.transforms['11'].rotation);
  });

  it('accumulates successive variations without dropping already demonstrated movements', () => {
    const base = workflowSceneStep(initialWorkflowScene(model), 4, model),
      first = move(base, '11'),
      second = move(first, '12', 0.8);
    expect(second.variation!['11']).toEqual(first.variation!['11']);
    expect(second.variation!['12']).not.toEqual(first.variation!['12']);
    expect(first.variation!['12']).toEqual(workflowSceneFrame(base).transforms['12']);
  });

  it('returns to the authored start of the current lesson step, dropping temporary geometry metadata and movement', () => {
    const base = workflowSceneStep(initialWorkflowScene(model), 4, model);
    const varied = applyWorkflowAction(
      move({ ...base, progress: 0.7 }),
      { kind: 'attachment', action: 'add', teeth: ['11'], shape: 'beveled' },
      model,
    );
    const restored = applyWorkflowAction(varied, { kind: 'return-lesson' }, model);
    expect(restored.id).toBe(base.id);
    expect(restored.step).toBe(4);
    expect(restored.progress).toBe(0);
    expect(restored.variation).toBeNull();
    expect(restored.model).toBe(model);
    expect(restored.playing).toBe(false);
    expect(visibleTransforms(restored)).toEqual(workflowSceneFrame(base).transforms);
    expect(restored.model.teeth.find(t => t.id === '11')!.attachment).toBeUndefined();
  });

  it('drops a variation and its attachment when advancing, without changing the authored next frame', () => {
    const current = workflowSceneStep(initialWorkflowScene(model), 3, model);
    const varied = applyWorkflowAction(
      move(current),
      { kind: 'attachment', action: 'add', teeth: ['21'] },
      model,
    );
    const next = applyWorkflowAction(varied, { kind: 'workflow', action: 'next' }, model);
    expect(next.step).toBe(4);
    expect(next.model).toBe(model);
    expect(next.variation).toBeNull();
    expect(next.progress).toBe(0);
    expect(next.playing).toBe(false);
    expect(workflowSceneFrame(next)).toEqual(getWorkflowFrame('fixed-braces', 4, 0, model.teeth));
  });

  it('preserves a professor’s selected tooth group through next, previous, restart, and installation navigation', () => {
    const selected = ['11', '12', '21', '22'];
    let scene = { ...initialWorkflowScene(model), selected };
    for (const action of [
      { kind: 'workflow', action: 'next' },
      { kind: 'workflow', action: 'previous' },
      { kind: 'workflow', action: 'restart' },
      { kind: 'workflow', action: 'phase', phase: 'wire' },
    ] as const) {
      scene = applyWorkflowAction(scene, action, model);
      expect(scene.selected).toEqual(selected);
    }
    expect(selected).toEqual(['11', '12', '21', '22']);
  });

  it('adds and removes attachment metadata in a temporary model while reusing untouched crown/root geometry', () => {
    const base = initialWorkflowScene(model),
      added = applyWorkflowAction(
        base,
        { kind: 'attachment', action: 'add', teeth: ['11', '21'], shape: 'ellipsoid' },
        model,
      );
    expect(added.model).not.toBe(model);
    expect(added.attachments).toBe(true);
    expect(added.variation).toEqual(workflowSceneFrame(base).transforms);
    for (const tooth of added.model.teeth) {
      const source = model.teeth.find(t => t.id === tooth.id)!;
      expect(tooth.geometry).toBe(source.geometry);
      expect(tooth.rootGeometry).toBe(source.rootGeometry);
      expect(source.attachment).toBeUndefined();
      if (['11', '21'].includes(tooth.id)) expect(tooth.attachment?.shape).toBe('ellipsoid');
      else expect(tooth).toBe(source);
    }
    const removed = applyWorkflowAction(
      added,
      { kind: 'attachment', action: 'remove', teeth: ['11'] },
      model,
    );
    expect(removed.model.teeth.find(t => t.id === '11')!.attachment).toBeUndefined();
    expect(removed.model.teeth.find(t => t.id === '21')!.attachment?.shape).toBe('ellipsoid');
    expect(added.model.teeth.find(t => t.id === '11')!.attachment?.shape).toBe('ellipsoid');
    expect(applyWorkflowAction(removed, { kind: 'return-lesson' }, model).model).toBe(model);
  });
});

describe('anatomy lesson movement geometry', () => {
  it('opens a labelled cutaway with all supporting layers enabled', () => {
    const scene = initialWorkflowScene(model, 'anatomy');
    expect(scene.anatomy).toMatchObject({ bone: true, ligament: true, cutaway: true });
    expect(scene.roots).toBe(true);
    expect(scene.gums).toBe(true);
    expect(scene.braces).toBe(false);
    expect(scene.selected).toEqual(['11']);
    expect(workflowSceneFrame(scene).transforms).toEqual({});
  });

  it('demonstrates equal crown and root displacement for translation, with no rotation or source changes', () => {
    const start = applyWorkflowAction(
        initialWorkflowScene(model, 'anatomy'),
        { kind: 'anatomy-lesson', action: 'translation' },
        model,
      ),
      frame = workflowSceneFrame({ ...start, progress: 1 });
    const tooth = model.teeth.find(t => t.id === '11')!,
      original = toothMatrix(tooth, {}),
      moved = toothMatrix(tooth, frame.transforms),
      root = new THREE.Vector3().fromBufferAttribute(
        tooth.rootGeometry!.getAttribute('position'),
        100,
      );
    const crownShift = new THREE.Vector3()
      .applyMatrix4(moved)
      .sub(new THREE.Vector3().applyMatrix4(original));
    const rootShift = root.clone().applyMatrix4(moved).sub(root.clone().applyMatrix4(original));
    expect(rootShift.distanceTo(crownShift)).toBeLessThan(1e-9);
    expect(crownShift.length()).toBeCloseTo(1.2);
    expect(frame.transforms['11'].rotation).toEqual([0, 0, 0]);
    expect(
      crownShift.distanceTo(new THREE.Vector3(...tooth.mesial).multiplyScalar(1.2)),
    ).toBeLessThan(1e-9);
    expect(workflowSceneFrame(start).transforms).toEqual({});
    expect(Object.keys(frame.transforms)).toEqual(['11']);
  });

  it('makes the translation visibly horizontal in the fitted front cutaway', () => {
    const start = applyWorkflowAction(
        initialWorkflowScene(model, 'anatomy'),
        { kind: 'anatomy-lesson', action: 'translation' },
        model,
      ),
      frame = workflowSceneFrame({ ...start, progress: 1 });
    const tooth = model.teeth.find(t => t.id === '11')!,
      width = 887,
      height = 321,
      front = new THREE.Vector3(0, 0, 1);
    const bounds = new THREE.Box3()
      .setFromBufferAttribute(tooth.geometry.getAttribute('position') as THREE.BufferAttribute)
      .union(
        new THREE.Box3().setFromBufferAttribute(
          tooth.rootGeometry!.getAttribute('position') as THREE.BufferAttribute,
        ),
      )
      .expandByScalar(2.1)
      .translate(new THREE.Vector3(...tooth.position));
    const center = bounds.getCenter(new THREE.Vector3()),
      camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 1000);
    camera.position
      .copy(center)
      .addScaledVector(
        front,
        perspectiveFitDistance(bounds, front, camera.up, camera.fov, camera.aspect, 1.48),
      );
    camera.lookAt(center);
    camera.updateMatrixWorld();
    const before = new THREE.Vector3().applyMatrix4(toothMatrix(tooth, {})).project(camera),
      after = new THREE.Vector3()
        .applyMatrix4(toothMatrix(tooth, frame.transforms))
        .project(camera);
    expect((Math.abs(after.x - before.x) * width) / 2).toBeGreaterThan(7);
    expect(Math.abs(frame.transforms['11'].translation[0])).toBeGreaterThan(1.1);
  });

  it('demonstrates an angular difference about the existing crown pivot, with distinct root displacement', () => {
    const start = applyWorkflowAction(
        initialWorkflowScene(model, 'anatomy'),
        { kind: 'anatomy-lesson', action: 'tipping' },
        model,
      ),
      frame = workflowSceneFrame({ ...start, progress: 1 });
    const tooth = model.teeth.find(t => t.id === '11')!,
      original = toothMatrix(tooth, {}),
      tipped = toothMatrix(tooth, frame.transforms),
      root = new THREE.Vector3().fromBufferAttribute(
        tooth.rootGeometry!.getAttribute('position'),
        250,
      );
    const crownShift = new THREE.Vector3()
        .applyMatrix4(tipped)
        .sub(new THREE.Vector3().applyMatrix4(original)),
      rootShift = root.clone().applyMatrix4(tipped).sub(root.clone().applyMatrix4(original));
    expect(crownShift.length()).toBeLessThan(1e-9);
    expect(rootShift.length()).toBeGreaterThan(0.5);
    expect(frame.transforms['11'].translation).toEqual([0, 0, 0]);
    expect(frame.transforms['11'].rotation.some(v => Math.abs(v) > 1)).toBe(true);
    expect(workflowSceneFrame(start).transforms).toEqual({});
  });

  it.each(['translation', 'tipping'] as const)(
    'replays %s from zero and restores the same authored endpoint after a variation',
    action => {
      const start = applyWorkflowAction(
          initialWorkflowScene(model, 'anatomy'),
          { kind: 'anatomy-lesson', action },
          model,
        ),
        endpoint = { ...start, progress: 1 };
      const before = workflowSceneFrame(endpoint),
        varied = move(endpoint),
        replay = applyWorkflowAction(varied, { kind: 'workflow', action: 'play' }, model);
      expect(replay.step).toBe(start.step);
      expect(replay.progress).toBe(0);
      expect(replay.playing).toBe(true);
      expect(replay.variation).toBeNull();
      expect(workflowSceneFrame({ ...replay, progress: 1 })).toEqual(before);
      const paused = applyWorkflowAction(replay, { kind: 'stop' }, model);
      expect(paused.playing).toBe(false);
      expect(paused.progress).toBe(0);
    },
  );

  it('changes directly between translation and tipping without retaining the previous demonstration’s pose', () => {
    const translated = {
      ...applyWorkflowAction(
        initialWorkflowScene(model, 'anatomy'),
        { kind: 'anatomy-lesson', action: 'translation' },
        model,
      ),
      progress: 1,
    };
    const tipped = applyWorkflowAction(
      move(translated),
      { kind: 'anatomy-lesson', action: 'tipping' },
      model,
    );
    expect(tipped.step).toBe(2);
    expect(tipped.progress).toBe(0);
    expect(tipped.variation).toBeNull();
    expect(tipped.selected).toEqual(['11']);
    expect(visibleTransforms(tipped)).toEqual({});
    const compared = applyWorkflowAction(tipped, { kind: 'comparison', mode: 'after' }, model);
    expect(compared.step).toBe(2);
    expect(compared.progress).toBe(1);
    expect(workflowSceneFrame(compared).transforms['11'].translation).toEqual([0, 0, 0]);
  });

  it('initializes cutaway layers once and then respects independent hide commands', () => {
    let scene = { ...initialWorkflowScene(model), roots: false, gums: false };
    scene = applyWorkflowAction(
      scene,
      { kind: 'anatomy', action: 'cutaway', visible: true },
      model,
    );
    expect(scene.anatomy).toMatchObject({ cutaway: true, bone: true, ligament: true });
    expect(scene.roots).toBe(true);
    expect(scene.gums).toBe(true);
    scene = applyWorkflowAction(scene, { kind: 'anatomy', action: 'bone', visible: false }, model);
    scene = applyWorkflowAction(
      scene,
      { kind: 'anatomy', action: 'ligament', visible: false },
      model,
    );
    scene = applyWorkflowAction(scene, { kind: 'toggle', target: 'roots', visible: false }, model);
    scene = applyWorkflowAction(scene, { kind: 'toggle', target: 'gums', visible: false }, model);
    expect(scene.anatomy).toMatchObject({ cutaway: true, bone: false, ligament: false });
    expect(scene.roots).toBe(false);
    expect(scene.gums).toBe(false);
  });
});

describe('authored workflow playback', () => {
  it.each(['fixed-braces', 'palatal-expansion', 'archwire-expansion', 'anatomy'])(
    'starts the canonical movement for %s and keeps source geometry immutable',
    id => {
      const source = model.teeth.find(t => t.id === '11')!,
        crown = [...source.geometry.getAttribute('position').array],
        root = [...source.rootGeometry!.getAttribute('position').array],
        position = [...source.position];
      const initial = initialWorkflowScene(model, id),
        frame = workflowSceneFrame(initial),
        varied = move(initial),
        playing = applyWorkflowAction(varied, { kind: 'workflow', action: 'play' }, model);
      expect(classroomDefinition(id).steps[playing.step].phase).toBe('movement');
      expect(playing.variation).toBeNull();
      expect(playing.progress).toBe(0);
      expect(playing.playing).toBe(true);
      for (const progress of [0, 0.5, 1]) {
        const rendered = workflowSceneFrame({ ...playing, progress });
        for (const pose of Object.values(rendered.transforms))
          expect([...pose.translation, ...pose.rotation].every(Number.isFinite)).toBe(true);
      }
      expect(workflowSceneFrame(initial)).toEqual(frame);
      expect([...source.geometry.getAttribute('position').array]).toEqual(crown);
      expect([...source.rootGeometry!.getAttribute('position').array]).toEqual(root);
      expect(source.position).toEqual(position);
    },
  );

  it('uses each appliance’s actual retention step and rejects navigation outside the lesson', () => {
    for (const id of ['fixed-braces', 'palatal-expansion', 'archwire-expansion']) {
      const scene = initialWorkflowScene(model, id),
        retained = applyWorkflowAction(
          scene,
          { kind: 'workflow', action: 'phase', phase: 'retention' },
          model,
        );
      expect(classroomDefinition(id).steps[retained.step].phase).toBe('retention');
      expect(workflowSceneFrame(retained).progress).toBe(1);
      expect(() => workflowSceneStep(scene, -1, model)).toThrow(/first step/);
      expect(() => workflowSceneStep(scene, classroomDefinition(id).steps.length, model)).toThrow(
        /complete/,
      );
    }
  });
});
