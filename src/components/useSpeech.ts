'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSpeechController, speechConstructor, type SpeechState } from '@/lib/speech';

export function useSpeech(onFinal: (text: string) => void, onError: (message: string) => void) {
  const callbacks = useRef({ onFinal, onError }); callbacks.current = { onFinal, onError };
  const controller = useRef<ReturnType<typeof createSpeechController> | null>(null);
  const [state, setState] = useState<SpeechState>({ supported: false, listening: false, transcript: '' });
  useEffect(() => {
    const browser = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const current = createSpeechController(speechConstructor(browser), {
      onFinal: text => callbacks.current.onFinal(text), onError: message => callbacks.current.onError(message), onState: setState,
    });
    controller.current = current;
    return () => { current.dispose(); controller.current = null; };
  }, []);
  const start = useCallback((continuous: boolean) => controller.current?.start(continuous), []);
  const stop = useCallback(() => controller.current?.stop(), []);
  return { ...state, start, stop };
}

export default useSpeech;
