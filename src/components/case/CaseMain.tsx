'use client';
import type { CaseStudioApi } from './api';
import type { ViewName } from '../Viewer';
import { TeachingCommandBar } from '../TeachingController';
import { wireSizeLabel } from '../MechanicsPanel';
import { CaseWorkspaceHeading } from './CaseWorkspaceHeading';
import { CaseArchToolbar } from './CaseArchToolbar';
import { CaseViewport } from './CaseViewport';
import { CaseLectureOverlay } from './CaseLectureOverlay';
import { CaseStageDock } from './CaseStageDock';

export function CaseMain({ api }: { api: CaseStudioApi }) {
  return (
    <>
      <main className="main-workspace">
        <div className="workspace-scene">
          <CaseWorkspaceHeading api={api} />
          <CaseArchToolbar api={api} />
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
          <div className="lecture-stage">
            <CaseViewport api={api} />
            <CaseLectureOverlay api={api} />
          </div>
          <CaseStageDock api={api} />
        </div>
        <div className="workspace-command-dock">
          {!api.prepared &&
            api.model.demo &&
            api.mechanics &&
            Object.keys(api.mechanics.config.brackets).length > 0 && (
              <div className="command-context-strip">
                <button
                  onClick={() => {
                    api.setToolsOpen(true);
                    api.setPanel('braces');
                    api.setMobilePanel('tools');
                  }}
                >
                  New wire preset ·{' '}
                  {api.wirePreset.material === 'stainless-steel' ? 'Steel' : 'Beta titanium'} ·{' '}
                  {wireSizeLabel(api.wirePreset.section)}
                </button>
                <span>
                  {api.mechanicsFocus.wireId
                    ? `Focus: ${api.mechanicsFocus.wireId}`
                    : 'Point → hold Space → speak'}
                </span>
              </div>
            )}
          <TeachingCommandBar
            suggestions={
              api.sandbox.pending
                ? ['apply preview', 'discard preview']
                : api.prepared
                  ? [
                      'play demonstration',
                      'show roots',
                      'reveal answer',
                      'explore this arrangement',
                    ]
                  : api.mechanics?.result
                    ? [
                        'repeat that more slowly',
                        'show roots',
                        'show displacement traces',
                        'compare with original',
                      ]
                    : api.mechanics?.config.wires.length
                      ? [
                          'activate that wire by 0.5 mm',
                          'show what happens',
                          'show roots',
                          'undo that',
                        ]
                      : api.mechanics && Object.keys(api.mechanics.config.brackets).length
                        ? ['put a wire through these brackets', 'show roots', 'undo that']
                        : [
                            'select upper teeth',
                            'put brackets in top',
                            'show roots',
                            'compare with original',
                          ]
            }
            placeholder={
              api.prepared
                ? 'Try “show roots, then reveal answer”'
                : 'Try “select upper front six, then move them buccally 1 mm”'
            }
            value={api.command}
            onChange={api.setCommand}
            inputRef={api.commandInput}
          />
          {api.statusError && (
            <div className="case-action-status error" role="status">
              {api.status}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
