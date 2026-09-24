'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Box, Check, ChevronDown, Eye, Layers3, Lightbulb, MousePointer2, Pause, Play, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import './studio-experience.css';

export type CaseDiagramKind = 'crowding' | 'spacing' | 'crossbite' | 'overjet' | 'overbite' | 'open-bite' | 'midline' | 'rotation' | 'expansion' | 'braces' | 'anatomy' | 'translation' | 'tipping' | 'retention';
export type TeachingCaseCard = {
  id: string;
  title: string;
  description: string;
  category: string;
  diagram?: CaseDiagramKind;
  concepts?: string[];
  variantCount?: number;
};
export type TeachingCaseLibraryProps = {
  cases: TeachingCaseCard[];
  onChoose: (id: string) => void;
  selectedId?: string;
  disabled?: boolean;
};

/** Small schematic thumbnails explain the topic; they are not patient images. */
function CaseDiagram({ kind = 'braces' }: { kind?: CaseDiagramKind }) {
  const side = ['overjet', 'overbite', 'open-bite'].includes(kind);
  const single = ['anatomy', 'translation', 'tipping'].includes(kind);
  return <svg viewBox="0 0 240 132" className={`case-diagram diagram-${kind}`} aria-hidden="true" focusable="false">
    <path className="diagram-guide" d="M20 108H220M120 14V118" />
    {single ? <>
      <path className="diagram-bone" d="M80 57L83 113H157L160 57L144 60L140 104H100L96 60Z" />
      <path className="diagram-ligament" d="M99 59L107 101Q120 123 133 101L141 59" />
      <g transform={kind === 'translation' ? 'translate(12 0)' : kind === 'tipping' ? 'rotate(-16 120 52)' : undefined}>
        <path className="diagram-tooth" d="M99 61L108 99Q120 118 132 99L141 61V32Q120 23 99 32Z" />
        <path className="diagram-root-line" d="M99 61Q120 67 141 61" />
      </g>
      {kind === 'anatomy' ? <><path className="diagram-gum" d="M77 59Q89 45 100 58M140 58Q151 45 163 59" /><path className="diagram-callout" d="M147 80H187M144 41H184" /><circle className="diagram-dot" cx="147" cy="80" r="3" /><circle className="diagram-dot" cx="144" cy="41" r="3" /></> : <path className="diagram-arrow" d={kind === 'translation' ? 'M77 45H94M89 40L94 45L89 50' : 'M155 24Q183 40 163 61M164 53L163 61L171 61'} />}
    </> : side ? <>
      <path className="diagram-gum" d="M53 36H188M53 106H188" />
      {[0, 1, 2, 3, 4].map(index => {
        const x = 64 + index * 24, upperY = kind === 'open-bite' && index > 1 && index < 4 ? 25 : 34;
        const lowerY = kind === 'overbite' ? 63 : kind === 'open-bite' ? 84 : 77;
        return <g key={index}><rect className={`diagram-tooth ${index === 3 ? 'diagram-highlight' : ''}`} x={x} y={upperY} width="21" height="31" rx="6" /><rect className="diagram-tooth diagram-secondary" x={x + (kind === 'overjet' ? -14 : 0)} y={lowerY} width="21" height="29" rx="6" /></g>;
      })}
      <path className="diagram-arrow" d={kind === 'overjet' ? 'M142 71H168M147 67L142 71L147 75M163 67L168 71L163 75' : 'M195 58V84M191 63L195 58L199 63M191 79L195 84L199 79'} />
    </> : <>
      <path className="diagram-arch" d="M57 104C51 5 189 5 183 104" />
      {Array.from({ length: 12 }, (_, index) => {
        const angle = Math.PI * (.05 + .9 * index / 11);
        const front = index >= 4 && index <= 7;
        let x = 120 - 66 * Math.cos(angle), y = 104 - 65 * Math.sin(angle), rotate = (angle * 180 / Math.PI) - 90;
        if (kind === 'crowding' && front) { y += index % 2 ? 6 : -5; rotate += index % 2 ? 24 : -24; }
        if (kind === 'spacing' && front) x += index < 6 ? -7 : 7;
        if (kind === 'rotation' && index === 5) rotate += 46;
        if (kind === 'crossbite' && index < 3) x += 12;
        if (kind === 'midline' && front) x += 8;
        const highlighted = ['expansion', 'crossbite'].includes(kind) ? index < 3 || index > 8 : front;
        return <g key={index} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotate.toFixed(2)})`}><rect className={`diagram-tooth ${highlighted ? 'diagram-highlight' : ''}`} x="-8" y="-11" width="16" height="22" rx="5" />{kind === 'braces' && <rect className="diagram-bracket" x="-4" y="-3" width="8" height="6" rx="1.5" />}{kind === 'retention' && <rect x="-10" y="-13" width="20" height="26" rx="6" stroke="#158f9b" fill="#8dd4dc" fillOpacity=".25" />}</g>;
      })}
      {kind === 'expansion' && <path className="diagram-arrow" d="M110 82H78M83 77L78 82L83 87M130 82H162M157 77L162 82L157 87" />}
      {kind === 'spacing' && <path className="diagram-arrow" d="M105 22H116M111 18L116 22L111 26M135 22H124M129 18L124 22L129 26" />}
      {kind === 'midline' && <path className="diagram-arrow" d="M140 17H124M129 13L124 17L129 21" />}
      {kind === 'rotation' && <path className="diagram-arrow" d="M102 17Q119 13 122 29M118 24L122 29L127 24" />}
      {kind === 'braces' && <path className="diagram-wire" d="M54 95C51 21 189 21 186 95" />}
    </>}
  </svg>;
}

export function TeachingCaseLibrary({ cases, onChoose, selectedId, disabled = false }: TeachingCaseLibraryProps) {
  const searchId = useId(), [query, setQuery] = useState(''), [category, setCategory] = useState('All cases');
  const categories = useMemo(() => ['All cases', ...new Set(cases.map(item => item.category))], [cases]);
  const results = cases.filter(item => (category === 'All cases' || item.category === category) && `${item.title} ${item.description} ${item.category} ${item.concepts?.join(' ') || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="teaching-case-library" aria-label="Teaching case library">
    <div className="case-library-intro"><div><span className="experience-eyebrow"><BookOpen size={14} />THE TEACHING COLLECTION</span><h2>Start with a question.<br />Explore it in 3D.</h2><p>Choose a prepared example, compare variations, then make the arrangement your own.</p></div><span className="case-library-count"><strong>{cases.length.toString().padStart(2, '0')}</strong><span>synthetic<br />teaching cases</span></span></div>
    <div className="case-library-toolbar"><label className="case-library-search" htmlFor={searchId}><Search size={18} /><input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a case or concept…" autoComplete="off" /><span className="experience-sr-only">Search teaching cases</span></label><span className="case-results" aria-live="polite">{results.length} {results.length === 1 ? 'case' : 'cases'}</span></div>
    <div className="case-library-filters" role="group" aria-label="Filter cases by topic">{categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="teaching-case-grid">{results.map((item, index) => <button key={item.id} type="button" className={`teaching-case-card ${selectedId === item.id ? 'is-current' : ''}`} onClick={() => onChoose(item.id)} disabled={disabled} aria-current={selectedId === item.id ? 'true' : undefined}>
      <div className="case-card-visual"><span className="case-card-index">{String(cases.findIndex(value => value.id === item.id) + 1 || index + 1).padStart(2, '0')}</span><CaseDiagram kind={item.diagram} /><span className="case-card-kind">{item.category}</span>{selectedId === item.id && <span className="case-card-current"><Check size={12} />Open</span>}</div>
      <div className="case-card-content"><h3>{item.title}</h3><p>{item.description}</p><div className="case-card-footer"><span>{item.variantCount ? `${item.variantCount} variations` : item.concepts?.[0] || 'Interactive example'}</span><ArrowRight size={17} /></div></div>
    </button>)}</div>
    {!results.length && <div className="case-library-empty"><Search size={25} /><h3>No matching cases</h3><p>Try a shorter search, or view the full collection.</p><button type="button" onClick={() => { setQuery(''); setCategory('All cases'); }}>Show all cases</button></div>}
    <div className="case-library-note"><Box size={17} /><p>Every case uses synthetic geometry for teaching. Variations illustrate movement, not a treatment recommendation.</p></div>
  </section>;
}

export type CaseScenarioPanelProps = {
  showPlayback?: boolean;
  title: string; description: string; category?: string; observe?: string;
  question: string; answer: string; answerVisible: boolean; onToggleAnswer: () => void;
  variants: { id: string; label: string; description?: string }[];
  variantId: string; onVariantChange: (id: string) => void;
  progress: number; playing: boolean; speed: .5 | 1 | 2; compare: boolean;
  onProgressChange: (value: number) => void; onSpeedChange: (value: .5 | 1 | 2) => void;
  onTogglePlaying: () => void; onReset: () => void; onCompare: () => void; onExplore: () => void;
  disabled?: boolean; edited?: boolean; onReturn?: () => void;
};

export function CaseScenarioPanel(props: CaseScenarioPanelProps) {
  const { title, description, category, observe, question, answer, answerVisible, variants, variantId, progress, playing, speed, compare, disabled = false, edited = false } = props;
  const answerId = useId(), variant = variants.find(item => item.id === variantId);
  const percentage = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return <section className="case-scenario-panel" aria-label={`${title} teaching controls`}>
    <div className="scenario-heading"><span className="scenario-icon"><BookOpen size={19} /></span><div><span className="experience-eyebrow">{edited ? 'FREE EXPLORATION' : `${category || 'PREPARED CASE'} · GUIDED EXAMPLE`}</span><h3>{title}</h3></div></div>
    <p className="scenario-description">{description}</p>
    {variants.length > 0 && <fieldset className="scenario-variants" disabled={disabled || edited}><legend>Compare an approach</legend><div>{variants.map(item => <button type="button" key={item.id} aria-pressed={variantId === item.id} onClick={() => props.onVariantChange(item.id)}>{variantId === item.id && <Check size={13} />}{item.label}</button>)}</div>{variant?.description && <p>{variant.description}</p>}</fieldset>}
    {props.showPlayback !== false && <div className="scenario-playback"><div className="scenario-playback-heading"><span>{edited ? 'Current variation' : 'Prepared movement'}</span><strong>{percentage}<small>%</small></strong></div><input type="range" min="0" max="1" step="0.01" value={Math.max(0, Math.min(1, progress))} aria-label="Prepared case movement progress" aria-valuetext={`${percentage} percent`} disabled={disabled || edited} onChange={event => props.onProgressChange(Number(event.target.value))} /><div className="scenario-range-labels"><span>Starting arrangement</span><span>Illustrated endpoint</span></div><div className="scenario-playback-actions"><button type="button" className="scenario-play" disabled={disabled || edited} onClick={props.onTogglePlaying}>{playing ? <Pause size={15} /> : <Play size={15} />}<span>{playing ? 'Pause' : progress >= 1 ? 'Replay' : 'Play'}</span></button><label className="scenario-speed"><span>Speed</span><select value={speed} disabled={disabled || edited} onChange={event => props.onSpeedChange(Number(event.target.value) as .5 | 1 | 2)}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><button type="button" className="scenario-reset" disabled={disabled || edited} onClick={props.onReset} aria-label="Reset prepared case progress"><RotateCcw size={15} /><span>Reset</span></button></div></div>}
    {observe && <div className="scenario-observe"><Eye size={17} /><p><strong>Watch for</strong>{observe}</p></div>}
    <div className="scenario-question"><span className="experience-eyebrow"><Lightbulb size={14} />ASK THE CLASS</span><p>{question}</p><button type="button" aria-expanded={answerVisible} aria-controls={answerId} onClick={props.onToggleAnswer}>{answerVisible ? 'Hide explanation' : 'Reveal explanation'}<ChevronDown size={16} /></button><div id={answerId} hidden={!answerVisible} className="scenario-answer">{answer}</div></div>
    <div className="scenario-footer"><button type="button" className="scenario-compare" aria-pressed={compare} disabled={disabled} onClick={props.onCompare}><Eye size={16} />{compare ? 'Hide original' : 'Compare original'}</button>{edited ? <button type="button" className="scenario-explore" disabled={disabled || !props.onReturn} onClick={props.onReturn}>Return to prepared case<RotateCcw size={16} /></button> : <button type="button" className="scenario-explore" disabled={disabled} onClick={props.onExplore}>Explore this arrangement<ArrowRight size={16} /></button>}<p>{edited ? 'These edits are a free variation. Return to the prepared case to compare its approaches.' : 'Open the shown arrangement in Try Mode. The prepared case stays available.'}</p></div>
  </section>;
}

export type MobileStudioPanel = 'model' | 'selection' | 'layers' | 'tools';
export function MobileStudioDock({ activePanel, onChange, onStop }: { activePanel: MobileStudioPanel; onChange: (panel: MobileStudioPanel) => void; onStop?: () => void }) {
  return <nav className="mobile-studio-dock" aria-label="Workspace panels">{([
    ['model', 'Model', Box], ['selection', 'Select', MousePointer2], ['layers', 'Layers', Layers3], ['tools', 'Tools', SlidersHorizontal],
  ] as const).map(([panel, label, Icon]) => <button key={panel} type="button" aria-pressed={activePanel === panel} onClick={() => onChange(panel === activePanel ? 'model' : panel)}><Icon size={20} /><span>{label}</span></button>)}{onStop && <button type="button" className="mobile-dock-stop" onClick={onStop}><span className="stop-glyph" /><span>Stop</span></button>}</nav>;
}

export function MobilePanelHeading({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="mobile-panel-heading"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()} panel`}><X size={20} /></button></div>;
}
