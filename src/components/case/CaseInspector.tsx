'use client';
import type { CaseStudioApi } from './api';
import {
  ArrowUpRight,
  History,
  Move3D,
  Redo2,
  Ruler,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { MobilePanelHeading } from '../StudioExperience';
import TryPanel from '../TryPanel';
import { toothArch } from '@/lib/appliances';
import { InspectorScenario } from './InspectorScenario';
import { InspectorMove } from './InspectorMove';
import { InspectorBraces } from './InspectorBraces';
import { InspectorAnalysis } from './InspectorAnalysis';
import { InspectorHistory } from './InspectorHistory';

export function CaseInspector({ api }: { api: CaseStudioApi }) {
  return (
    <>
      <aside className="inspector">
        <MobilePanelHeading title="Tools" onClose={() => api.setMobilePanel('model')} />
        <div className="inspector-heading">
          <span className="eyebrow">
            {api.selectedIds.length === 1 ? 'TOOTH INSPECTOR' : 'GROUP INSPECTOR'}
          </span>
          <div className="history-buttons">
            <button
              className="icon-button"
              onClick={() => void api.teaching.runControl('undo that')}
              aria-label="Undo"
              title="Ctrl / Cmd + Z"
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              onClick={() => void api.teaching.runControl('redo')}
              aria-label="Redo"
              title="Ctrl / Cmd + Shift + Z"
            >
              <Redo2 size={17} />
            </button>
          </div>
        </div>
        <div className="tooth-card">
          <div className="large-number">
            {api.selectedIds.length === 1 ? api.selected : api.selectedIds.length}
          </div>
          <div>
            <h3>{api.selectedIds.length === 1 ? api.tooth.name : 'Selected teeth'}</h3>
            <span>
              {api.selectedIds.length === 1
                ? `${toothArch(api.selected)} arch · FDI ${api.selected}`
                : api.selectedIds.join(' · ')}
            </span>
            <div className="selected-tag">
              {api.calibrated ? 'Reference axes set' : 'Calibration needed'}
            </div>
          </div>
        </div>
        <label className="mobile-tooth-selector">
          Selected tooth
          <select value={api.selected} onChange={e => api.selectTooth(e.target.value)}>
            {api.model.teeth.map(t => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mobile-groups">
          <button onClick={() => api.selectGroup('upper incisors')}>Upper incisors</button>
          <button onClick={() => api.selectGroup('lower incisors')}>Lower incisors</button>
          <button onClick={() => api.selectGroup('all teeth')}>All teeth</button>
        </div>
        <div className="inspector-tabs four-tabs">
          {(
            [
              { id: 'move', label: 'Move', icon: <Move3D size={14} /> },
              { id: 'braces', label: 'Appliances', icon: <SlidersHorizontal size={14} /> },
              { id: 'analysis', label: 'Measure', icon: <Ruler size={14} /> },
              { id: 'history', label: 'Stages', icon: <History size={14} /> },
            ] as const
          ).map(t => (
            <button
              key={t.id}
              className={api.panel === t.id ? 'active' : ''}
              onClick={() => api.setPanel(t.id)}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <InspectorScenario api={api} />
        {api.panel === 'move' && api.tryActive && (
          <>
            {!api.calibrated && (
              <div className="calibration-notice">
                Imported teeth need reference directions for named movements. Case axes work
                immediately.
                <button disabled={!!api.sandbox.pending} onClick={api.openCalibration}>
                  Calibrate tooth {api.selected}
                  <ArrowUpRight size={12} />
                </button>
              </div>
            )}
            <TryPanel {...api.tryPanelProps} hidePreview={api.lecture} />
          </>
        )}
        <InspectorMove api={api} />
        <InspectorBraces api={api} />
        <InspectorAnalysis api={api} />
        <InspectorHistory api={api} />
      </aside>
    </>
  );
}
