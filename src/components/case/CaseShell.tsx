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
import { TeacherWorkspace } from '../lecture-builder/TeacherWorkspace';
import { LectureNavigation } from '../lecture-builder/LectureNavigation';
import '../lecture-builder/lecture-builder.css';
import '../lecture-builder/teacher-workspace.css';

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
    apiUrl,
    setApiDraft,
    tryActive,
    setPanel,
    teaching,
    aiEnabled,
    sceneInteraction,
  } = api;
  const teacherError =
    teacher.error ||
    (teacher.session.screen === 'library' && teaching.runtime.error
      ? teaching.runtime.message
      : '');
  return (
    <div
      className={`app-shell braces-studio teaching-studio try-studio studio-experience lecture-opening ${lecture ? 'lecture-mode' : ''}`}
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
        onExperienceChange={next => (next === 'lecture' ? teacher.showLibrary() : teacher.exit())}
        toolsAvailable={
          !teacher.active ||
          teacher.session.exploring ||
          (teacher.session.screen === 'lecture' && teacher.session.mode === 'prepare')
        }
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
        onOpenSettings={() => {
          setApiDraft(apiUrl || 'http://127.0.0.1:8000');
          setModal('settings');
        }}
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
      {teacher.document && <LectureNavigation {...teacher.navigationProps} />}
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
        <CaseSidebar api={api} />

        <CaseMain api={api} teacher={teacher.active ? teacher : undefined} />

        {teacher.panelProps &&
        !teacher.session.exploring &&
        !toolsOpen &&
        mobilePanel !== 'tools' ? (
          <TeacherWorkspace teacher={teacher} />
        ) : (
          <CaseInspector api={api} />
        )}
        {teacher.session.screen === 'library' && <TeacherWorkspace teacher={teacher} />}
      </div>
      <MobileStudioDock
        activePanel={mobilePanel}
        onChange={next => {
          if (next !== 'model') setLecture(false);
          setMobilePanel(next);
          setToolsOpen(next === 'tools');
        }}
        onStop={teaching.cancel}
      />
      <footer className="statusbar">
        <span>Synthetic teaching model · illustrative movement · not for clinical use</span>
        <span>{aiEnabled ? 'AI interpretation available' : 'Built-in commands'}</span>
      </footer>

      <CaseDialogs api={api} />
    </div>
  );
}
