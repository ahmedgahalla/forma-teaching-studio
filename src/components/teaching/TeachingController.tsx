'use client';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { createTeachingRuntime, type RuntimeState } from '@/lib/teaching-runtime';
import { createPushToTalk, type CaptureState } from '@/lib/push-to-talk';
import { speechConstructor } from '@/lib/speech';
import type { TeachingAction } from '@/lib/lecture';
import {
  interpreterTeachingContext,
  teachingActionMode,
  type TeachingContext,
} from '@/lib/classroom';
import type { WorkflowTransfer } from '@/lib/workflow-transfer';
import {
  hostedCommandService,
  savedCommandService,
  type CommandServiceConfig as Config,
} from '@/lib/command-service';
import {
  validateSceneAnalysis,
  type SceneAnalysis,
  type SceneAnalysisContext,
} from '@/lib/scene-analysis';

type Mode = 'case' | 'workflow';
export type TeachingAdapter = {
  context: () => Omit<TeachingContext, 'revision'>;
  capture: () => unknown;
  restore: (snapshot: unknown) => void;
  apply: (action: TeachingAction, signal?: AbortSignal) => boolean | Promise<boolean>;
  preflight: (actions: TeachingAction[], from?: unknown) => void;
  pause: () => void;
  narration: (target: 'step' | 'answer' | 'mechanics') => string;
  settle?: (signal: AbortSignal) => Promise<void>;
  exportSetup?: (from?: unknown) => WorkflowTransfer;
  importSetup?: (setup: WorkflowTransfer, originSnapshot: unknown) => void;
  sourceLesson?: (from?: unknown) => unknown;
  analysisContext?: () => SceneAnalysisContext;
};
type Snapshot = { mode: Mode; scenes: Partial<Record<Mode, unknown>> };
const initialRuntime: RuntimeState = {
  phase: 'idle',
  message: 'Hold Space to speak, or type an instruction.',
  error: false,
  transcript: '',
};
type Controller = {
  mode: Mode;
  runtime: RuntimeState;
  capture: CaptureState;
  config: Config;
  preferAI: boolean;
  setPreferAI: (enabled: boolean) => void;
  analyzeMode: boolean;
  setAnalyzeMode: (enabled: boolean) => void;
  analysis: SceneAnalysis | null;
  analysisPending: boolean;
  analysisError: string;
  analysisQuestion: string;
  dismissAnalysis: () => void;
  run: (text: string) => Promise<void>;
  runControl: (text: string) => Promise<void>;
  start: () => void;
  finish: () => void;
  cancel: () => void;
  execute: (actions: TeachingAction[], summary: string) => Promise<void>;
  interact: () => void;
  referenceInteraction: () => void;
  resetHistory: () => void;
  setConfig: (config: Config) => void;
  register: (mode: Mode, adapter: TeachingAdapter) => () => void;
};
const Context = createContext<Controller | null>(null);
export const useTeaching = () => {
  const value = useContext(Context);
  if (!value) throw new Error('Teaching controller is unavailable.');
  return value;
};
export function useTeachingAdapter(mode: Mode, adapter: TeachingAdapter) {
  const teaching = useTeaching();
  useLayoutEffect(() => teaching.register(mode, adapter));
}

export function TeachingProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('case'),
    modeRef = useRef<Mode>('case');
  const [runtime, setRuntime] = useState(initialRuntime),
    [capture, setCapture] = useState<CaptureState>({
      supported: false,
      phase: 'idle',
      transcript: '',
    });
  const [config, updateConfig] = useState<Config>({ enabled: false, url: '' }),
    configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });
  const configRevision = useRef(0);
  const [preferAI, setPreferAI] = useState(false),
    preferAIRef = useRef(false);
  const [analyzeMode, setAnalyzeMode] = useState(false),
    analyzeModeRef = useRef(false);
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null),
    [analysisPending, setAnalysisPending] = useState(false),
    [analysisError, setAnalysisError] = useState(''),
    [analysisQuestion, setAnalysisQuestion] = useState('');
  const analysisRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      const saved = savedCommandService(
        JSON.parse(localStorage.getItem('forma-command-service') || 'null'),
      );
      if (saved) {
        configRef.current = saved;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time saved-config hydration on mount; deriving would read localStorage every render
        updateConfig(saved);
        return;
      }
    } catch {
      /* A blocked or cleared browser preference must not disable local commands. */
    }
    const controller = new AbortController(),
      startedAt = configRevision.current;
    const timeout = setTimeout(() => controller.abort(), 5000);
    void (async () => {
      try {
        const response = await fetch('/forma-runtime-config.json', {
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
        });
        if (!response.ok) return;
        const hosted = hostedCommandService(await response.json(), window.location.origin);
        if (hosted && !controller.signal.aborted && configRevision.current === startedAt) {
          configRef.current = hosted;
          updateConfig(hosted);
        }
      } catch {
        /* Offline and local builds retain all built-in commands. */
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);
  const saveConfig = (settings: Config) => {
    configRevision.current++;
    configRef.current = settings;
    updateConfig(settings);
    try {
      localStorage.setItem('forma-command-service', JSON.stringify(settings));
    } catch {
      /* Current-session settings still work. */
    }
  };
  const adapters = useRef<Partial<Record<Mode, TeachingAdapter>>>({}),
    revision = useRef(0);
  const engine = useRef<ReturnType<typeof createTeachingRuntime<Snapshot>> | null>(null);
  const mic = useRef<ReturnType<typeof createPushToTalk> | null>(null),
    held = useRef(false);
  const current = () => {
    const adapter = adapters.current[modeRef.current];
    if (!adapter) throw new Error('The teaching model is loading.');
    return adapter;
  };
  const pause = () => {
    Object.values(adapters.current).forEach(adapter => adapter.pause());
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  };
  const changeMode = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
  };
  const cancelAnalysis = () => {
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    setAnalysisPending(false);
  };
  const runAnalysis = async (question: string) => {
    cancelAnalysis();
    engine.current?.cancel('Explaining the current model.');
    setAnalysis(null);
    setAnalysisError('');
    setAnalysisQuestion(question);
    const controller = new AbortController(),
      requestedRevision = revision.current,
      requestedMode = modeRef.current;
    analysisRequest.current = controller;
    setAnalysisPending(true);
    try {
      const settings = configRef.current,
        context = current().analysisContext?.();
      if (!settings.enabled || !settings.url)
        throw new Error('Connect the AI service in Settings to discuss this model.');
      if (!context) throw new Error('The teaching model is still loading.');
      const response = await fetch(`${settings.url}/api/analyze-teaching`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
      });
      const value = await response.json();
      if (
        controller.signal.aborted ||
        requestedRevision !== revision.current ||
        requestedMode !== modeRef.current
      )
        return;
      if (!response.ok)
        throw new Error(
          typeof value.detail === 'string'
            ? value.detail
            : 'The model explanation is unavailable. Try again.',
        );
      setAnalysis(validateSceneAnalysis(value));
    } catch (error) {
      if (
        !controller.signal.aborted &&
        requestedRevision === revision.current &&
        requestedMode === modeRef.current
      )
        setAnalysisError(
          error instanceof Error ? error.message : 'The model explanation is unavailable.',
        );
    } finally {
      if (analysisRequest.current === controller) {
        analysisRequest.current = null;
        setAnalysisPending(false);
      }
    }
  };
  const submitText = async (text: string) => {
    if (
      analyzeModeRef.current &&
      !/^(?:stop|cancel|undo(?: that)?|redo(?: that)?)\.?$/i.test(text.trim())
    ) {
      await runAnalysis(text);
      return;
    }
    cancelAnalysis();
    setAnalysis(null);
    setAnalysisError('');
    await engine.current?.submit(text, {
      interpreter: preferAIRef.current && configRef.current.enabled ? 'ai' : 'auto',
    });
  };
  useEffect(() => {
    let alive = true;
    engine.current = createTeachingRuntime<Snapshot>({
      context: () => ({
        ...current().context(),
        canRestoreWorkspace: adapters.current.case?.context().canRestoreWorkspace,
        revision: revision.current,
      }),
      capture: () => ({
        mode: modeRef.current,
        scenes: Object.fromEntries(
          Object.entries(adapters.current).map(([key, adapter]) => [key, adapter.capture()]),
        ),
      }),
      settle: signal => current().settle?.(signal) ?? Promise.resolve(),
      restore: snapshot =>
        flushSync(() => {
          for (const key of ['case', 'workflow'] as const)
            if (snapshot.scenes[key]) adapters.current[key]?.restore(snapshot.scenes[key]);
          changeMode(snapshot.mode);
        }),
      preflight: (actions, from) => {
        if (actions[0]?.kind === 'workspace') {
          const action = actions[0],
            target = adapters.current.case;
          if (!target) throw new Error('The editing workspace is loading.');
          target.preflight([action], from?.scenes.case);
          if (action.action === 'explore') {
            if (!adapters.current.workflow?.exportSetup || !target.importSetup)
              throw new Error('This demonstration cannot be opened in Try Mode.');
            adapters.current.workflow.exportSetup(from?.scenes.workflow);
          } else if (action.action === 'lesson' && !target.sourceLesson?.(from?.scenes.case))
            throw new Error('There is no source lesson to restore.');
          return;
        }
        let nextMode = from?.mode || modeRef.current;
        const groups: { mode: Mode; actions: TeachingAction[] }[] = [];
        for (const action of actions) {
          nextMode = teachingActionMode(action, nextMode);
          if (groups.at(-1)?.mode !== nextMode) groups.push({ mode: nextMode, actions: [] });
          groups.at(-1)!.actions.push(action);
        }
        for (const group of groups)
          adapters.current[group.mode]?.preflight(group.actions, from?.scenes[group.mode]);
      },
      apply: async (action, signal) => {
        let applied: boolean | Promise<boolean> = true;
        flushSync(() => {
          if (action.kind === 'workspace') {
            const target = adapters.current.case!,
              source = adapters.current.workflow!;
            if (action.action === 'explore')
              target.importSetup!(source.exportSetup!(), source.capture());
            else if (action.action === 'lesson') {
              source.restore(target.sourceLesson!());
              changeMode('workflow');
              return;
            } else if (!target.apply(action))
              throw new Error('The original workspace could not be restored.');
            changeMode('case');
            return;
          }
          if (
            action.kind === 'case' ||
            (action.kind === 'workflow' && action.action === 'start') ||
            action.kind === 'anatomy-lesson'
          )
            changeMode(teachingActionMode(action, modeRef.current));
          if (action.kind === 'workflow' && action.action === 'exit') {
            current().pause();
            changeMode('case');
            return;
          }
          applied = current().apply(action, signal);
        });
        if (!(await applied))
          throw new Error('That action is unavailable in the current teaching view.');
      },
      pause: () => {
        if (alive) flushSync(pause);
      },
      narration: target => current().narration(target),
      speak: (text, signal) =>
        new Promise<void>((resolve, reject) => {
          if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            reject(new Error(`Speech output is unavailable. ${text}`));
            return;
          }
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = 0.95;
          const finish = () => {
            signal.removeEventListener('abort', abort);
            resolve();
          };
          const abort = () => {
            window.speechSynthesis.cancel();
            finish();
          };
          utterance.onend = finish;
          utterance.onerror = event => {
            signal.removeEventListener('abort', abort);
            if (signal.aborted || event.error === 'interrupted' || event.error === 'canceled')
              resolve();
            else reject(new Error(`Speech output could not start. ${text}`));
          };
          signal.addEventListener('abort', abort, { once: true });
          window.speechSynthesis.speak(utterance);
        }),
      interpret: async (text, context, signal) => {
        const settings = configRef.current;
        if (!settings.enabled || !settings.url)
          throw new Error(
            'Use a supported command, or connect the OpenAI service in Settings for flexible wording. Try “show roots” or “start braces workflow”.',
          );
        const wireContext = interpreterTeachingContext(context);
        const response = await fetch(`${settings.url}/api/interpret-teaching`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, context: wireContext }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            typeof result.detail === 'string'
              ? result.detail
              : 'Interpretation failed. Built-in commands remain available.',
          );
        return result;
      },
      publish: setRuntime,
    });
    const browser = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    mic.current = createPushToTalk(speechConstructor(browser), {
      state: setCapture,
      final: text => {
        held.current = false;
        void submitText(text);
      },
      error: message => {
        held.current = false;
        setRuntime(state => ({ ...state, phase: 'idle', message, error: true }));
      },
    });
    return () => {
      alive = false;
      analysisRequest.current?.abort();
      mic.current?.dispose();
      engine.current?.dispose();
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only service discovery and speech-synthesis cleanup; deps would re-run discovery
  }, []);
  const start = () => {
    if (held.current) return;
    cancelAnalysis();
    held.current = true;
    engine.current?.cancel('Listening for your instruction…');
    mic.current?.start();
  };
  const finish = () => {
    held.current = false;
    mic.current?.finish();
  };
  const cancel = () => {
    cancelAnalysis();
    held.current = false;
    mic.current?.cancel();
    engine.current?.cancel();
  };
  const interact = () => {
    revision.current++;
    cancelAnalysis();
    setAnalysis(null);
    if (held.current || mic.current?.getState().phase !== 'idle') {
      held.current = false;
      mic.current?.cancel();
    }
    if (engine.current?.getState().phase !== 'idle')
      engine.current?.cancel('The scene changed. Give the next instruction when ready.');
  };
  // Pointing is part of the current utterance. Keep capture alive, but invalidate
  // any older interpretation that has already been submitted.
  const referenceInteraction = () => {
    revision.current++;
    cancelAnalysis();
    setAnalysis(null);
    if (engine.current?.getState().phase !== 'idle')
      engine.current?.cancel('The target changed. Give the next instruction when ready.');
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancel();
        return;
      }
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        (event.target as HTMLElement).closest(
          'input,textarea,select,button,dialog,[contenteditable="true"]',
        )
      )
        return;
      event.preventDefault();
      start();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space' && held.current) {
        event.preventDefault();
        finish();
      }
    };
    const blur = () => {
      if (held.current || mic.current?.getState().phase !== 'idle') {
        held.current = false;
        mic.current?.cancel();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  });
  return (
    <Context.Provider
      value={{
        mode,
        runtime,
        capture,
        config,
        preferAI: preferAI && config.enabled,
        setPreferAI: enabled => {
          interact();
          analyzeModeRef.current = false;
          setAnalyzeMode(false);
          preferAIRef.current = enabled;
          setPreferAI(enabled);
        },
        analyzeMode,
        setAnalyzeMode: enabled => {
          interact();
          analyzeModeRef.current = enabled;
          setAnalyzeMode(enabled);
        },
        analysis,
        analysisPending,
        analysisError,
        analysisQuestion,
        dismissAnalysis: () => {
          cancelAnalysis();
          setAnalysis(null);
          setAnalysisError('');
        },
        run: async text => {
          mic.current?.cancel();
          await submitText(text);
        },
        runControl: async text => {
          cancelAnalysis();
          setAnalysis(null);
          setAnalysisError('');
          mic.current?.cancel();
          await engine.current?.submit(text);
        },
        execute: async (actions, summary) => {
          cancelAnalysis();
          setAnalysis(null);
          mic.current?.cancel();
          await engine.current?.submitActions(actions, summary);
        },
        start,
        finish,
        cancel,
        interact,
        referenceInteraction,
        resetHistory: () => {
          revision.current++;
          cancelAnalysis();
          setAnalysis(null);
          setAnalysisError('');
          engine.current?.clearHistory();
        },
        setConfig: settings => {
          interact();
          saveConfig(settings);
        },
        register: (key, adapter) => {
          adapters.current[key] = adapter;
          return () => {
            if (adapters.current[key] === adapter) delete adapters.current[key];
          };
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export { TeachingCommandBar } from './TeachingCommandBar';
