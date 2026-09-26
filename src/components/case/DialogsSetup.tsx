'use client';
import type { CaseStudioApi } from './api';
import { ArrowRight, ArrowUpRight, Check, CircleHelp, RotateCcw, Upload } from 'lucide-react';
import { Dialog, Toggle } from './ui';
import { axisVectors, errorText } from './constants';

export function DialogsSetup({ api }: { api: CaseStudioApi }) {
  const { modal, setModal } = api;
  return (
    <>
      {modal === 'import' && (
        <Dialog title="Import segmented dental meshes" onClose={() => setModal(null)}>
          <p>
            Select already-segmented STL teeth using FDI names such as <code>11.stl</code>,{' '}
            <code>21.stl</code>, <code>31.stl</code>, and <code>41.stl</code>. Gums can be named{' '}
            <code>upper_gum.stl</code> and <code>lower_gum.stl</code>.
          </p>
          <label className="upload-zone">
            <Upload size={26} />
            <strong>
              {api.files.length ? `${api.files.length} files selected` : 'Choose STL files'}
            </strong>
            <span>Shared coordinates · 100 MB total</span>
            <input
              type="file"
              accept=".stl"
              multiple
              onChange={e => api.setFiles(Array.from(e.target.files || []))}
            />
          </label>
          {api.files.length > 0 && (
            <div className="file-chips">
              {api.files.map(f => (
                <span key={f.name}>{f.name}</span>
              ))}
            </div>
          )}
          <label className="form-label">
            Source units
            <select value={api.scale} onChange={e => api.setScale(e.target.value)}>
              <option value="1">Millimetres</option>
              <option value="10">Centimetres</option>
              <option value="1000">Metres</option>
              <option value="25.4">Inches</option>
            </select>
          </label>
          <p className="form-note">
            Replaces the current case. Save first if needed. All shared positions are preserved.
            Anatomical orientation, tooth segmentation, roots, and bite registration are not
            inferred.
          </p>
          {api.importError && (
            <p className="inline-error" role="alert">
              {api.importError}
            </p>
          )}
          <div className="dialog-actions">
            <button className="button light" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={!api.files.length || api.busy}
              onClick={api.importFiles}
            >
              {api.busy ? 'Importing…' : 'Import models'}
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'calibrate' && (
        <Dialog title={`Reference axes · tooth ${api.selected}`} onClose={() => setModal(null)}>
          <p>
            Named movements require the tooth’s original anatomical axes. The occlusal axis points
            from the root toward the biting surface; intrusion moves in the opposite direction.
          </p>
          {api.actualCalibration && (
            <div className="frame-readout">
              {Object.entries(api.actualCalibration).map(([key, vector]) => (
                <div key={key}>
                  <span>{key}</span>
                  <code>[{vector.map(n => n.toFixed(3)).join(', ')}]</code>
                </div>
              ))}
            </div>
          )}
          <p className="form-note">
            These selectors assign an axis-aligned frame for this tooth. They do not rotate the
            mesh. Use world movement for tilted imports until an appropriate frame is assigned.
            Existing transformations are kept.
          </p>
          <div className="calibration-fields">
            {[
              { label: 'Buccal', value: api.bAxis, set: api.setBAxis },
              { label: 'Mesial', value: api.mAxis, set: api.setMAxis },
              { label: 'Occlusal', value: api.oAxis, set: api.setOAxis },
            ].map(f => (
              <label className="form-label" key={f.label}>
                {f.label}
                <select value={f.value} onChange={e => f.set(e.target.value)}>
                  {Object.keys(axisVectors).map(a => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <button className="button light" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={new Set([api.bAxis[1], api.mAxis[1], api.oAxis[1]]).size !== 3}
              onClick={() => {
                api.setModel({
                  ...api.model,
                  teeth: api.model.teeth.map(t =>
                    t.id === api.selected
                      ? {
                          ...t,
                          calibrated: true,
                          buccal: axisVectors[api.bAxis],
                          mesial: axisVectors[api.mAxis],
                          occlusal: axisVectors[api.oAxis],
                          bracketPosition: undefined,
                        }
                      : t,
                  ),
                });
                setModal(null);
                api.note(
                  `Tooth ${api.selected} reference axes assigned. Bracket placement is estimated from the buccal surface.`,
                );
              }}
            >
              Assign axes
              <Check size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'settings' && (
        <Dialog title="Workspace settings" onClose={() => setModal(null)}>
          <div className="settings-file-actions">
            <button
              className="button light"
              onClick={() => {
                setModal(null);
                api.caseInput.current?.click();
              }}
            >
              <Upload size={15} />
              Open saved case
            </button>
            <button
              className="button light"
              onClick={() => {
                api.setImportError('');
                setModal('import');
              }}
            >
              Import STL models
            </button>
          </div>
          <h3>Command interpretation</h3>
          <p>
            Try Mode commands work locally in English without a key. The optional AI service
            interprets flexible wording. Every action is independently validated before the geometry
            engine runs.
          </p>
          <Toggle
            label="Use AI command service"
            value={api.aiEnabled}
            onChange={() => {
              if (!api.aiEnabled && !api.apiUrl) {
                api.note('Connect the service below first.', true);
                return;
              }
              api.setAiEnabled(!api.aiEnabled);
            }}
          />
          <label className="form-label">
            Service URL
            <input value={api.apiDraft} onChange={e => api.setApiDraft(e.target.value)} />
          </label>
          <button
            className="button light"
            disabled={api.busy}
            onClick={async () => {
              api.setBusy(true);
              try {
                const url = new URL(api.apiDraft);
                if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
                  throw new Error('Use an http or https URL.');
                const base = url.href.replace(/\/$/, '');
                const response = await fetch(`${base}/health`, {
                  signal: AbortSignal.timeout(5000),
                });
                if (!response.ok) throw new Error('Service unavailable.');
                const result = await response.json();
                if (!result.ai_enabled)
                  throw new Error('Service is running but OPENAI_API_KEY is not configured.');
                api.teaching.setConfig({
                  url: base,
                  enabled: true,
                  provider: result.provider || 'Configured AI provider',
                });
                api.note(
                  'AI service connected. Clear validated classroom and geometric commands execute immediately; manual previews retain Apply and Cancel. Undo restores the whole request.',
                );
              } catch (e) {
                api.note(errorText(e), true);
              } finally {
                api.setBusy(false);
              }
            }}
          >
            Connect service
            <ArrowUpRight size={15} />
          </button>
          <p className="form-note">
            Command text and minimal scene references go to your configured AI provider. Meshes
            remain local. Voice uses the browser’s speech service. API keys belong only in the
            backend environment.
          </p>
          <p className={api.statusError ? 'inline-error' : 'form-note'}>{api.status}</p>
          <div className="divider" />
          <button className="text-button" onClick={() => setModal('demo')}>
            <RotateCcw size={16} />
            Reload synthetic study
          </button>
          <button className="text-button" onClick={() => setModal('guide')}>
            <CircleHelp size={16} />
            Movement guide and sources
          </button>
        </Dialog>
      )}
    </>
  );
}
