import { describe, expect, it } from 'vitest';
import { LESSONS, normalizeSpeechCommand, parseTeachingCommand } from './lecture';

const ids = [
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
];

describe('English classroom speech normalization', () => {
  it.each([
    ['move tooth eleven buccally one millimeter', 'move tooth 11 buccally 1 mm'],
    ['move tooth twenty one lingually half a millimetre', 'move tooth 21 lingually 0.5 mm'],
    ['move tooth twenty-one by one and a half millimeters x', 'move tooth 21 by 1.5 mm x'],
    ['move tooth eleven x minus point five millimeters', 'move tooth 11 x -0.5 mm'],
    ['move tooth eleven x zero point zero five millimeters', 'move tooth 11 x 0.05 mm'],
    ['move tooth eleven x negative one point five millimeters', 'move tooth 11 x -1.5 mm'],
    ['move tooth eleven x a quarter millimeter', 'move tooth 11 x 0.25 mm'],
    ['torque upper incisors minus three degrees', 'torque upper incisors -3 degrees'],
    ['rotate tooth eleven positive five degrees', 'rotate tooth 11 +5 degrees'],
    ['rotate tooth eleven one hundred and eighty degrees', 'rotate tooth 11 180 degrees'],
    ['select teeth eleven and twenty one', 'select teeth 11 and 21'],
    ['please show three d view', 'show 3 d view'],
    ['  Show   stage five please. ', 'show stage 5'],
  ])('normalizes known speech form %s', (text, expected) => {
    expect(normalizeSpeechCommand(text)).toBe(expected);
  });

  it('does not merge adjacent spoken IDs or erase a range separator', () => {
    expect(normalizeSpeechCommand('select teeth eleven twelve')).toBe('select teeth 11 12');
    expect(normalizeSpeechCommand('select teeth eleven to eighteen')).toBe('select teeth 11 to 18');
    expect(normalizeSpeechCommand('select teeth eleven-twenty-one')).toBe('select teeth 11-21');
  });
});

describe('deterministic teaching scene commands', () => {
  it.each([
    ['try this setup', { kind: 'workspace', action: 'explore' }],
    ['explore this setup', { kind: 'workspace', action: 'explore' }],
    ['explore this lesson', { kind: 'workspace', action: 'explore' }],
    ['restore my workspace', { kind: 'workspace', action: 'restore' }],
    ['back to my saved case', { kind: 'workspace', action: 'restore' }],
    ['return to source lesson', { kind: 'workspace', action: 'lesson' }],
    ['place brackets only', { kind: 'appliance-display', preset: 'brackets' }],
    ['place braces', { kind: 'appliance-display', preset: 'braces' }],
    ['place expander bands', { kind: 'appliance-display', preset: 'expander-bands' }],
    ['place palatal expander', { kind: 'appliance-display', preset: 'palatal-expander' }],
    ['place fixed retainer', { kind: 'appliance-display', preset: 'retainer' }],
    ['remove teaching appliance', { kind: 'appliance-display', preset: 'none' }],
  ])('recognizes an explicit local workspace command: %s', (text, expected) => {
    expect(parseTeachingCommand(text as string, '11', ids)).toEqual(expected);
  });
  it('supports patient-side groups, upper front six, and bounded counted request history', () => {
    expect(parseTeachingCommand('select upper front six', '11', ids)).toEqual({
      kind: 'select',
      teeth: ['11', '12', '13', '21', '22', '23'],
    });
    expect(parseTeachingCommand('select left posterior teeth', '11', ids)).toEqual({
      kind: 'select',
      teeth: ['24', '25', '26', '27', '34', '35', '36', '37'],
    });
    expect(parseTeachingCommand('select lower right molars', '11', ids)).toEqual({
      kind: 'select',
      teeth: ['46', '47'],
    });
    expect(parseTeachingCommand('undo the last two changes', '11', ids)).toEqual({
      kind: 'history',
      action: 'undo',
      count: 2,
    });
    expect(() => parseTeachingCommand('redo eleven changes', '11', ids)).toThrow(/1 and 10/);
  });
  it.each([
    ['select tooth eleven', { kind: 'select', teeth: ['11'] }],
    ['select upper incisors', { kind: 'select', teeth: ['11', '12', '21', '22'] }],
    ['select lower incisors', { kind: 'select', teeth: ['31', '32', '41', '42'] }],
    ['select teeth eleven and twenty one', { kind: 'select', teeth: ['11', '21'] }],
    ['select selected teeth', { kind: 'select', teeth: ['11', '21'] }],
    ['select all teeth', { kind: 'select', teeth: ids }],
    ['select all', { kind: 'select', teeth: ids }],
    ['select upper', { kind: 'select', teeth: ids.slice(0, 14) }],
    ['select lower', { kind: 'select', teeth: ids.slice(14) }],
    ['show front view', { kind: 'view', view: 'front' }],
    ['switch to the right view', { kind: 'view', view: 'right' }],
    ['show left view', { kind: 'view', view: 'left' }],
    ['switch to the left view', { kind: 'view', view: 'left' }],
    ['occlusal view', { kind: 'view', view: 'occlusal' }],
    ['show three d view', { kind: 'view', view: 'perspective' }],
    ['show upper arch', { kind: 'arch', arch: 'upper' }],
    ['isolate lower teeth', { kind: 'arch', arch: 'lower' }],
    ['show both arches', { kind: 'arch', arch: 'both' }],
    ['show all teeth', { kind: 'arch', arch: 'both' }],
    ['show brackets', { kind: 'toggle', target: 'braces', visible: true }],
    ['hide braces', { kind: 'toggle', target: 'braces', visible: false }],
    ['show brackets and wires', { kind: 'toggle', target: 'braces', visible: true }],
    ['show schematic roots', { kind: 'toggle', target: 'roots', visible: true }],
    ['hide gums', { kind: 'toggle', target: 'gums', visible: false }],
    ['show gingiva', { kind: 'toggle', target: 'gums', visible: true }],
    ['show tooth numbers', { kind: 'toggle', target: 'labels', visible: true }],
    ['turn the labels off', { kind: 'toggle', target: 'labels', visible: false }],
    ['grid on', { kind: 'toggle', target: 'grid', visible: true }],
    ['show attachments', { kind: 'toggle', target: 'attachments', visible: true }],
    ['show original', { kind: 'comparison', mode: 'overlay' }],
    ['show original overlay', { kind: 'comparison', mode: 'overlay' }],
    ['hide original', { kind: 'comparison', mode: 'off' }],
    ['comparison off', { kind: 'comparison', mode: 'off' }],
    ['show before', { kind: 'comparison', mode: 'before' }],
    ['show initial positions', { kind: 'comparison', mode: 'before' }],
    ['show after', { kind: 'comparison', mode: 'after' }],
    ['show final', { kind: 'comparison', mode: 'after' }],
    ['next stage', { kind: 'stage', action: 'next' }],
    ['previous stage', { kind: 'stage', action: 'previous' }],
    ['go to stage five', { kind: 'stage', action: 'exact', stage: 5 }],
    ['stage zero', { kind: 'stage', action: 'exact', stage: 0 }],
    ['stage fifty', { kind: 'stage', action: 'exact', stage: 50 }],
    ['stop animation', { kind: 'stop' }],
    ['pause playback', { kind: 'stop' }],
    ['focus on tooth twenty one', { kind: 'focus', tooth: '21' }],
    ['zoom to the selected tooth', { kind: 'focus', tooth: '11' }],
    ['lecture mode on', { kind: 'lecture', enabled: true }],
    ['exit lecture mode', { kind: 'lecture', enabled: false }],
    ['next step', { kind: 'lesson-step', action: 'next' }],
    ['previous lesson step', { kind: 'lesson-step', action: 'previous' }],
    ['restart lesson', { kind: 'lesson-step', action: 'restart' }],
  ])('parses one scene action: %s', (text, expected) => {
    expect(parseTeachingCommand(text as string, '11', ids, ['11', '21'])).toEqual(expected);
  });

  it('passes normalized dental movements through all existing target and amount checks', () => {
    expect(parseTeachingCommand('move tooth eleven buccally one millimeter', null, ids)).toEqual({
      kind: 'dental',
      command: { type: 'move', tooth: '11', direction: 'buccal', amount: 1 },
    });
    expect(parseTeachingCommand('torque upper incisors minus three degrees', null, ids)).toEqual({
      kind: 'dental',
      command: {
        type: 'orthodontic',
        teeth: ['11', '12', '21', '22'],
        movement: 'torque',
        amount: -3,
      },
    });
    expect(
      parseTeachingCommand('move selected teeth x half a millimeter', '11', ids, ['11', '21']),
    ).toEqual({
      kind: 'dental',
      command: { type: 'move_group', teeth: ['11', '21'], direction: 'x', amount: 0.5 },
    });
    expect(parseTeachingCommand('create ten stages', null, ids)).toEqual({
      kind: 'dental',
      command: { type: 'stages', count: 10 },
    });
    expect(parseTeachingCommand('rotate it five degrees', '11', ids)).toEqual({
      kind: 'dental',
      command: { type: 'rotate', tooth: '11', axis: 'y', amount: 5 },
    });
  });

  it.each([
    [
      'add attachments to upper incisors',
      { kind: 'attachment', action: 'add', teeth: ['11', '12', '21', '22'], shape: 'rectangle' },
    ],
    [
      'add rectangular attachment to tooth eleven',
      { kind: 'attachment', action: 'add', teeth: ['11'], shape: 'rectangle' },
    ],
    [
      'add ellipsoidal attachments on selected teeth',
      { kind: 'attachment', action: 'add', teeth: ['11', '21'], shape: 'ellipsoid' },
    ],
    [
      'add bevelled attachment to tooth twenty one',
      { kind: 'attachment', action: 'add', teeth: ['21'], shape: 'beveled' },
    ],
    [
      'remove attachments from selected teeth',
      { kind: 'attachment', action: 'remove', teeth: ['11', '21'] },
    ],
  ])('parses a concrete teaching appliance action: %s', (text, expected) => {
    expect(parseTeachingCommand(text as string, '11', ids, ['11', '21'])).toEqual(expected);
  });

  it.each([
    'show front and right views',
    'show roots and move tooth eleven x one millimeter',
    'show before and after',
    'select eleven then move it one millimeter',
    'move tooth eleven buccally one millimeter and show original',
    'next step and play',
    'select teeth eleven to eighteen',
    'select teeth 11–18',
    'focus upper incisors',
    'stage fifty one',
    'stage minus one',
    'stage one point five',
    'next',
    'continue',
    'align the teeth automatically',
    'fix the bite',
    'apply one hundred grams of force',
    'torque tooth eleven two hundred degrees',
    'move tooth eleven x eleven millimeters',
    'show constructor',
    'constructor on',
    'show banana',
    'show rear view',
    'add attachments to teeth eleven to eighteen',
    'add attachments from tooth eleven',
    'remove rectangular attachments from tooth eleven',
    'remove attachments to tooth eleven',
    'add attachments to upper incisors and show roots',
    'add round attachment to tooth eleven',
  ])('rejects a compound, unknown, ambiguous or unbounded instruction: %s', text => {
    expect(() => parseTeachingCommand(text, '11', ids, ['11', '21'])).toThrow();
  });

  it('requires present tooth IDs and an actual selection when requested', () => {
    expect(() => parseTeachingCommand('select tooth eighteen', '11', ids)).toThrow(/not present/);
    expect(() => parseTeachingCommand('focus it', null, ids)).toThrow(/Select a tooth/);
    expect(() => parseTeachingCommand('add attachments to selected teeth', null, ids, [])).toThrow(
      /No teeth/,
    );
  });
});

describe('built-in teaching sequences', () => {
  it('supplies four short geometric lessons with an explicit reset and supported steps', () => {
    expect(LESSONS).toHaveLength(4);
    expect(new Set(LESSONS.map(lesson => lesson.id)).size).toBe(LESSONS.length);
    for (const lesson of LESSONS) {
      expect(lesson.steps.length).toBeGreaterThanOrEqual(4);
      expect(lesson.steps.length).toBeLessThanOrEqual(6);
      expect(lesson.steps[0].command).toBe('reset all teeth');
      let selected = '11',
        selection = ['11'];
      for (const step of lesson.steps) {
        expect(step.caption.length).toBeGreaterThan(20);
        const action = parseTeachingCommand(step.command, selected, ids, selection);
        if (action.kind === 'select') {
          selection = action.teeth;
          selected = selection[0];
        }
        if (action.kind === 'focus') {
          selection = [action.tooth];
          selected = action.tooth;
        }
        expect(action.kind).not.toBe('lesson-step');
      }
    }
  });
});

describe('explicit workflow voice controls', () => {
  it.each([
    ['start braces workflow', { kind: 'workflow', action: 'start', id: 'fixed-braces' }],
    ['start fixed braces workflow', { kind: 'workflow', action: 'start', id: 'fixed-braces' }],
    [
      'start palatal expansion workflow',
      { kind: 'workflow', action: 'start', id: 'palatal-expansion' },
    ],
    [
      'start archwire expansion workflow',
      { kind: 'workflow', action: 'start', id: 'archwire-expansion' },
    ],
    ['next workflow step', { kind: 'workflow', action: 'next' }],
    ['previous workflow step', { kind: 'workflow', action: 'previous' }],
    ['restart workflow', { kind: 'workflow', action: 'restart' }],
    ['play demonstration', { kind: 'workflow', action: 'play' }],
    ['pause demonstration', { kind: 'workflow', action: 'pause' }],
    ['exit workflow', { kind: 'workflow', action: 'exit' }],
    ['install brackets', { kind: 'workflow', action: 'phase', phase: 'brackets' }],
    ['bond brackets', { kind: 'workflow', action: 'phase', phase: 'brackets' }],
    ['insert archwire', { kind: 'workflow', action: 'phase', phase: 'wire' }],
    ['engage archwire', { kind: 'workflow', action: 'phase', phase: 'wire' }],
    ['install expander', { kind: 'workflow', action: 'phase', phase: 'wire' }],
    ['fit expander', { kind: 'workflow', action: 'phase', phase: 'wire' }],
    ['show forces', { kind: 'workflow', action: 'phase', phase: 'forces' }],
    ['activate expander', { kind: 'workflow', action: 'phase', phase: 'forces' }],
    ['show movement', { kind: 'workflow', action: 'phase', phase: 'movement' }],
    ['demonstrate movement', { kind: 'workflow', action: 'phase', phase: 'movement' }],
    ['show retention', { kind: 'workflow', action: 'phase', phase: 'retention' }],
  ])('parses the complete workflow instruction %s', (text, expected) => {
    expect(parseTeachingCommand(text as string, '11', ids)).toEqual(expected);
  });

  it('keeps existing appliance visibility and generic step commands distinct', () => {
    expect(parseTeachingCommand('show brackets', '11', ids)).toEqual({
      kind: 'toggle',
      target: 'braces',
      visible: true,
    });
    expect(parseTeachingCommand('next step', '11', ids)).toEqual({
      kind: 'lesson-step',
      action: 'next',
    });
    expect(parseTeachingCommand('play', '11', ids)).toEqual({
      kind: 'dental',
      command: { type: 'play' },
    });
    expect(parseTeachingCommand('stop', '11', ids)).toEqual({ kind: 'stop' });
  });

  it.each([
    'start expansion workflow',
    'start braces workflow and move tooth eleven x one millimeter',
    'activate expander ten turns',
    'show forces of one hundred grams',
    'insert archwire and show movement',
    'install brackets then play demonstration',
    'start patient treatment workflow',
    'show retention for six months',
  ])('does not infer a workflow, force or activation prescription: %s', text => {
    expect(() => parseTeachingCommand(text, '11', ids)).toThrow();
  });
});

describe('classroom action aliases', () => {
  it.each([
    ['show upper jaw', { kind: 'arch', arch: 'upper' }],
    ['show both jaws', { kind: 'arch', arch: 'both' }],
    ['highlight upper molars', { kind: 'select', teeth: ['16', '17', '26', '27'] }],
    ['show alveolar bone', { kind: 'anatomy', action: 'bone', visible: true }],
    ['show the root', { kind: 'toggle', target: 'roots', visible: true }],
    ['hide the root', { kind: 'toggle', target: 'roots', visible: false }],
    ['make the bone transparent', { kind: 'anatomy', action: 'opacity', value: 0.25 }],
    ['make bone transparent', { kind: 'anatomy', action: 'opacity', value: 0.25 }],
    ['make the bone opaque', { kind: 'anatomy', action: 'opacity', value: 1 }],
    ['make bone opaque', { kind: 'anatomy', action: 'opacity', value: 1 }],
    ['hide bone', { kind: 'anatomy', action: 'bone', visible: false }],
    ['show cutaway view', { kind: 'anatomy', action: 'cutaway', visible: true }],
    ['show periodontal ligament', { kind: 'anatomy', action: 'ligament', visible: true }],
    ['hide pdl', { kind: 'anatomy', action: 'ligament', visible: false }],
    [
      'set bone opacity to thirty five percent',
      { kind: 'anatomy', action: 'opacity', value: 0.35 },
    ],
    ['bone opacity 0.5', { kind: 'anatomy', action: 'opacity', value: 0.5 }],
    ['set speed to slow', { kind: 'speed', value: 0.5 }],
    ['normal speed', { kind: 'speed', value: 1 }],
    ['double speed', { kind: 'speed', value: 2 }],
    ['playback speed 0.5x', { kind: 'speed', value: 0.5 }],
    ['playback speed 1x', { kind: 'speed', value: 1 }],
    ['playback speed 2x', { kind: 'speed', value: 2 }],
    ['explain this step', { kind: 'narrate', target: 'step' }],
    ['explain answer aloud', { kind: 'narrate', target: 'answer' }],
    ['read the answer', { kind: 'narrate', target: 'answer' }],
    ['reveal the answer', { kind: 'question', visible: true }],
    ['reveal explanation', { kind: 'question', visible: true }],
    ['show the answer', { kind: 'question', visible: true }],
    ['hide answer', { kind: 'question', visible: false }],
    ['hide the explanation', { kind: 'question', visible: false }],
    ['pause halfway', { kind: 'progress', value: 0.5 }],
    ['repeat that', { kind: 'replay', slower: false }],
    ['do that again more slowly', { kind: 'replay', slower: true }],
    ['undo that', { kind: 'dental', command: { type: 'undo' } }],
    ['redo the last request', { kind: 'dental', command: { type: 'redo' } }],
    ['return to the lesson', { kind: 'return-lesson' }],
    ['start anatomy lesson', { kind: 'anatomy-lesson', action: 'start' }],
    ['compare translation and tipping', { kind: 'anatomy-lesson', action: 'start' }],
    ['demonstrate tooth translation', { kind: 'anatomy-lesson', action: 'translation' }],
    ['show tipping in the anatomy lesson', { kind: 'anatomy-lesson', action: 'tipping' }],
  ])('parses %s', (text, expected) =>
    expect(parseTeachingCommand(text as string, '11', ids)).toEqual(expected),
  );

  it.each([
    'bone opacity 101 percent',
    'bone opacity 1.1',
    'show bone reconstruction',
    'explain which treatment is safe',
    'demonstrate translation safely',
    'set speed to 4x',
  ])('does not infer unsupported action: %s', text => {
    expect(() => parseTeachingCommand(text, '11', ids)).toThrow();
  });
});
