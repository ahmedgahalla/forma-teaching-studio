'use client';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, Mic, Sparkles, Square, Undo2 } from 'lucide-react';
import { createTeachingRuntime, type RuntimeState } from '@/lib/teaching-runtime';
import { createPushToTalk, type CaptureState } from '@/lib/push-to-talk';
import { speechConstructor } from '@/lib/speech';
import type { TeachingAction } from '@/lib/lecture';
import { interpreterTeachingContext, teachingActionMode, type TeachingContext } from '@/lib/classroom';
import type { WorkflowTransfer } from '@/lib/workflow-transfer';
import { hostedCommandService, savedCommandService, type CommandServiceConfig as Config } from '@/lib/command-service';
import { validateSceneAnalysis, type SceneAnalysis, type SceneAnalysisContext } from '@/lib/scene-analysis';

type Mode = 'case' | 'workflow';
export type TeachingAdapter = {
  context: () => Omit<TeachingContext, 'revision'>;
  capture: () => unknown; restore: (snapshot: unknown) => void;
  apply: (action: TeachingAction, signal?: AbortSignal) => boolean | Promise<boolean>; preflight: (actions: TeachingAction[], from?: unknown) => void;
  pause: () => void; narration: (target: 'step' | 'answer' | 'mechanics') => string;
  settle?: (signal: AbortSignal) => Promise<void>;
  exportSetup?: (from?: unknown) => WorkflowTransfer;
  importSetup?: (setup: WorkflowTransfer, originSnapshot: unknown) => void;
  sourceLesson?: (from?: unknown) => unknown;
  analysisContext?: () => SceneAnalysisContext;
};
type Snapshot = { mode: Mode; scenes: Partial<Record<Mode, unknown>> };
const initialRuntime: RuntimeState = { phase: 'idle', message: 'Hold Space to speak, or type an instruction.', error: false, transcript: '' };
type Controller = {
  mode: Mode; runtime: RuntimeState; capture: CaptureState; config: Config;
  preferAI: boolean; setPreferAI: (enabled: boolean) => void;
  analyzeMode: boolean; setAnalyzeMode: (enabled: boolean) => void;
  analysis: SceneAnalysis | null; analysisPending: boolean; analysisError: string; analysisQuestion: string; dismissAnalysis: () => void;
  run: (text: string) => Promise<void>; runControl: (text: string) => Promise<void>; start: () => void; finish: () => void; cancel: () => void;
  execute: (actions: TeachingAction[], summary: string) => Promise<void>;
  interact: () => void; referenceInteraction: () => void; resetHistory: () => void; setConfig: (config: Config) => void;
  register: (mode: Mode, adapter: TeachingAdapter) => () => void;
};
const Context = createContext<Controller | null>(null);
export const useTeaching = () => { const value = useContext(Context); if (!value) throw new Error('Teaching controller is unavailable.'); return value; };
export function useTeachingAdapter(mode: Mode, adapter: TeachingAdapter) {
  const teaching = useTeaching();
  useLayoutEffect(() => teaching.register(mode, adapter));
}

export function TeachingProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('case'), modeRef = useRef<Mode>('case');
  const [runtime, setRuntime] = useState(initialRuntime), [capture, setCapture] = useState<CaptureState>({ supported: false, phase: 'idle', transcript: '' });
  const [config, updateConfig] = useState<Config>({ enabled: false, url: '' }), configRef = useRef(config); configRef.current = config;
  const configRevision = useRef(0);
  const [preferAI, setPreferAI] = useState(false), preferAIRef = useRef(false);
  const [analyzeMode, setAnalyzeMode] = useState(false), analyzeModeRef = useRef(false);
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null), [analysisPending, setAnalysisPending] = useState(false), [analysisError, setAnalysisError] = useState(''), [analysisQuestion, setAnalysisQuestion] = useState('');
  const analysisRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      const saved = savedCommandService(JSON.parse(localStorage.getItem('forma-command-service') || 'null'));
      if (saved) { configRef.current = saved; updateConfig(saved); return; }
    } catch { /* A blocked or cleared browser preference must not disable local commands. */ }
    const controller = new AbortController(), startedAt = configRevision.current;
    const timeout = setTimeout(() => controller.abort(), 5000);
    void (async () => {
      try {
        const response = await fetch('/forma-runtime-config.json', { signal: controller.signal, cache: 'no-store', redirect: 'error' });
        if (!response.ok) return;
        const hosted = hostedCommandService(await response.json(), window.location.origin);
        if (hosted && !controller.signal.aborted && configRevision.current === startedAt) { configRef.current = hosted; updateConfig(hosted); }
      } catch { /* Offline and local builds retain all built-in commands. */ }
      finally { clearTimeout(timeout); }
    })();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);
  const saveConfig = (settings: Config) => { configRevision.current++; configRef.current = settings; updateConfig(settings); try { localStorage.setItem('forma-command-service', JSON.stringify(settings)); } catch { /* Current-session settings still work. */ } };
  const adapters = useRef<Partial<Record<Mode, TeachingAdapter>>>({}), revision = useRef(0);
  const engine = useRef<ReturnType<typeof createTeachingRuntime<Snapshot>> | null>(null);
  const mic = useRef<ReturnType<typeof createPushToTalk> | null>(null), held = useRef(false);
  const current = () => { const adapter = adapters.current[modeRef.current]; if (!adapter) throw new Error('The teaching model is loading.'); return adapter; };
  const pause = () => { Object.values(adapters.current).forEach(adapter => adapter.pause()); if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); };
  const changeMode = (next: Mode) => { modeRef.current = next; setMode(next); };
  const cancelAnalysis = () => { analysisRequest.current?.abort(); analysisRequest.current = null; setAnalysisPending(false); };
  const runAnalysis = async (question: string) => {
    cancelAnalysis(); engine.current?.cancel('Explaining the current model.');
    setAnalysis(null); setAnalysisError(''); setAnalysisQuestion(question);
    const controller = new AbortController(), requestedRevision = revision.current, requestedMode = modeRef.current;
    analysisRequest.current = controller; setAnalysisPending(true);
    try {
      const settings = configRef.current, context = current().analysisContext?.();
      if (!settings.enabled || !settings.url) throw new Error('Connect the AI service in Settings to discuss this model.');
      if (!context) throw new Error('The teaching model is still loading.');
      const response = await fetch(`${settings.url}/api/analyze-teaching`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]) });
      const value = await response.json();
      if (controller.signal.aborted || requestedRevision !== revision.current || requestedMode !== modeRef.current) return;
      if (!response.ok) throw new Error(typeof value.detail === 'string' ? value.detail : 'The model explanation is unavailable. Try again.');
      setAnalysis(validateSceneAnalysis(value));
    } catch (error) { if (!controller.signal.aborted && requestedRevision === revision.current && requestedMode === modeRef.current) setAnalysisError(error instanceof Error ? error.message : 'The model explanation is unavailable.'); }
    finally { if (analysisRequest.current === controller) { analysisRequest.current = null; setAnalysisPending(false); } }
  };
  const submitText = async (text: string) => {
    if (analyzeModeRef.current && !/^(?:stop|cancel|undo(?: that)?|redo(?: that)?)\.?$/i.test(text.trim())) { await runAnalysis(text); return; }
    cancelAnalysis(); setAnalysis(null); setAnalysisError('');
    await engine.current?.submit(text, { interpreter: preferAIRef.current && configRef.current.enabled ? 'ai' : 'auto' });
  };
  useEffect(() => {
    let alive = true;
    engine.current = createTeachingRuntime<Snapshot>({
      context: () => ({ ...current().context(), canRestoreWorkspace: adapters.current.case?.context().canRestoreWorkspace, revision: revision.current }),
      capture: () => ({ mode: modeRef.current, scenes: Object.fromEntries(Object.entries(adapters.current).map(([key, adapter]) => [key, adapter.capture()])) }),
      settle: signal => current().settle?.(signal) ?? Promise.resolve(),
      restore: snapshot => flushSync(() => { for (const key of ['case', 'workflow'] as const) if (snapshot.scenes[key]) adapters.current[key]?.restore(snapshot.scenes[key]); changeMode(snapshot.mode); }),
      preflight: (actions, from) => {
        if (actions[0]?.kind === 'workspace') {
          const action = actions[0], target = adapters.current.case;
          if (!target) throw new Error('The editing workspace is loading.');
          target.preflight([action], from?.scenes.case);
          if (action.action === 'explore') {
            if (!adapters.current.workflow?.exportSetup || !target.importSetup) throw new Error('This demonstration cannot be opened in Try Mode.');
            adapters.current.workflow.exportSetup(from?.scenes.workflow);
          } else if (action.action === 'lesson' && !target.sourceLesson?.(from?.scenes.case)) throw new Error('There is no source lesson to restore.');
          return;
        }
        let nextMode = from?.mode || modeRef.current; const groups: { mode: Mode; actions: TeachingAction[] }[] = [];
        for (const action of actions) {
          nextMode = teachingActionMode(action, nextMode);
          if (groups.at(-1)?.mode !== nextMode) groups.push({ mode: nextMode, actions: [] });
          groups.at(-1)!.actions.push(action);
        }
        for (const group of groups) adapters.current[group.mode]?.preflight(group.actions, from?.scenes[group.mode]);
      },
      apply: async (action, signal) => {
        let applied: boolean | Promise<boolean> = true;
        flushSync(() => {
        if (action.kind === 'workspace') {
          const target = adapters.current.case!, source = adapters.current.workflow!;
          if (action.action === 'explore') target.importSetup!(source.exportSetup!(), source.capture());
          else if (action.action === 'lesson') { source.restore(target.sourceLesson!()); changeMode('workflow'); return; }
          else if (!target.apply(action)) throw new Error('The original workspace could not be restored.');
          changeMode('case'); return;
        }
        if (action.kind === 'case' || (action.kind === 'workflow' && action.action === 'start') || action.kind === 'anatomy-lesson') changeMode(teachingActionMode(action, modeRef.current));
        if (action.kind === 'workflow' && action.action === 'exit') { current().pause(); changeMode('case'); return; }
        applied = current().apply(action, signal);
        });
        if (!await applied) throw new Error('That action is unavailable in the current teaching view.');
      },
      pause: () => { if (alive) flushSync(pause); }, narration: target => current().narration(target),
      speak: (text, signal) => new Promise<void>((resolve, reject) => {
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { reject(new Error(`Speech output is unavailable. ${text}`)); return; }
        const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = .95;
        const finish = () => { signal.removeEventListener('abort', abort); resolve(); };
        const abort = () => { window.speechSynthesis.cancel(); finish(); };
        utterance.onend = finish; utterance.onerror = event => { signal.removeEventListener('abort', abort); if (signal.aborted || event.error === 'interrupted' || event.error === 'canceled') resolve(); else reject(new Error(`Speech output could not start. ${text}`)); };
        signal.addEventListener('abort', abort, { once: true }); window.speechSynthesis.speak(utterance);
      }),
      interpret: async (text, context, signal) => {
        const settings = configRef.current;
        if (!settings.enabled || !settings.url) throw new Error('Use a supported command, or connect the OpenAI service in Settings for flexible wording. Try “show roots” or “start braces workflow”.');
        const wireContext = interpreterTeachingContext(context);
        const response = await fetch(`${settings.url}/api/interpret-teaching`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, context: wireContext }), signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]) });
        const result = await response.json(); if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Interpretation failed. Built-in commands remain available.'); return result;
      }, publish: setRuntime,
    });
    const browser = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    mic.current = createPushToTalk(speechConstructor(browser), { state: setCapture, final: text => { held.current = false; void submitText(text); }, error: message => { held.current = false; setRuntime(state => ({ ...state, phase: 'idle', message, error: true })); } });
    return () => { alive = false; analysisRequest.current?.abort(); mic.current?.dispose(); engine.current?.dispose(); window.speechSynthesis?.cancel(); };
  }, []);
  const start = () => { if (held.current) return; cancelAnalysis(); held.current = true; engine.current?.cancel('Listening for your instruction…'); mic.current?.start(); };
  const finish = () => { held.current = false; mic.current?.finish(); };
  const cancel = () => { cancelAnalysis(); held.current = false; mic.current?.cancel(); engine.current?.cancel(); };
  const interact = () => { revision.current++; cancelAnalysis(); setAnalysis(null); if (held.current || mic.current?.getState().phase !== 'idle') { held.current = false; mic.current?.cancel(); } if (engine.current?.getState().phase !== 'idle') engine.current?.cancel('The scene changed. Give the next instruction when ready.'); };
  // Pointing is part of the current utterance. Keep capture alive, but invalidate
  // any older interpretation that has already been submitted.
  const referenceInteraction = () => { revision.current++; cancelAnalysis(); setAnalysis(null); if (engine.current?.getState().phase !== 'idle') engine.current?.cancel('The target changed. Give the next instruction when ready.'); };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cancel(); return; }
      if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.altKey || event.metaKey || (event.target as HTMLElement).closest('input,textarea,select,button,dialog,[contenteditable="true"]')) return;
      event.preventDefault(); start();
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space' && held.current) { event.preventDefault(); finish(); } };
    const blur = () => { if (held.current || mic.current?.getState().phase !== 'idle') { held.current = false; mic.current?.cancel(); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  });
  return <Context.Provider value={{ mode, runtime, capture, config, preferAI: preferAI && config.enabled, setPreferAI: enabled => { interact(); analyzeModeRef.current = false; setAnalyzeMode(false); preferAIRef.current = enabled; setPreferAI(enabled); }, analyzeMode, setAnalyzeMode: enabled => { interact(); analyzeModeRef.current = enabled; setAnalyzeMode(enabled); }, analysis, analysisPending, analysisError, analysisQuestion, dismissAnalysis: () => { cancelAnalysis(); setAnalysis(null); setAnalysisError(''); }, run: async text => { mic.current?.cancel(); await submitText(text); }, runControl: async text => { cancelAnalysis(); setAnalysis(null); setAnalysisError(''); mic.current?.cancel(); await engine.current?.submit(text); }, execute: async (actions, summary) => { cancelAnalysis(); setAnalysis(null); mic.current?.cancel(); await engine.current?.submitActions(actions, summary); }, start, finish, cancel, interact, referenceInteraction, resetHistory: () => { revision.current++; cancelAnalysis(); setAnalysis(null); setAnalysisError(''); engine.current?.clearHistory(); }, setConfig: settings => { interact(); saveConfig(settings); }, register: (key, adapter) => { adapters.current[key] = adapter; return () => { if (adapters.current[key] === adapter) delete adapters.current[key]; }; } }}>{children}</Context.Provider>;
}

export function TeachingCommandBar({ label = 'Dental command', placeholder = 'Try “show upper jaw, hide gums, and highlight molars”', value, onChange, inputRef, suggestions }: { suggestions?: string[]; label?: string; placeholder?: string; value?: string; onChange?: (text: string) => void; inputRef?: RefObject<HTMLInputElement | null> }) {
  const teaching = useTeaching(), [draft, setDraft] = useState(''), [examples, setExamples] = useState(false);
  const text = value ?? draft, setText = onChange || setDraft;
  const capturing = teaching.capture.phase !== 'idle', phase = capturing ? teaching.capture.phase : teaching.analysisPending ? 'analyzing' : teaching.runtime.phase;
  const commands = suggestions ?? (teaching.mode === 'case' ? ['select upper front six', 'install brackets here', 'put a wire through these brackets', 'activate that wire by 0.5 mm', 'show what happens', 'use 0.018 inch wire instead', 'explain that movement', 'move selected segment posteriorly 1 mm', 'lock upper molars', 'place brackets only', 'place palatal expander', 'return to source lesson', 'restore my workspace', 'show roots', 'show displacement traces', 'save arrangement as example one', 'compare with original', 'undo that'] : ['start anatomy lesson', 'show the root', 'make the bone transparent', 'show cutaway', 'compare translation and tipping', 'repeat that more slowly', 'return to the lesson', 'try this setup', 'restore my workspace', 'reveal answer', 'hide answer', 'explain this step', 'undo that']);
  return <section className="command-section teaching-command-bar" aria-label="Voice classroom controls">
    <div className="command-title"><span><Mic size={16} />HOLD SPACE TO SPEAK</span>{teaching.config.enabled && <button className="teaching-ai-toggle" aria-label="Use AI interpreter" aria-pressed={teaching.preferAI && !teaching.analyzeMode} title="Send requests to AI for interpretation. Stop and Undo remain local." onClick={() => teaching.setPreferAI(teaching.analyzeMode || !teaching.preferAI)}><Sparkles size={13} />Ask AI</button>}{teaching.config.enabled && <button className="teaching-ai-toggle" aria-label="Analyze current model" aria-pressed={teaching.analyzeMode} onClick={() => teaching.setAnalyzeMode(!teaching.analyzeMode)}>Analyze</button>}<span className={`teaching-phase ${phase}`} role="status">{phase === 'idle' ? 'Ready' : phase}</span><button onClick={() => setExamples(!examples)}>Examples</button><button className="teaching-stop" onClick={teaching.cancel} aria-label="Stop classroom action"><Square size={13} />Stop</button></div>
    {examples && <div className="workflow-command-examples">{commands.map(command => <button key={command} onClick={() => setText(command)}>{command}</button>)}</div>}
    <form className={`command-input ${capturing ? 'listening' : ''}`} onSubmit={event => { event.preventDefault(); if (text.trim()) { void teaching.run(text); setText(''); } }}>
      <input ref={inputRef} aria-label={label} value={text} maxLength={teaching.analyzeMode ? 800 : 1000} placeholder={teaching.analyzeMode ? 'Ask about this setup: “Why did these teeth move so little?”' : teaching.preferAI ? 'Ask naturally: “Could you show the upper teeth and reveal their roots?”' : placeholder} onChange={event => setText(event.target.value)} />
      <button type="button" className={`voice-button ${capturing ? 'recording' : ''}`} aria-label="Hold to talk" disabled={!teaching.capture.supported} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); teaching.start(); }} onPointerUp={event => { event.currentTarget.releasePointerCapture(event.pointerId); teaching.finish(); }} onPointerCancel={teaching.cancel} onKeyDown={event => { if ((event.code === 'Space' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); teaching.start(); } }} onKeyUp={event => { if (event.code === 'Space' || event.key === 'Enter') { event.preventDefault(); teaching.finish(); } }}><Mic size={18} /><span>Hold to talk</span></button>
      <button type="submit" className="command-submit" disabled={!text.trim()} aria-label="Run classroom command"><ArrowRight size={18} /></button>
    </form>
    {(capturing || teaching.runtime.transcript) && <div className="speech-caption"><span className="speech-dot" /><strong>{capturing ? 'Hearing' : 'You'}</strong><span>{capturing ? teaching.capture.transcript || 'Release to run your instruction.' : teaching.runtime.transcript}</span></div>}
    <div className={`command-status ${teaching.runtime.error ? 'error' : ''}`}><span>{teaching.runtime.interpreter && <strong className="command-origin">{teaching.runtime.interpreter === 'ai' ? 'AI reply' : 'Local'}</strong>}{teaching.runtime.message}</span><button className="text-button" onClick={() => void teaching.run('undo that')} aria-label="Undo classroom request"><Undo2 size={14} />Undo</button></div>
    {(teaching.analyzeMode || teaching.analysis) && <div className="teaching-analysis-hint">Analyze explains the current model without changing it. Select Ask AI to control the model.</div>}
    {(teaching.analysis || teaching.analysisError) && <details className="teaching-analysis-card" open><summary>AI model explanation {teaching.analysis && <small>{teaching.analysis.model}</small>}</summary><div><p className="analysis-question">{teaching.analysisQuestion}</p>{teaching.analysisError ? <p role="alert">{teaching.analysisError}</p> : teaching.analysis && <><p><strong>In this setup</strong> {teaching.analysis.observations}</p><p>{teaching.analysis.explanation}</p><p className="analysis-limits">{teaching.analysis.limitations}</p><p><strong>Ask students</strong> {teaching.analysis.studentQuestion}</p></>}<button className="text-button" onClick={teaching.dismissAnalysis}>Close explanation</button></div></details>}
    {!teaching.capture.supported && <p className="speech-unavailable">Microphone recognition needs a supported browser such as Chrome or Edge. Typed commands work here.</p>}
  </section>;
}
