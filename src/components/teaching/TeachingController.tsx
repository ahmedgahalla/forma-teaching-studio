'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createTeachingRuntime, type RuntimeState } from '@/lib/teaching-runtime';
import type { TeachingAction } from '@/lib/lecture';
import { interpreterTeachingContext, teachingActionMode } from '@/lib/classroom';
import {
  hostedCommandService,
  savedCommandService,
  type CommandServiceConfig as Config,
} from '@/lib/command-service';
import { validateSceneAnalysis, type SceneAnalysis } from '@/lib/scene-analysis';
import {
  Context,
  initialRuntime,
  type Mode,
  type Snapshot,
  type TeachingAdapter,
} from './teaching-context';
import { useTeachingVoice } from './useTeachingVoice';
import { usePresenterKeys } from './usePresenterKeys';
export { useTeaching, useTeachingAdapter, type TeachingAdapter } from './teaching-context';

export function TeachingProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('case'),
    modeRef = useRef<Mode>('case');
  const [runtime, setRuntime] = useState(initialRuntime);
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
  const voiceControl = useTeachingVoice({
    submit: text => submitText(text),
    interrupt: () => {
      cancelAnalysis();
      engine.current?.cancel('Listening for your instruction…');
    },
    cancel: () => cancel(),
    canStop: () => !!adapters.current[modeRef.current]?.context().playing,
    message: (message, error = false, transcript = '') =>
      setRuntime(state => ({ ...state, phase: 'idle', message, error, transcript })),
  });
  const current = () => {
    const adapter = adapters.current[modeRef.current];
    if (!adapter) throw new Error('The teaching model is loading.');
    return adapter;
  };
  const pause = () => {
    Object.values(adapters.current).forEach(adapter => adapter.pause());
    voiceControl.stopSpeaking();
  };
  const changeMode = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
  };
  const cancelAnalysis = () => {
    if (analysisRequest.current) setRuntime(engine.current?.getState() ?? initialRuntime);
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
    const report = (message: string, error = false, phase: RuntimeState['phase'] = 'idle') => {
      const feedback: RuntimeState = {
        message,
        error,
        phase,
        transcript: question,
        interpreter: 'ai',
      };
      setRuntime(feedback);
      return feedback;
    };
    report('Explaining the current model…', false, 'interpreting');
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
      return report('Model explanation ready. Open Commands to read it.');
    } catch (error) {
      if (
        !controller.signal.aborted &&
        requestedRevision === revision.current &&
        requestedMode === modeRef.current
      ) {
        const message =
          error instanceof Error ? error.message : 'The model explanation is unavailable.';
        setAnalysisError(message);
        return report(message, true);
      }
    } finally {
      if (analysisRequest.current === controller) {
        analysisRequest.current = null;
        setAnalysisPending(false);
      }
    }
  };
  const submitText = async (text: string) => {
    if (/^stop listening[.!?]?$/i.test(text.trim())) {
      voiceControl.stopListening();
      return;
    }
    if (
      analyzeModeRef.current &&
      !/^(?:stop|cancel|undo(?: that)?|redo(?: that)?)\.?$/i.test(text.trim())
    ) {
      return runAnalysis(text);
    }
    cancelAnalysis();
    setAnalysis(null);
    setAnalysisError('');
    await engine.current?.submit(text, {
      interpreter: preferAIRef.current && configRef.current.enabled ? 'ai' : 'auto',
    });
    return engine.current?.getState();
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
          if (action.kind === 'workflow' && action.action === 'exit') {
            current().pause();
            changeMode('case');
            return;
          }
          changeMode(teachingActionMode(action, modeRef.current));
          applied = current().apply(action, signal);
        });
        if (!(await applied))
          throw new Error('That action is unavailable in the current teaching view.');
      },
      pause: () => {
        if (alive) flushSync(pause);
      },
      narration: target => current().narration(target),
      speak: voiceControl.speak,
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
    return () => {
      alive = false;
      analysisRequest.current?.abort();
      engine.current?.dispose();
      voiceControl.stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only service discovery and speech-synthesis cleanup; deps would re-run discovery
  }, []);
  const cancel = () => {
    cancelAnalysis();
    voiceControl.cancelCapture();
    voiceControl.invalidate();
    engine.current?.cancel();
  };
  const interact = () => {
    revision.current++;
    cancelAnalysis();
    setAnalysis(null);
    voiceControl.cancelCapture();
    voiceControl.invalidate();
    if (engine.current?.getState().phase !== 'idle')
      engine.current?.cancel('The scene changed. Give the next instruction when ready.');
  };
  // Pointing is part of the current utterance. Keep capture alive, but invalidate
  // any older interpretation that has already been submitted.
  const referenceInteraction = () => {
    revision.current++;
    cancelAnalysis();
    setAnalysis(null);
    voiceControl.invalidate();
    if (engine.current?.getState().phase !== 'idle')
      engine.current?.cancel('The target changed. Give the next instruction when ready.');
  };
  const runControl = async (text: string) => {
    cancelAnalysis();
    setAnalysis(null);
    setAnalysisError('');
    voiceControl.cancelCapture();
    voiceControl.invalidate();
    await engine.current?.submit(text);
  };
  usePresenterKeys(runControl, voiceControl.toggleHandsFree);
  return (
    <Context.Provider
      value={{
        mode,
        runtime,
        capture: voiceControl.capture,
        voice: voiceControl.voice,
        voiceSettings: voiceControl.voiceSettings,
        setVoiceSettings: voiceControl.setVoiceSettings,
        toggleHandsFree: voiceControl.toggleHandsFree,
        narration: voiceControl.narration,
        narrationFallback: voiceControl.narrationFallback,
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
          voiceControl.cancelCapture();
          voiceControl.invalidate();
          await submitText(text);
        },
        runControl,
        execute: async (actions, summary) => {
          cancelAnalysis();
          setAnalysis(null);
          voiceControl.cancelCapture();
          voiceControl.invalidate();
          await engine.current?.submitActions(actions, summary);
        },
        start: voiceControl.start,
        finish: voiceControl.finish,
        cancel,
        interact,
        referenceInteraction,
        resetHistory: () => {
          revision.current++;
          voiceControl.invalidate();
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
