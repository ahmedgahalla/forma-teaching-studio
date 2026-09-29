'use client';
import type { CaseStudioApi } from './api';
import type { TeacherLectures } from '../lecture-builder/useTeacherLectures';
import { CaseTopbar } from './CaseTopbar';
import { CaseSidebar } from './CaseSidebar';
import { CaseMain } from './CaseMain';
import { CaseInspector } from './CaseInspector';
import { CaseDialogs } from './CaseDialogs';
import { MobileStudioDock } from './StudioExperience';
import { PreviewDecisionBar } from '../try/PreviewDecisionBar';
import { LectureNavigation } from '../lecture-builder/LectureNavigation';
import '../lecture-builder/lecture-builder.css';
import '../lecture-builder/teacher-workspace.css';
import './atlas-workspace.css';
import { LecturePicker } from '../lecture-builder/LecturePicker';

export function CaseShell({ api, teacher }: { api: CaseStudioApi; teacher: TeacherLectures }) {
  const {
    lecture,
    mobilePanel,
    toolsOpen,
    sandbox,
    active,
    busy,
    setModal,
    setLecture,
    setToolsOpen,
    setMobilePanel,
    caseInput,
    tryActive,
    setPanel,
    teaching,
    sceneInteraction,
  } = api;
  const step = teacher.document?.steps[teacher.session.index];
  const walkthrough = teacher.active && !teacher.session.exploring;
  const teacherError = teaching.runtime.error ? teaching.runtime.message : '';
  return (
    <>
      <div
        className={`app-shell braces-studio teaching-studio try-studio studio-experience lecture-opening atlas-workspace ${lecture ? 'lecture-mode' : ''}`}
        data-mobile-panel={mobilePanel}
        data-tools-open={toolsOpen}
        data-preview={!!sandbox.pending}
        data-teacher-screen={teacher.session.screen}
        data-teacher-mode={teacher.session.mode}
        style={active ? undefined : { display: 'none' }}
        onPointerDownCapture={sceneInteraction}
        onClickCapture={sceneInteraction}
        onChangeCapture={sceneInteraction}
      >
        <CaseTopbar
          experience={teacher.active ? 'lecture' : 'explore'}
          onExperienceChange={next => (next === 'lecture' ? teacher.openSample() : teacher.exit())}
          toolsAvailable={!teacher.active || teacher.session.exploring}
          caseActionsAvailable={!teacher.active}
          lecture={lecture}
          toolsOpen={!lecture && (toolsOpen || mobilePanel === 'tools')}
          busy={busy}
          onOpenLibrary={() => setModal('workflows')}
          onToggleTools={() => {
            const open = lecture || !(toolsOpen || mobilePanel === 'tools');
            setLecture(false);
            setToolsOpen(open);
            setMobilePanel(open ? 'tools' : 'model');
          }}
          onToggleLecture={() => {
            setLecture(!lecture);
            setMobilePanel('model');
          }}
          onOpenCase={() => caseInput.current?.click()}
          onSaveCase={api.save}
          onOpenSettings={() => setModal('settings')}
          onOpenGuide={() => setModal('guide')}
          onOpenSelection={() => {
            setLecture(false);
            setToolsOpen(false);
            setMobilePanel('selection');
          }}
          onOpenLayers={() => {
            setLecture(false);
            setToolsOpen(false);
            setMobilePanel('layers');
          }}
        />
        {teacher.document && (
          <div className="teacher-presentation-toolbar">
            <LecturePicker
              lectures={teacher.catalog}
              currentId={teacher.session.documentId}
              onOpen={teacher.openLecture}
              disabled={teacher.session.exploring}
            />
            <LectureNavigation {...teacher.navigationProps} />
            {teacher.session.exploring && (
              <p className="lecture-exploration-context" role="status">
                <strong>Lecture paused · Step {teacher.session.index + 1}</strong>
                <span>
                  {teacher.document.title} · {step?.title}
                </span>
                <span>Return to lecture restores this step and its view.</span>
              </p>
            )}
          </div>
        )}
        {teacherError && (
          <div className="teacher-error" role="alert">
            {teacherError}
          </div>
        )}
        {tryActive && (
          <PreviewDecisionBar
            pending={api.tryPanelProps.pending || null}
            affectedCount={sandbox.pending?.affectedIds.length}
            busy={api.tryPanelProps.busy}
            unrestricted={sandbox.unrestricted}
            onApply={api.tryPanelProps.onApply}
            onDiscard={api.tryPanelProps.onDiscard}
            onModify={() => {
              setLecture(false);
              setToolsOpen(true);
              setPanel('move');
              setMobilePanel('tools');
            }}
          />
        )}
        <input
          ref={caseInput}
          type="file"
          accept=".json"
          hidden
          onChange={e => api.importCase(e.target.files?.[0])}
        />
        <div className="workspace">
          {!walkthrough && <CaseSidebar api={api} />}

          <CaseMain api={api} teacher={teacher.active ? teacher : undefined} />

          {!walkthrough && <CaseInspector api={api} />}
        </div>
        {!walkthrough && (
          <MobileStudioDock
            activePanel={mobilePanel}
            onChange={next => {
              if (next !== 'model') setLecture(false);
              setMobilePanel(next);
              setToolsOpen(next === 'tools');
            }}
            onStop={teaching.cancel}
          />
        )}
        <footer className="statusbar">
          <span>Synthetic teaching model · illustrative movement · not for clinical use</span>
          <button
            className="ai-status-button"
            onClick={() => setModal('settings')}
            title="AI settings. Enabled means configured; provider access is checked when you ask AI."
          >
            {teaching.config.enabled ? `${teaching.config.provider || 'AI'} enabled` : 'AI off'} ·
            Settings
          </button>
        </footer>

        <CaseDialogs api={api} />
      </div>
    </>
  );
}
