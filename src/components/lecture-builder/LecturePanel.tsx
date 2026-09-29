'use client';
import type { LectureDocument } from '@/lib/lecture-documents';
import type { BiologyView } from '@/lib/teaching-biology';
import type { LectureComparison } from '@/lib/classroom/presentation';
import { RemodelingDiagram } from './RemodelingDiagram';
import { LectureStepGuide } from './LectureStepGuide';
import { LECTURE_COMPARISON_LABELS } from './comparison-labels';
import { availableLectureComparisons } from './lecture-comparison';

export type LecturePanelProps = {
  document: LectureDocument;
  index: number;
  hasResponse?: boolean;
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
  hasResponse = false,
  focus,
  onFocus,
  comparison,
  onCompare,
  onCloseComparison,
  biology,
  onBiology,
  onHideBiology,
}: LecturePanelProps) {
  const step = document.steps[index];
  const comparisons = availableLectureComparisons(document);
  return (
    <section className="lecture-panel" aria-label="Step explanation">
      <div className="lecture-caption">
        {!comparison && step.answer && <p className="lecture-takeaway">{step.answer}</p>}
        <LectureStepGuide
          step={step}
          comparison={comparison}
          hasResponse={hasResponse}
          last={index === document.steps.length - 1}
        />
      </div>
      <details className="lecture-disclosure lecture-model-options">
        <summary>Inspect and compare</summary>
        <div className="lecture-aids-content">
          <button type="button" aria-pressed={focus} onClick={onFocus}>
            {focus ? 'Show surrounding teeth' : 'Focus on these teeth'}
          </button>
          {comparisons.length > 0 && (
            <div
              className="lecture-comparison-options"
              role="group"
              aria-label="Comparison arrangement"
            >
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
        <button
          type="button"
          className="lecture-primary lecture-comparison-return"
          onClick={onCloseComparison}
        >
          Close comparison
        </button>
      )}
      {biology !== 'off' && (
        <RemodelingDiagram view={biology} onViewChange={onBiology} onClose={onHideBiology} />
      )}
    </section>
  );
}
