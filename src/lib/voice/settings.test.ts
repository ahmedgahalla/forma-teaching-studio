import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_VOICE_SETTINGS,
  readVoiceSettings,
  saveVoiceSettings,
  validatedVoiceSettings,
  VOICE_SETTINGS_KEY,
} from './settings';

describe('voice settings', () => {
  it('defaults to hold to talk, US English and silent replies', () => {
    expect(DEFAULT_VOICE_SETTINGS).toEqual({
      mode: 'hold',
      language: 'en-US',
      spokenReplies: false,
    });
    expect(readVoiceSettings({ getItem: () => null })).toEqual(DEFAULT_VOICE_SETTINGS);
  });
  it.each([
    null,
    [],
    false,
    {},
    { mode: 'hands-free', language: 'en-US' },
    { mode: 'hands-free', language: 'fr-FR', spokenReplies: true },
    { mode: 'always', language: 'en-US', spokenReplies: true },
    { mode: 'hold', language: 'en-US', spokenReplies: 'true' },
    { mode: 'hold', language: 'en-US', spokenReplies: false, autoStart: true },
    { mode: ['hold'], language: 'en-US', spokenReplies: false },
  ])('uses defaults for invalid or unknown data: %j', value => {
    expect(validatedVoiceSettings(value)).toEqual(DEFAULT_VOICE_SETTINGS);
  });
  it('persists and reads the complete validated preference without activation', () => {
    const settings = { mode: 'hands-free', language: 'en-GB', spokenReplies: true } as const;
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
    saveVoiceSettings(settings, storage);
    expect(storage.setItem).toHaveBeenCalledWith(VOICE_SETTINGS_KEY, JSON.stringify(settings));
    expect(readVoiceSettings(storage)).toEqual(settings);
    expect(readVoiceSettings(storage)).not.toHaveProperty('active');
  });
  it('tolerates invalid JSON and inaccessible local storage', () => {
    expect(readVoiceSettings({ getItem: () => '{bad' })).toEqual(DEFAULT_VOICE_SETTINGS);
    expect(
      readVoiceSettings({
        getItem() {
          throw new Error('SecurityError');
        },
      }),
    ).toEqual(DEFAULT_VOICE_SETTINGS);
    expect(() =>
      saveVoiceSettings(DEFAULT_VOICE_SETTINGS, {
        setItem() {
          throw new Error('QuotaExceededError');
        },
      }),
    ).not.toThrow();
  });
  it('returns independent defaults, so callers cannot change future fallbacks', () => {
    const fallback = validatedVoiceSettings(null);
    fallback.mode = 'hands-free';
    expect(validatedVoiceSettings(null).mode).toBe('hold');
  });
});
