'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { DentalTooth } from '@/lib/geometry';
import type { Vec3 } from '@/lib/model';
import type { MechanicsAction, MechanicsConfig, MechanicsTooth } from '@/lib/mechanics/types';
import { hasMechanicsActivation } from '@/lib/mechanics/bracket-wire';
import { MECHANICS_LIMITS } from '@/lib/mechanics/presets';
import {
  bracketPlacementLocal,
  bracketPlacementOffsets,
  bracketSlotLocal,
} from '@/lib/bracket-placement';
import './bracket-placement.css';

type Props = {
  config: MechanicsConfig;
  referenceTeeth: readonly Pick<MechanicsTooth, 'id' | 'bracketLocal'>[];
  teeth: readonly DentalTooth[];
  selectedIds: readonly string[];
  hasResult: boolean;
  disabled?: boolean;
  onActions: (actions: MechanicsAction[], summary: string) => void;
};
type EditorProps = Pick<
  Props,
  'config' | 'referenceTeeth' | 'hasResult' | 'disabled' | 'onActions'
> & {
  tooth: DentalTooth;
  local: Vec3;
  angle: number;
  wired: boolean;
};
const display = (value: number) => String(Number(value.toFixed(3)));
const draftValue = (value: number) => String(Number(value.toFixed(10)));

function PlacementEditor({
  tooth,
  config,
  referenceTeeth,
  local,
  angle,
  wired,
  hasResult,
  disabled,
  onActions,
}: EditorProps) {
  const [committed] = useState(() => bracketPlacementOffsets(tooth, local));
  const [mesial, setMesial] = useState(() => draftValue(committed.mesialMm));
  const [height, setHeight] = useState(() => draftValue(committed.occlusalMm));
  const [tilt, setTilt] = useState(() => draftValue(angle));
  const [error, setError] = useState('');
  const [mesialEdited, setMesialEdited] = useState(false);
  const [heightEdited, setHeightEdited] = useState(false);
  const [angleEdited, setAngleEdited] = useState(false);
  const limit = MECHANICS_LIMITS.bracketOffsetMm;
  const angleLimit = MECHANICS_LIMITS.bracketAngleDeg;
  const coordinate = (value: number) =>
    Math.abs(Math.abs(value) - limit) < 1e-10 ? Math.sign(value) * limit : value;
  const valid =
    [mesial, height, tilt].every(value => value.trim() && Number.isFinite(Number(value))) &&
    Math.abs(Number(mesial)) <= limit &&
    Math.abs(Number(height)) <= limit &&
    Math.abs(Number(tilt)) <= angleLimit;
  const send = (reset: boolean) => {
    try {
      const next = reset
        ? bracketSlotLocal(tooth)
        : mesialEdited || heightEdited
          ? bracketPlacementLocal(
              tooth,
              mesialEdited ? Number(mesial) : coordinate(committed.mesialMm),
              heightEdited ? Number(height) : coordinate(committed.occlusalMm),
            )
          : local;
      const angleDeg = reset ? 0 : angleEdited ? Number(tilt) : angle;
      const action: MechanicsAction = {
        type: 'bracket-position',
        tooth: tooth.id,
        local: next,
        angleDeg,
      };
      const candidate: MechanicsConfig = {
        ...config,
        brackets: { ...config.brackets, [tooth.id]: next },
        bracketAngles: { ...config.bracketAngles, [tooth.id]: angleDeg },
      };
      onActions(
        hasResult && hasMechanicsActivation(candidate, referenceTeeth)
          ? [action, { type: 'solve' }]
          : [action],
        reset ? `Reset bracket on tooth ${tooth.id}` : `Adjust bracket on tooth ${tooth.id}`,
      );
      setError('');
      if (reset) {
        setMesial('0');
        setHeight('0');
        setTilt('0');
        setMesialEdited(true);
        setHeightEdited(true);
        setAngleEdited(true);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Choose a position on the crown surface.',
      );
    }
  };
  return (
    <>
      <p className="mechanics-small">
        Committed: {display(committed.mesialMm)} mm mesial · {display(committed.occlusalMm)} mm
        height · {display(angle)}° angle
      </p>
      <label>
        Mesial / distal offset (mm)
        <input
          aria-label="Bracket mesial offset in millimetres"
          type="number"
          min={-limit}
          max={limit}
          step="0.1"
          value={mesial}
          disabled={disabled}
          onChange={event => {
            setMesial(event.target.value);
            setMesialEdited(true);
            setError('');
          }}
        />
        <span className="mechanics-small">
          Positive: mesial, toward the dental midline. Negative: distal, away along the arch.
        </span>
      </label>
      <label>
        Height offset (mm)
        <input
          aria-label="Bracket height offset in millimetres"
          type="number"
          min={-limit}
          max={limit}
          step="0.1"
          value={height}
          disabled={disabled}
          onChange={event => {
            setHeight(event.target.value);
            setHeightEdited(true);
            setError('');
          }}
        />
        <span className="mechanics-small">
          Positive: toward the biting edge. Negative: toward the gum.
        </span>
      </label>
      <label>
        Angle on crown (°)
        <input
          aria-label="Bracket angle on crown in degrees"
          type="number"
          min={-angleLimit}
          max={angleLimit}
          step="1"
          value={tilt}
          disabled={disabled}
          onChange={event => {
            setTilt(event.target.value);
            setAngleEdited(true);
            setError('');
          }}
        />
        <span className="mechanics-small">
          In-plane tilt on the crown face, not a wire torque prescription.
        </span>
      </label>
      <p className="mechanics-small">
        Position and tilt change engagement with the reference wire. Calculate to compare.
      </p>
      {!wired && (
        <p className="mechanics-small">
          No wire is attached to this bracket. Placement alone applies no force.
        </p>
      )}
      {!valid && (
        <p role="status">
          Enter offsets from −{limit} to {limit} mm and an angle from −{angleLimit}° to {angleLimit}
          °.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="mechanics-actions">
        <button type="button" disabled={disabled || !valid} onClick={() => send(false)}>
          Apply position
        </button>
        <button type="button" disabled={disabled} onClick={() => send(true)}>
          Reset position & angle
        </button>
      </div>
    </>
  );
}

export function BracketPlacementPanel({
  config,
  referenceTeeth,
  teeth,
  selectedIds,
  hasResult,
  disabled,
  onActions,
}: Props) {
  const tooth =
    selectedIds.length === 1 ? teeth.find(item => item.id === selectedIds[0]) : undefined;
  const local = tooth && config.brackets[tooth.id];
  const angle = tooth ? (config.bracketAngles?.[tooth.id] ?? 0) : 0;
  return (
    <>
      <p className="mechanics-target">Selected: {selectedIds.join(' · ') || 'none'}</p>
      <div className="mechanics-actions">
        <button
          type="button"
          disabled={disabled || !selectedIds.length}
          onClick={() =>
            onActions(
              [{ type: 'brackets', teeth: [...selectedIds], installed: true }],
              'Install brackets on the selected teeth',
            )
          }
        >
          <Plus size={14} />
          Install brackets
        </button>
        <button
          type="button"
          disabled={disabled || !selectedIds.length}
          onClick={() =>
            onActions(
              [{ type: 'brackets', teeth: [...selectedIds], installed: false }],
              'Remove selected brackets',
            )
          }
        >
          Remove
        </button>
      </div>
      {tooth && local ? (
        <details className="mechanics-section bracket-placement">
          <summary>Bracket position · tooth {tooth.id}</summary>
          <PlacementEditor
            key={`${tooth.id}:${tooth.geometry.uuid}:${local.join(',')}:${angle}`}
            tooth={tooth}
            config={config}
            referenceTeeth={referenceTeeth}
            local={local}
            angle={angle}
            wired={config.wires.some(wire => wire.teeth.includes(tooth.id))}
            hasResult={hasResult}
            disabled={disabled}
            onActions={onActions}
          />
        </details>
      ) : (
        <p className="mechanics-small">
          Select one tooth with an installed bracket to adjust its position and angle.
        </p>
      )}
    </>
  );
}
