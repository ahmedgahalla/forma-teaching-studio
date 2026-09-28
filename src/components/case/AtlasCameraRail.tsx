'use client';
import type { CaseStudioApi } from './api';
import type { ArchView, ViewName } from '../viewer/Viewer';

type CameraApi = Pick<CaseStudioApi, 'view' | 'arch' | 'setCamera' | 'setArch' | 'teaching'>;
const VIEWS: { label: string; view: ViewName; arch?: ArchView }[] = [
  { label: 'Front', view: 'front' },
  { label: 'Left', view: 'left' },
  { label: 'Right', view: 'right' },
  { label: 'Upper', view: 'occlusal', arch: 'upper' },
  { label: 'Lower', view: 'occlusal', arch: 'lower' },
  { label: '¾', view: 'perspective', arch: 'both' },
];

export function AtlasCameraRail({ api }: { api: CameraApi }) {
  return (
    <div className="atlas-camera-rail" role="group" aria-label="Camera views">
      {VIEWS.map(({ label, view, arch }) => (
        <button
          key={label}
          type="button"
          aria-label={label === '¾' ? 'Three-quarter view' : `${label} view`}
          aria-pressed={api.view === view && (!arch || api.arch === arch)}
          onClick={() => {
            api.teaching.referenceInteraction();
            api.setCamera(view);
            if (arch) api.setArch(arch);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
