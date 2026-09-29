import { createContext, useContext, useLayoutEffect } from 'react';
import type { TeachingNarrationTarget } from '@/lib/teaching-narration';
import type { RuntimeState } from '@/lib/teaching-runtime';
import type { CaptureState } from '@/lib/push-to-talk';
import type { HandsFreeState } from '@/lib/voice/hands-free';
import type { VoiceSettings } from '@/lib/voice/settings';
import type { TeachingAction } from '@/lib/lecture';
import type { TeachingContext } from '@/lib/classroom';
import type { WorkflowTransfer } from '@/lib/workflow-transfer';
import type { CommandServiceConfig as Config } from '@/lib/command-service';
import type { SceneAnalysis, SceneAnalysisContext } from '@/lib/scene-analysis';

export type Mode = 'case' | 'workflow';
export type TeachingAdapter = {
  context: () => Omit<TeachingContext, 'revision'>;
  capture: () => unknown;
  restore: (snapshot: unknown) => void;
  apply: (action: TeachingAction, signal?: AbortSignal) => boolean | Promise<boolean>;
  preflight: (actions: TeachingAction[], from?: unknown) => void;
  pause: () => void;
  narration: (target: TeachingNarrationTarget) => string;
  settle?: (signal: AbortSignal) => Promise<void>;
  exportSetup?: (from?: unknown) => WorkflowTransfer;
  importSetup?: (setup: WorkflowTransfer, originSnapshot: unknown) => void;
  sourceLesson?: (from?: unknown) => unknown;
  analysisContext?: () => SceneAnalysisContext;
};
export type Snapshot = { mode: Mode; scenes: Partial<Record<Mode, unknown>> };
export const teachingPhaseLabels = {
  idle: 'Ready',
  starting: 'Starting microphone…',
  listening: 'Listening',
  finishing: 'Finishing speech',
  analyzing: 'Explaining…',
  interpreting: 'Understanding…',
  executing: 'Updating model…',
  speaking: 'Speaking',
};
export const initialRuntime: RuntimeState = {
  phase: 'idle',
  message: 'Hold Space to speak, or type an instruction.',
  error: false,
  transcript: '',
};
type Controller = {
  mode: Mode;
  runtime: RuntimeState;
  capture: CaptureState;
  voice: HandsFreeState;
  voiceSettings: VoiceSettings;
  setVoiceSettings: (settings: VoiceSettings) => void;
  toggleHandsFree: () => void;
  narration: string;
  narrationFallback: boolean;
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
export const Context = createContext<Controller | null>(null);
export const useTeaching = () => {
  const value = useContext(Context);
  if (!value) throw new Error('Teaching controller is unavailable.');
  return value;
};
export function useTeachingAdapter(mode: Mode, adapter: TeachingAdapter) {
  const teaching = useTeaching();
  useLayoutEffect(() => teaching.register(mode, adapter));
}
