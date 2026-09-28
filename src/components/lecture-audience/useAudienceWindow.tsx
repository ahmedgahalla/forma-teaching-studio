'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { createAudienceConnection } from './audience-connection';
import { AudienceView } from './AudienceView';
import type { AudienceContent, AudienceStatus } from './types';

type View = { target: HTMLElement; stream: MediaStream | null };

export function useAudienceWindow({
  active,
  source,
  content,
}: {
  active: boolean;
  source: RefObject<HTMLElement | null>;
  content: AudienceContent;
}) {
  const connection = useRef<ReturnType<typeof createAudienceConnection> | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<AudienceStatus>('closed');
  const [error, setError] = useState('');
  const close = useCallback(() => {
    connection.current?.dispose();
    connection.current = null;
    setView(null);
    setStatus('closed');
    setError('');
  }, []);
  const fail = useCallback((message: string) => {
    connection.current?.dispose();
    connection.current = null;
    setView(null);
    setStatus('error');
    setError(message);
  }, []);
  const ready = useCallback(() => {
    if (connection.current) setStatus('live');
  }, []);
  const open = useCallback(() => {
    if (!active) return;
    if (connection.current) {
      connection.current.focus();
      return;
    }
    if (!source.current) {
      fail('Wait for the 3D model to load, then open the audience window.');
      return;
    }
    try {
      const next = createAudienceConnection(source.current, {
        onStream: stream => {
          setStatus('opening');
          setView(previous => (previous ? { ...previous, stream } : null));
        },
        onError: fail,
        onClosed: close,
      });
      connection.current = next;
      setView({ target: next.target, stream: next.stream });
      setError('');
      setStatus('opening');
    } catch (problem) {
      fail(problem instanceof Error ? problem.message : 'The audience window could not open.');
    }
  }, [active, source, fail, close]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leaving a lecture tears down an external popup and its capture stream
    if (!active) close();
  }, [active, close]);
  useEffect(() => () => connection.current?.dispose(), []);
  return {
    status,
    error,
    isOpen: !!view,
    open,
    close,
    // Render this portal beside the shell, outside its captured interaction events.
    portal: view
      ? createPortal(
          <AudienceView content={content} stream={view.stream} onReady={ready} onError={fail} />,
          view.target,
        )
      : null,
  };
}
