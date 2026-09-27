import { describe, expect, it } from 'vitest';
import {
  createWakePhraseGate,
  FOLLOW_UP_MS,
  stripWakePhrase,
  WAKE_ALIASES,
  WAKE_PREFIXES,
} from './wake-phrase';

describe('wake phrases', () => {
  it.each(WAKE_ALIASES)('accepts and strips %s', alias => {
    expect(stripWakePhrase(`${alias}, show roots`)).toBe('show roots');
    expect(stripWakePhrase(`${alias}!`)).toBe('');
  });
  it.each(WAKE_PREFIXES)('accepts the %s prefix', prefix => {
    expect(stripWakePhrase(`${prefix} Forma, show the upper arch`)).toBe('show the upper arch');
    expect(stripWakePhrase(`${prefix}, for ma, play`)).toBe('play');
  });
  it('handles case, whitespace, smart apostrophes and punctuation', () => {
    expect(stripWakePhrase('  OKAY Forma’s: show roots. ')).toBe('show roots.');
    expect(stripWakePhrase('FOR   MA — stop listening')).toBe('stop listening');
  });
  it.each([
    'show roots',
    'please Forma play',
    'formal lecture',
    'a former lecturer',
    'formaldehyde',
  ])('requires a complete wake phrase at the beginning: %s', text =>
    expect(stripWakePhrase(text)).toBeNull(),
  );
  it('arms a single follow-up and consumes it', () => {
    let now = 1000;
    const gate = createWakePhraseGate(() => now);
    expect(gate.accept('Forma')).toBeNull();
    now += FOLLOW_UP_MS - 1;
    expect(gate.accept('show roots')).toEqual({ text: 'show roots', alias: false });
    expect(gate.accept('hide gums')).toBeNull();
  });
  it('expires the follow-up exactly at six seconds', () => {
    let now = 1000;
    const gate = createWakePhraseGate(() => now);
    gate.accept('hey Forma');
    now += FOLLOW_UP_MS;
    expect(gate.accept('show roots')).toBeNull();
  });
  it('clears arming on reset and on an explicit wake command', () => {
    const gate = createWakePhraseGate();
    gate.accept('Forma');
    gate.reset();
    expect(gate.accept('show roots')).toBeNull();
    gate.accept('Forma');
    expect(gate.accept('Forma, play')).toEqual({ text: 'play', alias: false });
    expect(gate.accept('show roots')).toBeNull();
  });
  it('only accepts bare stop/cancel without a wake phrase when stoppable', () => {
    const gate = createWakePhraseGate();
    expect(gate.accept('stop')).toBeNull();
    expect(gate.accept('cancel')).toBeNull();
    expect(gate.accept('Stop!', true)).toEqual({ text: 'stop', alias: false });
    expect(gate.accept('cancel.', true)).toEqual({ text: 'cancel', alias: false });
    expect(gate.accept('we can stop here', true)).toBeNull();
    expect(gate.accept('stop listening', true)).toBeNull();
    expect(gate.accept('Forma, stop listening')).toEqual({ text: 'stop listening', alias: false });
  });
  it.each(['former', 'forma’s', 'fauna'])('marks %s as local-only and never arms it', alias => {
    const gate = createWakePhraseGate();
    expect(gate.accept(`${alias}, show roots`)).toEqual({ text: 'show roots', alias: true });
    gate.accept('Forma');
    expect(gate.accept(`${alias}.`)).toBeNull();
    expect(gate.armed()).toBe(false);
    expect(gate.accept('show roots')).toBeNull();
  });
});
