import type { Command } from '../commands';
import type { WorkflowId, WorkflowPhase } from '../workflows';
import type { TryAction } from '../try-mode';
import type { MechanicsAction } from '../mechanics/types';
import type { DentalArrangementId } from '../dental-arrangements';
import type { ToothStudyAction } from '../tooth-study/types';

export type TeachingAction =
  | ToothStudyAction
  | { kind: 'mechanics'; action: MechanicsAction }
  | { kind: 'dental-arrangement'; id: DentalArrangementId }
  | { kind: 'case'; action: 'load' | 'variant'; id: string }
  | { kind: 'case'; action: 'play' | 'pause' | 'reset' | 'explore' | 'return' }
  | { kind: 'case'; action: 'progress'; value: number }
  | { kind: 'workspace'; action: 'explore' | 'restore' | 'lesson' }
  | {
      kind: 'appliance-display';
      preset: 'none' | 'brackets' | 'braces' | 'expander-bands' | 'palatal-expander' | 'retainer';
      progress?: number;
      palate?: boolean;
    }
  | { kind: 'try'; action: TryAction }
  | { kind: 'try-display'; target: 'traces' | 'curve'; visible: boolean }
  | { kind: 'try-playback'; direction: 'forward' | 'reverse' }
  | { kind: 'history'; action: 'undo' | 'redo'; count: number }
  | { kind: 'dental'; command: Command }
  | { kind: 'select'; teeth: string[] }
  | { kind: 'view'; view: 'front' | 'right' | 'left' | 'occlusal' | 'perspective' }
  | { kind: 'arch'; arch: 'upper' | 'lower' | 'both' }
  | {
      kind: 'toggle';
      target: 'braces' | 'roots' | 'gums' | 'labels' | 'grid' | 'attachments';
      visible: boolean;
    }
  | { kind: 'comparison'; mode: 'before' | 'after' | 'overlay' | 'off' }
  | { kind: 'stage'; action: 'next' | 'previous' }
  | { kind: 'stage'; action: 'exact'; stage: number }
  | { kind: 'stop' }
  | { kind: 'focus'; tooth: string }
  | { kind: 'lecture'; enabled: boolean }
  | { kind: 'lesson-step'; action: 'next' | 'previous' | 'restart' }
  | { kind: 'workflow'; action: 'start'; id: WorkflowId }
  | { kind: 'workflow'; action: 'next' | 'previous' | 'restart' | 'play' | 'pause' | 'exit' }
  | { kind: 'workflow'; action: 'phase'; phase: WorkflowPhase }
  | { kind: 'anatomy'; action: 'bone' | 'cutaway' | 'ligament'; visible: boolean }
  | { kind: 'anatomy'; action: 'opacity'; value: number }
  | { kind: 'speed'; value: 0.5 | 1 | 2 }
  | { kind: 'narrate'; target: 'step' | 'answer' }
  | { kind: 'question'; visible: boolean }
  | { kind: 'progress'; value: number }
  | { kind: 'replay'; slower: boolean }
  | { kind: 'return-lesson' }
  | { kind: 'anatomy-lesson'; action: 'start' | 'translation' | 'tipping' }
  | {
      kind: 'attachment';
      action: 'add' | 'remove';
      teeth: string[];
      shape?: 'rectangle' | 'ellipsoid' | 'beveled';
    };
