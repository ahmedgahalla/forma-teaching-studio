'use client';
import { useEffect, useState } from 'react';
import { hasMechanicsActivation } from '@/lib/mechanics/bracket-wire';
import type { MechanicsAction, MechanicsExperiment } from '@/lib/mechanics/types';

export function WireActivationControl({
  experiment,
  wire,
  onActions,
}: {
  experiment: MechanicsExperiment;
  wire: MechanicsExperiment['config']['wires'][number];
  onActions: (actions: MechanicsAction[], summary: string) => void;
}) {
  const [expansion, setExpansion] = useState(String(wire.expansionMm));
  const [twist, setTwist] = useState(String(wire.torqueDeg));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the draft after Undo or external activation changes
    setExpansion(String(wire.expansionMm));
    setTwist(String(wire.torqueDeg));
  }, [wire.id, wire.expansionMm, wire.torqueDeg]);
  const activate = () => {
    const action: MechanicsAction = {
      type: 'wire-activation',
      id: wire.id,
      expansionMm: Number(expansion),
      torqueDeg: Number(twist),
    };
    const config = {
      ...experiment.config,
      wires: experiment.config.wires.map(item =>
        item.id === wire.id
          ? { ...item, expansionMm: action.expansionMm, torqueDeg: action.torqueDeg! }
          : item,
      ),
    };
    onActions(
      experiment.result && hasMechanicsActivation(config, experiment.reference.teeth)
        ? [action, { type: 'solve' }]
        : [action],
      'Replace wire activation from the unloaded reference',
    );
  };
  return (
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
      <button className="mechanics-wide" onClick={activate}>
        Set activation
      </button>
    </>
  );
}
