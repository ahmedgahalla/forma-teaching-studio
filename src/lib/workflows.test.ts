import { describe, expect, it } from 'vitest';
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { emptyPose, type Tooth, type Vec3 } from './model';
import { getWorkflowFrame, WORKFLOWS } from './workflows';

const teeth: Tooth[] = [1, 2, 3, 4].flatMap(quadrant => Array.from({ length: 7 }, (_, index) => {
  const side = quadrant === 1 || quadrant === 4 ? -1 : 1;
  return { id: `${quadrant}${index + 1}`, name: 'Synthetic tooth', position: [side * (4 + index * 3), quadrant <= 2 ? 5 : -5, 18 - index * 4] as Vec3,
    buccal: [side * 0.6, 0, 0.8] as Vec3, mesial: [-side * 0.8, 0, 0.6] as Vec3, occlusal: [0, quadrant <= 2 ? -1 : 1, 0] as Vec3, calibrated: true,
    geometry: { marker: 'shared original geometry' } };
}));
const quaternion = (rotation: Vec3) => new Quaternion().setFromEuler(new Euler(...rotation.map(MathUtils.degToRad) as Vec3));

describe('authored workflow storyboards', () => {
  it('provides three sourced sequences that separate installation, loading, movement and passive holding', () => {
    expect(WORKFLOWS.map(w => w.id)).toEqual(['fixed-braces', 'palatal-expansion', 'archwire-expansion']);
    for (const workflow of WORKFLOWS) {
      expect(workflow.steps).toHaveLength(7);
      expect(workflow.steps.map(step => step.phase)).toEqual(['assessment', 'brackets', 'wire', 'forces', 'movement', 'retention', 'retention']);
      expect(workflow.sources.length).toBeGreaterThanOrEqual(3);
      for (const source of workflow.sources) expect(new URL(source.url).protocol).toBe('https:');
      for (const step of workflow.steps) {
        for (const field of ['title', 'action', 'explanation', 'observe', 'question', 'answer'] as const) expect(step[field].length).toBeGreaterThan(8);
        if (step.phase === 'retention') expect(step.arrows).toBe(false);
      }
    }
  });

  it('keeps palate imagery exclusive to the palatal workflow', () => {
    for (const workflow of WORKFLOWS) for (const step of workflow.steps) expect(step.palate).toBe(workflow.id === 'palatal-expansion');
    expect(WORKFLOWS[1].steps[4].explanation).toMatch(/not reconstructed bone/);
    expect(WORKFLOWS[2].steps[4].explanation).toMatch(/no split palate/);
  });

  it.each([
    ['fixed-braces', 6, 'Explain retention'],
    ['palatal-expansion', 5, 'Stop active widening'],
    ['archwire-expansion', 6, 'Maintain the demonstrated position'],
  ] as const)('routes the %s retention shortcut to its intended holding explanation', (id, index, title) => {
    const workflow = WORKFLOWS.find(item => item.id === id)!;
    expect(workflow.retentionStepIndex).toBe(index);
    expect(workflow.steps[workflow.retentionStepIndex].title).toBe(title);
    expect(workflow.steps[workflow.retentionStepIndex].phase).toBe('retention');
    const held = getWorkflowFrame(workflow, workflow.retentionStepIndex, 0, teeth);
    expect(held.progress).toBe(1);
    expect(held.arrows).toBe(false);
    expect(held.transforms).toEqual(getWorkflowFrame(workflow, 4, 1, teeth).transforms);
    if (id !== 'palatal-expansion') expect(workflow.steps[index].view).toBe('occlusal');
  });
});

describe('deterministic synthetic workflow frames', () => {
  it.each(WORKFLOWS.map(w => w.id))('keeps %s installation and force annotations stationary, then holds the completed endpoint', id => {
    const start = getWorkflowFrame(id, 0, 0, teeth);
    for (const index of [0, 1, 2, 3]) {
      const scene = getWorkflowFrame(id, index, 0.9, teeth);
      expect(scene.transforms).toEqual(start.transforms);
      expect(scene.progress).toBe(0);
    }
    expect(getWorkflowFrame(id, 4, 0, teeth).transforms).toEqual(start.transforms);
    const end = getWorkflowFrame(id, 4, 1, teeth);
    for (const index of [5, 6]) {
      const held = getWorkflowFrame(id, index, 0, teeth);
      expect(held.transforms).toEqual(end.transforms);
      expect(held.progress).toBe(1);
      expect(held.arrows).toBe(false);
    }
  });

  it('aligns authored crowded incisors back to the original reference through an actual interpolated orientation', () => {
    const start = getWorkflowFrame('fixed-braces', 0, 0, teeth);
    const middle = getWorkflowFrame('fixed-braces', 4, 0.5, teeth);
    const end = getWorkflowFrame('fixed-braces', 4, 1, teeth);
    expect(start.selectedIds).toEqual(['11', '12', '21', '22']);
    expect(Object.keys(start.transforms).sort()).toEqual(['11', '12', '21', '22']);
    expect(start.transforms['11'].translation).toEqual([0.9, 0, 1.1]);
    expect(middle.transforms['11'].translation).toEqual([0.45, 0, 0.55]);
    expect(quaternion(middle.transforms['11'].rotation).angleTo(new Quaternion())).toBeCloseTo(quaternion(start.transforms['11'].rotation).angleTo(new Quaternion()) / 2, 12);
    expect(end.transforms).toEqual({});
    expect(end.appliance).toBe('braces');
  });

  it('uses bilateral horizontal bodily shifts for the palatal concept, with no tooth inclination', () => {
    const start = getWorkflowFrame('palatal-expansion', 0, 0, teeth);
    const middle = getWorkflowFrame('palatal-expansion', 4, 0.5, teeth);
    const end = getWorkflowFrame('palatal-expansion', 4, 1, teeth);
    expect(start.transforms['16'].translation).toEqual([1.4, 0, 0]);
    expect(start.transforms['26'].translation).toEqual([-1.4, 0, 0]);
    expect(end.transforms['16'].translation).toEqual([-0.8, 0, 0]);
    expect(end.transforms['26'].translation).toEqual([0.8, 0, 0]);
    expect(middle.transforms['16'].translation[0]).toBeCloseTo(0.3, 12);
    for (const [id, pose] of Object.entries(end.transforms)) {
      expect(id[0] === '1' || id[0] === '2').toBe(true);
      expect(pose.translation.slice(1)).toEqual([0, 0]);
      expect(pose.rotation).toEqual([0, 0, 0]);
    }
    expect(end.appliance).toBe('palatal-expander');
    expect(end.palate).toBe(true);
  });

  it('uses local buccal displacement and outward crown inclination for archwire teaching, without a palate split', () => {
    const start = getWorkflowFrame('archwire-expansion', 0, 0, teeth);
    const end = getWorkflowFrame('archwire-expansion', 4, 1, teeth);
    for (const id of ['16', '26']) {
      const tooth = teeth.find(t => t.id === id)!;
      expect(new Vector3(...start.transforms[id].translation).dot(new Vector3(...tooth.buccal))).toBeCloseTo(-0.7, 12);
      expect(new Vector3(...end.transforms[id].translation).dot(new Vector3(...tooth.buccal))).toBeCloseTo(0.55, 12);
      const originalLongAxis = new Vector3(...tooth.occlusal!);
      const crownDirection = originalLongAxis.clone().applyQuaternion(quaternion(end.transforms[id].rotation));
      expect(crownDirection.sub(originalLongAxis).dot(new Vector3(...tooth.buccal))).toBeGreaterThan(0);
      expect(quaternion(end.transforms[id].rotation).angleTo(new Quaternion())).toBeCloseTo(MathUtils.degToRad(4), 12);
    }
    expect(end.appliance).toBe('archwire-expansion');
    expect(end.palate).toBe(false);
    expect(end.selectedIds).toEqual(['14', '15', '16', '17', '24', '25', '26', '27']);
  });

  it('is independent of visit order and never changes the source teeth or geometry', () => {
    const before = JSON.stringify(teeth);
    const expected = getWorkflowFrame(WORKFLOWS[2], 4, 0.3, teeth);
    getWorkflowFrame('palatal-expansion', 6, 1, teeth);
    getWorkflowFrame('fixed-braces', 4, 0.9, teeth);
    expect(getWorkflowFrame('archwire-expansion', 4, 0.3, teeth)).toEqual(expected);
    expected.transforms['11'].translation[0] = 1000;
    expect(getWorkflowFrame('archwire-expansion', 4, 0.3, teeth).transforms['11'].translation[0]).not.toBe(1000);
    expect(JSON.stringify(teeth)).toBe(before);
    for (const workflow of WORKFLOWS) for (const step of [0, 4, 6]) {
      const frame = getWorkflowFrame(workflow.id, step, 0.5, teeth);
      for (const t of teeth.filter(tooth => Number(tooth.id[0]) >= 3)) expect(frame.transforms[t.id] ?? emptyPose()).toEqual(emptyPose());
    }
  });

  it.each([-1, 7, 2.5, NaN, Infinity])('rejects invalid step %s', step => {
    expect(() => getWorkflowFrame('fixed-braces', step, 0, teeth)).toThrow(/step/);
  });
  it.each([-0.1, 1.1, NaN, Infinity])('rejects invalid progress %s without clamping it', progress => {
    expect(() => getWorkflowFrame('fixed-braces', 0, progress, teeth)).toThrow(/progress/);
  });
  it('rejects unknown workflows, missing teeth, duplicate IDs, corrupt coordinates and uncalibrated frames', () => {
    expect(() => getWorkflowFrame('unknown', 0, 0, teeth)).toThrow(/supported/);
    expect(() => getWorkflowFrame('fixed-braces', 0, 0, teeth.filter(t => t.id !== '11'))).toThrow(/requires tooth 11/);
    expect(() => getWorkflowFrame('palatal-expansion', 0, 0, teeth.filter(t => t.id !== '17'))).toThrow(/requires tooth 17/);
    expect(() => getWorkflowFrame('fixed-braces', 0, 0, [...teeth, teeth[0]])).toThrow(/metadata/);
    expect(() => getWorkflowFrame('fixed-braces', 0, 0, teeth.map(t => t.id === '11' ? { ...t, position: [NaN, 0, 0] } : t))).toThrow(/metadata/);
    expect(() => getWorkflowFrame('archwire-expansion', 0, 0, teeth.map(t => t.id === '16' ? { ...t, calibrated: false } : t))).toThrow(/calibrated/);
  });
});
