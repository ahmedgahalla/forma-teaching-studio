'use client';
import { useId } from 'react';
import type { LectureDocument } from '@/lib/lecture-documents';
import type { BiologyView } from '@/lib/teaching-biology';
import { RemodelingDiagram } from './RemodelingDiagram';
import { COMPARISON_TARGETS, type LectureComparison } from '@/lib/classroom/presentation';
import { LECTURE_COMPARISON_LABELS } from './comparison-labels';

export type LecturePanelProps = {
  document: LectureDocument;
  index: number;
  mode: 'rehearse' | 'teach';
  answerVisible: boolean;
  notesVisible: boolean;
  onReveal: () => void;
  onNotes: () => void;
  audienceOpen?: boolean;
  focus: boolean;
  onFocus: () => void;
  comparison: LectureComparison | null;
  onCompare: (target: LectureComparison) => void;
  onCloseComparison: () => void;
  biology: 'off' | BiologyView;
  onBiology: (view: BiologyView) => void;
  onHideBiology: () => void;
};

export function LecturePanel({
  document,
  index,
  mode,
  answerVisible,
  notesVisible,
  onReveal,
  onNotes,
  audienceOpen = false,
  focus,
  onFocus,
  comparison,
  onCompare,
  onCloseComparison,
  biology,
  onBiology,
  onHideBiology,
}: LecturePanelProps) {
  const fieldId = useId();
  const step = document.steps[index];
  return (
    <aside className="lecture-panel" data-mode={mode} aria-label="Lecture step">
      {step.question && <p className="lecture-question">{step.question}</p>}
      {step.answer && (
        <>
          <button
            type="button"
            onClick={onReveal}
            aria-expanded={answerVisible}
            aria-controls={`${fieldId}-revealed-answer`}
          >
            {answerVisible ? 'Hide answer' : 'Reveal answer'}
          </button>
          {answerVisible && (
            <p id={`${fieldId}-revealed-answer`} className="lecture-answer">
              {step.answer}
            </p>
          )}
        </>
      )}
      {step.notes && (
        <>
          <button
            type="button"
            onClick={onNotes}
            aria-expanded={notesVisible}
            aria-controls={`${fieldId}-shown-notes`}
          >
            {notesVisible ? 'Hide notes' : 'Show notes'}
          </button>
          {notesVisible && (
            <div id={`${fieldId}-shown-notes`} className="lecture-notes">
              <span className="lecture-eyebrow">
                {audienceOpen
                  ? 'PRESENTER NOTES · NOT IN AUDIENCE WINDOW'
                  : 'VISIBLE ON THIS SCREEN'}
              </span>
              <p>{step.notes}</p>
            </div>
          )}
        </>
      )}
      <button type="button" aria-pressed={focus} onClick={onFocus}>
        {focus ? 'Show surrounding teeth' : 'Focus teaching teeth'}
      </button>
      <details className="lecture-disclosure">
        <summary>Compare arrangements{comparison ? ' · shown' : ''}</summary>
        <div
          className="lecture-comparison-options"
          role="group"
          aria-label="Comparison arrangement"
        >
          {COMPARISON_TARGETS.map(target => (
            <button
              key={target}
              type="button"
              aria-pressed={comparison === target}
              onClick={() => onCompare(target)}
            >
              {LECTURE_COMPARISON_LABELS[target]}
            </button>
          ))}
          {comparison && (
            <button type="button" onClick={onCloseComparison}>
              Close comparison
            </button>
          )}
        </div>
        <p className="lecture-muted">
          Show each authored arrangement from the same viewpoint. Close comparison to return to your
          paused lecture.
        </p>
      </details>
      {biology === 'off' ? (
        <button type="button" onClick={() => onBiology('overview')}>
          Explain tissue response
        </button>
      ) : (
        <RemodelingDiagram view={biology} onViewChange={onBiology} onClose={onHideBiology} />
      )}
      {mode === 'rehearse' && (
        <p className="lecture-muted">
          Rehearse this ready-made lecture, then choose Teach when you are ready.
        </p>
      )}
    </aside>
  );
}
