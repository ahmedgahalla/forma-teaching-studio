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
        speech service receives audio while listening. Begin with “Forma”; other speech is discarded
        after the transient caption and never submitted, logged or sent to AI. Recognition pauses
        while Forma speaks. Say “Forma, stop listening” to switch it off.
      </p>
      <p className="form-note">
        Preferences are saved on this browser. Listening never starts on page load.
      </p>
    </fieldset>
  );
}
