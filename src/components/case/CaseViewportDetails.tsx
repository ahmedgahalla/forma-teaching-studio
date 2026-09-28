import { MousePointer2 } from 'lucide-react';
import type { CaseStudioApi } from './api';
import { LecturePointer } from '../lecture/LectureViewTools';
import { mechanicsResponseCaption } from '@/lib/mechanics-presentation';

export function CaseViewportDetails({ api, editing }: { api: CaseStudioApi; editing: boolean }) {
  return (
    <>
      <div className="viewport-selection">
        <MousePointer2 size={14} />
        <span>
          {api.selectedIds.length === 1 ? (
            <>
              Tooth <strong>{api.selected}</strong>
            </>
          ) : (
            <strong>{api.selectedIds.length} teeth selected</strong>
          )}
        </span>
        <span className="selection-line" />
        <span>{api.selectedIds.length === 1 ? api.tooth.name : api.selectedIds.join(' · ')}</span>
      </div>
      <div className="orientation">
        <span className="axis-y">Y</span>
        <span className="axis-x">X</span>
        <span className="axis-z">Z</span>
        <i />
      </div>
      <div className="viewport-hint">
        {api.measureMode && editing
          ? 'Pick two crown-surface points'
          : 'Drag to orbit · Scroll to zoom · Shift-click to select'}
      </div>
      <LecturePointer enabled={api.pointer && api.active} onExit={() => api.setPointer(false)} />
      {api.pointer && (
        <span className="lecture-pointer-notice">
          Lecture pointer · Escape or Exit pointer to orbit
        </span>
      )}
      {api.mechanics?.result && !api.sandbox.pending && (
        <div className="mechanics-scale-badge">
          {api.responseRevealed
            ? mechanicsResponseCaption(api.mechanics.result.diagnostics, api.magnification)
            : 'Predict first · calculated response hidden'}
        </div>
      )}
      {api.mechanics?.result &&
        !api.sandbox.pending &&
        api.forceVectors &&
        api.responseRevealed && (
          <div className="mechanics-vector-legend">
            <span>↗ Force direction</span>
            <span>↻ Moment</span>
            <small>Arrow size is schematic</small>
          </div>
        )}
      {api.stage < api.stages && (
        <div className="stage-preview-badge">
          Stage {api.stage.toFixed(1)} / {api.stages}
        </div>
      )}
      {api.opening > 0 && <div className="opening-badge">Display separation {api.opening} mm</div>}
      {api.roots && <div className="roots-badge">Schematic roots · not reconstructed</div>}
    </>
  );
}
