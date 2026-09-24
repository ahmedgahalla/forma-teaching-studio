'use client';

import { useId, type ReactNode } from 'react';
import { ArrowRight, Eye, Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
import './lecture-console.css';

export type LectureConsoleProps = {
  title: string;
  showPlayback?: boolean;
  objective?: string;
  question?: string;
  answer?: string;
  answerVisible: boolean;
  onToggleAnswer: () => void;
  playing: boolean;
  progress: number;
  onPlayPause: () => void;
  onRestart: () => void;
  onHalf: () => void;
  onProgress: (progress: number) => void;
  speed: number;
  onSpeed: (speed: number) => void;
  canPlay?: boolean;
  disabled?: boolean;
  variants?: { id: string; label: string }[];
  variantId?: string;
  onVariant?: (id: string) => void;
  explorationAction?: { label: string; onClick: () => void };
  note?: string;
  children?: ReactNode;
};

/** Presentation only: the host validates and executes every requested change. */
export function LectureConsole({ showPlayback = true, title, objective, question, answer, answerVisible, onToggleAnswer, playing, progress, onPlayPause, onRestart, onHalf, onProgress, speed, onSpeed, canPlay = true, disabled = false, variants = [], variantId, onVariant, explorationAction, note = 'Authored illustration · no treatment time scale · educator review pending', children }: LectureConsoleProps) {
  const id = useId();
  const shownProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const percentage = Math.round(shownProgress * 100);
  const playbackDisabled = disabled || !canPlay;

  return <section className="lecture-console" aria-label="Professor lecture controls">
    <header className="lecture-console-heading">
      <div><span className="lecture-console-eyebrow">PROFESSOR CONTROLS</span><h2>{title}</h2>{objective && <p>{objective}</p>}</div>
      {explorationAction && <button type="button" className="lecture-console-explore" disabled={disabled} onClick={explorationAction.onClick}>{explorationAction.label}<ArrowRight size={17} aria-hidden="true" /></button>}
    </header>
    <div className={`lecture-console-body${question || answer ? ' has-question' : ''}`}>
      <div className="lecture-console-demonstration">
        {variants.length > 0 && <details className="lecture-variant-picker"><summary>Compare another demonstration</summary><fieldset className="lecture-console-variants" disabled={disabled || !onVariant}><legend>Authored demonstrations</legend><div>{variants.map(variant => <button type="button" key={variant.id} aria-pressed={variantId === variant.id} onClick={() => onVariant?.(variant.id)}>{variant.label}</button>)}</div></fieldset></details>}
        {showPlayback && <><div className="lecture-console-playback" role="group" aria-label="Demonstration playback">
          <button type="button" className="lecture-console-play" disabled={playbackDisabled} onClick={onPlayPause}>{playing ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}{playing ? 'Pause' : shownProgress >= 1 ? 'Replay' : 'Play'}</button>
          <button type="button" disabled={disabled} onClick={onRestart}><RotateCcw size={17} aria-hidden="true" />Restart</button>
          <button type="button" disabled={playbackDisabled} onClick={onHalf} aria-label="Pause at 50 percent of demonstration">Pause at 50%</button>
          <label className="lecture-console-speed">Speed<select value={speed} disabled={disabled} onChange={event => onSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
        </div>
        <label className="lecture-console-progress" htmlFor={`${id}-progress`}><span>Demonstration progress<strong>{percentage}%</strong></span><input id={`${id}-progress`} type="range" min="0" max="1" step="0.01" value={shownProgress} aria-valuetext={`${percentage} percent of demonstration`} disabled={playbackDisabled} onChange={event => onProgress(Number(event.target.value))} /><span className="lecture-console-range-labels"><span>Starting arrangement</span><span>Illustrated endpoint</span></span></label></>}
        {children && <div className="lecture-console-tools" role="group" aria-label="Lecture model display">{children}</div>}
      </div>
      {(question || answer) && <div className="lecture-console-question">
        <span className="lecture-console-eyebrow"><Lightbulb size={17} aria-hidden="true" />ASK THE CLASS</span>
        {question && <p>{question}</p>}
        {answer && <><button type="button" className="lecture-console-reveal" aria-expanded={answerVisible} aria-controls={`${id}-answer`} disabled={disabled} onClick={onToggleAnswer}><Eye size={17} aria-hidden="true" />{answerVisible ? 'Hide explanation' : 'Reveal explanation'}</button><div id={`${id}-answer`} className="lecture-console-answer" hidden={!answerVisible}>{answer}</div></>}
      </div>}
    </div>
    {note && <p className="lecture-console-note">{note}</p>}
  </section>;
}
