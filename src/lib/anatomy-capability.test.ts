import { describe, expect, it } from 'vitest';
import type { DentalCase } from './geometry';
import { createOrthodonticDemo } from './demo';
import { supportsTeachingAnatomy } from './anatomy-capability';
import { anatomyCutawayTooth, createTeachingAnatomy, DEFAULT_ANATOMY } from './teaching-anatomy';
import { initialWorkflowScene, applyWorkflowAction } from './workflow-scene';

describe('atlas supporting anatomy', () => {
  const base = { ...createOrthodonticDemo(), asset: 'claude-atlas-v1' } as DentalCase;
  it('never generates unsupported sleeves or cutaway clips on atlas roots', () => {
    expect(supportsTeachingAnatomy(base)).toBe(false);
    const anatomy = { ...DEFAULT_ANATOMY, cutaway: true, bone: true, ligament: true };
    expect(anatomyCutawayTooth(base, anatomy, '16')).toBeUndefined();
    const kit = createTeachingAnatomy(base);
    kit.update({}, anatomy, { selected: '16' });
    expect(kit.group.children).toHaveLength(0);
    expect(kit.bounds.isEmpty()).toBe(true);
    expect(kit.gumPlanes).toHaveLength(0);
    kit.dispose();
  });
  it('keeps atlas for appliances, rejects tissue commands, and uses a separate schematic socket lesson', () => {
    const braces = initialWorkflowScene(base);
    expect(braces.model).toBe(base);
    expect(() =>
      applyWorkflowAction(braces, { kind: 'anatomy', action: 'bone', visible: true }, base),
    ).toThrow('Matching bone');
    let lesson = applyWorkflowAction(braces, { kind: 'anatomy-lesson', action: 'start' }, base);
    const supportModel = lesson.model;
    expect(supportModel).not.toBe(base);
    expect(supportsTeachingAnatomy(supportModel)).toBe(true);
    lesson = applyWorkflowAction(lesson, { kind: 'workflow', action: 'next' }, base);
    lesson = applyWorkflowAction(lesson, { kind: 'progress', value: 0.5 }, base);
    expect(lesson.model).toBe(supportModel);
    expect(lesson.progress).toBe(0.5);
    const returned = applyWorkflowAction(
      lesson,
      { kind: 'workflow', action: 'start', id: 'fixed-braces' },
      base,
    );
    expect(returned.model).toBe(base);
  });
});
