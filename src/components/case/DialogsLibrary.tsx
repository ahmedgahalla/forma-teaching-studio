'use client';
import type { CaseStudioApi } from './api';
import { ArrowUpRight } from 'lucide-react';
import { Dialog } from './ui';
import { TeachingCaseLibrary } from './StudioExperience';
import { WorkflowLibrary } from '../workflow/WorkflowStudio';
import { CASE_CARDS } from './constants';
import { DENTAL_ARRANGEMENTS } from '@/lib/dental-arrangements';
import { LESSONS } from '@/lib/lecture';

export function DialogsLibrary({ api }: { api: CaseStudioApi }) {
  const { modal, setModal } = api;
  return (
    <>
      {modal === 'workflows' && (
        <Dialog title="Teaching library" onClose={() => setModal(null)}>
          <section className="dental-arrangement-library">
            <span className="eyebrow">START A FREE EXPERIMENT</span>
            <h3>Dental relationships</h3>
            <p>
              Prepared starting arrangements for free exploration. Dental and skeletal
              classification remain separate.
            </p>
            <div>
              {DENTAL_ARRANGEMENTS.map(item => (
                <button
                  disabled={!!api.sandbox.pending || api.busy}
                  key={item.id}
                  title={item.description}
                  onClick={() =>
                    void api.teaching.execute(
                      [{ kind: 'dental-arrangement', id: item.id }],
                      `Load ${item.title}`,
                    )
                  }
                >
                  {item.title}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </section>
          <TeachingCaseLibrary
            cases={CASE_CARDS}
            selectedId={api.scenario?.caseId}
            disabled={!!api.sandbox.pending || api.busy}
            onChoose={id => {
              setModal(null);
              void api.teaching.execute(
                [{ kind: 'case', action: 'load', id }],
                'Load prepared teaching case',
              );
            }}
          />
          <details className="appliance-workflow-library">
            <summary>Appliance workflows & anatomy classroom</summary>
            <WorkflowLibrary
              onChoose={id => {
                setModal(null);
                void api.teaching.runControl(
                  id === 'anatomy'
                    ? 'start anatomy lesson'
                    : `start ${id === 'fixed-braces' ? 'braces' : id.replace('-', ' ')} workflow`,
                );
              }}
            />
          </details>
          <div className="combined-library-link">
            <p>Prefer a short sequence of tooth edits on this case?</p>
            <button onClick={() => setModal('lessons')}>Short guided lessons</button>
          </div>
        </Dialog>
      )}
      {modal === 'lessons' && (
        <Dialog title="Ready for the next demonstration?" onClose={() => setModal(null)}>
          <p>
            Choose a short teaching sequence. Say “next step”, “previous step”, or “restart lesson”
            as you explain.
          </p>
          <div className="lesson-cards">
            {LESSONS.map((lesson, i) => (
              <button
                key={lesson.id}
                onClick={() => {
                  if (api.workflowOrigin || api.scenario) {
                    api.note('Restore your workspace before starting another short lesson.', true);
                    setModal(null);
                    return;
                  }
                  if (api.sandbox.pending) {
                    api.note('Apply or discard the preview before opening a lesson.', true);
                    setModal(null);
                    return;
                  }
                  api.setSandbox({ ...api.sandbox, pending: null, lastEdit: null });
                  api.setLessonId(lesson.id);
                  api.setLessonStep(-1);
                  api.lessonSnapshots.current = [];
                  api.setLecture(true);
                  setModal(null);
                  api.setPlaying(false);
                  api.note('Lesson ready. Say “next step” or press Next step to begin.');
                }}
              >
                <span className="lesson-number">0{i + 1}</span>
                <div>
                  <strong>{lesson.title}</strong>
                  <p>{lesson.description}</p>
                  <small>{lesson.steps.length} steps · voice controlled</small>
                </div>
                <ArrowUpRight size={19} />
              </button>
            ))}
          </div>
          <p className="form-note">
            The first step resets tooth movements. Save your case first if needed. Previous step
            restores the setup before that step. Demonstrations use illustrative geometry.
          </p>
        </Dialog>
      )}
    </>
  );
}
