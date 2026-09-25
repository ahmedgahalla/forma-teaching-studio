'use client';
import type { CaseStudioApi } from './api';
import type { AttachmentSpec } from '@/lib/attachments';
import { CaseScenarioPanel, MobilePanelHeading } from '../StudioExperience';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  ChevronRight,
  Download,
  Focus,
  History,
  Layers3,
  Move3D,
  Plus,
  Redo2,
  Rotate3D,
  RotateCcw,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
  Undo2,
  X,
} from 'lucide-react';
import TryPanel from '../TryPanel';
import MechanicsPanel from '../MechanicsPanel';
import AppliancePalette from '../AppliancePalette';
import { Toggle } from './ui';
import { toothArch } from '@/lib/appliances';
import { directions, pretty } from './constants';
import { hasMechanicsMovement } from '@/lib/mechanics-presentation';

export function CaseInspector({ api }: { api: CaseStudioApi }) {
  const { scenario, caseDefinition, caseVariant } = api;
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

        {api.panel === 'move' && scenario && caseDefinition && caseVariant && (
          <>
            <CaseScenarioPanel
              showPlayback={false}
              title={caseDefinition.title}
              description={caseDefinition.description}
              category={caseDefinition.category}
              observe={caseDefinition.learningGoal}
              question={caseVariant.question}
              answer={caseVariant.answer}
              answerVisible={scenario.answerVisible}
              onToggleAnswer={() =>
                void api.teaching.execute(
                  [{ kind: 'question', visible: !scenario.answerVisible }],
                  scenario.answerVisible ? 'Hide answer' : 'Reveal answer',
                )
              }
              variants={caseDefinition.variants.map(item => ({
                id: item.id,
                label: item.title,
                description: item.description,
              }))}
              variantId={scenario.variantId}
              onVariantChange={id =>
                void api.teaching.execute(
                  [{ kind: 'case', action: 'variant', id }],
                  'Choose case demonstration',
                )
              }
              progress={scenario.exploring ? scenario.returnProgress : api.stage / api.stages}
              playing={api.playing}
              speed={api.playbackSpeed}
              compare={api.ghost}
              onProgressChange={value =>
                void api.teaching.execute(
                  [{ kind: 'case', action: 'progress', value }],
                  'Set demonstration progress',
                )
              }
              onSpeedChange={value =>
                void api.teaching.execute([{ kind: 'speed', value }], 'Set playback speed')
              }
              onTogglePlaying={() =>
                void api.teaching.execute(
                  [{ kind: 'case', action: api.playing ? 'pause' : 'play' }],
                  api.playing ? 'Pause case' : 'Play case',
                )
              }
              onReset={() =>
                void api.teaching.execute(
                  [{ kind: 'case', action: 'reset' }],
                  'Reset prepared case',
                )
              }
              onCompare={() =>
                void api.teaching.execute(
                  [{ kind: 'comparison', mode: api.ghost ? 'off' : 'overlay' }],
                  'Compare the case start',
                )
              }
              onExplore={() =>
                void api.teaching.execute(
                  [{ kind: 'case', action: 'explore' }],
                  'Explore this arrangement',
                )
              }
              onReturn={() =>
                void api.teaching.execute(
                  [{ kind: 'case', action: 'return' }],
                  'Return to prepared case',
                )
              }
              edited={scenario.exploring}
              disabled={!!api.sandbox.pending || api.busy}
            />
            <details className="case-sources">
              <summary>Assumptions & reading · educator review pending</summary>
              <ul>
                {[...caseDefinition.assumptions, ...caseVariant.assumptions].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <div>
                {caseVariant.sources.map(source => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                ))}
              </div>
            </details>
          </>
        )}
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
        {api.panel === 'move' && !api.tryActive && !api.prepared && (
          <div className="inspector-content">
            <div className="control-heading">
              <Move3D size={16} />
              <h3>Translate {api.selectedIds.length > 1 ? 'selection' : 'tooth'}</h3>
              <span>mm / tooth</span>
            </div>
            {!api.calibrated && (
              <div className="calibration-notice">
                Use world axes until reference directions are set.
                <button onClick={api.openCalibration}>
                  Calibrate tooth {api.selected}
                  <ArrowUpRight size={12} />
                </button>
              </div>
            )}
            <div className="direction-grid">
              {directions.map(d => (
                <button
                  key={d.id}
                  className={api.direction === d.id ? 'active' : ''}
                  onClick={() => api.setDirection(d.id)}
                  disabled={!api.calibrated}
                >
                  <strong>{d.label}</strong>
                  <span>{d.detail}</span>
                </button>
              ))}
            </div>
            <div className="world-axes">
              <span>World axis</span>
              {(['x', 'y', 'z'] as const).map(a => (
                <button
                  className={api.direction === a ? 'active' : ''}
                  onClick={() => api.setDirection(a)}
                  key={a}
                >
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="amount-row">
              <label className="number-field">
                <input
                  aria-label="Movement distance"
                  type="number"
                  value={api.distance}
                  step="0.05"
                  min="-10"
                  max="10"
                  onChange={e => api.setDistance(e.target.value)}
                />
                <span>mm</span>
              </label>
              <button
                className="button primary"
                onClick={() =>
                  api.apply({
                    type: 'move_group',
                    teeth: api.selectedIds,
                    direction: api.direction,
                    amount: Number(api.distance),
                  })
                }
              >
                Move <ArrowRight size={15} />
              </button>
            </div>
            <div className="presets">
              {['0.1', '0.25', '0.5', '1'].map(n => (
                <button
                  key={n}
                  className={api.distance === n ? 'active' : ''}
                  onClick={() => api.setDistance(n)}
                >
                  {n} mm
                </button>
              ))}
            </div>
            <div className="divider" />
            <div className="control-heading">
              <Rotate3D size={16} />
              <h3>Angular movement</h3>
              <span>degrees</span>
            </div>
            <div className="rotation-modes">
              {(
                [
                  { id: 'tip', label: 'Tip' },
                  { id: 'torque', label: 'Torque' },
                  { id: 'rotate', label: 'Axial' },
                  { id: 'world', label: 'World' },
                ] as const
              ).map(m => (
                <button
                  key={m.id}
                  onClick={() => api.setRotationMode(m.id)}
                  disabled={m.id !== 'world' && !api.calibrated}
                  className={api.rotationMode === m.id ? 'active' : ''}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="rotation-explanation">
              {api.rotationMode === 'tip'
                ? 'About each tooth’s buccolingual axis.'
                : api.rotationMode === 'torque'
                  ? 'About each tooth’s mesiodistal axis.'
                  : api.rotationMode === 'rotate'
                    ? 'About each tooth’s occlusal / long axis.'
                    : 'About a fixed axis of the case.'}
            </p>
            {api.rotationMode === 'world' && (
              <div className="rotation-axis">
                <span>World axis</span>
                <div>
                  {(['x', 'y', 'z'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => api.setAxis(a)}
                      className={api.axis === a ? 'active' : ''}
                    >
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="amount-row">
              <label className="number-field">
                <input
                  aria-label="Rotation angle"
                  type="number"
                  value={api.degrees}
                  min="-180"
                  max="180"
                  step="1"
                  onChange={e => api.setDegrees(e.target.value)}
                />
                <span>°</span>
              </label>
              <button
                className="button light"
                onClick={() =>
                  api.apply(
                    api.rotationMode === 'world'
                      ? {
                          type: 'rotate_group',
                          teeth: api.selectedIds,
                          axis: api.axis,
                          amount: Number(api.degrees),
                        }
                      : {
                          type: 'orthodontic',
                          teeth: api.selectedIds,
                          movement: api.rotationMode,
                          amount: Number(api.degrees),
                        },
                  )
                }
              >
                Apply <RotateCcw size={15} />
              </button>
            </div>
            <p className="field-hint">
              Right-hand sign · fixed reference axes · crown-centre pivot. No force or root-control
              prediction.
            </p>
            <div className="divider" />
            <div className="control-heading">
              <Focus size={16} />
              <h3>Tooth {api.selected} · final change</h3>
              <button
                className="reset-link"
                onClick={() => api.apply({ type: 'reset', teeth: api.selectedIds })}
              >
                Reset {api.selectedIds.length > 1 ? 'group' : ''}
              </button>
            </div>
            <div className="position-values">
              {['X', 'Y', 'Z'].map((a, i) => (
                <div key={a}>
                  <span>{a}</span>
                  <strong>{pretty(api.pose.translation[i])}</strong>
                  <small>mm</small>
                </div>
              ))}
            </div>
            <div className="rotation-values">
              Euler XYZ<span>{api.pose.rotation.map(n => `${n.toFixed(1)}°`).join(' / ')}</span>
            </div>
            <button className="axis-details" onClick={api.openCalibration}>
              {api.actualCalibration
                ? 'Inspect / adjust reference directions'
                : 'Set anatomical reference directions'}
              <ChevronRight size={13} />
            </button>
          </div>
        )}

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
                    !!api.mechanics?.result &&
                      hasMechanicsMovement(api.mechanics.result.diagnostics),
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
              <Toggle
                label="Show gingiva"
                value={api.gums}
                onChange={() => api.setGums(!api.gums)}
              />
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

        {api.panel === 'analysis' && (
          <div className="analysis-panel">
            <div className="control-heading">
              <Ruler size={16} />
              <h3>Surface landmarks</h3>
            </div>
            <button
              className={`button ${api.measureMode ? 'primary' : 'light'} full-button`}
              onClick={() => api.setMeasureMode(!api.measureMode)}
            >
              {api.measureMode ? 'Finish picking' : 'Pick two crown points'}
              <Ruler size={15} />
            </button>
            <div className="measure-result">
              <strong>
                {api.pointDistance === null ? '—' : api.pointDistance.toFixed(2)}
                <small> mm</small>
              </strong>
              <span>
                {api.landmarks.length === 2
                  ? `${api.landmarks[0].tooth} → ${api.landmarks[1].tooth} · shown stage`
                  : `${api.landmarks.length}/2 points selected`}
              </span>
              {api.landmarks.length > 0 && (
                <button onClick={() => api.setLandmarks([])}>Clear points</button>
              )}
            </div>
            <p className="field-hint">
              Straight 3D distance between your landmarks. Display arch separation is excluded.
            </p>
            <div className="divider" />
            <div className="control-heading">
              <Focus size={16} />
              <h3>Crown-centre spans</h3>
            </div>
            <div className="span-table">
              {api.spans.map(s => (
                <div key={s.name}>
                  <span>
                    {s.name}
                    <small>
                      {s.initial!.toFixed(2)} → {s.final!.toFixed(2)} mm
                    </small>
                  </span>
                  <strong>
                    {pretty(s.final! - s.initial!)}
                    <small> mm</small>
                  </strong>
                </div>
              ))}
            </div>
            <p className="field-hint">Crown-centre distances, not clinical cusp-tip arch widths.</p>
            <div className="measurement">
              <label htmlFor="measure-to">Tooth {api.selected} centre to</label>
              <select
                id="measure-to"
                value={api.measureTo}
                onChange={e => api.setMeasureTo(e.target.value)}
              >
                <option value="">Choose tooth</option>
                {api.model.teeth
                  .filter(t => t.id !== api.selected)
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      Tooth {t.id}
                    </option>
                  ))}
              </select>
              {api.distanceTo !== null && (
                <span className="measurement-result">
                  {api.distanceTo.toFixed(2)} mm <small>At final positions</small>
                </span>
              )}
            </div>
            <div className="divider" />
            <div className="control-heading">
              <Box size={16} />
              <h3>Surface intersections</h3>
            </div>
            <button
              className="button light full-button"
              onClick={api.scanContacts}
              disabled={api.checking || !!api.sandbox.pending}
            >
              {api.checking ? 'Checking triangle surfaces…' : 'Check final crown surfaces'}
            </button>
            {api.contacts !== null && (
              <div className="contact-results">
                <strong>{api.contacts.length} intersecting pairs</strong>
                {api.contacts.map(c => (
                  <button
                    key={`${c.a}-${c.b}`}
                    onClick={() => {
                      api.setSelectedIds([c.a, c.b]);
                      api.setSelected(c.a);
                      api.setArch(toothArch(c.a) === toothArch(c.b) ? toothArch(c.a) : 'both');
                    }}
                  >
                    {c.a} ↔ {c.b}
                  </button>
                ))}
              </div>
            )}
            <p className="field-hint">
              Tests triangle-surface crossings at the final pose only. Does not measure clearance,
              containment, gums, roots, bone, or intermediate-stage intersections.
            </p>
            <button className="text-button" onClick={api.csv}>
              <Download size={15} />
              Export movement summary
            </button>
          </div>
        )}

        {api.panel === 'history' && (
          <div className="history-panel">
            <div className="stage-export-card">
              <span className="eyebrow">TEACHING MODEL EXPORTS</span>
              <h3>Take the sequence with you.</h3>
              <p>Export the nearest whole stage, or every stage with a movement manifest.</p>
              <button className="button light full-button" onClick={api.exportShown}>
                <Download size={15} />
                Export stage {Math.round(api.stage)} · STL
              </button>
              <button
                className="button primary full-button"
                disabled={api.busy}
                onClick={api.exportSequence}
              >
                <Layers3 size={15} />
                {api.busy ? 'Preparing…' : `Export ${api.stages + 1} stages · ZIP`}
              </button>
              <p className="field-hint">
                Crowns + gingiva{api.attachments ? ' + placed attachments' : ''}. Teaching geometry;
                no aligner shells or manufacturing preparation.
              </p>
            </div>
            <div className="divider" />
            {!api.tryActive && !api.prepared && (
              <>
                <div className="control-heading">
                  <Layers3 size={16} />
                  <h3>Planning checkpoints</h3>
                  <span>{api.checkpoints.length}/20</span>
                </div>
                <p>
                  Capture an intermediate setup. Playback follows the saved order, then reaches your
                  current final target.
                </p>
                <div className="checkpoint-input">
                  <input
                    aria-label="Checkpoint name"
                    placeholder="e.g. Alignment study"
                    maxLength={60}
                    value={api.checkpointName}
                    onChange={e => api.setCheckpointName(e.target.value)}
                  />
                  <button
                    className="icon-button"
                    onClick={api.addCheckpoint}
                    disabled={api.checkpoints.length >= 20}
                    aria-label="Capture checkpoint"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="checkpoint-list">
                  {api.checkpoints.map((c, i) => (
                    <div key={c.id}>
                      <span>{i + 1}</span>
                      <button
                        onClick={() => {
                          api.setPlaying(false);
                          api.setStage(((i + 1) / (api.checkpoints.length + 1)) * api.stages);
                        }}
                      >
                        {c.name}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove checkpoint ${c.name}`}
                        onClick={() => {
                          api.setCheckpoints(api.checkpoints.filter(p => p.id !== c.id));
                          api.setStage(api.stages);
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="divider" />
              </>
            )}
            <div className="control-heading">
              <History size={16} />
              <h3>Movement history</h3>
              <span>{api.plan.past.length}</span>
            </div>
            {!api.plan.past.length ? (
              <div className="empty-history">
                <History size={24} />
                <span>Your first movement will appear here.</span>
              </div>
            ) : (
              [...api.plan.past].reverse().map((entry, i) => (
                <div className="history-entry" key={i}>
                  <span>{api.plan.past.length - i}</span>
                  <div>{entry.label}</div>
                </div>
              ))
            )}
          </div>
        )}
        <div className="inspector-bottom">
          <div>
            <span>Teeth adjusted</span>
            <strong>
              {api.moved}
              <small> / {api.model.teeth.length}</small>
            </strong>
          </div>
          <button className="button export-button" onClick={api.exportShown}>
            <ArrowDownToLine size={16} />
            Export stage {Math.round(api.stage)} STL
            <ArrowUpRight size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
