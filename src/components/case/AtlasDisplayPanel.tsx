'use client';
import { SlidersHorizontal } from 'lucide-react';
import type { CaseStudioApi } from './api';
import { useDisclosureMenu } from './useDisclosureMenu';
import { useStudioTheme } from '../shared/StudioTheme';
import { JawControl } from './JawControl';
import { supportsJawOpening } from '@/lib/classroom/jaw';

type DisplayApi = Pick<
  CaseStudioApi,
  | 'opening'
  | 'model'
  | 'toothStudy'
  | 'jawOpen'
  | 'setOpening'
  | 'arch'
  | 'setArch'
  | 'view'
  | 'setCamera'
  | 'gums'
  | 'roots'
  | 'labels'
  | 'teaching'
>;

export function AtlasDisplayPanel({ api }: { api: DisplayApi }) {
  const { menuRef, summaryRef } = useDisclosureMenu();
  const { theme, setTheme } = useStudioTheme();
  return (
    <details ref={menuRef} className="atlas-display opening-view-menu">
      <summary ref={summaryRef}>
        <SlidersHorizontal size={16} />
        Display
      </summary>
      <div className="atlas-display-body">
        <h2>Model display</h2>
        <JawControl
          jawAvailable={supportsJawOpening(api.model) && !api.toothStudy}
          jawOpen={api.jawOpen}
          execute={api.teaching.execute}
        />
        <label className="atlas-field">
          <span>
            Separate arches <output>{api.opening} mm</output>
          </span>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={api.opening}
            onChange={event => {
              api.teaching.referenceInteraction();
              api.setOpening(Number(event.target.value));
            }}
          />
        </label>
        <p className="atlas-note">Display spacing for a clearer view.</p>
        <div className="atlas-segment" role="group" aria-label="Visible arches">
          {(['both', 'upper', 'lower'] as const).map(arch => (
            <button
              key={arch}
              type="button"
              aria-pressed={api.arch === arch}
              onClick={() => {
                api.teaching.referenceInteraction();
                api.setArch(arch);
                if (arch === 'both' && api.view === 'occlusal') api.setCamera('perspective');
              }}
            >
              {arch === 'both' ? 'Both' : arch === 'upper' ? 'Upper' : 'Lower'}
            </button>
          ))}
        </div>
        {(
          [
            ['gums', 'Gingiva'],
            ['roots', 'Roots'],
            ['labels', 'Tooth numbers'],
          ] as const
        ).map(([target, label]) => (
          <button
            className="atlas-switch"
            key={target}
            role="switch"
            aria-checked={api[target]}
            onClick={() =>
              void api.teaching.execute(
                [{ kind: 'toggle', target, visible: !api[target] }],
                `${api[target] ? 'Hide' : 'Show'} ${label.toLowerCase()}`,
              )
            }
          >
            <span>{label}</span>
            <i aria-hidden="true" />
          </button>
        ))}
        <h2>Backdrop</h2>
        <div className="atlas-segment" role="group" aria-label="Studio backdrop">
          {(['midnight', 'clinical'] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              {value === 'midnight' ? 'Studio' : 'Clinical'}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
