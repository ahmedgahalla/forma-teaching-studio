'use client';
import type { CaseStudioApi } from './api';
import { Box, Download, Focus, Ruler } from 'lucide-react';
import { toothArch } from '@/lib/appliances';
import { pretty } from './constants';

export function InspectorAnalysis({ api }: { api: CaseStudioApi }) {
  return (
    <>
      {api.panel === 'analysis' && (
        <div className="analysis-panel">
          <div className="control-heading">
            <Ruler size={16} />
            <h3>Surface landmarks</h3>
          </div>
          <button
            className={`button ${api.measureMode ? 'primary' : 'light'} full-button`}
            onClick={() => api.setMeasureMode(!api.measureMode)}
          >
            {api.measureMode ? 'Finish picking' : 'Pick two crown points'}
            <Ruler size={15} />
          </button>
          <div className="measure-result">
            <strong>
              {api.pointDistance === null ? '—' : api.pointDistance.toFixed(2)}
              <small> mm</small>
            </strong>
            <span>
              {api.landmarks.length === 2
                ? `${api.landmarks[0].tooth} → ${api.landmarks[1].tooth} · shown stage`
                : `${api.landmarks.length}/2 points selected`}
            </span>
            {api.landmarks.length > 0 && (
              <button onClick={() => api.setLandmarks([])}>Clear points</button>
            )}
          </div>
          <p className="field-hint">
            Straight 3D distance between your landmarks. Display arch separation is excluded.
          </p>
          <div className="divider" />
          <div className="control-heading">
            <Focus size={16} />
            <h3>Crown-centre spans</h3>
          </div>
          <div className="span-table">
            {api.spans.map(s => (
              <div key={s.name}>
                <span>
                  {s.name}
                  <small>
                    {s.initial!.toFixed(2)} → {s.final!.toFixed(2)} mm
                  </small>
                </span>
                <strong>
                  {pretty(s.final! - s.initial!)}
                  <small> mm</small>
                </strong>
              </div>
            ))}
          </div>
          <p className="field-hint">Crown-centre distances, not clinical cusp-tip arch widths.</p>
          <div className="measurement">
            <label htmlFor="measure-to">Tooth {api.selected} centre to</label>
            <select
              id="measure-to"
              value={api.measureTo}
              onChange={e => api.setMeasureTo(e.target.value)}
            >
              <option value="">Choose tooth</option>
              {api.model.teeth
                .filter(t => t.id !== api.selected)
                .map(t => (
                  <option key={t.id} value={t.id}>
                    Tooth {t.id}
                  </option>
                ))}
            </select>
            {api.distanceTo !== null && (
              <span className="measurement-result">
                {api.distanceTo.toFixed(2)} mm <small>At final positions</small>
              </span>
            )}
          </div>
          <div className="divider" />
          <div className="control-heading">
            <Box size={16} />
            <h3>Surface intersections</h3>
          </div>
          <button
            className="button light full-button"
            onClick={api.scanContacts}
            disabled={api.checking || !!api.sandbox.pending}
          >
            {api.checking ? 'Checking triangle surfaces…' : 'Check final crown surfaces'}
          </button>
          {api.contacts !== null && (
            <div className="contact-results">
              <strong>{api.contacts.length} intersecting pairs</strong>
              {api.contacts.map(c => (
                <button
                  key={`${c.a}-${c.b}`}
                  onClick={() => {
                    api.setSelectedIds([c.a, c.b]);
                    api.setSelected(c.a);
                    api.setArch(toothArch(c.a) === toothArch(c.b) ? toothArch(c.a) : 'both');
                  }}
                >
                  {c.a} ↔ {c.b}
                </button>
              ))}
            </div>
          )}
          <p className="field-hint">
            Tests triangle-surface crossings at the final pose only. Does not measure clearance,
            containment, gums, roots, bone, or intermediate-stage intersections.
          </p>
          <button className="text-button" onClick={api.csv}>
            <Download size={15} />
            Export movement summary
          </button>
        </div>
      )}
    </>
  );
}
