'use client';
import type { AudienceStatus } from './types';
import './audience-launcher.css';

export function AudienceLauncher({
  status,
  error,
  onOpen,
  onClose,
}: {
  status: AudienceStatus;
  error: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  const isOpen = status === 'opening' || status === 'live';
  return (
    <div className="audience-launcher">
      <div className="audience-launcher-actions">
        <button type="button" onClick={onOpen}>
          {isOpen ? 'Show audience window' : 'Open audience window'}
        </button>
        {isOpen && (
          <button type="button" onClick={onClose}>
            Close audience window
          </button>
        )}
        <span role="status">
          {status === 'opening' ? 'Connecting model…' : isOpen ? 'Audience window open' : ''}
        </span>
      </div>
      {isOpen && (
        <p>Move the audience window to the projector. Keep presenter notes on this screen.</p>
      )}
      {error && (
        <p className="audience-launcher-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
