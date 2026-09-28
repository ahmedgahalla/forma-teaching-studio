'use client';
import { useId } from 'react';
import {
  BIOLOGY_LIMITS,
  BIOLOGY_SCOPE,
  BIOLOGY_SOURCES,
  BIOLOGY_VIGNETTES,
  type BiologyView,
} from '@/lib/teaching-biology';
import './RemodelingDiagram.css';

export type RemodelingDiagramProps = {
  view: BiologyView;
  onViewChange: (view: BiologyView) => void;
  onClose: () => void;
};

function TissueVignette({ kind }: { kind: 'compression' | 'tension' }) {
  const id = useId();
  const content = BIOLOGY_VIGNETTES[kind];
  const compression = kind === 'compression';
  const rootEdge = compression ? 110 : 72;
  return (
    <figure className={`biology-vignette biology-${kind}`}>
      <figcaption>
        <strong>{content.title}</strong>
        <p>{content.caption}</p>
      </figcaption>
      <svg viewBox="0 0 320 184" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{content.title}: local PDL and bone response</title>
        <desc id={`${id}-description`}>{content.description}</desc>
        <defs>
          <pattern id={`${id}-fibres`} width="12" height="16" patternUnits="userSpaceOnUse">
            <path d="M0 14 L12 2" className="biology-fibre" />
          </pattern>
          <pattern id={`${id}-new-bone`} width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 0 L7 7 M7 0 L0 7" className="biology-deposition" />
          </pattern>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
          </marker>
        </defs>
        <text x="18" y="20">
          Root surface
        </text>
        <text x="132" y="20">
          PDL
        </text>
        <text x="237" y="20">
          Bone
        </text>
        <path
          d={`M18 34 H${rootEdge - 8} Q${rootEdge} 34 ${rootEdge} 44 V138 Q${rootEdge} 148 ${rootEdge - 8} 148 H18 Z`}
          className="biology-root"
        />
        <rect x={rootEdge} y="34" width={182 - rootEdge} height="114" className="biology-pdl" />
        <rect x={rootEdge} y="34" width={182 - rootEdge} height="114" fill={`url(#${id}-fibres)`} />
        {compression ? (
          <>
            <path d="M182 34 H304 V148 H182 V117 Q207 100 182 83 Z" className="biology-bone" />
            <ellipse cx="190" cy="100" rx="12" ry="17" className="biology-osteoclast" />
            {[92, 100, 108].map(y => (
              <circle key={y} cx="190" cy={y} r="2.5" className="biology-nucleus" />
            ))}
            <path
              d="M119 53 H140 M174 53 H153"
              markerEnd={`url(#${id}-arrow)`}
              className="biology-load"
            />
            <path d="M203 100 H245" className="biology-callout" />
          </>
        ) : (
          <>
            <rect x="202" y="34" width="102" height="114" className="biology-bone" />
            <rect x="184" y="34" width="18" height="114" className="biology-new-bone" />
            <rect x="184" y="34" width="18" height="114" fill={`url(#${id}-new-bone)`} />
            {[80, 95, 110, 125].map(y => (
              <circle key={y} cx="178" cy={y} r="5" className="biology-osteoblast" />
            ))}
            <path
              d="M121 53 H91 M138 53 H168"
              markerEnd={`url(#${id}-arrow)`}
              className="biology-load"
            />
            <path d="M185 95 H245" className="biology-callout" />
          </>
        )}
        <text x="209" y="78" className="biology-cell-label">
          {content.cell}
        </text>
        <text x="160" y="175" textAnchor="middle" className="biology-response-label">
          {content.response}
        </text>
      </svg>
    </figure>
  );
}

/** Read-only audience content: no model, solver, playback or mutation callbacks. */
export function BiologyIllustration({
  view,
  audience = false,
}: {
  view: BiologyView;
  audience?: boolean;
}) {
  const kinds = view === 'overview' ? (['compression', 'tension'] as const) : [view];
  return (
    <section className="biology-illustration" aria-label="Illustrative tissue biology">
      <p className="biology-scope">{BIOLOGY_SCOPE}</p>
      <div className="biology-vignettes">
        {kinds.map(kind => (
          <TissueVignette key={kind} kind={kind} />
        ))}
      </div>
      <p className="biology-limits">{BIOLOGY_LIMITS}</p>
      <div className="biology-sources" aria-label="Biology research sources">
        <span>Research:</span>
        {BIOLOGY_SOURCES.map(source =>
          audience ? (
            <span key={source.url} title={source.title}>
              {source.label} · {source.evidence}
            </span>
          ) : (
            <a
              key={source.url}
              href={source.url}
              title={`${source.title} · ${source.evidence}`}
              target="_blank"
              rel="noreferrer"
            >
              {source.label}
            </a>
          ),
        )}
      </div>
    </section>
  );
}

export function RemodelingDiagram({ view, onViewChange, onClose }: RemodelingDiagramProps) {
  return (
    <section className="remodeling-diagram" aria-label="Tissue response explanation">
      <div className="biology-heading">
        <h3>Tissue response</h3>
        <button type="button" onClick={onClose}>
          Close biology
        </button>
      </div>
      <div className="biology-controls" role="group" aria-label="Biology explanation view">
        {(['overview', 'compression', 'tension'] as const).map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => onViewChange(value)}
          >
            {value === 'overview' ? 'Both' : BIOLOGY_VIGNETTES[value].title}
          </button>
        ))}
      </div>
      <BiologyIllustration view={view} />
    </section>
  );
}
