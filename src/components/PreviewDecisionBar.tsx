'use client';

import { Check, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { TryPreview } from './TryPanel';

export type PreviewDecisionBarProps = {
  pending: TryPreview | null;
  affectedCount?: number;
  busy?: boolean;
  unrestricted?: boolean;
  onApply: () => void;
  onDiscard: () => void;
  onModify: () => void;
};

const REPORT_LABELS: Record<TryPreview['collision'], string> = {
  clear: 'No new intersections detected',
  blocked: 'New intersections detected',
  limited: 'Path check reached its sample limit',
  checking: 'Checking the movement path',
  unchecked: 'Movement path not checked',
};

/** Shares the inspector's eligibility result; applying still runs the engine's validation. */
export function PreviewDecisionBar({ pending, affectedCount, busy = false, unrestricted = false, onApply, onDiscard, onModify }: PreviewDecisionBarProps) {
  const bar = useRef<HTMLElement>(null);
  const visible = !!pending;
  useEffect(() => {
    const element = bar.current, workspace = element?.parentElement;
    if (!element || !workspace) return;
    const measure = () => workspace.style.setProperty('--preview-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); workspace.style.removeProperty('--preview-height'); };
  }, [visible]);
  if (!pending) return null;

  return <section ref={bar} className="preview-decision-bar" aria-label="Movement preview decision" data-status={pending.collision}>
    <div className="preview-decision-summary" role="status" aria-live="polite" aria-atomic="true">
      <span className="preview-decision-eyebrow">Preview · not applied</span>
      <strong>{pending.summary}</strong>
      <div className="preview-decision-report">
        {affectedCount !== undefined && <span>{affectedCount} {affectedCount === 1 ? 'tooth' : 'teeth'} affected · </span>}
        <span>{REPORT_LABELS[pending.collision]}</span>
        <span> · {pending.checkedSteps} sampled {pending.checkedSteps === 1 ? 'position' : 'positions'}</span>
        {pending.collisions !== undefined && pending.collisions > 0 && <span> · {pending.collisions} intersecting {pending.collisions === 1 ? 'pair' : 'pairs'}</span>}
      </div>
      {unrestricted && <span className="preview-decision-unrestricted">Unrestricted illustration · locks still apply</span>}
    </div>
    <div className="preview-decision-actions">
      <button type="button" className="preview-decision-modify" disabled={busy} onClick={onModify}><SlidersHorizontal size={16} aria-hidden="true" />Modify</button>
      <button type="button" className="preview-decision-discard" disabled={busy} onClick={onDiscard}><X size={16} aria-hidden="true" />Discard</button>
      <button type="button" className="preview-decision-apply" disabled={busy || !pending.canApply} onClick={onApply}><Check size={16} aria-hidden="true" />Apply</button>
    </div>
  </section>;
}
