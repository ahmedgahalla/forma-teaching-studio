'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers3,
  Maximize,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  X,
} from 'lucide-react';
import { StudioThemeToggle } from '../shared/StudioTheme';
import { LectureConsole } from '../lecture/LectureConsole';
import { LecturePointer, LectureViewTools } from '../lecture/LectureViewTools';
import Viewer, { type ViewerCamera, type ViewerHandle, type ViewName } from '../viewer/Viewer';
import { createDemo } from '@/lib/geometry';
import { WORKFLOWS } from '@/lib/workflows';
import {
  applyWorkflowAction,
  classroomDefinition,
  initialWorkflowScene,
  workflowSceneFrame,
  workflowSceneStep,
  type WorkflowScene,
} from '@/lib/workflow-scene';
import AnatomyPanel from '../viewer/AnatomyPanel';
import {
  TeachingCommandBar,
  useTeaching,
  useTeachingAdapter,
} from '../teaching/TeachingController';
import { captureWorkflowArrangement } from '@/lib/workflow-transfer';
import { sceneAnalysisContext } from '@/lib/scene-analysis';

export function WorkflowLibrary({ onChoose }: { onChoose: (id: string) => void }) {
  return (
    <div className="workflow-library">
      <p className="workflow-library-intro">
        Explain what an appliance does, from fitting to retention. Each walkthrough uses prepared
        synthetic anatomy. Choose Try this setup to explore its displayed arrangement and appliances
        in the editing workspace.
      </p>
      <button className="workflow-library-card" onClick={() => onChoose('anatomy')}>
        <span className="workflow-library-number">A</span>
        <div>
          <strong>Inside a tooth: translation and tipping</strong>
          <p>Explore roots, supporting bone and the ligament in a labelled cutaway.</p>
          <small>4 steps · anatomy layers · movement comparison</small>
        </div>
        <ArrowUpRight size={21} />
      </button>
      {WORKFLOWS.map((item, i) => (
        <button className="workflow-library-card" key={item.id} onClick={() => onChoose(item.id)}>
          <span className="workflow-library-number">0{i + 1}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <small>{item.steps.length} steps · animated mechanism · student questions</small>
          </div>
          <ArrowUpRight size={21} />
        </button>
      ))}
      <div className="workflow-library-footnote">
        <BookOpen size={18} />
        <span>
          Source-linked explanations. Illustrative movement, without predicted forces or treatment
          timing.
        </span>
      </div>
    </div>
  );
}

function Switch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className={`workflow-switch ${value ? 'active' : ''}`}
      role="switch"
      aria-checked={value}
      onClick={onChange}
    >
      <span>{label}</span>
      <span className="switch">
        <span />
      </span>
    </button>
  );
}

export default function WorkflowStudio({ active }: { active: boolean }) {
  const teaching = useTeaching(),
    base = useMemo(() => createDemo(), []);
  const [scene, setScene] = useState(() => initialWorkflowScene(base));
  const {
    id: workflowId,
    step: stepIndex,
    progress,
    playing,
    speed,
    arch,
    view,
    roots,
    gums,
    labels,
    arrows,
    model,
  } = scene;
  const definition = classroomDefinition(workflowId),
    step = definition.steps[stepIndex];
  const [lecture, setLecture] = useState(false),
    [isolated, setIsolated] = useState(false),
    [pointer, setPointer] = useState(false);
  const [answer, setAnswer] = useState(false),
    [library, setLibrary] = useState(false);
  const pendingCamera = useRef<ViewerCamera | null>(null),
    previousView = useRef('');
  const viewer = useRef<ViewerHandle>(null),
    dialog = useRef<HTMLDialogElement>(null),
    explanation = useRef<HTMLElement>(null);
  const frame = useMemo(() => workflowSceneFrame(scene), [scene]);
  const selectedIds = scene.selected,
    activeId = selectedIds[0] || '11';
  const viewFrame = useMemo(() => ({ ...frame, arrows: frame.arrows && arrows }), [frame, arrows]);
  const run = (text: string) => void teaching.runControl(text);
  const patch = (change: Partial<WorkflowScene>) => {
    teaching.interact();
    setScene(value => ({ ...value, ...change }));
  };
  const setRoots = (value: boolean) => patch({ roots: value }),
    setGums = (value: boolean) => patch({ gums: value }),
    setLabels = (value: boolean) => patch({ labels: value }),
    setArrows = (value: boolean) => patch({ arrows: value });
  const setProgress = (value: number) => patch({ progress: value, playing: false }),
    setPlaying = (value: boolean) => patch({ playing: value });
  const setSpeed = (value: number) => run(`playback speed ${value}x`);
  const setSelectionOverride = (selected: string[]) => patch({ selected });
  const camera = (next: ViewName) => run(`${next} view`);
  const go = (index: number) => {
    teaching.interact();
    setScene(workflowSceneStep(scene, index, base));
    setAnswer(false);
    explanation.current?.scrollTo({ top: 0 });
  };
  const choose = (id: string) => {
    setLibrary(false);
    run(
      id === 'anatomy'
        ? 'start anatomy lesson'
        : `start ${id === 'fixed-braces' ? 'braces' : id.replace('-', ' ')} workflow`,
    );
  };
  const animate = () => run('play demonstration');
  useTeachingAdapter('workflow', {
    analysisContext: () =>
      sceneAnalysisContext({
        synthetic: true,
        ids: model.teeth.map(tooth => tooth.id),
        transforms: scene.variation || frame.transforms,
        selectedIds,
        arch,
        roots,
        gums,
        bone: scene.anatomy.bone,
        lesson: { title: `${definition.title}: ${step.title}`, explanation: step.explanation },
      }),
    context: () => ({
      mode: 'workflow',
      workflowId,
      stepIndex,
      selected: activeId,
      selectedIds,
      availableIds: model.teeth.map(tooth => tooth.id),
      synthetic: true,
      view,
      arch,
      speed,
      stage: Math.round(frame.progress * scene.stages),
      stages: scene.stages,
      playing,
      lessonActive: true,
      canReturnToLesson: true,
      layers: {
        roots,
        gums,
        labels,
        braces: scene.braces,
        attachments: scene.attachments,
        bone: scene.anatomy.bone,
        cutaway: scene.anatomy.cutaway,
        ligament: scene.anatomy.ligament,
      },
      boneOpacity: scene.anatomy.opacity,
    }),
    capture: () => ({ scene, camera: viewer.current?.getCamera(), answer, lecture, isolated }),
    exportSetup: from =>
      captureWorkflowArrangement(
        (from as { scene: WorkflowScene } | undefined)?.scene || scene,
        base,
      ),
    restore: value => {
      const saved = value as {
        scene: WorkflowScene;
        camera: ViewerCamera | null;
        answer: boolean;
        lecture?: boolean;
        isolated?: boolean;
      };
      setLecture(saved.lecture ?? false);
      setIsolated(saved.isolated ?? false);
      setPointer(false);
      setScene({ ...saved.scene, playing: false });
      setAnswer(saved.answer);
      pendingCamera.current = saved.camera;
    },
    apply: action => {
      if (action.kind === 'question') {
        setAnswer(action.visible);
        return true;
      }
      if (action.kind === 'lecture') {
        setLecture(action.enabled);
        return true;
      }
      const next = applyWorkflowAction(scene, action, base);
      setScene(next);
      if (next.id !== scene.id) {
        setIsolated(false);
        setPointer(false);
      }
      if (next.step !== scene.step || next.id !== scene.id) {
        setAnswer(false);
        explanation.current?.scrollTo({ top: 0 });
      }
      if (action.kind === 'focus') setTimeout(() => viewer.current?.focus(), 0);
      return true;
    },
    preflight: (actions, from) => {
      let next = (from as { scene: WorkflowScene } | undefined)?.scene || scene;
      for (const action of actions) next = applyWorkflowAction(next, action, base);
    },
    settle: signal => viewer.current?.whenRendered(signal) ?? Promise.resolve(),
    pause: () => setScene(value => (value.playing ? { ...value, playing: false } : value)),
    narration: target => (target === 'answer' ? step.answer : step.explanation),
  });
  useEffect(() => {
    if (!playing || !active) return;
    const timer = window.setInterval(
      () =>
        setScene(value => {
          const next = Math.min(1, value.progress + 0.008 * value.speed);
          return { ...value, progress: next, playing: next < 1 };
        }),
      40,
    );
    return () => clearInterval(timer);
  }, [playing, speed, active]);
  useEffect(() => {
    const key = `${active}:${view}:${stepIndex}:${workflowId}`;
    if (pendingCamera.current) {
      viewer.current?.restoreCamera(pendingCamera.current);
      pendingCamera.current = null;
    } else if (active && previousView.current !== key) viewer.current?.setView(view);
    previousView.current = key;
  });
  useEffect(() => {
    if (library) dialog.current?.showModal();
  }, [library]);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input,select,textarea,dialog,button')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        run(event.key === 'ArrowRight' ? 'next step' : 'previous step');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional dep subset: the effect must not re-run on the excluded values
  }, [active]);

  const lectureProgress = (value: number) =>
    void teaching.execute(
      [{ kind: 'progress', value }],
      `Show ${Math.round(value * 100)} percent of demonstration`,
    );
  const viewportInteraction = (event: { target: EventTarget }) => {
    if (!(event.target as HTMLElement).closest('.lecture-pointer')) teaching.interact();
  };
  return (
    <div
      className={`app-shell braces-studio teaching-studio workflow-studio${lecture ? ' workflow-presenting' : ''}`}
      style={active ? undefined : { display: 'none' }}
    >
      <header className="topbar">
        <button
          className="workflow-back"
          aria-label="Back to my case"
          onClick={() => run('exit workflow')}
        >
          <ArrowLeft size={17} />
          <span>Back to my case</span>
        </button>
        <a
          className="brand"
          href="#"
          onClick={e => e.preventDefault()}
          aria-label="Forma workflow classroom"
        >
          <span className="brand-icon">
            <Layers3 size={21} />
          </span>
          forma
          <span className="brand-divider" />
          <span className="brand-sub">WORKFLOW CLASSROOM</span>
        </a>
        <div className="header-actions">
          <StudioThemeToggle />
          <button
            className="button light small workflow-present-button"
            aria-label={lecture ? 'Exit lecture mode' : 'Enter lecture mode'}
            aria-pressed={lecture}
            onClick={() =>
              void teaching.execute([{ kind: 'lecture', enabled: !lecture }], 'Toggle lecture mode')
            }
          >
            <Presentation size={17} />
            <span>{lecture ? 'Exit lecture' : 'Lecture mode'}</span>
          </button>
          <button
            className="button primary small workflow-try-button"
            onClick={() => run('try this setup')}
          >
            Try this setup
          </button>
          <button
            className="button light small workflow-library-button"
            aria-label="Workflow library"
            onClick={() => setLibrary(true)}
          >
            <BookOpen size={16} />
            <span>Workflows</span>
          </button>
          <button
            className="icon-button"
            aria-label="Restart workflow"
            title="Restart workflow"
            onClick={() => run('restart workflow')}
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Save workflow image"
            title="Save 3D image"
            onClick={() => viewer.current?.snapshot()}
          >
            <Camera size={18} />
          </button>
        </div>
      </header>
      <div className="workflow-layout">
        <main className="workflow-main">
          <div className="workflow-stage-heading">
            <div>
              <div className="eyebrow">
                {definition.title}{' '}
                <span>
                  · STEP {stepIndex + 1} OF {definition.steps.length}
                </span>
              </div>
              <h1>{step.title}</h1>
            </div>
            <div className="workflow-navigation">
              <button
                className="icon-button"
                aria-label="Previous workflow step"
                disabled={stepIndex === 0}
                onClick={() => run('previous step')}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="button primary"
                disabled={stepIndex === definition.steps.length - 1}
                onClick={() => run('next step')}
              >
                Next step
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          {scene.variation && (
            <div className="teaching-experiment">
              <span>Temporary variation · your lesson is preserved</span>
              <button onClick={() => run('return to the lesson')}>Return to lesson</button>
            </div>
          )}
          <LectureViewTools
            isolated={isolated}
            pointer={pointer}
            onIsolate={() => setIsolated(!isolated)}
            onPointer={() => setPointer(!pointer)}
            onFocus={() => {
              teaching.referenceInteraction();
              viewer.current?.focus();
            }}
            onFit={() => {
              teaching.referenceInteraction();
              viewer.current?.fit();
            }}
          />
          <div className="lecture-stage">
            <section
              className="viewport workflow-viewport"
              aria-label="Workflow 3D model"
              onPointerDownCapture={viewportInteraction}
            >
              <Viewer
                onReferenceInteraction={teaching.referenceInteraction}
                isolateSelection={isolated}
                ref={viewer}
                model={model}
                transforms={scene.variation || frame.transforms}
                selected={activeId}
                selectedIds={selectedIds}
                onSelect={id => setSelectionOverride([id])}
                ghost={scene.ghost}
                gums={gums}
                labels={labels}
                grid={false}
                arch={arch}
                braces={scene.braces}
                roots={roots}
                bracketStyle="metal"
                ligatureColor="#3298bb"
                opening={0}
                measureMode={false}
                landmarks={[]}
                onLandmark={() => {}}
                intersections={[]}
                attachments={scene.attachments}
                tool="orbit"
                onPosePreview={() => {}}
                onPoseCommit={() => {}}
                workflow={workflowId === 'anatomy' ? undefined : viewFrame}
                anatomy={scene.anatomy}
                paused={!active}
              />
              <div className="viewport-top">
                <span className="view-badge">
                  <span />
                  ILLUSTRATIVE TEACHING MODEL
                </span>
                <span className="workflow-phase">
                  {step.phase === 'forces'
                    ? 'Direction of action'
                    : step.phase === 'wire'
                      ? 'Appliance fitted'
                      : step.phase === 'brackets' && definition.id === 'palatal-expansion'
                        ? 'Posterior anchorage'
                        : step.phase}
                </span>
              </div>
              <div className="camera-tabs">
                {(['perspective', 'front', 'occlusal', 'right', 'left'] as ViewName[]).map(item => (
                  <button
                    key={item}
                    className={view === item ? 'active' : ''}
                    aria-pressed={view === item}
                    onClick={() => camera(item)}
                  >
                    {item === 'perspective' ? '3D view' : item[0].toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
              <button
                className="workflow-fit"
                aria-label="Fit workflow model"
                onClick={() => viewer.current?.fit()}
                title="Fit model"
              >
                <Maximize size={18} />
              </button>
              <div className="workflow-visual-note" hidden={scene.anatomy.cutaway}>
                {scene.anatomy.cutaway
                  ? 'Schematic tissues · ligament enlarged for visibility'
                  : frame.palate
                    ? 'Conceptual palate halves · not patient anatomy'
                    : frame.arrows && arrows
                      ? 'Arrows show intended direction · not force magnitude'
                      : 'Drag to orbit · Scroll to zoom · Click a tooth to highlight'}
              </div>
              <LecturePointer enabled={pointer && active} onExit={() => setPointer(false)} />
              {pointer && (
                <span className="lecture-pointer-notice">
                  Lecture pointer · Escape or Exit pointer to orbit
                </span>
              )}
              <div className="orientation">
                <span className="axis-y">Y</span>
                <span className="axis-x">X</span>
                <span className="axis-z">Z</span>
                <i />
              </div>
            </section>
            {lecture && (
              <LectureConsole
                title={step.title}
                objective={step.observe}
                question={step.question}
                answer={step.answer}
                answerVisible={answer}
                onToggleAnswer={() =>
                  void teaching.execute(
                    [{ kind: 'question', visible: !answer }],
                    answer ? 'Hide answer' : 'Reveal answer',
                  )
                }
                playing={playing}
                progress={frame.progress}
                speed={speed}
                canPlay={!scene.variation}
                onPlayPause={() => run(playing ? 'pause demonstration' : 'play demonstration')}
                onRestart={() =>
                  void teaching.execute(
                    [{ kind: 'question', visible: false }, { kind: 'return-lesson' }],
                    'Restore this lesson step',
                  )
                }
                onHalf={() => lectureProgress(0.5)}
                onProgress={lectureProgress}
                onSpeed={setSpeed}
                explorationAction={{
                  label: scene.variation ? 'Return to lesson' : 'Try this arrangement',
                  onClick: () => run(scene.variation ? 'return to the lesson' : 'try this setup'),
                }}
              >
                <div className="lecture-quick-layers">
                  <button
                    aria-pressed={roots}
                    onClick={() => run(roots ? 'hide roots' : 'show roots')}
                  >
                    Roots
                  </button>
                  <button aria-pressed={gums} onClick={() => run(gums ? 'hide gums' : 'show gums')}>
                    Gingiva
                  </button>
                  <button
                    aria-pressed={scene.ghost}
                    onClick={() =>
                      run(scene.ghost ? 'hide original overlay' : 'show original overlay')
                    }
                  >
                    Original overlay
                  </button>
                  <button onClick={() => run('explain this step')}>Explain aloud</button>
                  {workflowId === 'anatomy' && (
                    <>
                      <button
                        aria-pressed={stepIndex === 1}
                        onClick={() => run('demonstrate translation')}
                      >
                        Translation
                      </button>
                      <button
                        aria-pressed={stepIndex === 2}
                        onClick={() => run('demonstrate tipping')}
                      >
                        Tipping
                      </button>
                    </>
                  )}
                </div>
              </LectureConsole>
            )}
          </div>
          <section className="workflow-animation" aria-label="Illustrative movement playback">
            <button
              className={`button ${playing ? 'light' : 'primary'}`}
              onClick={() => (playing ? setPlaying(false) : animate())}
              aria-label={playing ? 'Pause demonstration' : 'Play demonstration'}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
              <span>
                {playing
                  ? 'Pause'
                  : step.phase === 'movement' && progress >= 1
                    ? 'Replay movement'
                    : 'Animate movement'}
              </span>
            </button>
            <div className="workflow-scrubber">
              <input
                type="range"
                aria-label="Workflow movement progress"
                min="0"
                max="1"
                step="0.01"
                value={frame.progress}
                disabled={step.phase !== 'movement' || !!scene.variation}
                onChange={e => {
                  setProgress(Number(e.target.value));
                  setPlaying(false);
                }}
                style={{ '--progress': `${frame.progress * 100}%` } as React.CSSProperties}
              />
              <div>
                <span>Initial illustration</span>
                <strong>{Math.round(frame.progress * 100)}%</strong>
                <span>Illustrative endpoint</span>
              </div>
            </div>
            <label className="workflow-speed">
              Speed
              <select
                aria-label="Workflow playback speed"
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
              >
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="2">2×</option>
              </select>
            </label>
          </section>
          <p className="workflow-try-note">
            Try this setup opens the exact displayed arrangement for free editing. Your previous
            workspace stays available through Restore my workspace.
          </p>
          <TeachingCommandBar label="Workflow command" />
        </main>
        <aside ref={explanation} className="workflow-explanation" aria-label="Workflow explanation">
          <div className="workflow-purpose">
            <span className="eyebrow">LEARNING GOAL</span>
            <p>{definition.learningGoal}</p>
          </div>
          <nav className="workflow-step-list" aria-label="Workflow steps">
            {definition.steps.map((item, i) => (
              <button
                key={i}
                title={item.title}
                aria-label={`Step ${i + 1}: ${item.title}`}
                className={i === stepIndex ? 'active' : ''}
                aria-current={i === stepIndex ? 'step' : undefined}
                onClick={() => go(i)}
              >
                <span>{i < stepIndex ? <Check size={13} /> : i + 1}</span>
              </button>
            ))}
          </nav>
          {workflowId === 'anatomy' && (
            <div className="anatomy-compare-buttons">
              <button onClick={() => run('demonstrate translation')}>Translation</button>
              <button onClick={() => run('demonstrate tipping')}>Tipping</button>
              <button
                onClick={() => run(scene.ghost ? 'hide original overlay' : 'show original overlay')}
              >
                Original overlay
              </button>
            </div>
          )}
          <div className="workflow-explain-section">
            <span className="eyebrow">WHAT IS DONE</span>
            <p>{step.action}</p>
          </div>
          <div className="workflow-explain-section effect">
            <span className="eyebrow">WHY IT MATTERS</span>
            <p>{step.explanation}</p>
            <button className="text-button" onClick={() => run('explain this step')}>
              Explain aloud
            </button>
          </div>
          <div className="workflow-observe">
            <Eye size={20} />
            <div>
              <strong>Watch the model</strong>
              <p>{step.observe}</p>
            </div>
          </div>
          <div className="workflow-question">
            <span className="eyebrow">ASK THE CLASS</span>
            <p>{step.question}</p>
            <button
              aria-expanded={answer}
              onClick={() =>
                void teaching.execute(
                  [{ kind: 'question', visible: !answer }],
                  answer ? 'Hide answer' : 'Reveal answer',
                )
              }
            >
              {answer ? 'Hide explanation' : 'Reveal explanation'}
              <ChevronRight size={14} />
            </button>
            {answer && <p className="workflow-answer">{step.answer}</p>}
          </div>
          <AnatomyPanel
            value={scene.anatomy}
            available={true}
            selected={activeId}
            onChange={anatomy =>
              patch({
                anatomy,
                ...(anatomy.cutaway && !scene.anatomy.cutaway ? { roots: true, gums: true } : {}),
              })
            }
          />
          <div className="workflow-display">
            <Switch label="Direction arrows" value={arrows} onChange={() => setArrows(!arrows)} />
            <Switch label="Schematic roots" value={roots} onChange={() => setRoots(!roots)} />
            <Switch label="Gingiva" value={gums} onChange={() => setGums(!gums)} />
            <Switch label="Tooth numbers" value={labels} onChange={() => setLabels(!labels)} />
          </div>
          <details className="workflow-sources">
            <summary>Sources & teaching limits</summary>
            <p>
              Pre-authored geometric examples. Placement alone does not produce the animation; the
              intended endpoint is scripted. No force magnitude, biological timing, bone response,
              or patient outcome is calculated.
            </p>
            {definition.sources.map(source => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                {source.title}
                <ArrowUpRight size={13} />
              </a>
            ))}
          </details>
        </aside>
      </div>
      {library && (
        <dialog
          ref={dialog}
          className="dialog"
          onCancel={() => setLibrary(false)}
          onClick={e => {
            if (e.target === dialog.current) setLibrary(false);
          }}
        >
          <div className="dialog-heading">
            <h2>Choose a treatment workflow</h2>
            <button
              className="icon-button"
              aria-label="Close workflow library"
              onClick={() => setLibrary(false)}
            >
              <X size={19} />
            </button>
          </div>
          <WorkflowLibrary onChoose={choose} />
        </dialog>
      )}
    </div>
  );
}
