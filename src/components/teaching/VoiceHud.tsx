'use client';
import { useEffect, useState } from 'react';
import type { RuntimeState } from '@/lib/teaching-runtime';
import { useTeaching } from './TeachingController';
import './VoiceHud.css';
export { VOICE_VIEWPORT_PROPS } from '@/lib/lecture-layout';

type VoiceHudState = {
  active: boolean;
  paused?: boolean;
  interim: string;
  narration: string;
  runtime: RuntimeState;
};

function RequestCaption({ runtime, suppressed }: { runtime: RuntimeState; suppressed: boolean }) {
  const [visible, setVisible] = useState(true);
  const complete = runtime.phase === 'idle';
  useEffect(() => {
    if (!complete) return;
    const timer = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timer);
  }, [complete]);
  if (!visible || suppressed) return null;
  return (
    <div className={`voice-hud-caption voice-hud-request${complete ? ' voice-hud-result' : ''}`}>
      <p className={`voice-hud-summary${runtime.error ? ' voice-hud-error' : ''}`}>
        <span aria-hidden="true">{runtime.error ? '! ' : complete ? '✓ ' : ''}</span>
        {runtime.message}
      </p>
      {runtime.transcript && <p className="voice-hud-heard">Heard: {runtime.transcript}</p>}
    </div>
  );
}

export function VoiceHudView({ active, paused, interim, narration, runtime }: VoiceHudState) {
  return (
    <div className="voice-hud" role="status" aria-live="polite" aria-atomic="true">
      {active && (
        <span className="voice-hud-listening">
          <i aria-hidden="true" /> Listening{paused ? ' · paused while Forma speaks' : ''}
        </span>
      )}
      {narration ? (
        <div className="voice-hud-caption voice-hud-narration">
          <p>{narration}</p>
        </div>
      ) : interim ? (
        <div className="voice-hud-caption voice-hud-interim">
          <p>{interim}</p>
        </div>
      ) : null}
      {(runtime.transcript || runtime.error) && (
        <RequestCaption
          key={`${runtime.phase}:${runtime.transcript}:${runtime.message}`}
          runtime={runtime}
          suppressed={!!(narration || interim)}
        />
      )}
    </div>
  );
}

export function VoiceHud() {
  const { voice, capture, narration, runtime } = useTeaching();
  return (
    <VoiceHudView
      active={voice.active}
      paused={voice.phase === 'paused'}
      interim={capture.phase === 'idle' ? voice.transcript : capture.transcript}
      narration={narration}
      runtime={runtime}
    />
  );
}
