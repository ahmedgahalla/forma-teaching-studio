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
import type { TeacherLectures } from '../lecture-builder/useTeacherLectures';

export function CaseMain({ api, teacher }: { api: CaseStudioApi; teacher?: TeacherLectures }) {
  const customStep = teacher?.document && !teacher.session.exploring;
  return (
    <>
      <main className="main-workspace">
        <div className="workspace-scene">
          {customStep ? (
            <div className="teacher-step-heading">
              <span>{teacher.document!.title}</span>
              <h1>{teacher.document!.steps[teacher.session.index].title}</h1>
            </div>
          ) : (
            <CaseWorkspaceHeading api={api} />
          )}
          {(!customStep || teacher.session.mode === 'prepare') && <CaseArchToolbar api={api} />}
          <div
            className={`lecture-stage${api.toothStudy ? ' tooth-study-workspace' : ''}${api.glossaryId ? ' definition-workspace' : ''}`}
          >
            <CaseViewport api={api} />
            {!customStep && <CaseLectureOverlay api={api} />}
          </div>
          {(!customStep || api.prepared || api.demonstration || api.sandbox.pending) && (
            <CaseStageDock api={api} hideExplore={!!customStep} />
          )}
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
              customStep
                ? ['next step', 'show roots', 'reveal answer', 'show notes']
                : api.sandbox.pending
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
