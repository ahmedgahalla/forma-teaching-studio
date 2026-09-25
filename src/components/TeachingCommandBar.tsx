'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Mic, Sparkles, Square, Undo2 } from 'lucide-react';
import { useTeaching } from './TeachingController';

export function TeachingCommandBar({
  label = 'Dental command',
  placeholder = 'Try “show upper jaw, hide gums, and highlight molars”',
  value,
  onChange,
  inputRef,
  suggestions,
}: {
  suggestions?: string[];
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (text: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const teaching = useTeaching(),
    [draft, setDraft] = useState(''),
    [examples, setExamples] = useState(false);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = bar.current?.closest<HTMLElement>('.workspace-command-dock'),
      workspace = element?.closest<HTMLElement>('.studio-experience');
    if (!element || !workspace) return;
    const measure = () =>
      workspace.style.setProperty(
        '--composer-height',
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      workspace.style.removeProperty('--composer-height');
    };
  }, []);
  const text = value ?? draft,
    setText = onChange || setDraft;
  const capturing = teaching.capture.phase !== 'idle',
    phase = capturing
      ? teaching.capture.phase
      : teaching.analysisPending
        ? 'analyzing'
        : teaching.runtime.phase;
  const commands =
    suggestions ??
    (teaching.mode === 'case'
      ? [
          'select upper front six',
          'install brackets here',
          'put a wire through these brackets',
          'activate that wire by 0.5 mm',
          'show what happens',
          'use 0.018 inch wire instead',
          'explain that movement',
          'move selected segment posteriorly 1 mm',
          'lock upper molars',
          'place brackets only',
          'place palatal expander',
          'return to source lesson',
          'restore my workspace',
          'show roots',
          'show displacement traces',
          'save arrangement as example one',
          'compare with original',
          'undo that',
        ]
      : [
          'start anatomy lesson',
          'show the root',
          'make the bone transparent',
          'show cutaway',
          'compare translation and tipping',
          'repeat that more slowly',
          'return to the lesson',
          'try this setup',
          'restore my workspace',
          'reveal answer',
          'hide answer',
          'explain this step',
          'undo that',
        ]);
  return (
    <section
      ref={bar}
      className="command-section teaching-command-bar"
      aria-label="Voice classroom controls"
    >
      <div className="command-title">
        <span>
          <Mic size={16} />
          HOLD SPACE TO SPEAK
        </span>
        {teaching.config.enabled && (
          <button
            className="teaching-ai-toggle"
            aria-label="Use AI interpreter"
            aria-pressed={teaching.preferAI && !teaching.analyzeMode}
            title="Send requests to AI for interpretation. Stop and Undo remain local."
            onClick={() => teaching.setPreferAI(teaching.analyzeMode || !teaching.preferAI)}
          >
            <Sparkles size={13} />
            Ask AI
          </button>
        )}
        {teaching.config.enabled && (
          <button
            className="teaching-ai-toggle"
            aria-label="Analyze current model"
            aria-pressed={teaching.analyzeMode}
            onClick={() => teaching.setAnalyzeMode(!teaching.analyzeMode)}
          >
            Analyze
          </button>
        )}
        <span className={`teaching-phase ${phase}`} role="status">
          {phase === 'idle' ? 'Ready' : phase}
        </span>
        <button onClick={() => setExamples(!examples)}>Examples</button>
        <button
          className="teaching-stop"
          onClick={teaching.cancel}
          aria-label="Stop classroom action"
        >
          <Square size={13} />
          Stop
        </button>
      </div>
      {examples && (
        <div className="workflow-command-examples" aria-label="Suggested commands">
          <div className="command-examples-heading">
            <strong>Try with this setup</strong>
            <button aria-label="Close command suggestions" onClick={() => setExamples(false)}>
              ×
            </button>
          </div>
          {commands.slice(0, 4).map(command => (
            <button
              key={command}
              onClick={() => {
                setText(command);
                setExamples(false);
              }}
            >
              {command}
            </button>
          ))}
        </div>
      )}
      <form
        className={`command-input ${capturing ? 'listening' : ''}`}
        onSubmit={event => {
          event.preventDefault();
          if (text.trim()) {
            setExamples(false);
            void teaching.run(text);
            setText('');
          }
        }}
      >
        <input
          ref={inputRef}
          aria-label={label}
          value={text}
          maxLength={teaching.analyzeMode ? 800 : 1000}
          placeholder={
            teaching.analyzeMode
              ? 'Ask about this setup: “Why did these teeth move so little?”'
              : teaching.preferAI
                ? 'Ask naturally: “Could you show the upper teeth and reveal their roots?”'
                : placeholder
          }
          onChange={event => setText(event.target.value)}
        />
        <button
          type="button"
          className={`voice-button ${capturing ? 'recording' : ''}`}
          aria-label="Hold to talk"
          disabled={!teaching.capture.supported}
          onPointerDown={event => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            teaching.start();
          }}
          onPointerUp={event => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            teaching.finish();
          }}
          onPointerCancel={teaching.cancel}
          onKeyDown={event => {
            if ((event.code === 'Space' || event.key === 'Enter') && !event.repeat) {
              event.preventDefault();
              teaching.start();
            }
          }}
          onKeyUp={event => {
            if (event.code === 'Space' || event.key === 'Enter') {
              event.preventDefault();
              teaching.finish();
            }
          }}
        >
          <Mic size={18} />
          <span>Hold to talk</span>
        </button>
        <button
          type="submit"
          className="command-submit"
          disabled={!text.trim()}
          aria-label="Run classroom command"
        >
          <ArrowRight size={18} />
        </button>
      </form>
      {(capturing || teaching.runtime.transcript) && (
        <div className="speech-caption">
          <span className="speech-dot" />
          <strong>{capturing ? 'Hearing' : 'You'}</strong>
          <span>
            {capturing
              ? teaching.capture.transcript || 'Release to run your instruction.'
              : teaching.runtime.transcript}
          </span>
        </div>
      )}
      <div className={`command-status ${teaching.runtime.error ? 'error' : ''}`}>
        <span>
          {teaching.runtime.interpreter && (
            <strong className="command-origin">
              {teaching.runtime.interpreter === 'ai' ? 'AI reply' : 'Local'}
            </strong>
          )}
          {teaching.runtime.message}
        </span>
        <button
          className="text-button"
          onClick={() => void teaching.run('undo that')}
          aria-label="Undo classroom request"
        >
          <Undo2 size={14} />
          Undo
        </button>
      </div>
      {(teaching.analyzeMode || teaching.analysis) && (
        <div className="teaching-analysis-hint">
          Analyze explains the current model without changing it. Select Ask AI to control the
          model.
        </div>
      )}
      {(teaching.analysis || teaching.analysisError) && (
        <details className="teaching-analysis-card" open>
          <summary>
            AI model explanation {teaching.analysis && <small>{teaching.analysis.model}</small>}
          </summary>
          <div>
            <p className="analysis-question">{teaching.analysisQuestion}</p>
            {teaching.analysisError ? (
              <p role="alert">{teaching.analysisError}</p>
            ) : (
              teaching.analysis && (
                <>
                  <p>
                    <strong>In this setup</strong> {teaching.analysis.observations}
                  </p>
                  <p>{teaching.analysis.explanation}</p>
                  <p className="analysis-limits">{teaching.analysis.limitations}</p>
                  <p>
                    <strong>Ask students</strong> {teaching.analysis.studentQuestion}
                  </p>
                </>
              )
            )}
            <button className="text-button" onClick={teaching.dismissAnalysis}>
              Close explanation
            </button>
          </div>
        </details>
      )}
      {!teaching.capture.supported && (
        <p className="speech-unavailable">
          Microphone recognition needs a supported browser such as Chrome or Edge. Typed commands
          work here.
        </p>
      )}
    </section>
  );
}
