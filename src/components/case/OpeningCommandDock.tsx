'use client';
import { useId, type ReactNode } from 'react';
import { MessageSquare, Redo2, Square, Undo2 } from 'lucide-react';
import { useTeaching } from '../teaching/TeachingController';

export function OpeningCommandDock({
  open,
  onOpenChange,
  playing = false,
  notice,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playing?: boolean;
  notice?: string;
  children: ReactNode;
}) {
  const teaching = useTeaching(),
    id = useId();
  const capturing = teaching.capture.phase !== 'idle';
  const working =
    capturing || teaching.analysisPending || teaching.runtime.phase !== 'idle' || playing;
  const feedback = capturing
    ? `${teaching.capture.phase}: ${teaching.capture.transcript || 'Release Space to run your instruction.'}`
    : teaching.analysisPending
      ? 'Analyzing the current model…'
      : teaching.analysisError ||
        (teaching.analysis
          ? 'Model explanation ready. Open Commands to read it.'
          : teaching.runtime.message);
  return (
    <div className="workspace-command-dock opening-command-dock">
      <div className="opening-command-controls">
        <button aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}>
          <MessageSquare size={16} />
          {open ? 'Hide commands' : 'Commands'} <kbd>/</kbd>
        </button>
        {!open && (
          <span
            role="status"
            className={teaching.runtime.error || teaching.analysisError ? 'error' : ''}
          >
            {feedback}
          </span>
        )}
        {!open && working && (
          <button
            className="teaching-stop"
            aria-label="Stop classroom action"
            onClick={teaching.cancel}
          >
            <Square size={14} />
            Stop
          </button>
        )}
        <button
          aria-label="Undo"
          title="Ctrl / Cmd + Z"
          onClick={() => void teaching.runControl('undo that')}
        >
          <Undo2 size={16} />
        </button>
        <button
          aria-label="Redo"
          title="Ctrl / Cmd + Shift + Z"
          onClick={() => void teaching.runControl('redo')}
        >
          <Redo2 size={16} />
        </button>
      </div>
      {notice && (
        <div className="case-action-status error" role="alert">
          {notice}
        </div>
      )}
      <div id={id} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
