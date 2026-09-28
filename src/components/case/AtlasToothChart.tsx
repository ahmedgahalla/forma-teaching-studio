'use client';
import { orderedArchIds, toothArch } from '@/lib/appliances';
import type { CaseStudioApi } from './api';

type ChartApi = Pick<
  CaseStudioApi,
  | 'ids'
  | 'selectedIds'
  | 'selectTooth'
  | 'sandbox'
  | 'toothMoved'
  | 'arch'
  | 'setArch'
  | 'view'
  | 'setCamera'
>;

// Odontogram silhouette language and chart placement follow Claude's Dentition Atlas.
function ToothSymbol({ id }: { id: string }) {
  const n = Number(id[1]);
  const outline =
    n < 3
      ? 'M5 5Q10 2 15 5L14 23Q10 26 6 23Z'
      : n === 3
        ? 'M4 9L10 3L16 9L14 24Q10 27 6 24Z'
        : n < 6
          ? 'M4 6Q10 1 16 6L16 22Q10 28 4 22Z'
          : 'M2 7Q4 2 10 5Q16 2 18 7L17 23Q13 27 10 24Q7 27 3 23Z';
  return (
    <svg viewBox="0 0 20 30" aria-hidden="true">
      <path d={outline} />
      {n > 3 && <path d="M6 12L10 16L14 12M10 16V22" />}
    </svg>
  );
}

export function AtlasToothChart({ api }: { api: ChartApi }) {
  return (
    <div className="atlas-odontogram" role="group" aria-label="Tooth chart, FDI numbering">
      {(['upper', 'lower'] as const).map(arch => (
        <div className={`atlas-chart-row ${arch}`} key={arch}>
          <span>{arch === 'upper' ? 'U' : 'L'}</span>
          {orderedArchIds(api.ids, arch).map(id => (
            <button
              key={id}
              type="button"
              aria-label={`Select tooth ${id}`}
              aria-pressed={api.selectedIds.includes(id)}
              title={`Tooth ${id}${api.sandbox.lockedIds.includes(id) ? ' · locked' : ''}`}
              data-moved={api.toothMoved(id) || undefined}
              onClick={event => {
                const additive = event.shiftKey || event.ctrlKey || event.metaKey;
                if (api.arch !== 'both' && api.arch !== toothArch(id)) {
                  api.setArch(additive ? 'both' : toothArch(id));
                  if (additive && api.view === 'occlusal') api.setCamera('perspective');
                }
                api.selectTooth(id, additive);
              }}
            >
              <ToothSymbol id={id} />
              <span>{id}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
