'use client';
import { useCallback, useState } from 'react';
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
import { lectureStepTitle } from '../lecture-builder/comparison-labels';
import { LectureViewControls } from '../lecture-builder/LectureViewControls';
import { AtlasToothChart } from './AtlasToothChart';
import { AtlasToothInspector } from './AtlasToothInspector';
import { supportsJawOpening } from '@/lib/classroom/jaw';
import { TeacherWorkspace } from '../lecture-builder/TeacherWorkspace';
import { canRunLectureMechanics } from '../lecture-builder/lecture-mechanics';

export function CaseMain({ api, teacher }: { api: CaseStudioApi; teacher?: TeacherLectures }) {
  const customStep = teacher?.document && !teacher.session.exploring;
  const canCalculate =
    !!customStep &&
    canRunLectureMechanics(
      teacher.document!.steps[teacher.session.index],
      teacher.session.comparison,
    );
  const atlasExplore = !customStep && !api.toothStudy && !api.glossaryId && !api.lecture;
  const [hoveredTooth, setHoveredTooth] = useState<{
    id: string;
    model: CaseStudioApi['model'];
    arch: CaseStudioApi['arch'];
  } | null>(null);
  const onHoverTooth = useCallback(
    (id: string | null) => setHoveredTooth(id ? { id, model: api.model, arch: api.arch } : null),
    [api.model, api.arch],
  );
  const hoveredToothId =
    hoveredTooth?.model === api.model && hoveredTooth.arch === api.arch ? hoveredTooth.id : null;
  return (
    <>
      <main className="main-workspace" data-lecture-walkthrough={customStep || undefined}>
        <div className="workspace-scene">
          {customStep ? (
            <div className="teacher-step-heading">
              <div className="teacher-step-title">
                <span>{teacher.document!.title}</span>
                <h1>
                  {lectureStepTitle(
                    teacher.document!.steps[teacher.session.index].title,
                    teacher.session.comparison,
                  )}
                </h1>
              </div>
              <LectureViewControls
                view={api.view}
                roots={api.roots}
                jawAvailable={supportsJawOpening(api.model) && !api.toothStudy}
                jawOpen={api.jawOpen}
                execute={api.teaching.execute}
              />
            </div>
          ) : (
            <CaseWorkspaceHeading api={api} />
          )}
          {!customStep && <CaseArchToolbar api={api} />}
          <div
            className={`lecture-stage${api.toothStudy ? ' tooth-study-workspace' : ''}${api.glossaryId ? ' definition-workspace' : ''}${atlasExplore ? ' atlas-explore-stage' : ''}${customStep ? ' learning-model-stage' : ''}`}
          >
            <CaseViewport
              api={api}
              lecturePresentation={!!customStep}
              teachingFocus={!!customStep && teacher!.session.focus}
              hoveredToothId={atlasExplore ? hoveredToothId : null}
            />
            {atlasExplore && !api.toolsOpen && <AtlasToothInspector api={api} />}
            {!customStep && <CaseLectureOverlay api={api} />}
          </div>
          {atlasExplore && <AtlasToothChart api={api} onHoverTooth={onHoverTooth} />}
          {(!customStep ||
            api.prepared ||
            api.demonstration ||
            api.moved > 0 ||
            api.sandbox.pending ||
            api.mechanics?.result ||
            canCalculate) && (
            <CaseStageDock
              api={api}
              hideExplore={!!customStep}
              authored={!!customStep}
              canCalculate={canCalculate}
            />
          )}
          {customStep && <TeacherWorkspace teacher={teacher} />}
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
                ? ['next step', 'show roots', 'fit model', 'explore this step']
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
              customStep
                ? 'Try “next step”, “show roots” or “fit model”'
                : api.prepared
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
