import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPushToTalk, type CaptureState } from '@/lib/push-to-talk';
import { speechConstructor } from '@/lib/speech';
import { createHandsFree, type HandsFreeState } from '@/lib/voice/hands-free';
import {
  DEFAULT_VOICE_SETTINGS,
  readVoiceSettings,
  saveVoiceSettings,
  validatedVoiceSettings,
  type VoiceSettings,
} from '@/lib/voice/settings';
import { createSpeaker } from '@/lib/voice/speaker';
import type { RuntimeState } from '@/lib/teaching-runtime';
import { useHoldToTalkKeys } from './useHoldToTalkKeys';

type Options = {
  submit: (text: string) => Promise<RuntimeState | undefined>;
  interrupt: () => void;
  cancel: () => void;
  canStop: () => boolean;
  message: (message: string, error?: boolean, transcript?: string) => void;
};

export function useTeachingVoice(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const [capture, setCapture] = useState<CaptureState>({
    supported: false,
    phase: 'idle',
    transcript: '',
  });
  const [voice, setVoice] = useState<HandsFreeState>({
    supported: false,
    active: false,
    phase: 'idle',
    transcript: '',
  });
  const [voiceSettings, updateSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [narration, setNarration] = useState('');
  const settings = useRef(DEFAULT_VOICE_SETTINGS),
    held = useRef(false);
  const mic = useRef<ReturnType<typeof createPushToTalk> | null>(null);
  const handsFree = useRef<ReturnType<typeof createHandsFree> | null>(null);
  const speaker = useRef<ReturnType<typeof createSpeaker> | null>(null);
  const speaking = useRef(false),
    alive = useRef(false),
    request = useRef(0);
  const narrated = useRef(0);
  const syncPause = () => handsFree.current?.setPaused(speaking.current || held.current);
  const stopSpeaking = () => speaker.current?.cancel();
  const invalidate = () => {
    request.current++;
    stopSpeaking();
  };
  const cancelCapture = () => {
    held.current = false;
    mic.current?.cancel();
    syncPause();
  };
  const stopListening = () => {
    handsFree.current?.stop();
    invalidate();
    latest.current.message('Hands-free is off.', false, 'stop listening');
  };
  const submitVoice = async (text: string) => {
    held.current = false;
    syncPause();
    invalidate();
    const own = request.current,
      beforeNarration = narrated.current;
    try {
      const result = await latest.current.submit(text);
      if (
        !alive.current ||
        own !== request.current ||
        !settings.current.spokenReplies ||
        !result ||
        beforeNarration !== narrated.current ||
        /^stop listening[.!?]?$/i.test(text)
      )
        return;
      const reply = result.error
        ? result.message
        : result.message.split(/\s+/).slice(0, 12).join(' ');
      await speaker.current?.speak(reply);
    } catch (error) {
      if (alive.current && own === request.current)
        latest.current.message(
          error instanceof Error ? error.message : 'Speech output unavailable.',
          true,
          text,
        );
    }
  };
  const initializeRecognition = () => {
    const browser = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const Recognition = speechConstructor(browser);
    mic.current?.dispose();
    handsFree.current?.dispose();
    mic.current = createPushToTalk(
      Recognition,
      {
        state: state => {
          if (alive.current) setCapture(state);
        },
        final: text => {
          void submitVoice(text);
        },
        error: message => {
          held.current = false;
          syncPause();
          latest.current.message(message, true);
        },
      },
      settings.current.language,
    );
    handsFree.current = createHandsFree(
      Recognition,
      {
        state: state => {
          if (alive.current) setVoice(state);
        },
        final: text => {
          void submitVoice(text);
        },
        error: message => latest.current.message(message, true),
        canStop: () => speaking.current || latest.current.canStop(),
      },
      settings.current.language,
    );
    syncPause();
  };
  useEffect(() => {
    alive.current = true;
    settings.current = readVoiceSettings();
    updateSettings(settings.current);
    speaker.current = createSpeaker(
      () => settings.current.language,
      text => {
        speaking.current = !!text;
        if (text) narrated.current++;
        syncPause();
        if (alive.current) setNarration(text);
      },
    );
    initializeRecognition();
    const pagehide = () => {
      handsFree.current?.stop();
      cancelCapture();
      invalidate();
      latest.current.cancel();
    };
    window.addEventListener('pagehide', pagehide);
    return () => {
      alive.current = false;
      handsFree.current?.dispose();
      mic.current?.dispose();
      speaker.current?.cancel();
      window.removeEventListener('pagehide', pagehide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-owned browser services read current callbacks/settings through refs
  }, []);
  const setVoiceSettings = (value: VoiceSettings) => {
    const next = validatedVoiceSettings(value);
    cancelCapture();
    invalidate();
    const changedLanguage = next.language !== settings.current.language;
    const changedMode = next.mode !== settings.current.mode;
    if (changedLanguage || changedMode) handsFree.current?.stop();
    settings.current = next;
    updateSettings(next);
    saveVoiceSettings(next);
    if (changedLanguage) initializeRecognition();
  };
  const toggleHandsFree = () => {
    if (handsFree.current?.getState().active) stopListening();
    else {
      cancelCapture();
      handsFree.current?.start();
      syncPause();
    }
  };
  const start = () => {
    if (held.current) return;
    held.current = true;
    syncPause();
    invalidate();
    latest.current.interrupt();
    mic.current?.start();
  };
  const finish = () => {
    mic.current?.finish();
  };
  useHoldToTalkKeys({
    enabled: voiceSettings.mode === 'hold' && !voice.active,
    held: () => held.current,
    start,
    finish,
    cancel: options.cancel,
    cancelCapture,
  });
  return {
    capture,
    voice,
    voiceSettings,
    setVoiceSettings,
    toggleHandsFree,
    narration,
    start,
    finish,
    cancelCapture,
    stopListening,
    stopSpeaking,
    invalidate,
    speak: (text: string, signal: AbortSignal) =>
      speaker.current?.speak(text, signal) ?? Promise.resolve(),
  };
}
