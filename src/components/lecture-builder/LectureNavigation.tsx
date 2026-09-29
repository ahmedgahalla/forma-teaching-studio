'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type LectureNavigationProps = {
  mode: 'rehearse' | 'teach';
  index: number;
  count: number;
  stepTitles: readonly string[];
  exploring: boolean;
  onMode: (mode: 'rehearse' | 'teach') => void;
  onStep: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onExplore: () => void;
  onReturn: () => void;
};

export function LectureNavigation({
  mode,
  index,
  count,
  stepTitles,
  exploring,
  onMode,
  onStep,
  onPrevious,
  onNext,
  onExplore,
  onReturn,
}: LectureNavigationProps) {
  return (
    <nav className="lecture-navigation" aria-label="Lecture controls">
      <div className="lecture-mode-switch" aria-label="Lecture view" role="group">
        {(['rehearse', 'teach'] as const).map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            disabled={exploring}
            onClick={() => onMode(value)}
          >
            {value === 'rehearse' ? 'Rehearse' : 'Teach'}
          </button>
        ))}
      </div>
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
        <button type="button" className="lecture-primary" onClick={onReturn}>
          Return to lecture
        </button>
      ) : (
        <button type="button" className="lecture-explore" onClick={onExplore}>
          Explore this question
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
