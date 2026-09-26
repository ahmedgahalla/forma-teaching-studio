export type VoiceSettings = {
  mode: 'hold' | 'hands-free';
  language: 'en-US' | 'en-GB';
  spokenReplies: boolean;
};
export const VOICE_SETTINGS_KEY = 'forma-voice-settings';
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  mode: 'hold',
  language: 'en-US',
  spokenReplies: false,
};

export function validatedVoiceSettings(value: unknown): VoiceSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { ...DEFAULT_VOICE_SETTINGS };
  const saved = value as Record<string, unknown>;
  if (
    Object.keys(saved).sort().join() !== 'language,mode,spokenReplies' ||
    (saved.mode !== 'hold' && saved.mode !== 'hands-free') ||
    (saved.language !== 'en-US' && saved.language !== 'en-GB') ||
    typeof saved.spokenReplies !== 'boolean'
  )
    return { ...DEFAULT_VOICE_SETTINGS };
  return {
    mode: saved.mode,
    language: saved.language,
    spokenReplies: saved.spokenReplies,
  };
}

export function readVoiceSettings(storage?: Pick<Storage, 'getItem'>): VoiceSettings {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    return validatedVoiceSettings(JSON.parse(target?.getItem(VOICE_SETTINGS_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(
  settings: VoiceSettings,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    target?.setItem(VOICE_SETTINGS_KEY, JSON.stringify(validatedVoiceSettings(settings)));
  } catch {
    // Browsers may disable storage; the current session still uses its selected settings.
  }
}
