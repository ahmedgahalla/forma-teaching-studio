'use client';
import type { DemoLecture } from '@/lib/lecture-documents';
import { useDisclosureMenu } from '../case/useDisclosureMenu';

type Props = {
  lectures: readonly DemoLecture[];
  currentId: string | null;
  onOpen: (id: string) => void;
  disabled?: boolean;
};

export function LecturePicker({ lectures, currentId, onOpen, disabled = false }: Props) {
  const selected = lectures.find(item => item.id === currentId);
  const { menuRef, summaryRef } = useDisclosureMenu({ closeOnAction: true });
  return (
    <details ref={menuRef} className="lecture-picker">
      <summary ref={summaryRef}>Choose lecture</summary>
      <div className="lecture-picker-list" aria-label="Demo lectures">
        <p className="lecture-muted lecture-picker-help">
          Choose a prepared case or topic. Review notes, then Present. Advance through its steps
          with Next.
        </p>
        {lectures.map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={currentId === item.id}
            disabled={disabled}
            onClick={() => onOpen(item.id)}
          >
            <strong>{item.title}</strong>
            <span>{item.summary}</span>
            <small>
              {currentId === item.id ? 'Current lecture · ' : ''}Suggested pacing · {item.duration}
            </small>
          </button>
        ))}
        {disabled && <p className="lecture-muted">Return to the lecture to choose another demo.</p>}
        {selected && (
          <details className="lecture-disclosure">
            <summary>Learning objectives and sources</summary>
            <ul>
              {selected.objectives.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <ul>
              {selected.sources.map(item => (
                <li key={item.url}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
            <p className="lecture-muted">
              Sources support the teaching concepts, not clinical validation of the displayed model.
            </p>
          </details>
        )}
      </div>
    </details>
  );
}
