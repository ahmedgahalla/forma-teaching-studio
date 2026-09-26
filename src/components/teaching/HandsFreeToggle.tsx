'use client';
import { Mic, MicOff } from 'lucide-react';
import { useTeaching } from './TeachingController';
import './HandsFreeToggle.css';

export function HandsFreeToggle() {
  const { voice, toggleHandsFree } = useTeaching();
  return (
    <button
      type="button"
      className="hands-free-toggle"
      aria-label={voice.active ? 'Listening' : 'Hands-free'}
      aria-pressed={voice.active}
      disabled={!voice.supported}
      title={
        voice.active
          ? 'Turn hands-free listening off (M, B or .)'
          : 'Enable hands-free for this session (M, B or .). Audio goes to your browser’s speech service. Start commands with “Forma”.'
      }
      onClick={toggleHandsFree}
    >
      {voice.active ? <Mic size={17} /> : <MicOff size={17} />}
      <span>{voice.active ? 'Listening' : 'Hands-free'}</span>
    </button>
  );
}
