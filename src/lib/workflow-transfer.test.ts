import { afterAll, describe, expect, it } from 'vitest';
import { BoxGeometry, Vector3 } from 'three';
import { createOrthodonticDemo } from './demo';
import {
  applyWorkflowAction,
  classroomDefinition,
  initialWorkflowScene,
  workflowSceneFrame,
  workflowSceneStep,
} from './workflow-scene';
import {
  assertPreparedWorkflowCompatible,
  captureWorkflowArrangement,
  createWorkflowTryState,
} from './workflow-transfer';
import { createTryState, transitionTryMode } from './try-mode';
import { toothMatrix } from './analysis';
import { createTeachingAnatomy } from './teaching-anatomy';
import { workflowFixedVisibility } from './workflow-appliances';
import type { Transforms, Vec3 } from './model';

const base = createOrthodonticDemo();
afterAll(() => {
  base.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  base.gums.forEach(gum => gum.geometry.dispose());
});

describe('prepared workflow arrangement capture', () => {
  it.each(['fixed-braces', 'palatal-expansion', 'archwire-expansion'])(
    'freezes the exact displayed %s frame at intermediate progress',
    id => {
      const scene = {
        ...workflowSceneStep(initialWorkflowScene(base, id), 4, base),
        progress: 0.37,
        playing: true,
        selected: ['16', '26'],
      };
      const frame = workflowSceneFrame(scene),
        packet = captureWorkflowArrangement(scene, base);
      expect(packet.transforms).toEqual(frame.transforms);
      expect(packet.transforms).not.toBe(frame.transforms);
      expect(packet.source).toMatchObject({
        workflowId: id,
        step: 4,
        progress: 0.37,
        variation: false,
      });
      expect(packet.selectedIds).toEqual(['16', '26']);
      expect(packet.selectedIds).not.toBe(scene.selected);
      for (const tooth of base.teeth) {
        const expected = new Vector3(0.4, -0.6, 0.8).applyMatrix4(
          toothMatrix(tooth, frame.transforms),
        );
        const actual = new Vector3(0.4, -0.6, 0.8).applyMatrix4(
          toothMatrix(
            packet.model.teeth.find(item => item.id === tooth.id)!,
            packet.transforms,
          ),
        );
        expect(actual.distanceTo(expected)).toBeLessThan(1e-10);
      }
      expect(scene.playing).toBe(true);
      expect(scene.progress).toBe(0.37);
      expect(scene.variation).toBeNull();
    },
  );

  it('uses effective retention progress, carries the source lesson text, and respects the displayed arrow toggle', () => {
    const scene = {
      ...workflowSceneStep(initialWorkflowScene(base, 'palatal-expansion'), 5, base),
      progress: 0.2,
      arrows: false,
      braces: false,
    };
    const packet = captureWorkflowArrangement(scene, base),
      definition = classroomDefinition(scene.id),
      step = definition.steps[5];
    expect(packet.source.progress).toBe(1);
    expect(packet.display.workflowOverlay).toEqual({
      appliance: 'palatal-expander',
      phase: 'retention',
      progress: 1,
      arrows: false,
      palate: true,
    });
    expect(packet.display.braces).toBe(false);
    expect(packet.source).toMatchObject({
      title: definition.title,
      stepTitle: step.title,
      explanation: step.explanation,
      question: step.question,
      answer: step.answer,
      sources: definition.sources,
    });
    expect(packet.source.sources).not.toBe(definition.sources);
    expect(packet.source.sources[0]).not.toBe(definition.sources[0]);
    const movement = { ...workflowSceneStep(initialWorkflowScene(base), 4, base), arrows: false };
    expect(captureWorkflowArrangement(movement, base).display.workflowOverlay!.arrows).toBe(false);
  });

  it.each([0, 1, 2, 3])(
    'captures anatomy step %i through the anatomy frame path and preserves stationary supporting tissues',
    step => {
      const scene = {
        ...workflowSceneStep(initialWorkflowScene(base, 'anatomy'), step, base),
        progress: 0.6,
      };
      const packet = captureWorkflowArrangement(scene, base),
        displayed = workflowSceneFrame(scene).transforms;
      expect(packet.transforms).toEqual(displayed);
      expect(packet.display.workflowOverlay).toBeUndefined();
      expect(packet.display.anatomy).toEqual(scene.anatomy);
      const sourceKit = createTeachingAnatomy(base),
        copyKit = createTeachingAnatomy(packet.model);
      sourceKit.update(displayed, scene.anatomy, { selected: '11' });
      copyKit.update(packet.transforms, packet.display.anatomy, { selected: '11' });
      expect(copyKit.labels.map(label => label.position.toArray())).toEqual(
        sourceKit.labels.map(label => label.position.toArray()),
      );
      expect(copyKit.group.children.map(child => child.position.toArray())).toEqual(
        sourceKit.group.children.map(child => child.position.toArray()),
      );
      expect(copyKit.bounds.equals(sourceKit.bounds)).toBe(true);
      sourceKit.dispose();
      copyKit.dispose();
    },
  );

  it('uses the visible variation, including attachment metadata, instead of rerunning the canonical storyboard', () => {
    const movement = { ...workflowSceneStep(initialWorkflowScene(base), 4, base), progress: 0.55 };
    let scene = applyWorkflowAction(
      movement,
      { kind: 'dental', command: { type: 'move', tooth: '11', direction: 'x', amount: 0.7 } },
      base,
    );
    scene = applyWorkflowAction(
      scene,
      { kind: 'attachment', action: 'add', teeth: ['11'], shape: 'beveled' },
      base,
    );
    const packet = captureWorkflowArrangement(scene, base),
      source = scene.model.teeth.find(tooth => tooth.id === '11')!,
      copied = packet.model.teeth.find(tooth => tooth.id === '11')!;
    expect(packet.transforms).toEqual(scene.variation);
    expect(packet.transforms).not.toEqual(workflowSceneFrame(scene).transforms);
    expect(packet.source.variation).toBe(true);
    expect(packet.source.label).toContain('temporary variation');
    expect(packet.display.attachments).toBe(true);
    expect(copied.attachment).toEqual(source.attachment);
    expect(copied.attachment).not.toBe(source.attachment);
    expect(copied.geometry).toBe(source.geometry);
    expect(copied.rootGeometry).toBe(source.rootGeometry);
    copied.attachment!.width = 7;
    copied.position[0] += 5;
    copied.buccal[0] += 1;
    packet.transforms['11'].translation[0] += 20;
    expect(source.attachment!.width).toBe(2.5);
    expect(copied.position).not.toEqual(source.position);
    expect(copied.buccal).not.toEqual(source.buccal);
    expect(packet.transforms['11'].translation[0]).not.toBe(scene.variation!['11'].translation[0]);
    expect(base.teeth.find(tooth => tooth.id === '11')!.attachment).toBeUndefined();
  });

  it('preserves phase-aware appliance visibility without triggering phase progression', () => {
    const scene = workflowSceneStep(initialWorkflowScene(base, 'fixed-braces'), 1, base),
      packet = captureWorkflowArrangement(scene, base);
    expect(workflowFixedVisibility(packet.display.workflowOverlay, packet.display.braces)).toEqual({
      brackets: true,
      wires: false,
      ligatures: false,
    });
    const state = createWorkflowTryState(packet),
      next = transitionTryMode(packet.model, state, {
        type: 'preview',
        edit: { type: 'segment-translate', teeth: ['16'], axis: 'y', amount: 1 },
      });
    expect(next.current).toEqual(packet.transforms);
    expect(next.pending!.from).toEqual(packet.transforms);
    expect(packet.display.workflowOverlay!.phase).toBe('brackets');
    expect(packet.display.workflowOverlay!.progress).toBe(0);
    expect(packet.transforms).toEqual(workflowSceneFrame(scene).transforms);
  });
});

describe('transfer provenance and fresh experiment state', () => {
  it('accepts metadata copies on the canonical geometry but rejects an imported or changed geometry/frame', () => {
    const scene = initialWorkflowScene(base),
      copied = captureWorkflowArrangement(scene, base).model;
    expect(() => assertPreparedWorkflowCompatible(copied, base)).not.toThrow();
    expect(() => assertPreparedWorkflowCompatible({ ...copied, demo: false }, base)).toThrow(
      /prepared/,
    );
    const replacement = new BoxGeometry(1, 1, 1);
    try {
      for (const change of [
        { geometry: replacement },
        { rootGeometry: replacement },
        { calibrated: false },
        { position: [99, 0, 0] as Vec3 },
        { buccal: [1, 0, 0] as Vec3 },
        { bracketPosition: [0, 0, 0] as Vec3 },
      ])
        expect(() =>
          assertPreparedWorkflowCompatible(
            {
              ...copied,
              teeth: copied.teeth.map((tooth, i) => (i ? tooth : { ...tooth, ...change })),
            },
            base,
          ),
        ).toThrow();
      expect(() =>
        assertPreparedWorkflowCompatible(
          {
            ...copied,
            gums: copied.gums.map((gum, i) => (i ? gum : { ...gum, geometry: replacement })),
          },
          base,
        ),
      ).toThrow();
      expect(() =>
        assertPreparedWorkflowCompatible(
          {
            ...copied,
            gums: copied.gums.map((gum, i) => (i ? gum : { ...gum, position: [1, 2, 3] })),
          },
          base,
        ),
      ).toThrow();
    } finally {
      replacement.dispose();
    }
    expect(() =>
      assertPreparedWorkflowCompatible({ ...copied, teeth: copied.teeth.slice(1) }, base),
    ).toThrow();
    expect(() =>
      assertPreparedWorkflowCompatible(
        { ...copied, teeth: [copied.teeth[0], ...copied.teeth.slice(0, -1)] },
        base,
      ),
    ).toThrow();
  });

  it('creates an independent constrained Try state and comparison without importing previous case state', () => {
    const previous = {
        ...createTryState({ '31': { translation: [3, 0, 0], rotation: [0, 0, 0] } }),
        lockedIds: ['31'],
        unrestricted: true,
      },
      before = structuredClone(previous);
    const packet = captureWorkflowArrangement(
        { ...workflowSceneStep(initialWorkflowScene(base), 4, base), progress: 0.42 },
        base,
      ),
      state = createWorkflowTryState(packet);
    expect(state.active).toBe(true);
    expect(state.current).toEqual(packet.transforms);
    expect(state.current).not.toBe(packet.transforms);
    expect(state.lockedIds).toEqual([]);
    expect(state.unrestricted).toBe(false);
    expect(state.pending).toBeNull();
    expect(state.lastEdit).toBeNull();
    expect(state.groups).toEqual([]);
    expect(state.snapshots).toEqual([{ name: 'Workflow start', transforms: packet.transforms }]);
    expect(state.snapshots[0].transforms).not.toBe(state.current);
    state.current['11'].translation[0] += 1;
    expect(state.snapshots[0].transforms['11']).toEqual(packet.transforms['11']);
    expect(previous).toEqual(before);
  });

  it('deep-copies the displayed metadata without copying or disposing immutable meshes', () => {
    const scene = initialWorkflowScene(base, 'anatomy'),
      packet = captureWorkflowArrangement(scene, base);
    packet.selectedIds.push('12');
    packet.display.anatomy.opacity = 0.2;
    packet.model.gums[0].position[0] = 100;
    packet.source.sources[0].title = 'Changed copy';
    expect(scene.selected).toEqual(['11']);
    expect(scene.anatomy.opacity).toBe(1);
    expect(base.gums[0].position[0]).toBe(0);
    expect(classroomDefinition('anatomy').sources[0].title).not.toBe('Changed copy');
    expect(packet.model.gums[0].geometry).toBe(base.gums[0].geometry);
    expect(packet.model.teeth[0].geometry).toBe(base.teeth[0].geometry);
  });

  it('rejects malformed source state and unknown, nonfinite, or excessive variation poses', () => {
    const scene = initialWorkflowScene(base);
    for (const change of [
      { id: 'unknown' },
      { step: -1 },
      { step: 99 },
      { progress: NaN },
      { progress: 1.1 },
      { selected: ['99'] },
      { selected: ['11', '11'] },
      { anatomy: { ...scene.anatomy, opacity: Infinity } },
    ]) {
      expect(() => captureWorkflowArrangement({ ...scene, ...change }, base)).toThrow();
    }
    const invalidPoses: Transforms[] = [
      { '99': { translation: [0, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 } },
      { '11': { translation: [Infinity, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 } },
      { '11': { translation: [1e6, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 } },
    ];
    for (const variation of invalidPoses)
      expect(() => captureWorkflowArrangement({ ...scene, variation }, base)).toThrow(/poses/);
    const packet = captureWorkflowArrangement(scene, base);
    packet.transforms['11'].translation[0] = NaN;
    expect(() => createWorkflowTryState(packet)).toThrow(/poses/);
  });
});
