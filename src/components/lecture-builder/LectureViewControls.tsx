'use client';
import { Focus, Maximize } from 'lucide-react';
import type { TeachingAction } from '@/lib/lecture';
import type { ViewName } from '../viewer/Viewer';
import { useDisclosureMenu } from '../case/useDisclosureMenu';
import { JawControl, type JawControlProps } from '../case/JawControl';

export type LectureViewControlsProps = JawControlProps & {
  view: ViewName;
  roots: boolean;
  execute: (actions: TeachingAction[], summary: string) => Promise<void>;
};

export function LectureViewControls({
  view,
  roots,
  execute,
  jawAvailable,
  jawOpen,
}: LectureViewControlsProps) {
  const viewLabel =
    view === 'perspective' ? '3D view' : `${view[0].toUpperCase()}${view.slice(1)} view`;
  const { menuRef, summaryRef } = useDisclosureMenu({ closeOnAction: true });
  return (
    <div className="lecture-view-controls" role="group" aria-label="Lecture model view">
      <details ref={menuRef} className="opening-view-menu">
        <summary
          ref={summaryRef}
          aria-label={`Lecture view controls: ${viewLabel}`}
          title="Change camera or roots. Your view stays between steps."
        >
          <Focus size={16} />
          {viewLabel}
        </summary>
        <div className="opening-view-content">
          <JawControl jawAvailable={jawAvailable} jawOpen={jawOpen} execute={execute} />
          <div className="lecture-view-cameras" role="group" aria-label="Camera views">
            {(['perspective', 'front', 'occlusal', 'right', 'left'] as const).map(camera => (
              <button
                key={camera}
                type="button"
                aria-pressed={view === camera}
                onClick={() =>
                  void execute([{ kind: 'view', view: camera }], `Show ${camera} view`)
                }
              >
                {camera === 'perspective' ? '3D view' : camera[0].toUpperCase() + camera.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={roots}
            onClick={() =>
              void execute(
                [{ kind: 'toggle', target: 'roots', visible: !roots }],
                roots ? 'Hide roots' : 'Show roots',
              )
            }
          >
            {roots ? 'Hide roots' : 'Show roots'}
          </button>
        </div>
      </details>
      <button
        type="button"
        aria-label="Fit model"
        title="Fit visible teeth and appliances"
        onClick={() => void execute([{ kind: 'presentation', action: 'fit-view' }], 'Fit model')}
      >
        <Maximize size={16} />
        Fit
      </button>
    </div>
  );
}
