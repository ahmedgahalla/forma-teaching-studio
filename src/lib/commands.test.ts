import { describe, expect, it } from 'vitest';
import { parseCommand, validateCommand } from './commands';

const ids = ['11', '12', '21'];

describe('tooth command parsing', () => {
  it.each([
    'Move 11 buccally 1 mm',
    'move tooth 11 1 mm buccally',
    'move it buccal by 1mm',
    'move the selected tooth by 1 millimetre buccally',
    '  MOVE 11 BUCCALLY 1 MM.  ',
  ])('parses the complete movement command: %s', text => {
    expect(parseCommand(text, '11', ids)).toEqual({
      type: 'move',
      tooth: '11',
      direction: 'buccal',
      amount: 1,
    });
  });

  it('uses explicit targets before selection and accepts decimal and signed world movement', () => {
    expect(parseCommand('move 12 x -0.25 mm', '11', ids)).toEqual({
      type: 'move',
      tooth: '12',
      direction: 'x',
      amount: -0.25,
    });
    expect(parseCommand('move .5 mm mesially', '21', ids)).toEqual({
      type: 'move',
      tooth: '21',
      direction: 'mesial',
      amount: 0.5,
    });
  });

  it.each([
    'move by 1 mm x',
    'move x by 1 mm',
    'move it by 1 mm x',
    'move the selected tooth by 1 mm x',
  ])('does not confuse optional movement filler with a target: %s', text => {
    expect(parseCommand(text, '11', ids)).toEqual({
      type: 'move',
      tooth: '11',
      direction: 'x',
      amount: 1,
    });
  });

  it.each([
    'rotate about x by 5 degrees',
    'rotate around the x axis by 5 degrees',
    'rotate the x axis 5 degrees',
    'rotate x 5 degrees',
    'rotate by 5 degrees around x',
    'rotate 5 degrees around x',
  ])('uses the selected tooth for an axis-first command without a target: %s', text => {
    expect(parseCommand(text, '11', ids)).toEqual({
      type: 'rotate',
      tooth: '11',
      axis: 'x',
      amount: 5,
    });
  });

  it("accepts scientific notation emitted by the backend's canonical commands", () => {
    expect(parseCommand('move 11 x 1e-7 mm', '11', ids)).toEqual({
      type: 'move',
      tooth: '11',
      direction: 'x',
      amount: 1e-7,
    });
    expect(parseCommand('rotate 11 -1E-7 degrees', '11', ids)).toEqual({
      type: 'rotate',
      tooth: '11',
      axis: 'y',
      amount: -1e-7,
    });
    expect(() => parseCommand('move 11 x 1e309 mm', '11', ids)).toThrow(/finite/);
  });

  it('requires an available target', () => {
    expect(() => parseCommand('move it 1 mm buccally', null, ids)).toThrow(/Select a tooth/);
    expect(() => parseCommand('move 18 1 mm buccally', '11', ids)).toThrow(/not present/);
    expect(() => parseCommand('rotate it 5 degrees', '18', ids)).toThrow(/not present/);
  });

  it.each([
    ['rotate it 5 degrees', 'y'],
    ['rotate tooth 11 5° around z', 'z'],
    ['rotate 11 about x by 5 degrees', 'x'],
    ['rotate 11 5 deg on the z axis', 'z'],
  ])('parses rotation and its documented default: %s', (text, axis) => {
    expect(parseCommand(text, '11', ids)).toEqual({ type: 'rotate', tooth: '11', axis, amount: 5 });
  });

  it.each([
    'move 11 buccally',
    'move 11 buccally 1',
    'move 11 buccally 1 cm',
    'rotate 11 5 mm',
    'move 11 1e3 mm x',
    'move 11 Infinity mm x',
    'move 11 NaN mm x',
    'move 11 buccally 1 mm and move 12 lingually 2 mm',
    'undo and redo',
    'move 11 1 mm x; show original',
    'please move 11 1 mm x',
    'move 11 1 mm x extra',
  ])('rejects unsupported, ambiguous, or incomplete input: %s', text => {
    expect(() => parseCommand(text, '11', ids)).toThrow();
  });

  it('rejects numeric overflow', () => {
    expect(() => parseCommand(`move 11 x ${'9'.repeat(400)} mm`, '11', ids)).toThrow(/finite/);
  });

  it('accepts boundary input amounts without implying clinical suitability', () => {
    expect(parseCommand('move 11 x 10 mm', '11', ids)).toMatchObject({ amount: 10 });
    expect(parseCommand('move 11 x -10 mm', '11', ids)).toMatchObject({ amount: -10 });
    expect(parseCommand('rotate 11 180 degrees', '11', ids)).toMatchObject({ amount: 180 });
    expect(parseCommand('rotate 11 -180 degrees', '11', ids)).toMatchObject({ amount: -180 });
  });

  it.each([
    'move 11 x 0 mm',
    'move 11 x -0 mm',
    'move 11 x 10.01 mm',
    'move 11 x -10.01 mm',
    'rotate 11 0 degrees',
    'rotate 11 180.1 degrees',
    'rotate 11 -180.1 degrees',
  ])('rejects zero and out-of-range inputs: %s', text => {
    expect(() => parseCommand(text, '11', ids)).toThrow(/nonzero/);
  });
});

describe('view and timeline commands', () => {
  it('does not require a selected tooth for view, stage, or history operations', () => {
    expect(parseCommand('show original', null, [])).toEqual({ type: 'ghost', visible: true });
    expect(parseCommand('hide original', null, [])).toEqual({ type: 'ghost', visible: false });
    expect(parseCommand('create 10 stages', null, [])).toEqual({ type: 'stages', count: 10 });
    expect(parseCommand('undo', null, [])).toEqual({ type: 'undo' });
    expect(parseCommand('redo', null, [])).toEqual({ type: 'redo' });
    expect(parseCommand('play animation', null, [])).toEqual({ type: 'play' });
  });

  it('accepts stage-count boundaries', () => {
    expect(parseCommand('create 2 stages', null, [])).toEqual({ type: 'stages', count: 2 });
    expect(parseCommand('create 50 stages', null, [])).toEqual({ type: 'stages', count: 50 });
  });

  it.each([
    'create 0 stages',
    'create 1 stage',
    'create 51 stages',
    'create 101 stages',
    'create -1 stages',
    'create 1.5 stages',
    'create 10 stages and play',
  ])('rejects invalid stages: %s', text => {
    expect(() => parseCommand(text, '11', ids)).toThrow();
  });
});

describe('orthodontic groups and complete command scope', () => {
  const full = [
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '21',
    '22',
    '23',
    '24',
    '25',
    '26',
    '27',
    '28',
    '31',
    '32',
    '33',
    '34',
    '35',
    '36',
    '37',
    '38',
    '41',
    '42',
    '43',
    '44',
    '45',
    '46',
    '47',
    '48',
  ];

  it.each([
    ['all teeth', full],
    ['upper teeth', full.slice(0, 16)],
    ['lower teeth', full.slice(16)],
    ['maxillary arch', full.slice(0, 16)],
    ['mandibular arch', full.slice(16)],
    ['upper incisors', ['11', '12', '21', '22']],
    ['lower incisors', ['31', '32', '41', '42']],
    ['canines', ['13', '23', '33', '43']],
    ['upper premolars', ['14', '15', '24', '25']],
    ['lower molars', ['36', '37', '38', '46', '47', '48']],
    ['upper anterior', ['11', '12', '13', '21', '22', '23']],
    ['lower posterior teeth', ['34', '35', '36', '37', '38', '44', '45', '46', '47', '48']],
  ])('resolves %s from permanent FDI IDs', (selector, teeth) => {
    expect(parseCommand(`move ${selector} x 1 mm`, null, full)).toEqual({
      type: 'move_group',
      teeth,
      direction: 'x',
      amount: 1,
    });
  });

  it.each([
    ['intrude upper incisors 0.5 mm', 'intrude', ['11', '12', '21', '22']],
    ['extrude lower incisors 0.5 mm', 'extrude', ['31', '32', '41', '42']],
    ['retract upper anterior 0.5 mm', 'lingual', ['11', '12', '13', '21', '22', '23']],
    ['protract lower incisors 0.5 mm', 'buccal', ['31', '32', '41', '42']],
    ['expand upper teeth 0.5 mm', 'buccal', full.slice(0, 16)],
    ['constrict lower teeth 0.5 mm', 'lingual', full.slice(16)],
    ['distalize upper molars 0.5 mm', 'distal', ['16', '17', '18', '26', '27', '28']],
    ['mesialise canines 0.5 mm', 'mesial', ['13', '23', '33', '43']],
  ])('resolves a precise amount and per-tooth direction: %s', (text, direction, teeth) => {
    expect(parseCommand(text, '11', full)).toEqual({
      type: 'move_group',
      teeth,
      direction,
      amount: 0.5,
    });
  });

  it.each(['teeth 11,12,21', 'teeth 11, 12 and 21', 'teeth 11 12 21', 'teeth 11,12,21,11'])(
    'resolves an explicit complete list: %s',
    selector => {
      expect(parseCommand(`move ${selector} 1 mm labially`, '31', full)).toEqual({
        type: 'move_group',
        teeth: ['11', '12', '21'],
        direction: 'buccal',
        amount: 1,
      });
    },
  );

  it("uses selected teeth as a group while 'it' stays a single tooth", () => {
    expect(parseCommand('move selected teeth palatally 1 mm', '11', full, ['11', '21'])).toEqual({
      type: 'move_group',
      teeth: ['11', '21'],
      direction: 'lingual',
      amount: 1,
    });
    expect(parseCommand('move it palatally 1 mm', '11', full, ['11', '21'])).toEqual({
      type: 'move',
      tooth: '11',
      direction: 'lingual',
      amount: 1,
    });
    expect(() => parseCommand('move selected teeth x 1 mm', '11', full, [])).toThrow(/No teeth/);
  });

  it('never silently drops missing explicit or selected IDs', () => {
    expect(() => parseCommand('move teeth 11,12,21 x 1 mm', '11', ['11', '12'])).toThrow(
      /21.*not present/,
    );
    expect(() => parseCommand('move selected teeth x 1 mm', '11', ['11'], ['11', '21'])).toThrow(
      /21.*not present/,
    );
    expect(() => parseCommand('intrude lower incisors 1 mm', '11', ids)).toThrow(/No teeth/);
    expect(parseCommand('intrude upper incisors 1 mm', '11', ids)).toEqual({
      type: 'move_group',
      teeth: ids,
      direction: 'intrude',
      amount: 1,
    });
  });

  it.each(['11–18', '11-18', '11 to 18', '11 — 18', '11 through 18', '11 - 18'])(
    'rejects tooth range %s rather than selecting its endpoints',
    range => {
      for (const text of [
        `move teeth ${range} buccally 1 mm`,
        `move ${range} 1 mm x`,
        `intrude teeth ${range} 0.5 mm`,
        `tip teeth ${range} 5 degrees`,
        `torque teeth ${range} -3 degrees`,
        `rotate teeth ${range} 5 degrees`,
        `rotate teeth ${range} 5 degrees around y`,
        `reset teeth ${range}`,
      ])
        expect(() => parseCommand(text, '11', full)).toThrow();
      expect(() =>
        validateCommand(
          { type: 'move_group', teeth: [range], direction: 'x', amount: 1 },
          '11',
          full,
        ),
      ).toThrow();
    },
  );

  it('still permits explicit endpoints and signed amounts when no range is implied', () => {
    expect(parseCommand('move teeth 11,18 x -1 mm', '11', full)).toEqual({
      type: 'move_group',
      teeth: ['11', '18'],
      direction: 'x',
      amount: -1,
    });
    expect(parseCommand('rotate teeth 11 and 18 -5 degrees', '11', full)).toEqual({
      type: 'orthodontic',
      teeth: ['11', '18'],
      movement: 'rotate',
      amount: -5,
    });
  });

  it('supports tip, torque, axial rotation and explicit world rotation without changing v1 defaults', () => {
    expect(parseCommand('tip tooth 11 5 degrees', null, full)).toEqual({
      type: 'orthodontic',
      teeth: ['11'],
      movement: 'tip',
      amount: 5,
    });
    expect(parseCommand('torque upper incisors -3 degrees', null, full)).toEqual({
      type: 'orthodontic',
      teeth: ['11', '12', '21', '22'],
      movement: 'torque',
      amount: -3,
    });
    expect(parseCommand('rotate teeth 11,12 5 degrees', null, full)).toEqual({
      type: 'orthodontic',
      teeth: ['11', '12'],
      movement: 'rotate',
      amount: 5,
    });
    expect(parseCommand('rotate 11 5 degrees around long axis', null, full)).toEqual({
      type: 'orthodontic',
      teeth: ['11'],
      movement: 'rotate',
      amount: 5,
    });
    expect(
      parseCommand('rotate selected teeth around the long axis by 5 degrees', '11', full, [
        '11',
        '12',
      ]),
    ).toEqual({ type: 'orthodontic', teeth: ['11', '12'], movement: 'rotate', amount: 5 });
    expect(parseCommand('rotate upper incisors 5 degrees around z', null, full)).toEqual({
      type: 'rotate_group',
      teeth: ['11', '12', '21', '22'],
      axis: 'z',
      amount: 5,
    });
    expect(parseCommand('rotate it 5 degrees', '11', full)).toEqual({
      type: 'rotate',
      tooth: '11',
      axis: 'y',
      amount: 5,
    });
  });

  it('accepts optional by with new commands and preserves strict selection semantics', () => {
    expect(parseCommand('intrude by 0.5 mm', '11', full)).toEqual({
      type: 'move',
      tooth: '11',
      direction: 'intrude',
      amount: 0.5,
    });
    expect(parseCommand('torque by -3 degrees', '11', full)).toEqual({
      type: 'orthodontic',
      teeth: ['11'],
      movement: 'torque',
      amount: -3,
    });
    expect(parseCommand('rotate around the long axis by 3 degrees', '11', full)).toEqual({
      type: 'orthodontic',
      teeth: ['11'],
      movement: 'rotate',
      amount: 3,
    });
    expect(() => parseCommand('rotate about x by 5 degrees', null, full)).toThrow(/Select a tooth/);
    expect(() => parseCommand('reset by', '11', full)).toThrow();
  });

  it('accepts selection reset and brace display commands', () => {
    expect(parseCommand('reset selected teeth', '11', full, ['11', '12'])).toEqual({
      type: 'reset',
      teeth: ['11', '12'],
    });
    expect(parseCommand('reset lower incisors', '11', full)).toEqual({
      type: 'reset',
      teeth: ['31', '32', '41', '42'],
    });
    expect(parseCommand('show braces', null, [])).toEqual({ type: 'appliance', visible: true });
    expect(parseCommand('hide braces', null, [])).toEqual({ type: 'appliance', visible: false });
  });

  it.each([
    'intrude upper incisors 0 mm',
    'extrude lower teeth 10.01 mm',
    'torque upper incisors 181 degrees',
    'move teeth 11-21 x 1 mm',
    'move teeth 11, x 1 mm',
    'intrude upper lower incisors 1 mm',
    'move upper incisors and lower incisors 1 mm x',
    'tip upper incisors 5 degrees and torque lower incisors 3 degrees',
    'rotate upper incisors clockwise',
    'retract anterior teeth',
    'expand upper arch 2 mm total width',
    'intrude incisors 1 mm then show braces',
    'reset teeth 11,12 and play',
    'show braces and move 11 1 mm x',
    'align all teeth',
    'fix overbite',
    'close all gaps',
    'plan braces treatment',
    'apply 100 grams of force',
  ])('rejects ambiguous, unsupported, compound, or unbounded instruction: %s', text => {
    expect(() => parseCommand(text, '11', full)).toThrow();
  });
});

describe('external command validation', () => {
  it.each([
    { type: 'move', tooth: '11', direction: 'buccal', amount: 1 },
    { type: 'move_group', teeth: ['11', '12'], direction: 'intrude', amount: 0.5 },
    { type: 'rotate', tooth: '12', axis: 'z', amount: 5 },
    { type: 'rotate_group', teeth: ['11', '12'], axis: 'x', amount: -5 },
    { type: 'orthodontic', teeth: ['11'], movement: 'tip', amount: 3 },
    { type: 'orthodontic', teeth: ['11', '12'], movement: 'torque', amount: -3 },
    { type: 'orthodontic', teeth: ['11'], movement: 'rotate', amount: 3 },
    { type: 'reset', teeth: ['11', '21'] },
    { type: 'appliance', visible: true },
    { type: 'ghost', visible: false },
    { type: 'stages', count: 10 },
    { type: 'undo' },
    { type: 'redo' },
    { type: 'play' },
  ])('accepts a complete valid command: %j', value => {
    expect(validateCommand(value, '21', ids, ['21'])).toEqual(value);
  });

  it.each([
    null,
    [],
    'move 11 buccally 1 mm',
    {},
    { type: 'plan' },
    { type: 'move', tooth: '11', direction: 'buccal', amount: '1' },
    { type: 'move', tooth: '11', direction: 'buccal', amount: 11 },
    { type: 'move', tooth: '11', direction: 'buccal', amount: 1, teeth: ['12'] },
    { type: 'move', tooth: '11', direction: 'buccal', amount: 1, explanation: 'ignored?' },
    { type: 'move', tooth: '18', direction: 'buccal', amount: 1 },
    { type: 'move', tooth: '11', direction: 'palatal', amount: 1 },
    { type: 'move_group', teeth: [], direction: 'x', amount: 1 },
    { type: 'move_group', teeth: ['11', '18'], direction: 'x', amount: 1 },
    { type: 'move_group', teeth: ['11', 12], direction: 'x', amount: 1 },
    { type: 'move_group', teeth: ['11,12'], direction: 'x', amount: 1 },
    { type: 'move_group', teeth: Array(33).fill('11'), direction: 'x', amount: 1 },
    { type: 'rotate', tooth: '11', axis: 'buccal', amount: 5 },
    { type: 'rotate', tooth: '11', amount: 5 },
    { type: 'orthodontic', teeth: ['11'], movement: 'upright', amount: 3 },
    { type: 'orthodontic', teeth: ['11'], movement: 'torque', amount: NaN },
    { type: 'orthodontic', teeth: ['11'], movement: 'tip', amount: Infinity },
    { type: 'orthodontic', teeth: ['11'], movement: 'tip', amount: 0 },
    { type: 'appliance', visible: 'true' },
    { type: 'ghost' },
    { type: 'stages', count: '10' },
    { type: 'stages', count: 1.5 },
    { type: 'stages', count: 51 },
    { type: 'reset' },
    { type: 'undo', teeth: ['11'] },
  ])('rejects malformed, unknown, out-of-bounds or mismatched objects: %j', value => {
    expect(() => validateCommand(value, '11', ids)).toThrow();
  });
});
