'use client';
import { useState } from 'react';
import {
  MECHANICS_EXAMPLES,
  mechanicsExampleTargets,
  type MechanicsExampleAction,
} from '@/lib/mechanics-examples/catalog';
import './mechanics-examples.css';

type Props = {
  selected: string;
  availableIds: string[];
  disabled: boolean;
  pending: boolean;
  onLoad: (action: MechanicsExampleAction) => void;
};

export function MechanicsExamples({ selected, availableIds, disabled, pending, onLoad }: Props) {
  const [index, setIndex] = useState(0);
  const [variation, setVariation] = useState(0);
  const example = MECHANICS_EXAMPLES[index],
    variant = example.variants[variation];
  let targets: string[] = [];
  try {
    targets = mechanicsExampleTargets(example.id, selected, availableIds);
  } catch {
    /* Unavailable models cannot load this rig. */
  }
  const command = `Show mechanics example ${example.title} ${variant.label}`;
  return (
    <details className="mechanics-examples">
      <summary>Mechanics examples</summary>
      <p>
        Compare force systems on the current synthetic model. Each example replaces the appliance
        setup; Undo restores it.
      </p>
      <label>
        Example
        <select
          aria-label="Mechanics example"
          value={index}
          onChange={event => {
            setIndex(Number(event.target.value));
            setVariation(0);
          }}
        >
          {MECHANICS_EXAMPLES.map((item, i) => (
            <option key={item.id} value={i}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Variation
        <select
          aria-label="Mechanics variation"
          value={variation}
          onChange={event => setVariation(Number(event.target.value))}
        >
          {example.variants.map((item, i) => (
            <option key={item.id} value={i}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mechanics-example-question">{example.question}</p>
      {example.id === 'wire-play' && (
        <p>
          Larger: 0.019 × 0.025 in. Smaller: 0.017 × 0.025 in. Both use the same total end twist.
        </p>
      )}
      <p>Teeth: {targets.length ? targets.join(', ') : 'required teeth unavailable'}.</p>
      <button
        className="button primary"
        disabled={disabled || pending || !targets.length}
        onClick={() => onLoad({ kind: 'mechanics-example', id: example.id, variant: variant.id })}
      >
        Load and calculate
      </button>
      {pending && <p role="status">Apply or discard the preview first.</p>}
      <p className="mechanics-example-command">Type or say: “{command}”</p>
      <p className="field-hint">
        Initial elastic response only. Anchors and load points are schematic; magnification makes
        small movements visible. Variations share the current unloaded reference, not a treatment
        timeline.
      </p>
    </details>
  );
}
