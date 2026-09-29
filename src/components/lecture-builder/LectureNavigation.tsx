'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type LectureNavigationProps = {
  index: number;
  count: number;
  stepTitles: readonly string[];
  exploring: boolean;
  onStep: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onExplore: () => void;
  onReturn: () => void;
};

export function LectureNavigation({
  index,
  count,
  stepTitles,
  exploring,
  onStep,
  onPrevious,
  onNext,
  onExplore,
  onReturn,
}: LectureNavigationProps) {
  return (
    <nav className="lecture-navigation" aria-label="Lecture controls">
      <div className="lecture-step-navigation">
        <button
          type="button"
          aria-label="Previous lecture step"
          disabled={index <= 0 || exploring}
          onClick={onPrevious}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <label className="lecture-step-picker">
          <span className="lecture-step-count" aria-live="polite">
            Step {index + 1} of {count}
          </span>
          <select
            aria-label="Lecture step"
            value={index}
            disabled={exploring}
            onChange={event => onStep(Number(event.target.value))}
          >
            {stepTitles.map((title, stepIndex) => (
              <option key={stepIndex} value={stepIndex}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="lecture-primary"
          aria-label="Next lecture step"
          disabled={index >= count - 1 || exploring}
          onClick={onNext}
        >
          <span>Next</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      {exploring ? (
        <button
          type="button"
          className="lecture-primary"
          title={`Restore step ${index + 1} with its paused view`}
          onClick={onReturn}
        >
          Return to lecture
        </button>
      ) : (
        <button type="button" className="lecture-explore" onClick={onExplore}>
          Explore this step
        </button>
      )}
      <progress
        className="lecture-progress"
        aria-label="Lecture progress"
        max={count}
        value={index + 1}
      />
    </nav>
  );
}
