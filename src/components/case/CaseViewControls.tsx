'use client';
import type { CaseStudioApi } from './api';
import type { ArchView, ViewName } from '../viewer/Viewer';
import { Camera, Eye, Focus, Ruler } from 'lucide-react';
import { LectureViewTools } from '../lecture/LectureViewTools';
import { useDisclosureMenu } from './useDisclosureMenu';

export function CaseViewControls({
  api,
}: {
  api: Pick<
    CaseStudioApi,
    | 'arch'
    | 'ghost'
    | 'isolated'
    | 'measureMode'
    | 'pointer'
    | 'sandbox'
    | 'selectedIds'
    | 'setArch'
    | 'setCamera'
    | 'setIsolated'
    | 'setLecture'
    | 'setMeasureMode'
    | 'setMobilePanel'
    | 'setPanel'
    | 'setPointer'
    | 'setTool'
    | 'setToolsOpen'
    | 'stage'
    | 'stages'
    | 'teaching'
    | 'view'
    | 'viewer'
  >;
}) {
  const { menuRef, summaryRef } = useDisclosureMenu();
  return (
    <details ref={menuRef} className="opening-view-menu presentation-view-menu">
      <summary ref={summaryRef} title="Camera and comparison controls">
        <Focus size={16} />
        View
      </summary>
      <div className="opening-view-content">
        {api.selectedIds.length === 1 && (
          <button
            className="button small"
            onClick={() => {
              if (menuRef.current) menuRef.current.open = false;
              void api.teaching.execute(
                [{ kind: 'tooth-study', action: 'open', tooth: api.selectedIds[0] }],
                'Study this tooth',
              );
            }}
          >
            Study this tooth
          </button>
        )}
        <div className="workspace-cameras" role="group" aria-label="Camera views">
          {(['perspective', 'front', 'occlusal', 'right', 'left'] as ViewName[]).map(v => (
            <button
              key={v}
              className={api.view === v ? 'active' : ''}
              onClick={() => {
                api.teaching.referenceInteraction();
                api.setCamera(v);
              }}
              aria-pressed={api.view === v}
            >
              {v === 'perspective' ? '3D view' : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="arch-toolbar">
          <div className="segmented">
            {(['both', 'upper', 'lower'] as ArchView[]).map(a => (
              <button
                key={a}
                className={api.arch === a ? 'active' : ''}
                onClick={() => {
                  api.teaching.referenceInteraction();
                  api.setArch(a);
                  if (a === 'both' && api.view === 'occlusal') api.setCamera('perspective');
                }}
                aria-pressed={api.arch === a}
              >
                {a === 'both' ? (
                  <>
                    <span className="arch-button-full">Both arches</span>
                    <span className="arch-button-short">Both</span>
                  </>
                ) : (
                  `${a[0].toUpperCase()}${a.slice(1)}`
                )}
              </button>
            ))}
          </div>
          <div className="comparison-strip">
            <button
              className={api.stage === 0 ? 'active' : ''}
              onClick={() =>
                void api.teaching.execute(
                  [{ kind: 'comparison', mode: 'before' }],
                  'Show the edit start',
                )
              }
            >
              Before
            </button>
            <button
              className={api.stage === api.stages && !api.ghost ? 'active' : ''}
              onClick={() =>
                void api.teaching.execute(
                  [{ kind: 'comparison', mode: 'after' }],
                  'Show the endpoint',
                )
              }
            >
              After
            </button>
            <button
              className={api.ghost ? 'active' : ''}
              aria-pressed={api.ghost}
              disabled={!!api.sandbox.pending}
              onClick={() =>
                void api.teaching.execute(
                  [{ kind: 'comparison', mode: api.ghost ? 'off' : 'overlay' }],
                  api.ghost ? 'Hide original overlay' : 'Compare with the original',
                )
              }
            >
              <Eye size={13} />
              Overlay
            </button>
          </div>
          <button
            className={`measure-tool ${api.measureMode ? 'active' : ''}`}
            onClick={() => {
              api.teaching.interact();
              api.setLecture(false);
              if (menuRef.current) menuRef.current.open = false;
              api.setMeasureMode(!api.measureMode);
              api.setTool('orbit');
              api.setToolsOpen(true);
              api.setPanel('analysis');
              api.setMobilePanel('tools');
            }}
            aria-pressed={api.measureMode}
          >
            <Ruler size={14} />
            Measure
          </button>
        </div>
        <LectureViewTools
          isolated={api.isolated}
          pointer={api.pointer}
          onIsolate={() => api.setIsolated(!api.isolated)}
          onPointer={() => api.setPointer(!api.pointer)}
          onFocus={() => {
            api.teaching.referenceInteraction();
            api.viewer.current?.focus();
          }}
          onFit={() => {
            api.teaching.referenceInteraction();
            api.viewer.current?.fit();
          }}
        />

        <button className="button small" onClick={() => api.viewer.current?.snapshot()}>
          <Camera size={16} />
          Export 3D image
        </button>
      </div>
    </details>
  );
}
