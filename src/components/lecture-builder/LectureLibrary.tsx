'use client';
import { useId, useState } from 'react';
import type { LectureDocument } from '@/lib/lecture-documents';

export type LectureLibraryProps = {
  documents: LectureDocument[];
  error: string;
  onCreate: () => void;
  onSample: () => void;
  onOpen: (id: string) => void;
  onImport: (file: File) => void;
  onDelete: (id: string) => void;
};

export function LectureLibrary({
  documents,
  error,
  onCreate,
  onSample,
  onOpen,
  onImport,
  onDelete,
}: LectureLibraryProps) {
  const importId = useId();
  const [deleting, setDeleting] = useState<string | null>(null);
  return (
    <section className="lecture-library" aria-label="Your lectures">
      <header className="lecture-library-heading">
        <div>
          <span className="lecture-eyebrow">YOUR CLASSROOM</span>
          <h1>Prepare once. Teach with the model.</h1>
          <p>Build your lecture here, with notes and a model setup for every step.</p>
        </div>
        <button type="button" className="lecture-primary" onClick={onCreate}>
          Create lecture
        </button>
      </header>
      <div className="lecture-library-actions">
        <button type="button" onClick={onSample}>
          Open a three-step sample
        </button>
        <label className="lecture-import" htmlFor={importId}>
          Import a lecture backup
          <input
            id={importId}
            type="file"
            accept=".json,application/json"
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) onImport(file);
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="lecture-error">
          {error}
        </p>
      )}
      <p className="lecture-muted">
        Lectures save in this browser. Export a backup to keep a copy or move to another computer.
      </p>
      {documents.length === 0 ? (
        <div className="lecture-empty">
          <h2>Your first lecture starts with one step</h2>
          <p>
            Choose a view, add your notes, and capture the model. Add more steps when you are ready.
          </p>
        </div>
      ) : (
        <ul className="lecture-document-list">
          {documents.map(document => (
            <li key={document.id}>
              <div className="lecture-document-summary">
                <h2>{document.title || 'Untitled lecture'}</h2>
                <p>
                  {document.steps.length} {document.steps.length === 1 ? 'step' : 'steps'}
                </p>
              </div>
              {deleting === document.id ? (
                <div className="lecture-delete-confirm">
                  <p>Delete “{document.title || 'Untitled lecture'}” from this browser?</p>
                  <button type="button" onClick={() => setDeleting(null)}>
                    Keep lecture
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(document.id);
                      setDeleting(null);
                    }}
                  >
                    Delete lecture
                  </button>
                </div>
              ) : (
                <div className="lecture-document-actions">
                  <button
                    type="button"
                    onClick={() => onOpen(document.id)}
                    aria-label={`Open ${document.title || 'Untitled lecture'}`}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(document.id)}
                    aria-label={`Delete ${document.title || 'Untitled lecture'}`}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
