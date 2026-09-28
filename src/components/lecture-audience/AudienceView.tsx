'use client';
import { useEffect, useRef } from 'react';
import { BiologyIllustration } from '../lecture-builder/RemodelingDiagram';
import type { AudienceContent } from './types';

export function AudienceView({
  content,
  stream,
  onReady,
  onError,
}: {
  content: AudienceContent;
  stream: MediaStream | null;
  onReady: () => void;
  onError: (message: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element || !stream) return;
    let current = true;
    element.srcObject = stream;
    element.muted = true;
    void element.play().then(
      () => {
        if (current) onReady();
      },
      () => {
        if (current)
          onError('Audience video could not start. Reopen the audience window to try again.');
      },
    );
    return () => {
      current = false;
      element.pause();
      element.srcObject = null;
    };
  }, [stream, onReady, onError]);
  return (
    <main className="audience-view" aria-label="Audience lecture view">
      <header className="audience-heading">
        <p>{content.lectureTitle}</p>
        <h1>{content.stepTitle}</h1>
      </header>
      <div className="audience-stage" data-biology={!!content.biology}>
        <div className="audience-model">
          <video ref={video} autoPlay muted playsInline aria-label="Live 3D teaching model" />
          {!stream && <p role="status">The 3D model is loading…</p>}
        </div>
        {content.biology && (
          <aside className="audience-biology" aria-label="Tissue response explanation">
            <BiologyIllustration view={content.biology} audience />
          </aside>
        )}
      </div>
      {(content.question || content.answer) && (
        <section className="audience-question" aria-label="Class discussion">
          {content.question && <h2>{content.question}</h2>}
          {content.answer && <p className="audience-answer">{content.answer}</p>}
        </section>
      )}
      <footer className="audience-footer">
        Synthetic teaching model · illustrative movement · not for clinical use
      </footer>
    </main>
  );
}
