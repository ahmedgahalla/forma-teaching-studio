'use client';
import { useId, useState } from 'react';
import { MAX_LECTURE_STEPS, type LectureDocument, type LectureStep } from '@/lib/lecture-documents';
import { TEACHING_CASES } from '@/lib/teaching-cases';

export type LecturePanelProps = {
  document: LectureDocument;
  index: number;
  mode: 'prepare' | 'rehearse' | 'teach';
  answerVisible: boolean;
  notesVisible: boolean;
  saveStatus: string;
  onTitle: (title: string) => void;
  onPatchStep: (
    patch: Partial<Pick<LectureStep, 'title' | 'notes' | 'question' | 'answer'>>,
  ) => void;
  onCapture: () => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onAttachDemo: (caseId: string, variantId: string) => void;
  onDetachDemo: () => void;
  onGo: (index: number) => void;
  onReveal: () => void;
  onNotes: () => void;
  onExport: () => void;
};

export function LecturePanel(props: LecturePanelProps) {
  const {
    document,
    index,
    mode,
    answerVisible,
    notesVisible,
    saveStatus,
    onTitle,
    onPatchStep,
    onCapture,
    onAdd,
    onDuplicate,
    onDelete,
    onMove,
    onAttachDemo,
    onDetachDemo,
    onGo,
    onReveal,
    onNotes,
    onExport,
  } = props;
  const fieldId = useId();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [caseId, setCaseId] = useState(TEACHING_CASES[0].id);
  const selectedCase = TEACHING_CASES.find(item => item.id === caseId)!;
  const [variantId, setVariantId] = useState(selectedCase.variants[0].id);
  const step = document.steps[index];
  const attachedCase = step.demo && TEACHING_CASES.find(item => item.id === step.demo?.caseId);
  const attachedVariant = attachedCase?.variants.find(item => item.id === step.demo?.variantId);
  return (
    <aside
      className="lecture-panel"
      data-mode={mode}
      aria-label={mode === 'prepare' ? 'Lecture preparation' : 'Lecture step'}
    >
      {mode === 'prepare' ? (
        <>
          <div className="lecture-panel-heading">
            <span className="lecture-eyebrow">PREPARE YOUR LECTURE</span>
            <button type="button" onClick={onExport}>
              Export backup
            </button>
          </div>
          <label htmlFor={`${fieldId}-lecture`}>Lecture title</label>
          <input
            id={`${fieldId}-lecture`}
            maxLength={160}
            value={document.title}
            onChange={event => onTitle(event.target.value)}
          />
          <p role="status" className="lecture-save-status">
            {saveStatus}
          </p>
          <ol className="lecture-step-list" aria-label="Lecture steps">
            {document.steps.map((item, stepIndex) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={stepIndex === index ? 'step' : undefined}
                  onClick={() => onGo(stepIndex)}
                >
                  <span>{stepIndex + 1}</span>
                  {item.title || 'Untitled step'}
                </button>
              </li>
            ))}
          </ol>
          <div className="lecture-edit-actions" role="group" aria-label="Edit lecture steps">
            <button
              type="button"
              disabled={document.steps.length >= MAX_LECTURE_STEPS}
              onClick={onAdd}
            >
              Add step
            </button>
            <button
              type="button"
              disabled={document.steps.length >= MAX_LECTURE_STEPS}
              onClick={onDuplicate}
            >
              Duplicate
            </button>
            <button
              type="button"
              aria-label="Move step earlier"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              Move up
            </button>
            <button
              type="button"
              aria-label="Move step later"
              disabled={index === document.steps.length - 1}
              onClick={() => onMove(1)}
            >
              Move down
            </button>
            <button
              type="button"
              disabled={document.steps.length === 1}
              onClick={() => setDeleting(step.id)}
            >
              Delete step
            </button>
          </div>
          {deleting === step.id && (
            <div
              className="lecture-delete-confirm"
              role="group"
              aria-label="Delete step confirmation"
            >
              <p>Delete “{step.title}” and its notes?</p>
              <button type="button" onClick={() => setDeleting(null)}>
                Keep step
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  setDeleting(null);
                }}
              >
                Confirm delete
              </button>
            </div>
          )}
          <label htmlFor={`${fieldId}-step`}>Step title</label>
          <input
            id={`${fieldId}-step`}
            maxLength={160}
            value={step.title}
            onChange={event => onPatchStep({ title: event.target.value })}
          />
          <label htmlFor={`${fieldId}-notes`}>Lecture notes</label>
          <textarea
            id={`${fieldId}-notes`}
            maxLength={20000}
            rows={4}
            value={step.notes}
            placeholder="What will you explain at this point?"
            onChange={event => onPatchStep({ notes: event.target.value })}
          />
          <label htmlFor={`${fieldId}-question`}>Question for students</label>
          <textarea
            id={`${fieldId}-question`}
            maxLength={2000}
            rows={2}
            value={step.question}
            placeholder="Ask for a prediction before showing the answer."
            onChange={event => onPatchStep({ question: event.target.value })}
          />
          <label htmlFor={`${fieldId}-answer`}>Answer to reveal</label>
          <textarea
            id={`${fieldId}-answer`}
            maxLength={10000}
            rows={2}
            value={step.answer}
            onChange={event => onPatchStep({ answer: event.target.value })}
          />
          <div className="lecture-capture">
            <button type="button" className="lecture-primary" onClick={onCapture}>
              Capture shown model setup
            </button>
            <p>
              {step.demo
                ? 'Replaces the attached demonstration with the model setup shown now.'
                : 'Save the teeth, view and visible layers you see now for this step.'}
            </p>
          </div>
          <details className="lecture-demo-picker">
            <summary>Prepared demonstration</summary>
            {attachedVariant && (
              <p>
                Attached: {attachedCase?.title} · {attachedVariant.title}
              </p>
            )}
            <label htmlFor={`${fieldId}-case`}>Teaching example</label>
            <select
              id={`${fieldId}-case`}
              value={caseId}
              onChange={event => {
                const next = TEACHING_CASES.find(item => item.id === event.target.value)!;
                setCaseId(next.id);
                setVariantId(next.variants[0].id);
              }}
            >
              {TEACHING_CASES.map(item => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <label htmlFor={`${fieldId}-variant`}>Demonstration</label>
            <select
              id={`${fieldId}-variant`}
              value={variantId}
              onChange={event => setVariantId(event.target.value)}
            >
              {selectedCase.variants.map(item => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <p>Uses this example’s starting model. Play will run its authored demonstration.</p>
            <button type="button" onClick={() => onAttachDemo(caseId, variantId)}>
              Attach demonstration
            </button>
            {step.demo && (
              <button type="button" onClick={onDetachDemo}>
                Remove demonstration
              </button>
            )}
          </details>
        </>
      ) : (
        <>
          <span className="lecture-eyebrow">
            STEP {index + 1} OF {document.steps.length}
          </span>
          <h2>{step.title || 'Untitled step'}</h2>
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
              Rehearsal uses the same steps and model setup as teaching.
            </p>
          )}
        </>
      )}
    </aside>
  );
}
