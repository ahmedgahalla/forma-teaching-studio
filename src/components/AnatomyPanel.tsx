'use client';
import { ANATOMY_SOURCE, type AnatomyViewState } from '@/lib/teaching-anatomy';
import './teaching-anatomy.css';

export default function AnatomyPanel({ value, onChange, available, selected }: { value: AnatomyViewState; onChange: (value: AnatomyViewState) => void; available: boolean; selected: string }) {
  const toggle = (key: 'bone' | 'cutaway' | 'ligament') => onChange({ ...value, ...(key === 'cutaway' && !value.cutaway ? { bone: true, ligament: true } : {}), [key]: !value[key] });
  return <section className="anatomy-panel" aria-label="Teaching anatomy">
    <div className="anatomy-panel-heading"><strong>Supporting anatomy</strong><span>Schematic</span></div>
    {!available ? <p>Support tissues are available on the synthetic demo. Imported models use only the supplied anatomy.</p> : <>
      {([['bone', 'Supporting bone'], ['ligament', 'Periodontal ligament'], ['cutaway', `Tooth ${selected} cutaway`]] as const).map(([key, label]) => <button key={key} type="button" className={`anatomy-switch ${value[key] ? 'active' : ''}`} role="switch" aria-checked={value[key]} onClick={() => toggle(key)}><span>{label}</span><span className="anatomy-switch-track"><span /></span></button>)}
      <label className="anatomy-opacity">Bone opacity <output>{Math.round(value.opacity * 100)}%</output><input type="range" min="0" max="100" step="5" value={value.opacity * 100} disabled={!value.bone && !value.cutaway} onChange={event => onChange({ ...value, opacity: Number(event.target.value) / 100 })} /></label>
      <p>Cutaway isolates the selected tooth and reveals its root, gum and socket. Yellow ligament thickness is enlarged for visibility. Supporting tissues stay fixed when the tooth moves.</p>
      <a href={ANATOMY_SOURCE} target="_blank" rel="noreferrer">About tissues supporting teeth · NIDCR ↗</a>
    </>}
  </section>;
}
