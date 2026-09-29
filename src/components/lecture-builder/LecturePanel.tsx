'use client';
import { useEffect, useId, useRef } from 'react';
import type { LectureDocument } from '@/lib/lecture-documents';
import type { BiologyView } from '@/lib/teaching-biology';
import { RemodelingDiagram } from './RemodelingDiagram';
import { LectureStepGuide } from './LectureStepGuide';
import type { LectureComparison } from '@/lib/classroom/presentation';
import { LECTURE_COMPARISON_LABELS } from './comparison-labels';
import { availableLectureComparisons } from './lecture-comparison';

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
  const aidsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if ((comparison !== null || biology !== 'off') && aidsRef.current) aidsRef.current.open = true;
  }, [comparison, biology]);
  const step = document.steps[index];
  const comparisons = availableLectureComparisons(document);
  const notes = step.notes && (
    <>
      <button
        type="button"
        onClick={onNotes}
        aria-expanded={notesVisible}
        aria-controls={`${fieldId}-shown-notes`}
      >
        {notesVisible ? 'Hide presenter notes' : 'Show presenter notes'}
      </button>
      {notesVisible && (
        <div id={`${fieldId}-shown-notes`} className="lecture-notes">
          <span className="lecture-eyebrow">
            {audienceOpen ? 'PRESENTER NOTES · NOT IN AUDIENCE WINDOW' : 'VISIBLE ON THIS SCREEN'}
          </span>
          <p>{step.notes}</p>
        </div>
      )}
    </>
  );
  return (
    <aside className="lecture-panel" data-mode={mode} aria-label="Lecture step">
      <LectureStepGuide
        step={step}
        mode={mode}
        comparison={comparison}
        last={index === document.steps.length - 1}
      />
      {mode === 'rehearse' && notes}
      {(step.question || step.answer) && (
        <section className="lecture-prompt" aria-label="Class discussion">
          <span className="lecture-eyebrow">Discuss with students</span>
          {step.question && <p className="lecture-question">{step.question}</p>}
          {step.answer && (
            <>
              <button
                type="button"
                className="lecture-primary"
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
        </section>
      )}
      {mode === 'teach' && notes}
      <details ref={aidsRef} className="lecture-disclosure lecture-teaching-aids">
        <summary>Teaching aids</summary>
        <div className="lecture-aids-content">
          <button type="button" aria-pressed={focus} onClick={onFocus}>
            {focus ? 'Show surrounding teeth' : 'Focus teaching teeth'}
          </button>
          {comparisons.length > 0 && (
            <div
              className="lecture-comparison-options"
              role="group"
              aria-label="Comparison arrangement"
            >
              <span className="lecture-eyebrow">Compare arrangements</span>
              {comparisons.map(target => (
                <button
                  key={target}
                  type="button"
                  aria-pressed={comparison === target}
                  onClick={() => onCompare(target)}
                >
                  {LECTURE_COMPARISON_LABELS[target]}
                </button>
              ))}
              <p className="lecture-muted">
                Compare from the same viewpoint. Close comparison to return to your paused lecture.
              </p>
            </div>
          )}
          {biology === 'off' && (
            <button type="button" onClick={() => onBiology('overview')}>
              Explain tissue response
            </button>
          )}
        </div>
      </details>
      {comparison && (
        <button type="button" className="lecture-primary" onClick={onCloseComparison}>
          Close comparison
        </button>
      )}
      {biology !== 'off' && (
        <RemodelingDiagram view={biology} onViewChange={onBiology} onClose={onHideBiology} />
      )}
    </aside>
  );
}
