'use client';
import { getToothAnatomy, hasToothAnatomy } from '@/lib/tooth-anatomy';
import type { CaseStudioApi } from './api';

type InspectorApi = Pick<
  CaseStudioApi,
  | 'selectedIds'
  | 'selected'
  | 'tooth'
  | 'teaching'
  | 'viewer'
  | 'isolated'
  | 'setIsolated'
  | 'model'
>;

export function AtlasToothInspector({ api }: { api: InspectorApi }) {
  const anatomy =
    api.selectedIds.length === 1 && hasToothAnatomy(api.selected)
      ? getToothAnatomy(api.selected)
      : null;
  return (
    <aside className="atlas-tooth-inspector" aria-label="Selected tooth">
      <span className="atlas-inspector-kicker">
        {anatomy ? `FDI ${anatomy.id}` : `${api.selectedIds.length} teeth selected`}
      </span>
      <h2>
        {anatomy?.name || (api.selectedIds.length === 1 ? api.tooth.name : 'Explore together')}
      </h2>
      {anatomy && (
        <>
          <p className="atlas-note">
            {anatomy.arch === 'upper' ? 'Maxillary' : 'Mandibular'} · patient’s {anatomy.side}
          </p>
          <h3>Crown form</h3>
          <p>{anatomy.cusps}</p>
          <h3>Look for</h3>
          <ul>
            {anatomy.features.slice(0, 2).map(feature => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </>
      )}
      <div className="atlas-inspector-actions">
        <button
          type="button"
          onClick={() => {
            api.teaching.referenceInteraction();
            api.viewer.current?.focus();
          }}
        >
          Frame
        </button>
        <button
          type="button"
          aria-pressed={api.isolated}
          onClick={() => {
            api.teaching.referenceInteraction();
            api.setIsolated(!api.isolated);
          }}
        >
          {api.isolated ? 'Show all' : 'Isolate'}
        </button>
        {anatomy && api.model.demo && api.tooth.calibrated && api.tooth.rootGeometry && (
          <button
            type="button"
            onClick={() =>
              void api.teaching.execute(
                [{ kind: 'tooth-study', action: 'open', tooth: anatomy.id }],
                'Study this tooth',
              )
            }
          >
            Study tooth
          </button>
        )}
      </div>
    </aside>
  );
}
