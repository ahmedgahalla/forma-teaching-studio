'use client';
import { useId } from 'react';
import type { LectureDocument } from '@/lib/lecture-documents';

export type LecturePanelProps = {
  document: LectureDocument;
  index: number;
  mode: 'rehearse' | 'teach';
  answerVisible: boolean;
  notesVisible: boolean;
  onReveal: () => void;
  onNotes: () => void;
};

export function LecturePanel({
  document,
  index,
  mode,
  answerVisible,
  notesVisible,
  onReveal,
  onNotes,
}: LecturePanelProps) {
  const fieldId = useId();
  const step = document.steps[index];
  return (
    <aside className="lecture-panel" data-mode={mode} aria-label="Lecture step">
      <span className="lecture-eyebrow">
        READY TO TEACH · STEP {index + 1} OF {document.steps.length}
      </span>
      <h2>{step.title}</h2>
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
              <span className="lecture-eyebrow">VISIBLE ON THIS SCREEN</span>
              <p>{step.notes}</p>
            </div>
          )}
        </>
      )}
      {mode === 'rehearse' && (
        <p className="lecture-muted">
          Rehearse this ready-made lecture, then choose Teach when you are ready.
        </p>
      )}
    </aside>
  );
}
