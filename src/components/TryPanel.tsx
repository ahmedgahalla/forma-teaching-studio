'use client';
import { useEffect, useId, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  CircleHelp,
  Eye,
  LockKeyhole,
  Move3D,
  Rotate3D,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  UnlockKeyhole,
  X,
} from 'lucide-react';
import type { Axis, MovementDirection } from '@/lib/model';
import { TRY_LIMITS, type TryAction } from '@/lib/try-mode';
import './try-mode.css';

export type TryPreview = {
  summary: string;
  collision: 'clear' | 'blocked' | 'limited' | 'checking' | 'unchecked';
  checkedSteps: number;
  collisions?: number;
  canApply: boolean;
  detail?: string;
};
type TryPreviewCardProps = {
  pending: TryPreview;
  unrestricted: boolean;
  onUnrestrictedChange: (enabled: boolean) => void;
  onApply: () => void;
  onDiscard: () => void;
  busy?: boolean;
};
function TryPreviewCard({
  pending,
  unrestricted,
  onUnrestrictedChange,
  onApply,
  onDiscard,
  busy = false,
}: TryPreviewCardProps) {
  const labels = {
    clear: 'No new intersections detected',
    blocked: 'New intersections detected',
    limited: 'Path check reached its sample limit',
    checking: 'Checking the movement path',
    unchecked: 'Movement path not checked',
  };
  return (
    <section className="try-preview" aria-label="Review movement preview">
      <div className="try-preview-heading">
        <span />
        REVIEW PREVIEW
      </div>
      <p>{pending.summary}</p>
      <div className="try-preview-legend">
        Cyan shows the proposed arrangement. Your current arrangement is unchanged until Apply.
      </div>
      <div className={`try-collision ${pending.collision}`} role="status">
        {pending.collision === 'clear' ? <ShieldCheck size={17} /> : <ScanLine size={17} />}
        <div>
          <strong>{labels[pending.collision]}</strong>
          <small>
            {pending.checkedSteps} path {pending.checkedSteps === 1 ? 'position' : 'positions'}{' '}
            checked
            {pending.collisions !== undefined && pending.collisions > 0
              ? ` · ${pending.collisions} intersecting ${pending.collisions === 1 ? 'pair' : 'pairs'}`
              : ''}
            . Sampled geometry check.
          </small>
        </div>
      </div>
      {pending.detail && <div className="try-preview-detail">{pending.detail}</div>}
      {pending.collision === 'limited' && (
        <div className="try-preview-detail">
          Reduce the edit to check a shorter path, or explicitly allow an unrestricted illustration.
        </div>
      )}
      <label className="try-unrestricted">
        <input
          type="checkbox"
          checked={unrestricted}
          disabled={busy}
          onChange={event => onUnrestrictedChange(event.target.checked)}
        />
        <span>
          <strong>Unrestricted illustration</strong>
          <small>
            Allow intersecting geometry for a demonstration. Locked teeth always stay fixed.
          </small>
        </span>
      </label>
      <div className="try-preview-buttons">
        <button type="button" className="try-secondary" disabled={busy} onClick={onDiscard}>
          <X size={16} />
          Discard
        </button>
        <button
          type="button"
          className="try-action"
          disabled={busy || !pending.canApply}
          onClick={onApply}
        >
          <Check size={16} />
          Apply
        </button>
      </div>
    </section>
  );
}

export type TryPanelProps = {
  selectedIds: string[];
  lockedIds: string[];
  pending?: TryPreview | null;
  status?: string;
  statusError?: boolean;
  busy?: boolean;
  unrestricted: boolean;
  onUnrestrictedChange: (enabled: boolean) => void;
  onLock: (ids: string[], locked: boolean) => void;
  onAction: (action: TryAction) => void;
  onApply: () => void;
  onDiscard: () => void;
  hidePreview?: boolean;
  atEndpoint?: boolean;
  calibratedSynthetic?: boolean;
  archTargets?: Record<'upper' | 'lower', { width: number; depth: number }>;
  lastEdit?: { summary: string; amount: number; unit: 'mm' | '°' } | null;
  onReplaceAmount?: (amount: number) => void;
  snapshots?: { id: string; name: string }[];
  comparingId?: string | null;
  onSaveSnapshot?: (name: string) => void;
  onCompareSnapshot?: (id: string | null) => void;
  onRestoreSnapshot?: (id: string) => void;
  groups?: { name: string; teeth: string[] }[];
  onSaveGroup?: (name: string) => void;
  onSelectGroup?: (name: string) => void;
};

const DIRECTIONS: [MovementDirection, string][] = [
  ['buccal', 'Buccal / labial · outward'],
  ['lingual', 'Lingual / palatal · inward'],
  ['mesial', 'Mesial · toward midline'],
  ['distal', 'Distal · away from midline'],
  ['intrude', 'Intrude · toward root'],
  ['extrude', 'Extrude · toward biting edge'],
  ['x', 'Case X'],
  ['y', 'Case Y'],
  ['z', 'Case Z'],
];
const AXES: [Axis, string][] = [
  ['x', 'X · case axis'],
  ['y', 'Y · case axis'],
  ['z', 'Z · case axis'],
];
const finite = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));
const bounded = (value: string, min: number, max: number, nonzero = false) =>
  finite(value) &&
  Number(value) >= min &&
  Number(value) <= max &&
  (!nonzero || Number(value) !== 0);
function Amount({
  label,
  value,
  onChange,
  unit,
  step = '.1',
  min,
  max,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  step?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="try-field">
      <span>{label}</span>
      <span className="try-input-unit">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={event => onChange(event.target.value)}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}

export default function TryPanel(props: TryPanelProps) {
  const {
    selectedIds,
    lockedIds,
    pending,
    busy = false,
    atEndpoint = true,
    onAction,
    archTargets,
    lastEdit,
    snapshots = [],
    groups = [],
  } = props;
  const id = useId();
  const [tab, setTab] = useState<'move' | 'rotate' | 'goals'>('move');
  const [mode, setMode] = useState<'individual' | 'segment'>('individual');
  const [direction, setDirection] = useState<MovementDirection>('buccal'),
    [axis, setAxis] = useState<Axis>('x');
  const [distance, setDistance] = useState('0.5'),
    [degrees, setDegrees] = useState('5');
  const [rotation, setRotation] = useState<'tip' | 'torque' | 'rotate' | 'world'>('tip');
  const [objective, setObjective] = useState<'gap' | 'span' | 'arch'>('gap');
  const [gap, setGap] = useState('0.2'),
    [distribution, setDistribution] = useState<'equal' | 'first' | 'second'>('equal'),
    [span, setSpan] = useState('1');
  const [width, setWidth] = useState('54'),
    [depth, setDepth] = useState('34');
  const [replacement, setReplacement] = useState(''),
    [snapshotName, setSnapshotName] = useState(''),
    [groupName, setGroupName] = useState('');
  const selectedLocked = selectedIds.filter(tooth => lockedIds.includes(tooth));
  const ready = selectedIds.length > 0 && !selectedLocked.length && !busy && !pending && atEndpoint;
  const arches = new Set(selectedIds.map(tooth => (Number(tooth[0]) <= 2 ? 'upper' : 'lower')));
  const arch = arches.size === 1 ? ([...arches][0] as 'upper' | 'lower') : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
    setReplacement(lastEdit ? String(lastEdit.amount) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(phase-2): revisit effect deps; adding them may change behavior
  }, [lastEdit?.amount, lastEdit?.summary]);
  useEffect(() => {
    if (arch && archTargets) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(phase-2): derive this state or move the sync out of the effect
      setWidth(String(archTargets[arch].width));
      setDepth(String(archTargets[arch].depth));
    }
  }, [arch, archTargets]);
  const pair =
    selectedIds.length === 2 ? ([selectedIds[0], selectedIds[1]] as [string, string]) : null;
  const gapMovers = pair
    ? distribution === 'first'
      ? [pair[0]]
      : distribution === 'second'
        ? [pair[1]]
        : pair
    : [];
  const gapReady =
    !!pair &&
    !busy &&
    !pending &&
    atEndpoint &&
    gapMovers.every(tooth => !lockedIds.includes(tooth));
  const validMove = bounded(distance, -TRY_LIMITS.movement, TRY_LIMITS.movement, true);
  const validRotation = bounded(degrees, -TRY_LIMITS.rotation, TRY_LIMITS.rotation, true);
  const validArch =
    bounded(width, TRY_LIMITS.width.min, TRY_LIMITS.width.max) &&
    bounded(depth, TRY_LIMITS.depth.min, TRY_LIMITS.depth.max);
  const previewMovement = () => {
    if (!ready || !validMove) return;
    onAction({
      type: 'preview',
      edit:
        mode === 'segment'
          ? { type: 'segment-translate', teeth: selectedIds, axis, amount: Number(distance) }
          : {
              type: 'dental',
              command: {
                type: 'move_group',
                teeth: selectedIds,
                direction,
                amount: Number(distance),
              },
            },
    });
  };
  const previewRotation = () => {
    if (!ready || !validRotation) return;
    onAction({
      type: 'preview',
      edit:
        mode === 'segment'
          ? { type: 'segment-rotate', teeth: selectedIds, axis, amount: Number(degrees) }
          : {
              type: 'dental',
              command:
                rotation === 'world'
                  ? { type: 'rotate_group', teeth: selectedIds, axis, amount: Number(degrees) }
                  : {
                      type: 'orthodontic',
                      teeth: selectedIds,
                      movement: rotation,
                      amount: Number(degrees),
                    },
            },
    });
  };
  const updateArch = (key: 'width' | 'depth', value: string) => {
    if (key === 'width') setWidth(value);
    else setDepth(value);
    const next = {
      width: Number(key === 'width' ? value : width),
      depth: Number(key === 'depth' ? value : depth),
    };
    if (
      arch &&
      !busy &&
      !pending &&
      finite(value) &&
      next.width >= TRY_LIMITS.width.min &&
      next.width <= TRY_LIMITS.width.max &&
      next.depth >= TRY_LIMITS.depth.min &&
      next.depth <= TRY_LIMITS.depth.max
    )
      onAction({ type: 'set-arch', arch, ...next });
  };
  const segmentOptions = (
    <fieldset>
      <legend>How should the selection move?</legend>
      <div className="try-mode-options">
        {(
          [
            ['individual', 'Per tooth'],
            ['segment', 'Rigid segment'],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name={`${id}-mode`}
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
  const axisControl = (
    <label className="try-field">
      <span>Case axis</span>
      <select value={axis} onChange={event => setAxis(event.target.value as Axis)}>
        {AXES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="try-panel" aria-label="Try Mode editing panel">
      <div>
        <div className="try-heading">
          <h3>Try Mode</h3>
          <span>Explore an arrangement</span>
        </div>
        <p className="try-intro">
          Select teeth, preview a change, then apply it when you’re ready.
        </p>
      </div>
      <div className="try-selection">
        <div className="try-selection-heading">
          <strong>
            {selectedIds.length} {selectedIds.length === 1 ? 'tooth' : 'teeth'} selected
          </strong>
          <span>{lockedIds.length} locked</span>
        </div>
        <div className="try-tooth-chips">
          {selectedIds.map(tooth => (
            <span
              key={tooth}
              className={`try-tooth-chip ${lockedIds.includes(tooth) ? 'locked' : ''}`}
            >
              {lockedIds.includes(tooth) && <LockKeyhole size={10} />}
              {tooth}
            </span>
          ))}
        </div>
        <div className="try-selection-actions">
          <button
            type="button"
            disabled={busy || !selectedIds.length || selectedLocked.length === selectedIds.length}
            onClick={() => props.onLock(selectedIds, true)}
          >
            <LockKeyhole size={13} />
            Lock
          </button>
          <button
            type="button"
            disabled={busy || !selectedLocked.length}
            onClick={() => props.onLock(selectedIds, false)}
          >
            <UnlockKeyhole size={13} />
            Unlock
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              onAction({
                type: 'preview',
                edit: { type: 'dental', command: { type: 'reset', teeth: selectedIds } },
              })
            }
          >
            <RotateCcw size={13} />
            Reset preview
          </button>
        </div>
      </div>
      {!!selectedLocked.length && (
        <p className="try-warning">
          {selectedLocked.length} selected {selectedLocked.length === 1 ? 'tooth is' : 'teeth are'}{' '}
          locked and will stay fixed. A one-sided gap edit can use a locked tooth as its stationary
          partner.
        </p>
      )}
      {!selectedIds.length && (
        <p className="try-warning">Select a tooth in the model or choose a group to begin.</p>
      )}
      {pending && !props.hidePreview && (
        <TryPreviewCard
          pending={pending}
          unrestricted={props.unrestricted}
          onUnrestrictedChange={props.onUnrestrictedChange}
          onApply={props.onApply}
          onDiscard={props.onDiscard}
          busy={busy}
        />
      )}
      {pending && (
        <p className="try-hint">
          Apply or discard the current preview before starting another edit.
          {lastEdit && props.onReplaceAmount ? ' You can still revise its amount below.' : ''}
        </p>
      )}
      {!atEndpoint && (
        <p className="try-warning">Choose After to edit or save the committed endpoint.</p>
      )}
      <div className="try-tabs" role="group" aria-label="Try Mode tools">
        {(
          [
            ['move', 'Move', Move3D],
            ['rotate', 'Rotate', Rotate3D],
            ['goals', 'Objectives', ScanLine],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            type="button"
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      {tab === 'move' && (
        <div className="try-fields">
          {segmentOptions}
          {mode === 'individual' ? (
            <label className="try-field">
              <span>Direction</span>
              <select
                value={direction}
                onChange={event => setDirection(event.target.value as MovementDirection)}
              >
                {DIRECTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            axisControl
          )}
          <Amount
            label="Movement amount"
            value={distance}
            onChange={setDistance}
            unit="mm"
            min={-TRY_LIMITS.movement}
            max={TRY_LIMITS.movement}
          />
          <div className="try-presets" aria-label="Movement amounts">
            {['-1', '-0.5', '0.5', '1'].map(value => (
              <button type="button" key={value} onClick={() => setDistance(value)}>
                {Number(value) > 0 ? '+' : ''}
                {value} mm
              </button>
            ))}
          </div>
          <p className="try-hint">
            {mode === 'individual'
              ? 'Each tooth follows its own calibrated dental direction. Case X, Y and Z stay fixed when you orbit the camera.'
              : 'All selected teeth share one translation. Their spacing and relative orientation stay the same.'}{' '}
            Negative amounts reverse the direction.
          </p>
          <button
            type="button"
            className="try-action"
            disabled={!ready || !validMove}
            onClick={previewMovement}
          >
            Preview movement
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {tab === 'rotate' && (
        <div className="try-fields">
          {segmentOptions}
          {mode === 'individual' && (
            <label className="try-field">
              <span>Rotation</span>
              <select
                value={rotation}
                onChange={event => setRotation(event.target.value as typeof rotation)}
              >
                <option value="tip">Tip · each tooth’s buccal axis</option>
                <option value="torque">Torque · each tooth’s mesial axis</option>
                <option value="rotate">Axial rotation · long axis</option>
                <option value="world">Rotate around a case axis</option>
              </select>
            </label>
          )}
          {(mode === 'segment' || rotation === 'world') && axisControl}
          <Amount
            label="Rotation amount"
            value={degrees}
            onChange={setDegrees}
            unit="°"
            step="1"
            min={-TRY_LIMITS.rotation}
            max={TRY_LIMITS.rotation}
          />
          <p className="try-hint">
            {mode === 'segment'
              ? 'Rotate the whole group around its shared centre and the selected case axis. Spacing within the segment stays fixed.'
              : 'Each tooth rotates about its own crown centre. Roots and attachments follow the crown.'}
          </p>
          <button
            type="button"
            className="try-action"
            disabled={!ready || !validRotation}
            onClick={previewRotation}
          >
            Preview rotation
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {tab === 'goals' && (
        <div className="try-fields">
          <label className="try-field">
            <span>Geometric objective</span>
            <select
              value={objective}
              onChange={event => setObjective(event.target.value as typeof objective)}
            >
              <option value="gap">Close a gap between two teeth</option>
              <option value="span">Change distance between two centres</option>
              <option value="arch">Arrange selection on an arch curve</option>
            </select>
          </label>
          {objective === 'gap' && (
            <>
              {!pair ? (
                <p className="try-warning">Select exactly two teeth to set their projected gap.</p>
              ) : (
                <p className="try-hint">
                  Pair: tooth {pair[0]} and tooth {pair[1]}
                </p>
              )}
              <Amount
                label="Target projected gap"
                value={gap}
                onChange={setGap}
                unit="mm"
                min={0}
                max={TRY_LIMITS.gap}
              />
              <fieldset>
                <legend>Which teeth move?</legend>
                <div className="try-distribution">
                  {(
                    [
                      ['equal', 'Both equally'],
                      ['first', `Only ${pair?.[0] || 'the first tooth'}`],
                      ['second', `Only ${pair?.[1] || 'the second tooth'}`],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name={`${id}-gap`}
                        checked={distribution === value}
                        onChange={() => setDistribution(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="try-hint">
                Uses projected crown bounds along the line joining the pair. Review the contact from
                several views.
              </p>
              <button
                type="button"
                className="try-action"
                disabled={!gapReady || !bounded(gap, 0, TRY_LIMITS.gap)}
                onClick={() => {
                  if (pair)
                    onAction({
                      type: 'preview',
                      edit: {
                        type: 'close-gap',
                        teeth: pair,
                        gap: Number(gap),
                        rule: distribution,
                      },
                    });
                }}
              >
                Preview gap
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {objective === 'span' && (
            <>
              {!pair && (
                <p className="try-warning">
                  Select exactly two teeth to change their crown-centre distance.
                </p>
              )}
              <Amount
                label="Change in crown-centre distance"
                value={span}
                onChange={setSpan}
                unit="mm"
                min={-TRY_LIMITS.span}
                max={TRY_LIMITS.span}
              />
              <p className="try-hint">
                Both teeth move equally along the line joining their centres. Positive spreads them
                apart; negative brings them closer.
              </p>
              <button
                type="button"
                className="try-action"
                disabled={
                  !ready || !pair || !bounded(span, -TRY_LIMITS.span, TRY_LIMITS.span, true)
                }
                onClick={() => {
                  if (pair)
                    onAction({
                      type: 'preview',
                      edit: { type: 'change-width', teeth: pair, amount: Number(span) },
                    });
                }}
              >
                Preview span
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {objective === 'arch' && (
            <>
              {!arch && (
                <p className="try-warning">Choose teeth from a single arch to edit its curve.</p>
              )}
              {!props.calibratedSynthetic && (
                <p className="try-warning">
                  Arch-curve fitting is available for calibrated synthetic teeth.
                </p>
              )}
              <div className="try-field-pair">
                <Amount
                  label="Full curve width"
                  value={width}
                  onChange={value => updateArch('width', value)}
                  unit="mm"
                  min={TRY_LIMITS.width.min}
                  max={TRY_LIMITS.width.max}
                  disabled={busy || !!pending || !props.calibratedSynthetic}
                />
                <Amount
                  label="Curve depth"
                  value={depth}
                  onChange={value => updateArch('depth', value)}
                  unit="mm"
                  min={TRY_LIMITS.depth.min}
                  max={TRY_LIMITS.depth.max}
                  disabled={busy || !!pending || !props.calibratedSynthetic}
                />
              </div>
              <p className="try-hint">
                Selected {arch || ''} tooth centres follow an illustrative arch curve in the case
                X–Z plane. Height and rotation are preserved. Depth is the front-to-centre radius.
              </p>
              <button
                type="button"
                className="try-action"
                disabled={
                  !ready || !arch || !archTargets || !validArch || !props.calibratedSynthetic
                }
                onClick={() => {
                  if (arch)
                    onAction({
                      type: 'preview',
                      edit: { type: 'fit-arch', teeth: selectedIds, arch },
                    });
                }}
              >
                Preview arch arrangement
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      )}
      {lastEdit && props.onReplaceAmount && (
        <div className="try-last-edit">
          <div className="try-section-heading">
            <strong>Adjust the last edit</strong>
            <RotateCcw size={15} />
          </div>
          <p>{lastEdit.summary}</p>
          <Amount
            label="Replace amount"
            value={replacement}
            onChange={setReplacement}
            unit={lastEdit.unit}
          />
          <p className="try-detail">
            Rebuilds that edit from its starting arrangement; it does not add another movement.
          </p>
          <button
            type="button"
            className="try-secondary"
            disabled={busy || !finite(replacement)}
            onClick={() => props.onReplaceAmount?.(Number(replacement))}
          >
            Preview replacement
          </button>
        </div>
      )}
      {(props.onSaveSnapshot ||
        props.onCompareSnapshot ||
        props.onSaveGroup ||
        props.onSelectGroup) && (
        <div className="try-saved">
          {(props.onSaveSnapshot || props.onCompareSnapshot) && (
            <details open>
              <summary>
                <Bookmark size={15} />
                Saved arrangements
              </summary>
              <div className="try-snapshot-tools">
                {props.onSaveSnapshot && (
                  <>
                    <div className="try-name-row">
                      <input
                        aria-label="Arrangement name"
                        value={snapshotName}
                        maxLength={60}
                        placeholder="Name this arrangement"
                        onChange={event => setSnapshotName(event.target.value)}
                      />
                      <button
                        type="button"
                        disabled={busy || !!pending || !atEndpoint || !snapshotName.trim()}
                        onClick={() => {
                          props.onSaveSnapshot?.(snapshotName.trim());
                          setSnapshotName('');
                        }}
                      >
                        Save
                      </button>
                    </div>
                    <p className="try-detail">
                      Saves the committed endpoint.
                      {pending
                        ? ' Apply or discard the preview first.'
                        : !atEndpoint
                          ? ' Choose After before saving.'
                          : ''}
                    </p>
                  </>
                )}
                {props.onCompareSnapshot && (
                  <>
                    <label className="try-field">
                      <span>Compare with</span>
                      <select
                        value={props.comparingId || ''}
                        disabled={busy || !!pending}
                        onChange={event => props.onCompareSnapshot?.(event.target.value || null)}
                      >
                        <option value="">Comparison off</option>
                        <option value="original">Original arrangement</option>
                        {snapshots.map(snapshot => (
                          <option key={snapshot.id} value={snapshot.id}>
                            {snapshot.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {pending && (
                      <p className="try-detail">
                        The candidate uses the overlay during review. Your comparison resumes after
                        Apply or Discard.
                      </p>
                    )}
                  </>
                )}
                {props.onRestoreSnapshot &&
                  props.comparingId &&
                  props.comparingId !== 'original' && (
                    <button
                      type="button"
                      className="try-secondary"
                      disabled={busy || !!pending || !atEndpoint}
                      onClick={() => props.onRestoreSnapshot?.(props.comparingId!)}
                    >
                      <Eye size={14} />
                      Preview saved arrangement
                    </button>
                  )}
              </div>
            </details>
          )}
          {(props.onSaveGroup || props.onSelectGroup) && (
            <details>
              <summary>
                <Move3D size={15} />
                Custom tooth groups
              </summary>
              {props.onSaveGroup && (
                <div className="try-name-row">
                  <input
                    aria-label="Tooth group name"
                    value={groupName}
                    maxLength={60}
                    placeholder="Name this selection"
                    onChange={event => setGroupName(event.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !selectedIds.length || !groupName.trim()}
                    onClick={() => {
                      props.onSaveGroup?.(groupName.trim());
                      setGroupName('');
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
              <div className="try-group-list">
                {groups.map(group => (
                  <button
                    type="button"
                    key={group.name}
                    disabled={busy || !props.onSelectGroup}
                    onClick={() => props.onSelectGroup?.(group.name)}
                  >
                    {group.name}
                    <span>{group.teeth.length} teeth</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {props.status && (
        <p className={`try-status ${props.statusError ? 'error' : ''}`} role="status">
          {props.status}
        </p>
      )}
      <details className="try-help">
        <summary>
          <CircleHelp size={15} />
          What these controls do
        </summary>
        <p>
          Dental directions follow each tooth’s calibrated frame. Case X, Y and Z stay fixed to the
          model when you orbit the camera.
          {props.calibratedSynthetic
            ? ' This synthetic model uses patient left (+X), superior (+Y) and anterior (+Z).'
            : ' Imported case axes depend on the model’s original orientation.'}
        </p>
        <p>
          Per-tooth movement and rigid segments serve different demonstrations. Gap, span and arch
          objectives are geometric approximations, not force calculations or treatment predictions.
          Every change is previewed before it is applied.
        </p>
        <p>
          Intersection checks sample the movement path and do not establish biological safety.
          Unrestricted illustration can allow overlap, but it never overrides tooth locks.
        </p>
      </details>
    </section>
  );
}
