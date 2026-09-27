'use client';

export type LectureNavigationProps = {
  mode: 'rehearse' | 'teach';
  index: number;
  count: number;
  exploring: boolean;
  onMode: (mode: 'rehearse' | 'teach') => void;
  onPrevious: () => void;
  onNext: () => void;
  onExplore: () => void;
  onReturn: () => void;
};

export function LectureNavigation({
  mode,
  index,
  count,
  exploring,
  onMode,
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
          Previous
        </button>
        <span aria-live="polite">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          aria-label="Next lecture step"
          disabled={index >= count - 1 || exploring}
          onClick={onNext}
        >
          Next
        </button>
      </div>
      {exploring ? (
        <button type="button" className="lecture-primary" onClick={onReturn}>
          Return to lecture
        </button>
      ) : (
        <button type="button" onClick={onExplore}>
          Explore this question
        </button>
      )}
    </nav>
  );
}
