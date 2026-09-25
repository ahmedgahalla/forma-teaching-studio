'use client';
import type { CaseStudioApi } from './api';
import type { ArchView } from '../Viewer';
import { BookOpen, ChevronLeft, ChevronRight, Eye, Ruler, X } from 'lucide-react';

export function CaseArchToolbar({ api }: { api: CaseStudioApi }) {
  return (
    <>
      <div className="arch-toolbar">
        <div className="segmented">
          {(['both', 'upper', 'lower'] as ArchView[]).map(a => (
            <button
              key={a}
              className={api.arch === a ? 'active' : ''}
              onClick={() => {
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
      {api.scenario && api.caseDefinition && api.caseVariant && (
        <div className="case-lesson-summary">
          <span>
            <strong>{api.caseVariant.title}</strong> ·{' '}
            {api.scenario.exploring ? 'Free variation' : 'Prepared illustration'}
          </span>
          <button onClick={() => api.setLecture(!api.lecture)}>
            {api.lecture ? 'Editing workspace' : 'Professor controls'}
          </button>
          {api.canRestoreWorkspace && (
            <button
              onClick={() =>
                void api.teaching.execute(
                  [{ kind: 'workspace', action: 'restore' }],
                  'Restore my workspace',
                )
              }
            >
              Restore workspace
            </button>
          )}
        </div>
      )}
      {api.prepared && api.pathAudit && api.pathAudit.pairs.length > 0 && (
        <details className="case-path-note">
          <summary>
            {api.pathAudit.pairs.length} known surface-crossing pairs in {api.pathAudit.samples}{' '}
            sampled frames · involved teeth marked amber
          </summary>
          <p>
            {api.pathAudit.pairs.map(pair => `${pair.a}–${pair.b} (${pair.tissue})`).join(', ')}.
            Highlighting covers the sampled sequence, not only the current stage.
          </p>
          <p>{api.pathAudit.limitation}</p>
        </details>
      )}
      {api.workflowOrigin && (
        <section className="workspace-origin" aria-label="Source lesson and preserved workspace">
          <div>
            <span className="eyebrow">FREE EXPLORATION FROM A LESSON</span>
            <strong>{api.workflowOrigin.setup.source.stepTitle}</strong>
            <span>
              {api.workflowOrigin.setup.source.title} ·{' '}
              {Math.round(api.workflowOrigin.setup.source.progress * 100)}% shown
            </span>
          </div>
          <div className="workspace-origin-actions">
            <button
              onClick={() =>
                void api.teaching.execute(
                  [{ kind: 'workspace', action: 'lesson' }],
                  'Return to the source lesson',
                )
              }
            >
              Return to source lesson
            </button>
            <button
              onClick={() =>
                void api.teaching.execute(
                  [{ kind: 'workspace', action: 'restore' }],
                  'Restore my workspace',
                )
              }
            >
              Restore my workspace
            </button>
          </div>
          <details>
            <summary>Lesson explanation & question</summary>
            <p>{api.workflowOrigin.setup.source.explanation}</p>
            <p>
              <strong>Ask the class:</strong> {api.workflowOrigin.setup.source.question}
            </p>
            <details>
              <summary>Reveal answer</summary>
              <p>{api.workflowOrigin.setup.source.answer}</p>
            </details>
            <div className="workspace-source-links">
              {api.workflowOrigin.setup.source.sources.map(source => (
                <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ))}
            </div>
            <p>
              The copied arrangement and hardware are editable. Authored arrows and the conceptual
              palate split remain in the source lesson. Your previous workspace is held only for
              this session; use Save case to keep an arrangement.
            </p>
          </details>
        </section>
      )}
      {api.currentLesson && (
        <section className="lesson-ribbon" aria-label="Current lesson">
          <BookOpen size={21} />
          <div>
            <strong>
              {api.currentLesson.title}
              <span>
                {Math.max(0, api.lessonStep + 1)} / {api.currentLesson.steps.length}
              </span>
            </strong>
            <p>
              {api.lessonStep < 0
                ? api.currentLesson.description
                : api.currentLesson.steps[api.lessonStep].caption}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Previous lesson step"
            disabled={api.lessonStep < 0}
            onClick={() =>
              void api.teaching.execute(
                [{ kind: 'lesson-step', action: 'previous' }],
                'Previous lesson step',
              )
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="button primary small"
            disabled={api.lessonStep >= api.currentLesson.steps.length - 1}
            onClick={() =>
              void api.teaching.execute(
                [{ kind: 'lesson-step', action: 'next' }],
                'Next lesson step',
              )
            }
          >
            Next step
            <ChevronRight size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Close lesson"
            onClick={() => {
              api.setLessonId('');
              api.setLessonStep(-1);
              api.setSandbox({ ...api.sandbox, active: true, pending: null, lastEdit: null });
            }}
          >
            <X size={16} />
          </button>
        </section>
      )}
    </>
  );
}
