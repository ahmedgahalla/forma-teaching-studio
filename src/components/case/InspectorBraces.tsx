'use client';
import type { CaseStudioApi } from './api';
import { Box, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import MechanicsPanel from '../mechanics/MechanicsPanel';
import AppliancePalette from '../mechanics/AppliancePalette';
import { Toggle } from './ui';
import { hasMechanicsMovement } from '@/lib/mechanics-presentation';
import type { AttachmentSpec } from '@/lib/attachments';

export function InspectorBraces({ api }: { api: CaseStudioApi }) {
  const { caseVariant } = api;
  return (
    <>
      {api.panel === 'braces' && (
        <div className="braces-panel">
          {api.activeExperiment && !api.prepared && (
            <MechanicsPanel
              experiment={api.activeExperiment}
              selectedIds={api.selectedIds}
              pointed={api.physicalPoint}
              focus={api.mechanicsFocus}
              preset={api.wirePreset}
              onPreset={value => {
                api.teaching.interact();
                api.setWirePreset(value);
              }}
              onFocus={value => {
                api.teaching.referenceInteraction();
                api.setMechanicsFocus(value);
              }}
              onActions={api.sendMechanics}
              busy={api.teaching.runtime.phase !== 'idle'}
              magnification={api.magnification}
              onMagnification={api.setMagnification}
              onReplay={() =>
                void api.teaching.execute(
                  [{ kind: 'dental', command: { type: 'play' } }],
                  'Replay the calculated response from the same unloaded reference',
                )
              }
              onFrame={() => {
                api.teaching.referenceInteraction();
                api.viewer.current?.focus();
              }}
              predict={api.predictResponse}
              onPredict={api.setPredictResponse}
              revealed={api.responseRevealed}
              onReveal={() => {
                api.setResponseRevealed(true);
                api.setReverse(false);
                api.setStage(0);
                api.setPlaying(
                  !!api.mechanics?.result && hasMechanicsMovement(api.mechanics.result.diagnostics),
                );
              }}
              forces={api.forceVectors}
              onForces={() => api.setForceVectors(!api.forceVectors)}
              onExplain={() => void api.teaching.runControl('explain that movement')}
            />
          )}
          <details className="appearance-details">
            <summary>Authored appliance illustrations & appearance</summary>
            <AppliancePalette
              value={api.applianceDisplay}
              available={api.model.demo}
              busy={api.teaching.runtime.phase !== 'idle'}
              onChange={value =>
                void api.teaching.execute(
                  [{ kind: 'appliance-display', ...value }],
                  'Change teaching appliance',
                )
              }
            />
            {api.anatomy.cutaway &&
              ['expander-bands', 'palatal-expander', 'retainer'].includes(
                api.applianceDisplay.preset,
              ) && (
                <p className="form-note">
                  Turn off the anatomy cutaway to see the complete appliance.
                </p>
              )}
            <div className="appliance-intro">
              Show how appliances relate to the teeth. Select a tooth or group to add attachments.
            </div>
            <div className="control-heading">
              <SlidersHorizontal size={16} />
              <h3>Fixed appliance</h3>
            </div>
            <Toggle
              label="Show chosen appliance"
              value={
                api.braces &&
                (!!api.mechanics ||
                  api.applianceDisplay.preset !== 'none' ||
                  !!caseVariant?.removableRetainer)
              }
              onChange={api.toggleApplianceVisibility}
            />
            <label className="form-label">
              Bracket appearance
              <select
                value={api.bracketStyle}
                onChange={e => api.setBracketStyle(e.target.value as 'metal' | 'ceramic')}
              >
                <option value="metal">Metal</option>
                <option value="ceramic">Ceramic</option>
              </select>
            </label>
            <label className="form-label">Ligature colour</label>
            <div className="colour-swatches">
              {['#299f9b', '#889ba6', '#547aca', '#bd5b87', '#946fbe', '#e4d5ac'].map(c => (
                <button
                  key={c}
                  aria-label={`Ligature colour ${c}`}
                  aria-pressed={api.ligatureColor === c}
                  className={api.ligatureColor === c ? 'active' : ''}
                  style={{ background: c }}
                  onClick={() => api.setLigatureColor(c)}
                />
              ))}
            </div>
            <div className="divider" />
            <div className="control-heading">
              <Box size={16} />
              <h3>Aligner attachments</h3>
              <span>{api.model.teeth.filter(t => t.attachment).length} placed</span>
            </div>
            <Toggle
              label="Show attachments"
              value={api.attachments}
              onChange={() => api.setAttachments(!api.attachments)}
            />
            <label className="form-label">
              Attachment shape
              <select
                aria-label="Attachment shape"
                value={api.attachmentDraft.shape}
                onChange={e =>
                  api.setAttachmentDraft({
                    ...api.attachmentDraft,
                    shape: e.target.value as AttachmentSpec['shape'],
                  })
                }
              >
                <option value="rectangle">Rectangular</option>
                <option value="ellipsoid">Ellipsoid</option>
                <option value="beveled">Beveled</option>
              </select>
            </label>
            <div className="attachment-fields">
              {(
                [
                  { key: 'width', label: 'Width', unit: 'mm', min: 0.2, max: 6 },
                  { key: 'height', label: 'Height', unit: 'mm', min: 0.2, max: 6 },
                  { key: 'depth', label: 'Depth', unit: 'mm', min: 0.2, max: 6 },
                  { key: 'rotation', label: 'Rotation', unit: '°', min: -180, max: 180 },
                  { key: 'offsetMesial', label: 'Mesial offset', unit: 'mm', min: -5, max: 5 },
                  {
                    key: 'offsetOcclusal',
                    label: 'Occlusal offset',
                    unit: 'mm',
                    min: -5,
                    max: 5,
                  },
                ] as const
              ).map(f => (
                <label key={f.key}>
                  {f.label}
                  <span>
                    <input
                      type="number"
                      aria-label={`Attachment ${f.label.toLowerCase()}`}
                      min={f.min}
                      max={f.max}
                      step={f.key === 'rotation' ? 1 : 0.1}
                      value={
                        Number.isFinite(api.attachmentDraft[f.key])
                          ? api.attachmentDraft[f.key]
                          : ''
                      }
                      onChange={e =>
                        api.setAttachmentDraft({
                          ...api.attachmentDraft,
                          [f.key]: e.target.value === '' ? NaN : Number(e.target.value),
                        })
                      }
                    />
                    <small>{f.unit}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="attachment-actions">
              <button
                className="button primary"
                disabled={!api.calibrated}
                onClick={() => api.editAttachments(api.attachmentDraft)}
              >
                Apply to{' '}
                {api.selectedIds.length === 1 ? api.selected : `${api.selectedIds.length} teeth`}
              </button>
              <button
                className="button light"
                disabled={
                  !api.model.teeth.some(t => api.selectedIds.includes(t.id) && t.attachment)
                }
                onClick={() => api.editAttachments(null)}
              >
                Remove
              </button>
            </div>
            <p className="field-hint">
              Placed on the crown surface. Changes apply to the selection; Remove reverses an
              appliance edit.
            </p>
            <div className="divider" />
            <Toggle label="Show gingiva" value={api.gums} onChange={() => api.setGums(!api.gums)} />
            <Toggle
              label="Show schematic roots"
              value={api.roots}
              onChange={() => {
                if (!api.model.teeth.some(t => t.rootGeometry)) {
                  api.note('No root geometry in this case.', true);
                  return;
                }
                api.setRoots(!api.roots);
              }}
            />
            <label className="form-label">
              Separate arches for inspection <span>{api.opening} mm</span>
              <input
                aria-label="Display arch separation"
                type="range"
                min="0"
                max="25"
                step="1"
                value={api.opening}
                onChange={e => api.setOpening(Number(e.target.value))}
                style={{ '--progress': `${api.opening * 4}%` } as React.CSSProperties}
              />
            </label>
            <p className="field-hint">
              Display separation does not change saved tooth movements, exported geometry, or
              measurements.
            </p>
            <div className="information-card">
              <ShieldCheck size={18} />
              <p>
                These appearance presets are authored illustrations. The experiment controls above
                separately calculate supported initial wire, elastic and expander responses with
                declared virtual supports.
              </p>
            </div>
            {!api.model.demo && (
              <p className="field-hint">
                Imported teeth need reference calibration. Bracket placement is an estimate on the
                buccal surface.
              </p>
            )}
          </details>
        </div>
      )}
    </>
  );
}
