'use client';
import { useId } from 'react';
import { useTeaching } from './TeachingController';
import './VoiceSettingsFields.css';

export function VoiceSettingsFields() {
  const { voiceSettings, setVoiceSettings } = useTeaching();
  const id = useId();
  return (
    <fieldset className="voice-settings-fields" aria-describedby={`${id}-privacy`}>
      <legend>Lecture voice</legend>
      <label className="form-label">
        Voice mode preference
        <select
          value={voiceSettings.mode}
          onChange={event =>
            setVoiceSettings({
              ...voiceSettings,
              mode: event.target.value === 'hands-free' ? 'hands-free' : 'hold',
            })
          }
        >
          <option value="hold">Hold to talk (default)</option>
          <option value="hands-free">Hands-free</option>
        </select>
      </label>
      <label className="form-label">
        Recognition language
        <select
          value={voiceSettings.language}
          onChange={event =>
            setVoiceSettings({
              ...voiceSettings,
              language: event.target.value === 'en-GB' ? 'en-GB' : 'en-US',
            })
          }
        >
          <option value="en-US">English (United States)</option>
          <option value="en-GB">English (United Kingdom)</option>
        </select>
      </label>
      <label className="voice-settings-replies">
        <input
          type="checkbox"
          checked={voiceSettings.spokenReplies}
          onChange={event =>
            setVoiceSettings({ ...voiceSettings, spokenReplies: event.target.checked })
          }
        />
        Spoken replies
      </label>
      <p className="form-note" id={`${id}-privacy`}>
        Enable Hands-free explicitly each session using its microphone toggle or M. Your browser’s
        speech service receives audio while listening. Begin with “Forma” or “for ma”, optionally
        after “hey”, “ok” or “okay”. Mishearings “former”, “forma’s” and “fauna” only run recognized
        local commands; they never reach AI or Analyze, show interim captions, or arm a follow-up.
        Other speech is discarded without captions or submission. Recognition pauses while Forma
        speaks or the tab is hidden, then resumes when visible and ready. Say “Forma, stop
        listening” to switch it off.
      </p>
      <p className="form-note">
        Preferences are saved on this browser. Listening never starts on page load.
      </p>
    </fieldset>
  );
}
