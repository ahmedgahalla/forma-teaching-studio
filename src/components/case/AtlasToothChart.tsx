'use client';
import type { CSSProperties } from 'react';
import { orderedArchIds, toothArch } from '@/lib/appliances';
import { ATLAS_DIAGRAM_HEIGHT, ATLAS_TOOTH_DIAGRAMS } from '@/lib/atlas-tooth-diagram';
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

// Claude's original crown/root paths, using the bundled atlas dimensions.
function ToothSymbol({ id }: { id: string }) {
  const { md, crown, roots } = ATLAS_TOOTH_DIAGRAMS[id];
  return (
    <svg
      viewBox={`0 0 ${md.toFixed(2)} ${ATLAS_DIAGRAM_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        transform={
          toothArch(id) === 'lower' ? `matrix(1 0 0 -1 0 ${ATLAS_DIAGRAM_HEIGHT})` : undefined
        }
      >
        {roots.map((root, index) => (
          <path className="atlas-chart-root" d={root} key={index} />
        ))}
        <path className="atlas-chart-crown" d={crown} />
      </g>
    </svg>
  );
}

export function AtlasToothChart({ api }: { api: ChartApi }) {
  const hasWisdomTeeth = api.ids.some(id => id.endsWith('8'));
  const slots = Object.keys(ATLAS_TOOTH_DIAGRAMS).filter(id => hasWisdomTeeth || !id.endsWith('8'));
  const width = (id: string) => ({ '--tooth-width': ATLAS_TOOTH_DIAGRAMS[id].md }) as CSSProperties;
  return (
    <div className="atlas-odontogram" role="group" aria-label="Tooth chart, FDI numbering">
      <div className="atlas-chart-grid">
        <span className="atlas-chart-side" title="Patient's right">
          R
        </span>
        <div className="atlas-chart-rows">
          {(['upper', 'lower'] as const).map(arch => {
            const order = orderedArchIds(slots, arch),
              middle = order.length / 2;
            return (
              <div
                className={`atlas-chart-row ${arch}`}
                key={arch}
                role="group"
                aria-label={`${arch === 'upper' ? 'Upper' : 'Lower'} teeth`}
              >
                {[order.slice(0, middle), order.slice(middle)].map((half, side) => (
                  <div className="atlas-chart-half" key={side}>
                    {half.map(id =>
                      api.ids.includes(id) ? (
                        <button
                          className="atlas-chart-tooth"
                          style={width(id)}
                          key={id}
                          type="button"
                          aria-label={`Select tooth ${id}`}
                          aria-pressed={api.selectedIds.includes(id)}
                          title={`Tooth ${id}${api.sandbox.lockedIds.includes(id) ? ' · locked' : ''}`}
                          data-moved={api.toothMoved(id) || undefined}
                          data-off={(api.arch !== 'both' && api.arch !== arch) || undefined}
                          onClick={event => {
                            const additive = event.shiftKey || event.ctrlKey || event.metaKey;
                            if (api.arch !== 'both' && api.arch !== toothArch(id)) {
                              api.setArch(additive ? 'both' : toothArch(id));
                              if (additive && api.view === 'occlusal') api.setCamera('perspective');
                            }
                            api.selectTooth(id, additive);
                          }}
                        >
                          <span className="atlas-chart-number">{id}</span>
                          <ToothSymbol id={id} />
                        </button>
                      ) : (
                        <span
                          className="atlas-chart-tooth"
                          data-tooth-gap={id}
                          style={width(id)}
                          aria-hidden="true"
                          key={id}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <span className="atlas-chart-side" title="Patient's left">
          L
        </span>
      </div>
      <div className="atlas-chart-foot">
        <span>
          {api.selectedIds.length === 1
            ? `Tooth ${api.selectedIds[0]} selected`
            : api.selectedIds.length
              ? `${api.selectedIds.length} teeth selected`
              : 'Dental chart · click a tooth'}
        </span>
        <span>FDI</span>
      </div>
    </div>
  );
}
