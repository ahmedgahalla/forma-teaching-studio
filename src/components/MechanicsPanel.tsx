'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Focus, Play, Plus, RotateCcw } from 'lucide-react';
import type {
  MechanicsAction,
  MechanicsExperiment,
  WireMaterial,
  WireSection,
} from '@/lib/mechanics/types';
import type { MechanicsFocus, PointedReference } from '@/lib/mechanics-commands';
import { MATERIAL_PRESETS, MECHANICS_SOURCES, SUPPORT_PRESETS } from '@/lib/mechanics/presets';
import { hasMechanicsMovement, MECHANICS_DISPLAY_SCALES } from '@/lib/mechanics-presentation';

const WIRE_OPTIONS: { label: string; section: WireSection }[] = [
  { label: 'Round · 0.014 in', section: { shape: 'round', diameterMm: 0.014 * 25.4 } },
  { label: 'Round · 0.016 in', section: { shape: 'round', diameterMm: 0.016 * 25.4 } },
  { label: 'Round · 0.018 in', section: { shape: 'round', diameterMm: 0.018 * 25.4 } },
  {
    label: 'Rectangular · 0.019 × 0.025 in',
    section: { shape: 'rectangle', widthMm: 0.025 * 25.4, heightMm: 0.019 * 25.4 },
  },
];
export type WirePreset = { material: WireMaterial; section: WireSection };
export const DEFAULT_WIRE_PRESET: WirePreset = {
  material: 'stainless-steel',
  section: WIRE_OPTIONS[1].section,
};
export const wireSizeLabel = (section: WireSection) =>
  section.shape === 'round'
    ? `Ø ${section.diameterMm.toFixed(3)} mm`
    : `${section.heightMm.toFixed(3)} × ${section.widthMm.toFixed(3)} mm`;
const uniqueId = (prefix: string, ids: string[]) => {
  let n = 1;
  while (ids.includes(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
};

type Props = {
  experiment: MechanicsExperiment;
  selectedIds: string[];
  pointed: PointedReference | null;
  focus: MechanicsFocus;
  preset: WirePreset;
  onPreset: (preset: WirePreset) => void;
  onFocus: (focus: MechanicsFocus) => void;
  onActions: (actions: MechanicsAction[], summary: string) => void;
  busy: boolean;
  magnification: number;
  onMagnification: (value: number) => void;
  onReplay: () => void;
  onFrame: () => void;
  predict: boolean;
  onPredict: (value: boolean) => void;
  revealed: boolean;
  onReveal: () => void;
  forces: boolean;
  onForces: () => void;
  onExplain: () => void;
};

export default function MechanicsPanel(p: Props) {
  const { config, result, stages, stageIndex, comparison } = p.experiment;
  const [newWire, setNewWire] = useState(false);
  const wire = newWire
    ? undefined
    : config.wires.find(item => item.id === p.focus.wireId) || config.wires.at(-1);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
    setNewWire(false);
  }, [p.focus.wireId]);
  const tad = config.tads.find(item => item.id === p.focus.tadId) || config.tads.at(-1);
  const [expansion, setExpansion] = useState('0.5'),
    [twist, setTwist] = useState('0'),
    [tension, setTension] = useState('1');
  const [elasticLaw, setElasticLaw] = useState<'constant' | 'spring'>('constant'),
    [elasticStiffness, setElasticStiffness] = useState('0.1'),
    [restLength, setRestLength] = useState('10');
  const [stageName, setStageName] = useState(''),
    [left, setLeft] = useState('26'),
    [right, setRight] = useState('16');
  const [activation, setActivation] = useState('0.5'),
    [stiffness, setStiffness] = useState('20'),
    [palate, setPalate] = useState('100');
  useEffect(() => {
    if (wire) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
      setExpansion(String(wire.expansionMm));
      setTwist(String(wire.torqueDeg));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
  }, [wire?.id, wire?.expansionMm, wire?.torqueDeg]);
  const expander = config.expanders[0];
  useEffect(() => {
    if (expander) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
      setLeft(expander.left.join(', '));
      setRight(expander.right.join(', '));
      setActivation(String(expander.activationMm));
      setStiffness(String(expander.stiffnessNPerMm));
      setPalate(
        expander.palateStiffnessNPerMm === undefined ? '' : String(expander.palateStiffnessNPerMm),
      );
    }
  }, [expander]);
  const perform = (actions: MechanicsAction[], summary: string, recalculate = true) =>
    p.onActions(result && recalculate ? [...actions, { type: 'solve' }] : actions, summary);
  const choosePreset = (preset: WirePreset) => {
    if (!wire) p.onPreset(preset);
    if (wire)
      perform(
        [
          { type: 'wire-material', id: wire.id, material: preset.material },
          { type: 'wire-section', id: wire.id, section: preset.section },
        ],
        'Replace the selected wire from the same baseline',
      );
  };
  const connect = () => {
    if (!tad) return;
    const used = config.elastics.map(item => item.id);
    const actions: MechanicsAction[] = p.selectedIds.map(tooth => {
      const id = uniqueId('elastic', used);
      used.push(id);
      return {
        type: 'elastic',
        id,
        from: { kind: 'tad', id: tad.id },
        to: {
          kind: 'tooth',
          tooth,
          local:
            config.brackets[tooth] ||
            (p.pointed?.tooth === tooth ? p.pointed.localPoint : undefined),
        },
        law:
          elasticLaw === 'constant'
            ? { kind: 'constant', forceN: Number(tension) / p.selectedIds.length }
            : {
                kind: 'spring',
                stiffnessNPerMm: Number(elasticStiffness),
                restLengthMm: Number(restLength),
              },
      };
    });
    perform(
      actions,
      elasticLaw === 'constant'
        ? 'Connect the anchor with the displayed total tension'
        : 'Connect the anchor using the displayed spring law',
    );
  };
  const selectedResults = result?.teeth.filter(item => p.selectedIds.includes(item.id)) || [];
  const magnitude = (vector: number[]) => Math.hypot(...vector);
  const visibleSection = wire?.section || p.preset.section;
  const selectedSection = WIRE_OPTIONS.findIndex(
    item => JSON.stringify(item.section) === JSON.stringify(visibleSection),
  );
  return (
    <div className="mechanics-panel">
      <div className="mechanics-intro">
        <span className="eyebrow">BUILD AN EXPERIMENT</span>
        <h3>Place. Activate. Compare.</h3>
        <p>Initial elastic response · one unchanged reference.</p>
      </div>
      <fieldset disabled={p.busy}>
        <section className="mechanics-section">
          <div className="mechanics-section-heading">
            <strong>01 · Brackets & wire</strong>
            <span>{Object.keys(config.brackets).length} brackets</span>
          </div>
          <p className="mechanics-target">Selected: {p.selectedIds.join(' · ') || 'none'}</p>
          <div className="mechanics-actions">
            <button
              onClick={() =>
                perform(
                  [{ type: 'brackets', teeth: p.selectedIds, installed: true }],
                  'Install brackets on the selected teeth',
                  false,
                )
              }
            >
              <Plus size={14} />
              Install brackets
            </button>
            <button
              onClick={() =>
                perform(
                  [{ type: 'brackets', teeth: p.selectedIds, installed: false }],
                  'Remove selected brackets',
                  false,
                )
              }
            >
              Remove
            </button>
          </div>
          {config.wires.length > 0 && (
            <label>
              Active wire
              <select
                aria-label="Active mechanical wire"
                value={wire?.id || 'new'}
                onChange={event => {
                  setNewWire(event.target.value === 'new');
                  if (event.target.value !== 'new')
                    p.onFocus({ ...p.focus, wireId: event.target.value });
                }}
              >
                <option value="new">New wire preset</option>
                {config.wires.map(item => (
                  <option value={item.id} key={item.id}>
                    {item.id} · {item.teeth.length} teeth
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Wire material
            <select
              aria-label="Mechanical wire material"
              value={wire?.material || p.preset.material}
              onChange={event =>
                choosePreset({
                  material: event.target.value as WireMaterial,
                  section: visibleSection,
                })
              }
            >
              <option value="stainless-steel">Stainless steel</option>
              <option value="beta-titanium">Beta titanium</option>
            </select>
          </label>
          <label>
            Cross-section
            <select
              aria-label="Mechanical wire cross-section"
              value={selectedSection < 0 ? 'custom' : selectedSection}
              onChange={event =>
                choosePreset({
                  material: wire?.material || p.preset.material,
                  section: WIRE_OPTIONS[Number(event.target.value)].section,
                })
              }
            >
              {selectedSection < 0 && (
                <option value="custom">Custom · {wireSizeLabel(visibleSection)}</option>
              )}
              {WIRE_OPTIONS.map((item, index) => (
                <option key={index} value={index}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <span className="mechanics-small">
            {wireSizeLabel(visibleSection)} · ideal 0.022 × 0.028 in slot
          </span>
          <button
            className="button light mechanics-wide"
            disabled={p.selectedIds.length < 2}
            onClick={() =>
              perform(
                [
                  {
                    type: 'wire',
                    id: uniqueId(
                      'wire',
                      config.wires.map(item => item.id),
                    ),
                    teeth: p.selectedIds,
                    ...p.preset,
                  },
                ],
                'Connect the selected brackets with the visible wire preset',
                false,
              )
            }
          >
            Add wire · {p.preset.material === 'stainless-steel' ? 'steel' : 'beta Ti'} ·{' '}
            {wireSizeLabel(p.preset.section)}
            <ArrowRight size={14} />
          </button>
          {wire && (
            <>
              <div className="mechanics-number-grid">
                <label>
                  Total width activation (mm)
                  <input
                    aria-label="Wire width activation in millimetres"
                    type="number"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={expansion}
                    onChange={event => setExpansion(event.target.value)}
                  />
                </label>
                <label>
                  Relative end twist (°)
                  <input
                    aria-label="Wire end twist in degrees"
                    type="number"
                    min="-20"
                    max="20"
                    step="1"
                    value={twist}
                    onChange={event => setTwist(event.target.value)}
                  />
                </label>
              </div>
              <button
                className="mechanics-wide"
                onClick={() =>
                  perform(
                    [
                      {
                        type: 'wire-activation',
                        id: wire.id,
                        expansionMm: Number(expansion),
                        torqueDeg: Number(twist),
                      },
                    ],
                    'Replace wire activation from the unloaded reference',
                  )
                }
              >
                Set activation
              </button>
              <button
                className="mechanics-wide"
                onClick={() =>
                  perform(
                    [{ type: 'remove', kind: 'wire', id: wire.id }],
                    'Remove this wire',
                    false,
                  )
                }
              >
                Remove this wire
              </button>
            </>
          )}
        </section>
        <details className="mechanics-section">
          <summary>
            02 · TAD & elastic connection <span>{config.tads.length} anchors</span>
          </summary>
          <p>
            Point on the model to place a fixed teaching anchor. Its position is a graphics
            attachment, not a surgical site recommendation.
          </p>
          <button
            className="mechanics-wide"
            disabled={!p.pointed}
            onClick={() =>
              p.pointed &&
              perform(
                [
                  {
                    type: 'tad',
                    id: uniqueId(
                      'tad',
                      config.tads.map(item => item.id),
                    ),
                    position: p.pointed.worldPoint,
                  },
                ],
                'Place a fixed teaching anchor at the indicated point',
                false,
              )
            }
          >
            Place anchor {p.pointed ? `at target ${p.pointed.tooth}` : '— point first'}
          </button>
          {tad && (
            <>
              <label>
                Active anchor
                <select
                  aria-label="Active TAD"
                  value={tad.id}
                  onChange={event => p.onFocus({ ...p.focus, tadId: event.target.value })}
                >
                  {config.tads.map(item => (
                    <option key={item.id}>{item.id}</option>
                  ))}
                </select>
              </label>
              <label>
                New connection law
                <select
                  aria-label="Elastic connection law"
                  value={elasticLaw}
                  onChange={event => setElasticLaw(event.target.value as 'constant' | 'spring')}
                >
                  <option value="constant">Specified constant tension</option>
                  <option value="spring">Tension-only linear spring</option>
                </select>
              </label>
              {elasticLaw === 'constant' ? (
                <>
                  <label>
                    Total tension (N)
                    <input
                      aria-label="Total elastic tension in newtons"
                      type="number"
                      min="0"
                      max="20"
                      step="0.1"
                      value={tension}
                      onChange={event => setTension(event.target.value)}
                    />
                  </label>
                  <p className="mechanics-small">
                    Divided equally among selected attachment points.
                  </p>
                </>
              ) : (
                <>
                  <label>
                    Spring stiffness (N/mm)
                    <input
                      aria-label="Elastic spring stiffness"
                      type="number"
                      min="0.001"
                      max="1000"
                      step="0.01"
                      value={elasticStiffness}
                      onChange={event => setElasticStiffness(event.target.value)}
                    />
                  </label>
                  <label>
                    Unloaded length (mm)
                    <input
                      aria-label="Elastic unloaded length"
                      type="number"
                      min="0"
                      max="200"
                      step="0.1"
                      value={restLength}
                      onChange={event => setRestLength(event.target.value)}
                    />
                  </label>
                  <p className="mechanics-small">
                    Select one tooth. The spring carries tension only when stretched past its
                    unloaded length.
                  </p>
                </>
              )}
              <button
                className="mechanics-wide"
                disabled={
                  !p.selectedIds.length ||
                  p.selectedIds.length > 6 ||
                  (elasticLaw === 'spring' && p.selectedIds.length !== 1) ||
                  p.selectedIds.some(id => !config.brackets[id] && p.pointed?.tooth !== id)
                }
                onClick={connect}
              >
                Connect to selected teeth
              </button>
              <button
                className="mechanics-wide"
                disabled={!result}
                onClick={() =>
                  perform(
                    [{ type: 'compare-without-tad', id: tad.id }],
                    'Compare without the anchor from the same reference',
                    false,
                  )
                }
              >
                What if this TAD is removed?
              </button>
              <button
                className="mechanics-wide"
                onClick={() =>
                  perform(
                    [{ type: 'remove', kind: 'tad', id: tad.id }],
                    'Remove this anchor and its connections',
                    false,
                  )
                }
              >
                Remove anchor & connections
              </button>
            </>
          )}
          {config.elastics.length > 0 && (
            <div className="mechanics-connections">
              <strong>Connections</strong>
              {config.elastics.map(item => (
                <div key={item.id}>
                  <span>
                    {item.id}
                    <small>
                      {item.to.kind === 'tooth' ? `Tooth ${item.to.tooth}` : item.to.id} ·{' '}
                      {item.law.kind === 'constant'
                        ? `${item.law.forceN.toFixed(3)} N`
                        : `${item.law.stiffnessNPerMm} N/mm · ${item.law.restLengthMm} mm unloaded`}
                    </small>
                  </span>
                  <button
                    aria-label={`Remove ${item.id}`}
                    onClick={() =>
                      perform(
                        [{ type: 'remove', kind: 'elastic', id: item.id }],
                        `Remove ${item.id}`,
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </details>
        <details className="mechanics-section">
          <summary>03 · Compliant expansion</summary>
          <p>
            A symmetric virtual spring model. Dental and supporting-spring opening are reported
            separately.
          </p>
          <div className="mechanics-number-grid">
            <label>
              Left teeth (FDI)
              <input
                aria-label="Expander left attachments"
                value={left}
                placeholder="26, 27"
                onChange={event => setLeft(event.target.value)}
              />
            </label>
            <label>
              Right teeth (FDI)
              <input
                aria-label="Expander right attachments"
                value={right}
                placeholder="16, 17"
                onChange={event => setRight(event.target.value)}
              />
            </label>
          </div>
          <label>
            Screw activation (mm)
            <input
              aria-label="Expander activation in millimetres"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={activation}
              onChange={event => setActivation(event.target.value)}
            />
          </label>
          <div className="mechanics-number-grid">
            <label>
              Appliance stiffness (N/mm)
              <input
                type="number"
                min="0.001"
                max="1000"
                value={stiffness}
                onChange={event => setStiffness(event.target.value)}
              />
            </label>
            <label>
              Support spring · optional (N/mm)
              <input
                type="number"
                min="0.001"
                max="1000"
                placeholder="Rigid support"
                value={palate}
                onChange={event => setPalate(event.target.value)}
              />
            </label>
          </div>
          <button
            className="mechanics-wide"
            onClick={() =>
              perform(
                [
                  {
                    type: 'expander',
                    id: config.expanders[0]?.id || 'expander-1',
                    left: left
                      .trim()
                      .split(/[,\s]+/)
                      .filter(Boolean),
                    right: right
                      .trim()
                      .split(/[,\s]+/)
                      .filter(Boolean),
                    activationMm: Number(activation),
                    stiffnessNPerMm: Number(stiffness),
                    ...(palate.trim() ? { palateStiffnessNPerMm: Number(palate) } : {}),
                  },
                ],
                'Set the compliant expansion experiment',
              )
            }
          >
            Set expander configuration
          </button>
          {config.expanders.map(item => (
            <button
              key={item.id}
              className="mechanics-wide"
              onClick={() =>
                perform(
                  [{ type: 'remove', kind: 'expander', id: item.id }],
                  'Remove expander',
                  false,
                )
              }
            >
              Remove {item.id}
            </button>
          ))}
        </details>
        <section className="mechanics-section">
          <label>
            Virtual tooth support
            <select
              aria-label="Virtual tooth support"
              value={config.support}
              onChange={event =>
                perform(
                  [{ type: 'support', preset: event.target.value as typeof config.support }],
                  'Change virtual support stiffness',
                )
              }
            >
              {Object.entries(SUPPORT_PRESETS).map(([id, item]) => (
                <option value={id} key={id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mechanics-actions">
            <button
              onClick={() =>
                perform(
                  [{ type: 'anchor', teeth: p.selectedIds, fixed: true }],
                  'Fix the selected teeth mechanically',
                )
              }
            >
              Fix selected
            </button>
            <button
              onClick={() =>
                perform(
                  [{ type: 'anchor', teeth: p.selectedIds, fixed: false }],
                  'Release the selected mechanical anchors',
                )
              }
            >
              Release
            </button>
          </div>
          {config.fixedTeeth.length > 0 && (
            <span className="mechanics-small">Fixed: {config.fixedTeeth.join(', ')}</span>
          )}
        </section>
        <section className="mechanics-section mechanics-calculate">
          <label className="mechanics-check">
            <input
              type="checkbox"
              checked={p.predict}
              onChange={event => p.onPredict(event.target.checked)}
            />
            Ask students before revealing
          </label>
          <button
            className="button primary mechanics-wide"
            onClick={() =>
              perform([{ type: 'solve' }], 'Calculate the supported initial response', false)
            }
          >
            <Play size={15} />
            Show what happens
          </button>
          {result && !p.revealed && (
            <button className="mechanics-wide" onClick={p.onReveal}>
              Reveal calculated response
            </button>
          )}
          {!result && (
            <p className="mechanics-setup-note">
              Setup only. Brackets and a passive wire do not move teeth. Set an activation, then
              calculate the response.
            </p>
          )}
          {result && p.revealed && (
            <div className="mechanics-actions">
              <button disabled={!hasMechanicsMovement(result.diagnostics)} onClick={p.onReplay}>
                <RotateCcw size={14} />
                Replay response
              </button>
              <button onClick={p.onFrame}>
                <Focus size={14} />
                Focus selection
              </button>
            </div>
          )}
          <label>
            Movement display
            <select
              aria-label="Mechanics display magnification"
              value={p.magnification}
              onChange={event => p.onMagnification(Number(event.target.value))}
            >
              {MECHANICS_DISPLAY_SCALES.map(value => (
                <option key={value} value={value}>
                  {value === 1 ? 'Actual geometric scale' : `Exaggerated ${value}×`}
                </option>
              ))}
            </select>
          </label>
          <p className="mechanics-small">
            Each calculation chooses a bounded lecture scale. Adjust it here; all values and saved
            geometry stay at actual scale.
          </p>
          {result && p.revealed && !hasMechanicsMovement(result.diagnostics) && (
            <p className="mechanics-setup-note">
              No measurable response. Check activation and fixed teeth; the display will not invent
              movement.
            </p>
          )}
          <label className="mechanics-check">
            <input type="checkbox" checked={p.forces} onChange={p.onForces} />
            Show force directions
          </label>
        </section>
        {result && p.revealed && (
          <section className="mechanics-result" aria-label="Calculated mechanics result">
            <span className="eyebrow">CALCULATED INITIAL RESPONSE</span>
            <div className="mechanics-result-values">
              <div>
                <strong>
                  {result.diagnostics.maxDisplacementMm.toFixed(4)}
                  <small> mm</small>
                </strong>
                <span>Largest displacement</span>
              </div>
              <div>
                <strong>
                  {result.diagnostics.maxRotationDeg.toFixed(3)}
                  <small>°</small>
                </strong>
                <span>Largest rotation</span>
              </div>
            </div>
            {comparison && (
              <p>
                Without TAD: {comparison.diagnostics.maxDisplacementMm.toFixed(4)} mm maximum ·
                ghost overlay from the same reference.
              </p>
            )}
            {result.expanders.map(item => (
              <p key={item.id}>
                {item.id}: {item.forceN.toFixed(3)} N · dental opening{' '}
                {item.dentalOpeningMm.toFixed(4)} mm · supporting-spring opening{' '}
                {item.skeletalOpeningMm.toFixed(4)} mm · appliance deflection{' '}
                {item.applianceDeflectionMm.toFixed(4)} mm.
              </p>
            ))}
            {selectedResults.length > 0 && (
              <div className="mechanics-load-table">
                <div>
                  <strong>Tooth</strong>
                  <strong>Force · N</strong>
                  <strong>Moment · N·mm</strong>
                </div>
                {selectedResults.map(item => (
                  <div key={item.id}>
                    <span>
                      {item.id}
                      {item.fixed ? ' · fixed' : ''}
                    </span>
                    <span>{magnitude(item.forceN).toFixed(3)}</span>
                    <span>{magnitude(item.momentNmm).toFixed(3)}</span>
                  </div>
                ))}
                <small>
                  Resultant applied magnitudes about each specified virtual support origin; no
                  biological center is inferred.
                </small>
              </div>
            )}
            {result.elastics.map(item => (
              <p key={item.id}>
                {item.id}: calculated tension {item.forceN.toFixed(3)} N.
              </p>
            ))}
            {result.tads.map(item => (
              <p key={item.id}>
                {item.id}: anchor reaction {magnitude(item.reactionN).toFixed(3)} N.
              </p>
            ))}
            {result.diagnostics.warnings.map(item => (
              <p className="mechanics-warning" key={item}>
                {item}
              </p>
            ))}
            <button className="mechanics-wide" onClick={p.onExplain}>
              Explain the result aloud
            </button>
          </section>
        )}
        <section className="mechanics-section">
          <div className="mechanics-section-heading">
            <strong>Experiment stages</strong>
            <span>{stages.length} saved</span>
          </div>
          {stages.length > 0 && (
            <label>
              Restore configuration
              <select
                aria-label="Saved mechanics stage"
                value={stageIndex}
                onChange={event =>
                  perform(
                    [{ type: 'stage', index: Number(event.target.value) }, { type: 'solve' }],
                    'Restore and calculate a saved stage',
                    false,
                  )
                }
              >
                {stageIndex < 0 && <option value={-1}>Unsaved configuration</option>}
                {stages.map((item, index) => (
                  <option value={index} key={index}>
                    {index + 1} · {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mechanics-actions">
            <input
              aria-label="New experiment stage name"
              placeholder="Name this setup"
              maxLength={80}
              value={stageName}
              onChange={event => setStageName(event.target.value)}
            />
            <button
              disabled={!stageName.trim()}
              onClick={() => {
                perform(
                  [{ type: 'save-stage', label: stageName }],
                  'Save this experiment configuration',
                  false,
                );
                setStageName('');
              }}
            >
              Save
            </button>
          </div>
          <button
            className="mechanics-wide"
            onClick={() =>
              perform([{ type: 'discard' }], 'Return to the unloaded reference', false)
            }
          >
            <RotateCcw size={13} />
            Show unloaded reference
          </button>
        </section>
      </fieldset>
      <details className="mechanics-assumptions">
        <summary>Model assumptions & sources</summary>
        <p>
          {MATERIAL_PRESETS[p.preset.material].label}. Support stiffness:{' '}
          {SUPPORT_PRESETS[config.support].translationNPerMm} N/mm and{' '}
          {SUPPORT_PRESETS[config.support].rotationNmmPerRad} N·mm/rad.
        </p>
        <p>
          Wire curves, force arrows and moment arcs are schematic graphics. Arrow lengths are not a
          force scale.
        </p>
        <p>
          Small deflections; ideal sliding; no friction, tissue remodeling, biological time, NiTi
          hysteresis or patient-specific prediction.
        </p>
        {result?.diagnostics.assumptions.map(item => (
          <p key={item}>{item}</p>
        ))}
        {MECHANICS_SOURCES.map(source => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
            {source.title}
          </a>
        ))}
      </details>
    </div>
  );
}
