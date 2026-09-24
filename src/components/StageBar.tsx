'use client';
import { Pause, Play, RotateCcw, Settings2, SkipBack } from 'lucide-react';
type Props = {
  label: string; progress: number; stages: number; playing: boolean; speed: number; canPlay: boolean;
  onPlay: () => void; onProgress: (value: number) => void; onSpeed: (value: number) => void; onStages: (value: number) => void; onReverse: () => void;
  revealed?: boolean; onReveal?: () => void; onExplore?: () => void;
};
export default function StageBar(p: Props) {
  return <section className="classroom-stage-bar" aria-label="Demonstration stage controls">
    <button className="stage-play" aria-label={p.playing ? 'Pause demonstration' : 'Play demonstration'} disabled={!p.canPlay} onClick={p.onPlay}>{p.playing ? <Pause size={17} /> : <Play size={17} />}</button>
    <button className="stage-reset" aria-label="Return to demonstration start" onClick={() => p.onProgress(0)}><SkipBack size={15} /></button>
    <label className="classroom-stage-progress"><span>{p.label}<strong>{Math.round(p.progress * 100)}%</strong></span><input aria-label="Demonstration progress" type="range" min="0" max="1" step="0.005" value={p.progress} disabled={!p.canPlay} onChange={event => p.onProgress(Number(event.target.value))} /></label>
    <span className="classroom-stage-number">{Math.round(p.progress * p.stages)}<small> / {p.stages}</small></span>
    {p.revealed === false && <button className="stage-reveal" onClick={p.onReveal}>Reveal response</button>}
    {p.onExplore && <button className="stage-explore" onClick={p.onExplore}>Explore</button>}
    <details className="stage-options"><summary aria-label="Playback options"><Settings2 size={16} /></summary><div><label>Presentation speed<select aria-label="Playback speed" value={p.speed} onChange={event => p.onSpeed(Number(event.target.value))}><option value="0.5">Slow · 0.5×</option><option value="1">Normal · 1×</option><option value="2">Fast · 2×</option></select></label><label>Display stages<select aria-label="Display stage count" value={p.stages} onChange={event => p.onStages(Number(event.target.value))}>{[...new Set([5, 10, 20, 30, p.stages])].sort((a, b) => a - b).map(n => <option key={n}>{n}</option>)}</select></label><button disabled={!p.canPlay} onClick={p.onReverse}><RotateCcw size={13} />Play in reverse</button><p>Presentation progress. No treatment time is implied.</p></div></details>
  </section>;
}
