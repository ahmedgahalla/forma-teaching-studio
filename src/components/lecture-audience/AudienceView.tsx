'use client';
import { useEffect, useRef } from 'react';
import { BiologyIllustration } from '../lecture-builder/RemodelingDiagram';
import type { AudienceContent } from './types';
import { createAudienceOverlays } from './audience-overlays';

export function AudienceView({
  content,
  stream,
  canvas,
  onReady,
  onError,
}: {
  content: AudienceContent;
  stream: MediaStream | null;
  canvas: HTMLCanvasElement | null;
  onReady: () => void;
  onError: (message: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element || !stream || !canvas || !overlay.current) return;
    let current = true;
    const annotations = createAudienceOverlays(overlay.current, element, canvas, stream);
    element.srcObject = stream;
    element.muted = true;
    void element.play().then(
      () => {
        if (current) {
          annotations.ready();
          onReady();
        }
      },
      () => {
        if (current)
          onError('Audience video could not start. Reopen the audience window to try again.');
      },
    );
    return () => {
      current = false;
      annotations.dispose();
      element.pause();
      element.srcObject = null;
    };
  }, [stream, canvas, onReady, onError]);
  return (
    <main className="audience-view" aria-label="Audience lecture view">
      <header className="audience-heading">
        <p>{content.lectureTitle}</p>
        <h1>{content.stepTitle}</h1>
      </header>
      <div className="audience-stage" data-biology={!!content.biology}>
        <div className="audience-model">
          <video ref={video} autoPlay muted playsInline aria-label="Live 3D teaching model" />
          <div ref={overlay} className="audience-overlays" aria-label="Model annotations" hidden />
          {!stream && <p role="status">The 3D model is loading…</p>}
        </div>
        {content.biology && (
          <aside className="audience-biology" aria-label="Tissue response explanation">
            <BiologyIllustration view={content.biology} audience />
          </aside>
        )}
      </div>
      {(content.modelCaption || content.vectorLegend || content.separation != null) && (
        <div className="audience-model-notes" aria-label="Model display explanation">
          {content.modelCaption && <span>{content.modelCaption}</span>}
          {content.vectorLegend && (
            <span>↗ Force direction · ↻ Moment · Arrow size is schematic</span>
          )}
          {content.separation != null && <span>Display separation {content.separation} mm</span>}
        </div>
      )}
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
