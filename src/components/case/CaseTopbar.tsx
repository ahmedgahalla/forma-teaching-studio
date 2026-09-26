'use client';
import {
  CircleHelp,
  Download,
  Layers3,
  MoreHorizontal,
  MousePointer2,
  Presentation,
  Settings2,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { StudioThemeToggle } from '../shared/StudioTheme';
import { useDisclosureMenu } from './useDisclosureMenu';

export type CaseTopbarProps = {
  lecture: boolean;
  toolsOpen: boolean;
  busy: boolean;
  onOpenLibrary: () => void;
  onToggleTools: () => void;
  onToggleLecture: () => void;
  onOpenCase: () => void;
  onSaveCase: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onOpenSelection: () => void;
  onOpenLayers: () => void;
};

export function CaseTopbar({
  lecture,
  toolsOpen,
  busy,
  onOpenLibrary,
  onToggleTools,
  onToggleLecture,
  onOpenCase,
  onSaveCase,
  onOpenSettings,
  onOpenGuide,
  onOpenSelection,
  onOpenLayers,
}: CaseTopbarProps) {
  const { menuRef, summaryRef } = useDisclosureMenu({ closeOnAction: true });

  return (
    <header className="topbar">
      <div className="brand" aria-label="Forma Teaching Studio">
        <span className="brand-icon">
          <Layers3 size={22} />
        </span>
        forma
        <span className="brand-divider" />
        <span className="brand-sub">TEACHING STUDIO</span>
      </div>
      <div className="top-center">
        <span className="studio-live-dot" />
        Interactive classroom
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="button light small workflows-button"
          aria-label="Teaching library"
          onClick={onOpenLibrary}
        >
          <Layers3 size={16} />
          <span>Library</span>
        </button>
        <button
          type="button"
          className={`button light small ${toolsOpen ? 'active' : ''}`}
          aria-label="Tools"
          aria-pressed={toolsOpen}
          onClick={onToggleTools}
        >
          <SlidersHorizontal size={16} />
          <span>Tools</span>
        </button>
        <button
          type="button"
          className={`button small presentation-button ${lecture ? 'active' : ''}`}
          aria-pressed={lecture}
          aria-label={lecture ? 'Exit lecture mode' : 'Enter lecture mode'}
          onClick={onToggleLecture}
        >
          <Presentation size={16} />
          <span>{lecture ? 'Exit present' : 'Present'}</span>
        </button>
        <details ref={menuRef} className="opening-menu">
          <summary
            ref={summaryRef}
            className="button light small"
            aria-label="More workspace actions"
          >
            <MoreHorizontal size={16} />
            <span>More</span>
          </summary>
          <div className="opening-menu-content">
            <button type="button" onClick={onOpenCase} disabled={busy}>
              <Upload size={16} />
              Open case
            </button>
            <button type="button" onClick={onSaveCase}>
              <Download size={16} />
              Save case
            </button>
            <button type="button" onClick={onOpenSettings}>
              <Settings2 size={16} />
              Settings
            </button>
            <StudioThemeToggle />
            <button type="button" onClick={onOpenGuide}>
              <CircleHelp size={16} />
              Guide
            </button>
            <button type="button" onClick={onOpenSelection}>
              <MousePointer2 size={16} />
              Selection
            </button>
            <button type="button" onClick={onOpenLayers}>
              <Layers3 size={16} />
              Layers
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
