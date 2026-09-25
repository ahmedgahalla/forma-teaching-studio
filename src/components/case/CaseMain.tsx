'use client';
import type { CaseStudioApi } from './api';
import type { ArchView, ViewName } from '../Viewer';
import type { Vec3 } from '@/lib/model';
import {
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  Focus,
  Maximize,
  MousePointer2,
  Move3D,
  Rotate3D,
  Ruler,
  X,
} from 'lucide-react';
import { LecturePointer, LectureViewTools } from '../LectureViewTools';
import Viewer from '../Viewer';
import { LectureConsole } from '../LectureConsole';
import StageBar from '../StageBar';
import { TeachingCommandBar } from '../TeachingController';
import { hasMechanicsMovement, mechanicsResponseCaption } from '@/lib/mechanics-presentation';
import { Vector3 } from 'three';
import { toothMatrix } from '@/lib/analysis';
import { applianceView } from '@/lib/appliance-display';
import { wireSizeLabel } from '../MechanicsPanel';

export function CaseMain({ api }: { api: CaseStudioApi }) {
  const { sceneInteraction, viewer } = api;
  return (
    <>
      <main className="main-workspace">
        <div className="workspace-scene">
          <div className="workspace-heading">
            <div>
              <div className="breadcrumbs">
                {api.prepared
                  ? 'Case library'
                  : api.tryActive
                    ? 'Try Mode'
                    : api.currentLesson
                      ? 'Prepared lesson'
                      : 'Case editor'}{' '}
                <ChevronRight size={12} />
                <span>
                  {api.prepared ? (
                    api.caseDefinition?.category
                  ) : api.tryActive ? (
                    api.scenario ? (
                      'Case variation'
                    ) : (
                      'No lesson required'
                    )
                  ) : (
                    <button onClick={() => api.sendTry({ type: 'enter' }, 'Return to Try Mode')}>
                      Return to Try Mode
                    </button>
                  )}
                </span>
              </div>
              <h2>
                {api.prepared
                  ? api.caseDefinition?.title
                  : api.tryActive
                    ? api.dentalArrangement?.title || 'Your orthodontic sandbox'
                    : api.currentLesson
                      ? 'Explain one step at a time.'
                      : 'Explore the case geometry.'}
              </h2>
            </div>
            <div className="view-actions">
              {api.dentalArrangement && (
                <button
                  className="icon-button"
                  aria-label="About this dental arrangement"
                  onClick={() => api.setModal('arrangement')}
                >
                  <CircleHelp size={17} />
                </button>
              )}
              <details className="presentation-view-menu">
                <summary title="Model presentation tools">
                  <Focus size={16} />
                  View tools
                </summary>
                <LectureViewTools
                  isolated={api.isolated}
                  pointer={api.pointer}
                  onIsolate={() => api.setIsolated(!api.isolated)}
                  onPointer={() => api.setPointer(!api.pointer)}
                  onFocus={() => {
                    api.teaching.referenceInteraction();
                    viewer.current?.focus();
                  }}
                  onFit={() => {
                    api.teaching.referenceInteraction();
                    viewer.current?.fit();
                  }}
                />
              </details>
              <button
                className="icon-button"
                title="Export 3D image"
                aria-label="Export 3D image"
                onClick={() => viewer.current?.snapshot()}
              >
                <Camera size={18} />
              </button>
              <button
                className="icon-button"
                title="Fit model"
                aria-label="Fit model"
                onClick={() => viewer.current?.fit()}
              >
                <Maximize size={18} />
              </button>
            </div>
          </div>
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
                {api.pathAudit.pairs.map(pair => `${pair.a}–${pair.b} (${pair.tissue})`).join(', ')}
                . Highlighting covers the sampled sequence, not only the current stage.
              </p>
              <p>{api.pathAudit.limitation}</p>
            </details>
          )}
          {api.workflowOrigin && (
            <section
              className="workspace-origin"
              aria-label="Source lesson and preserved workspace"
            >
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
                  The copied arrangement and hardware are editable. Authored arrows and the
                  conceptual palate split remain in the source lesson. Your previous workspace is
                  held only for this session; use Save case to keep an arrangement.
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
            <section
              className="viewport"
              onPointerDownCapture={sceneInteraction}
              aria-label="3D workspace"
            >
              <Viewer
                onReferenceInteraction={api.teaching.referenceInteraction}
                mechanics={
                  api.sandbox.pending && api.mechanics
                    ? { ...api.mechanics, result: null }
                    : api.mechanics
                }
                mechanicsForces={api.forceVectors}
                mechanicsRevealed={api.responseRevealed}
                pointed={api.pointed}
                pointing={api.teaching.capture.phase !== 'idle'}
                onPoint={point => {
                  api.teaching.referenceInteraction();
                  if (point) {
                    const tooth = api.model.teeth.find(item => item.id === point.tooth)!;
                    api.setPointed(
                      point.surface === 'gingiva'
                        ? point
                        : {
                            ...point,
                            worldPoint: new Vector3(...point.localPoint)
                              .applyMatrix4(toothMatrix(tooth, api.actualShown))
                              .toArray() as Vec3,
                          },
                    );
                  } else api.setPointed(null);
                }}
                paused={!api.active}
                isolateSelection={api.isolated}
                anatomy={api.anatomy}
                removableRetainer={
                  !!api.caseVariant?.removableRetainer &&
                  api.braces &&
                  api.applianceDisplay.preset === 'none'
                }
                workflow={api.braces ? applianceView(api.applianceDisplay) : undefined}
                ref={viewer}
                model={api.model}
                transforms={api.dragPreview || api.shown}
                selected={api.selected}
                selectedIds={api.selectedIds}
                onSelect={api.selectTooth}
                ghost={
                  api.ghost ||
                  !!api.sandbox.pending ||
                  api.comparisonName !== null ||
                  !!api.mechanicsGhost
                }
                ghostTransforms={
                  api.mechanicsGhost ||
                  api.sandbox.pending?.to ||
                  (api.mechanics?.result && api.ghost && !api.comparisonName
                    ? api.mechanics.reference.transforms
                    : undefined) ||
                  (api.comparisonName === 'original' || (api.scenario && api.ghost)
                    ? api.caseStart || api.sandbox.original || {}
                    : api.sandbox.snapshots.find(item => item.name === api.comparisonName)
                        ?.transforms)
                }
                lockedIds={api.sandbox.lockedIds}
                traceFrom={
                  api.traces
                    ? api.mechanics?.reference.transforms ||
                      api.demonstration?.from ||
                      api.caseStart ||
                      api.sandbox.original ||
                      {}
                    : undefined
                }
                archCurve={api.curve}
                gums={api.gums}
                labels={api.labels}
                grid={api.grid}
                arch={api.arch}
                braces={api.braces && (!!api.mechanics || api.applianceDisplay.preset !== 'none')}
                roots={api.roots}
                bracketStyle={api.bracketStyle}
                ligatureColor={api.ligatureColor}
                opening={api.opening}
                measureMode={api.measureMode}
                landmarks={api.landmarks}
                onLandmark={point => {
                  api.setLandmarks(previous =>
                    previous.length >= 2 ? [point] : [...previous, point],
                  );
                  api.note('Surface landmark captured.');
                }}
                intersections={api.highlightedContacts}
                attachments={api.attachments}
                tool={api.tool}
                onPosePreview={(id, next) => {
                  api.teaching.interact();
                  if (!api.sandbox.lockedIds.includes(id))
                    api.setDragPreview({ ...api.plan.current, [id]: next });
                }}
                onPoseCommit={api.poseCommit}
              />
              {api.pointed && (
                <div className="pointed-target-caption" role="status">
                  {api.pointed.surface === 'gingiva'
                    ? 'Gingiva near'
                    : api.pointed.surface === 'root'
                      ? 'Root'
                      : 'Target'}{' '}
                  · {api.pointed.tooth}
                  <span>
                    {api.teaching.capture.phase !== 'idle'
                      ? 'Keep speaking — this point is captured'
                      : 'Say “install brackets here”'}
                  </span>
                  <button
                    aria-label="Clear pointed target"
                    onClick={() => {
                      api.teaching.referenceInteraction();
                      api.setPointed(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="viewport-top">
                <span className="view-badge">
                  <span />
                  {api.sandbox.pending
                    ? 'UNAPPLIED PREVIEW'
                    : api.sandbox.unrestricted
                      ? 'UNRESTRICTED ILLUSTRATION'
                      : api.prepared
                        ? 'AUTHORED TEACHING EXAMPLE'
                        : api.model.demo
                          ? 'SYNTHETIC SANDBOX'
                          : 'IMPORTED CASE'}
                </span>
                <span className="unit-badge">mm · FDI numbering</span>
              </div>
              <div className="model-tools" aria-label="3D tools">
                <button
                  aria-label="Orbit tool"
                  title="Orbit"
                  className={api.tool === 'orbit' ? 'active' : ''}
                  onClick={() => api.chooseTool('orbit')}
                >
                  <MousePointer2 size={19} />
                </button>
                <button
                  aria-label="Move with handles"
                  title="Move with world-axis handles"
                  className={api.tool === 'translate' ? 'active' : ''}
                  onClick={() => api.chooseTool('translate')}
                >
                  <Move3D size={19} />
                </button>
                <button
                  aria-label="Rotate with handles"
                  title="Rotate with world-axis handles"
                  className={api.tool === 'rotate' ? 'active' : ''}
                  onClick={() => api.chooseTool('rotate')}
                >
                  <Rotate3D size={19} />
                </button>
                <span />
                <button
                  aria-label="Focus selected teeth"
                  title="Focus selected teeth"
                  onClick={() => {
                    api.teaching.referenceInteraction();
                    viewer.current?.focus();
                  }}
                >
                  <Focus size={19} />
                </button>
                <button
                  aria-label="Toggle tooth numbers"
                  title="Tooth numbers"
                  className={api.labels ? 'active' : ''}
                  onClick={() => api.setLabels(!api.labels)}
                >
                  11
                </button>
              </div>
              <div className="viewport-selection">
                <MousePointer2 size={14} />
                <span>
                  {api.selectedIds.length === 1 ? (
                    <>
                      Tooth <strong>{api.selected}</strong>
                    </>
                  ) : (
                    <strong>{api.selectedIds.length} teeth selected</strong>
                  )}
                </span>
                <span className="selection-line" />
                <span>
                  {api.selectedIds.length === 1 ? api.tooth.name : api.selectedIds.join(' · ')}
                </span>
              </div>
              <div className="orientation">
                <span className="axis-y">Y</span>
                <span className="axis-x">X</span>
                <span className="axis-z">Z</span>
                <i />
              </div>
              <div className="viewport-hint">
                {api.measureMode
                  ? 'Pick two crown-surface points'
                  : 'Drag to orbit · Scroll to zoom · Shift-click to select'}
              </div>
              <LecturePointer
                enabled={api.pointer && api.active}
                onExit={() => api.setPointer(false)}
              />
              {api.pointer && (
                <span className="lecture-pointer-notice">
                  Lecture pointer · Escape or Exit pointer to orbit
                </span>
              )}
              {api.mechanics?.result && !api.sandbox.pending && (
                <div className="mechanics-scale-badge">
                  {api.responseRevealed
                    ? mechanicsResponseCaption(api.mechanics.result.diagnostics, api.magnification)
                    : 'Predict first · calculated response hidden'}
                </div>
              )}
              {api.mechanics?.result &&
                !api.sandbox.pending &&
                api.forceVectors &&
                api.responseRevealed && (
                  <div className="mechanics-vector-legend">
                    <span>↗ Force direction</span>
                    <span>↻ Moment</span>
                    <small>Arrow size is schematic</small>
                  </div>
                )}
              {api.stage < api.stages && (
                <div className="stage-preview-badge">
                  Stage {api.stage.toFixed(1)} / {api.stages}
                </div>
              )}
              {api.opening > 0 && (
                <div className="opening-badge">Display separation {api.opening} mm</div>
              )}
              {api.roots && <div className="roots-badge">Schematic roots · not reconstructed</div>}
            </section>
            {api.lecture && (
              <LectureConsole
                compact={!api.caseVariant}
                collapsible={!!api.caseVariant}
                showPlayback={false}
                title={api.caseVariant?.title || 'Explore and explain'}
                objective={
                  api.caseDefinition?.learningGoal ||
                  'Select a group, preview a geometric change, and invite students to compare it with the starting arrangement.'
                }
                question={api.caseVariant?.question}
                answer={api.caseVariant?.answer}
                answerVisible={api.scenario?.answerVisible ?? false}
                onToggleAnswer={() =>
                  void api.teaching.execute(
                    [{ kind: 'question', visible: !api.scenario?.answerVisible }],
                    'Toggle the prepared answer',
                  )
                }
                playing={api.playing}
                progress={api.stage / api.stages}
                speed={api.playbackSpeed}
                canPlay={api.prepared || !!api.demonstration || api.moved > 0}
                disabled={api.busy}
                onPlayPause={() =>
                  void api.teaching.execute(
                    [
                      api.playing
                        ? { kind: 'stop' }
                        : api.prepared
                          ? { kind: 'case', action: 'play' }
                          : { kind: 'dental', command: { type: 'play' } },
                    ],
                    api.playing ? 'Pause demonstration' : 'Play demonstration',
                  )
                }
                onRestart={() =>
                  void api.teaching.execute(
                    [
                      { kind: 'progress', value: 0 },
                      ...(api.scenario ? [{ kind: 'question' as const, visible: false }] : []),
                    ],
                    'Return to the starting arrangement',
                  )
                }
                onHalf={() =>
                  void api.teaching.execute(
                    [{ kind: 'progress', value: 0.5 }],
                    'Pause at 50 percent',
                  )
                }
                onProgress={progress =>
                  void api.teaching.execute(
                    [{ kind: 'progress', value: progress }],
                    'Set demonstration progress',
                  )
                }
                onSpeed={value =>
                  void api.teaching.execute(
                    [{ kind: 'speed', value: value as 0.5 | 1 | 2 }],
                    'Set presentation speed',
                  )
                }
                variants={
                  api.prepared
                    ? api.caseDefinition?.variants.map(item => ({ id: item.id, label: item.title }))
                    : undefined
                }
                variantId={api.scenario?.variantId}
                onVariant={id =>
                  void api.teaching.execute(
                    [{ kind: 'case', action: 'variant', id }],
                    'Compare an authored demonstration from its start',
                  )
                }
                explorationAction={
                  api.scenario
                    ? {
                        label: api.prepared ? 'Try this arrangement' : 'Return to prepared case',
                        onClick: () =>
                          void api.teaching.execute(
                            [{ kind: 'case', action: api.prepared ? 'explore' : 'return' }],
                            api.prepared
                              ? 'Explore the displayed arrangement'
                              : 'Return to the prepared case',
                          ),
                      }
                    : undefined
                }
                note={
                  api.scenario
                    ? undefined
                    : 'Geometric illustration · playback speed is presentation speed · no biological prediction'
                }
              >
                <div className="lecture-quick-layers">
                  <button
                    aria-pressed={api.roots}
                    onClick={() =>
                      void api.teaching.runControl(api.roots ? 'hide roots' : 'show roots')
                    }
                  >
                    Roots
                  </button>
                  <button
                    aria-pressed={api.gums}
                    onClick={() =>
                      void api.teaching.runControl(api.gums ? 'hide gums' : 'show gums')
                    }
                  >
                    Gingiva
                  </button>
                  <button
                    aria-pressed={api.labels}
                    onClick={() =>
                      void api.teaching.runControl(api.labels ? 'hide labels' : 'show labels')
                    }
                  >
                    Tooth numbers
                  </button>
                  <button
                    aria-pressed={api.ghost}
                    disabled={!!api.sandbox.pending}
                    onClick={() =>
                      void api.teaching.execute(
                        [{ kind: 'comparison', mode: api.ghost ? 'off' : 'overlay' }],
                        'Toggle original overlay',
                      )
                    }
                  >
                    Original overlay
                  </button>
                  {api.scenario && (
                    <button onClick={() => void api.teaching.runControl('explain this step')}>
                      Explain aloud
                    </button>
                  )}
                  {api.tryActive && api.demonstration && (
                    <button
                      onClick={() =>
                        void api.teaching.execute(
                          [{ kind: 'try-playback', direction: 'reverse' }],
                          'Reverse the geometric edit',
                        )
                      }
                    >
                      Reverse edit
                    </button>
                  )}
                </div>
              </LectureConsole>
            )}
          </div>
          {(api.prepared ||
            !!api.demonstration ||
            api.moved > 0 ||
            !!api.sandbox.pending ||
            !!api.mechanics?.result) && (
            <StageBar
              label={
                api.mechanics
                  ? api.mechanics.result
                    ? 'Calculated initial response'
                    : 'Appliance setup · calculate to see a response'
                  : api.prepared
                    ? 'Authored demonstration'
                    : api.sandbox.pending
                      ? 'Geometric preview'
                      : 'Geometric movement'
              }
              progress={api.stage / api.stages}
              stages={api.stages}
              playing={api.playing}
              speed={api.playbackSpeed}
              canPlay={
                api.mechanics
                  ? !!api.mechanics.result && hasMechanicsMovement(api.mechanics.result.diagnostics)
                  : api.prepared || !!api.demonstration || api.moved > 0
              }
              onPlay={() =>
                void api.teaching.execute(
                  [
                    api.playing
                      ? { kind: 'stop' }
                      : api.prepared
                        ? { kind: 'case', action: 'play' }
                        : { kind: 'dental', command: { type: 'play' } },
                  ],
                  api.playing ? 'Pause demonstration' : 'Play demonstration',
                )
              }
              onProgress={value => {
                api.teaching.interact();
                api.setPlaying(false);
                api.setStage(value * api.stages);
              }}
              onSpeed={value => api.setPlaybackSpeed(value as 0.5 | 1 | 2)}
              onStages={value => {
                api.setStages(value);
                api.setStage((api.stage / api.stages) * value);
              }}
              onReverse={() =>
                void api.teaching.execute(
                  [{ kind: 'try-playback', direction: 'reverse' }],
                  'Play in reverse',
                )
              }
              revealed={api.mechanics?.result ? api.responseRevealed : undefined}
              onReveal={() => {
                api.setResponseRevealed(true);
                api.setReverse(false);
                api.setStage(0);
                api.setPlaying(
                  !!api.mechanics?.result && hasMechanicsMovement(api.mechanics.result.diagnostics),
                );
              }}
              onExplore={
                api.prepared
                  ? () =>
                      void api.teaching.execute(
                        [{ kind: 'case', action: 'explore' }],
                        'Explore this arrangement',
                      )
                  : undefined
              }
            />
          )}
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
