'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, RefreshCw, Sparkles } from 'lucide-react';
import { connectAiService, connectThisApp } from '@/lib/ai-service-client';
import type { CommandServiceConfig } from '@/lib/command-service';
import './ai-connection-settings.css';

export function AiConnectionSettings({
  config,
  onChange,
}: {
  config: CommandServiceConfig;
  onChange: (config: CommandServiceConfig) => void;
}) {
  const [edit, setEdit] = useState({ forUrl: config.url, value: config.url });
  const draft = edit.forUrl === config.url ? edit.value : config.url;
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => () => request.current?.abort(), [config]);
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setPending(false);
  };
  const connect = async (sameApp: boolean) => {
    cancel();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFeedback(null);
    try {
      const next = await (sameApp
        ? connectThisApp(window.location.origin, controller.signal)
        : connectAiService(draft, controller.signal));
      if (controller.signal.aborted) return;
      setEdit({ forUrl: next.url, value: next.url });
      setFeedback({
        text: 'Backend reached and API key configured. Provider access is checked when you ask AI.',
        error: false,
      });
      onChange(next);
    } catch (error) {
      if (!controller.signal.aborted)
        setFeedback({
          text:
            error instanceof Error
              ? error.message
              : 'Connection failed. Local commands still work.',
          error: true,
        });
    } finally {
      if (mounted.current && request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  };
  return (
    <section className="ai-connection-settings" aria-labelledby="ai-settings-heading">
      <div className="ai-connection-heading">
        <div>
          <h3 id="ai-settings-heading">
            <Sparkles size={17} /> AI assistant
          </h3>
          <p>{config.enabled ? `${config.provider || 'AI provider'} enabled` : 'AI is off'}</p>
        </div>
        <span className="ai-local-status">
          <Check size={13} /> Local commands always available
        </span>
      </div>
      <p>Use flexible wording to control the model, or ask AI to explain the current setup.</p>
      <div className="ai-connection-actions">
        <button className="button primary" disabled={pending} onClick={() => void connect(true)}>
          <RefreshCw size={15} />{' '}
          {pending
            ? 'Checking connection…'
            : config.enabled
              ? 'Reconnect this app'
              : 'Connect this app'}
        </button>
        {pending && (
          <button className="button light" onClick={cancel}>
            Cancel check
          </button>
        )}
        {(config.enabled || pending) && (
          <button
            className="button light"
            onClick={() => {
              cancel();
              setFeedback(null);
              onChange({ ...config, enabled: false });
            }}
          >
            Turn AI off
          </button>
        )}
      </div>
      {feedback && (
        <p
          className={feedback.error ? 'inline-error' : 'ai-connection-success'}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}
      <details className="ai-connection-advanced">
        <summary>Advanced: connect a different backend</summary>
        <label className="form-label">
          Backend URL
          <input
            type="url"
            value={draft}
            placeholder="http://127.0.0.1:8000"
            autoComplete="off"
            spellCheck={false}
            onChange={event => {
              cancel();
              setFeedback(null);
              setEdit({ forUrl: config.url, value: event.target.value });
            }}
          />
        </label>
        <button
          className="button light"
          disabled={pending || !draft.trim()}
          onClick={() => void connect(false)}
        >
          Connect backend <ArrowUpRight size={15} />
        </button>
      </details>
      <p className="form-note">
        A configured key does not confirm provider access or available credits. Your API key stays
        in the backend environment; never enter it here.
      </p>
      <p className="form-note">
        AI receives command text and a small scene summary. Meshes stay local. Voice recognition
        uses your browser’s speech service.
      </p>
    </section>
  );
}
