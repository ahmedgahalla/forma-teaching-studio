'use client';
import type { ApplianceDisplay } from '@/lib/appliance-display';
import './appliance-palette.css';

export type AppliancePaletteProps = {
  value: ApplianceDisplay;
  onChange: (value: ApplianceDisplay) => void;
  available: boolean;
  busy?: boolean;
};

const OPTIONS: { preset: ApplianceDisplay['preset']; label: string; detail: string }[] = [
  { preset: 'none', label: 'None', detail: 'Teeth without hardware' },
  { preset: 'brackets', label: 'Brackets', detail: 'Bracket bodies only' },
  { preset: 'braces', label: 'Brackets + wire', detail: 'Wire and ligatures included' },
  { preset: 'expander-bands', label: 'Molar bands', detail: 'Upper teeth 16 and 26' },
  { preset: 'palatal-expander', label: 'Palatal expander', detail: 'Bands, arms and screw' },
  { preset: 'retainer', label: 'Lingual retainer', detail: 'Behind the front teeth' },
];

export function AppliancePalette({ value, onChange, available, busy = false }: AppliancePaletteProps) {
  const expander = value.preset === 'expander-bands' || value.preset === 'palatal-expander';
  return <section className="appliance-palette" aria-label="Appliance display">
    <div className="appliance-palette-heading"><strong>Appliances</strong><span>Visual only</span></div>
    <fieldset disabled={busy} className="appliance-palette-options"><legend className="sr-only">Choose appliance appearance</legend>
      {OPTIONS.filter(option => available || option.preset === 'none' || option.preset === 'braces').map(option => <button type="button" key={option.preset} aria-pressed={value.preset === option.preset} onClick={() => onChange({ ...value, preset: option.preset })}><strong>{option.label}</strong><small>{option.detail}</small></button>)}
    </fieldset>
    {available && expander && <div className="appliance-expander-settings">
      <label className="appliance-palate-toggle"><input type="checkbox" disabled={busy} checked={value.palate} onChange={event => onChange({ ...value, palate: event.target.checked })} /><span>Show schematic palate halves</span></label>
      {(value.preset === 'palatal-expander' || value.palate) && <label className="appliance-opening"><span>Illustration opening</span><output>{Math.round(value.progress * 100)}%</output><input type="range" min="0" max="1" step="0.05" value={value.progress} disabled={busy} onChange={event => onChange({ ...value, progress: Number(event.target.value) })} /></label>}
      <p>The expander is upper only. This opening changes the illustration, not tooth positions or measured screw activation. Palate halves are a diagram, not bone movement.</p>
    </div>}
    {available && value.preset === 'retainer' && <p>The retainer follows the front teeth of each visible arch.</p>}
    {!available && <p>Imported models can show ordinary braces on calibrated teeth. Other appliance illustrations require the synthetic demo.</p>}
    <p>Hardware follows the displayed teeth. It does not calculate forces or move teeth, and it is not included in STL exports. Lesson force arrows are omitted here.</p>
  </section>;
}

export default AppliancePalette;
