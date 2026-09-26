'use client';
import type { CaseStudioApi } from './api';
import { OpeningCommandDock } from './OpeningCommandDock';
import { TeachingCommandBar } from '../teaching/TeachingController';
import { wireSizeLabel } from '../mechanics/MechanicsPanel';
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
          <div className={`lecture-stage${api.toothStudy ? ' tooth-study-workspace' : ''}`}>
            <CaseViewport api={api} />
            <CaseLectureOverlay api={api} />
          </div>
          <CaseStageDock api={api} />
        </div>
        <OpeningCommandDock
          open={api.commandsOpen}
          onOpenChange={api.setCommandsOpen}
          playing={api.playing}
          notice={api.statusError ? api.status : undefined}
        >
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
            showUndo={false}
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
        </OpeningCommandDock>
      </main>
    </>
  );
}
