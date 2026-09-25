'use client';
import type { CaseStudioApi } from './api';
import { Download, Layers3, Presentation, Settings2, Upload } from 'lucide-react';
import { StudioThemeToggle } from '../StudioTheme';

export function CaseTopbar({ api }: { api: CaseStudioApi }) {
  return (
    <>
      <header className="topbar">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- TODO(phase-3): intentional full reload of the static export */}
        <a className="brand" href="/" aria-label="Forma home">
          <span className="brand-icon">
            <Layers3 size={22} />
          </span>
          forma
          <span className="brand-divider" />
          <span className="brand-sub">TEACHING STUDIO</span>
        </a>
        <div className="top-center">
          <span className="studio-live-dot" />
          Interactive classroom
        </div>
        <div className="header-actions">
          <StudioThemeToggle />
          <button
            className="button light small workflows-button"
            aria-label="Teaching library"
            onClick={() => api.setModal('workflows')}
          >
            <Layers3 size={16} />
            <span>Teaching library</span>
          </button>
          <button
            className={`button small presentation-button ${api.lecture ? 'active' : ''}`}
            aria-pressed={api.lecture}
            aria-label={api.lecture ? 'Exit lecture mode' : 'Enter lecture mode'}
            onClick={() => api.setLecture(!api.lecture)}
          >
            <Presentation size={16} />
            <span>{api.lecture ? 'Exit lecture' : 'Lecture mode'}</span>
          </button>
          <button
            className="text-button open-case-button"
            onClick={() => api.caseInput.current?.click()}
            disabled={api.busy}
          >
            <Upload size={16} />
            Open case
          </button>
          <button className="button dark small" aria-label="Save case" onClick={api.save}>
            <Download size={15} />
            <span>Save case</span>
          </button>
          <button
            className="avatar"
            onClick={() => {
              api.setApiDraft(api.apiUrl || 'http://127.0.0.1:8000');
              api.setModal('settings');
            }}
            aria-label="Open settings"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>
    </>
  );
}
