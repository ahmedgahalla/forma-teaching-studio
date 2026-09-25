'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Focus, MousePointer2, Scan, Expand } from 'lucide-react';
import './lecture-view.css';

export function LectureViewTools({
  isolated,
  pointer,
  onIsolate,
  onPointer,
  onFocus,
  onFit,
  children,
}: {
  isolated: boolean;
  pointer: boolean;
  onIsolate: () => void;
  onPointer: () => void;
  onFocus: () => void;
  onFit: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="lecture-view-tools" aria-label="Model presentation tools">
      <button type="button" onClick={onFocus} title="Frame all selected teeth">
        <Focus size={17} />
        Focus selection
      </button>
      <button
        type="button"
        onClick={onIsolate}
        aria-pressed={isolated}
        title="Show the selected teeth without the surrounding arch"
      >
        <Scan size={17} />
        {isolated ? 'Show full arch' : 'Isolate selection'}
      </button>
      <button type="button" onClick={onFit} title="Fit the visible anatomy">
        <Expand size={17} />
        Fit
      </button>
      <button
        type="button"
        onClick={onPointer}
        aria-pressed={pointer}
        title="Point at the model without moving teeth. Escape exits."
      >
        <MousePointer2 size={17} />
        {pointer ? 'Exit pointer' : 'Lecture pointer'}
      </button>
      {children}
    </div>
  );
}

/** A screen pointer only: it never selects, moves or annotates a tooth. */
export function LecturePointer({ enabled, onExit }: { enabled: boolean; onExit: () => void }) {
  const spot = useRef<HTMLSpanElement>(null);
  const exit = useRef(onExit);
  useEffect(() => {
    exit.current = onExit;
  });
  useEffect(() => {
    if (!enabled) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exit.current();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [enabled]);
  if (!enabled) return null;
  const hide = () => {
    if (spot.current) spot.current.hidden = true;
  };
  return (
    <div
      className="lecture-pointer"
      aria-hidden="true"
      onPointerMove={event => {
        if (!spot.current) return;
        const box = event.currentTarget.getBoundingClientRect();
        spot.current.hidden = false;
        spot.current.style.transform = `translate(${event.clientX - box.left}px, ${event.clientY - box.top}px)`;
      }}
      onPointerDown={event => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={hide}
      onPointerLeave={hide}
    >
      <span ref={spot} className="lecture-pointer-spot" hidden />
    </div>
  );
}
