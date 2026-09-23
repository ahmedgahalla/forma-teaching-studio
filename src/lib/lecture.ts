import { CommandValidationError, parseCommand, type Command } from './commands';
import type { WorkflowId, WorkflowPhase } from './workflows';
import type { TryAction } from './try-mode';

export type TeachingAction =
  | { kind: 'case'; action: 'load' | 'variant'; id: string }
  | { kind: 'case'; action: 'play' | 'pause' | 'reset' | 'explore' | 'return' }
  | { kind: 'case'; action: 'progress'; value: number }
  | { kind: 'workspace'; action: 'explore' | 'restore' | 'lesson' }
  | { kind: 'appliance-display'; preset: 'none' | 'brackets' | 'braces' | 'expander-bands' | 'palatal-expander' | 'retainer'; progress?: number; palate?: boolean }
  | { kind: 'try'; action: TryAction }
  | { kind: 'try-display'; target: 'traces' | 'curve'; visible: boolean }
  | { kind: 'try-playback'; direction: 'forward' | 'reverse' }
  | { kind: 'history'; action: 'undo' | 'redo'; count: number }
  | { kind: 'dental'; command: Command }
  | { kind: 'select'; teeth: string[] }
  | { kind: 'view'; view: 'front' | 'right' | 'left' | 'occlusal' | 'perspective' }
  | { kind: 'arch'; arch: 'upper' | 'lower' | 'both' }
  | { kind: 'toggle'; target: 'braces' | 'roots' | 'gums' | 'labels' | 'grid' | 'attachments'; visible: boolean }
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
  | { kind: 'attachment'; action: 'add' | 'remove'; teeth: string[]; shape?: 'rectangle' | 'ellipsoid' | 'beveled' };

const wordValues: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const digit = '(?:zero|one|two|three|four|five|six|seven|eight|nine)';
const unit = '(?:one|two|three|four|five|six|seven|eight|nine)';
const tens = '(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)';
const underHundred = `(?:${tens}(?: ${unit})?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|${digit})`;
const wholeNumber = `(?:${unit} hundred(?: (?:and )?${underHundred})?|${underHundred})`;

function spokenInteger(words: string): number {
  const pieces = words.split(' ').filter(word => word !== 'and');
  const hundred = pieces.indexOf('hundred');
  return hundred === -1 ? pieces.reduce((sum, word) => sum + wordValues[word], 0) : wordValues[pieces[0]] * 100 + pieces.slice(hundred + 1).reduce((sum, word) => sum + wordValues[word], 0);
}

/** Normalize only known speech forms; never infer a target, amount, or treatment plan. */
export function normalizeSpeechCommand(text: string): string {
  let normalized = text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^please /, '').replace(/ please[.!]?$/, '').replace(/[.!]$/, '');
  normalized = normalized.replace(new RegExp(`\\b(${tens})-(${unit})\\b`, 'g'), '$1 $2');
  normalized = normalized.replace(new RegExp(`\\b(${wholeNumber}) and (?:a )?half\\b`, 'g'), (_, words: string) => String(spokenInteger(words) + 0.5));
  normalized = normalized.replace(/\b(?:a half|half(?: a)?) (?=millimet(?:er|re)s?\b|mm\b)/g, '0.5 ');
  normalized = normalized.replace(/\b(?:a quarter|quarter(?: a)?) (?=millimet(?:er|re)s?\b|mm\b)/g, '0.25 ');
  normalized = normalized.replace(new RegExp(`\\bpoint (${digit}(?: ${digit})*)\\b`, 'g'), (_, words: string) => `point ${words.split(' ').map(word => wordValues[word]).join('')}`);
  normalized = normalized.replace(new RegExp(`\\b${wholeNumber}\\b`, 'g'), words => String(spokenInteger(words)));
  normalized = normalized.replace(/\b(\d+) point (\d+)\b/g, '$1.$2').replace(/\bpoint (\d+)\b/g, '0.$1');
  normalized = normalized.replace(/\b(minus|negative) (?=\d)/g, '-').replace(/\b(?:plus|positive) (?=\d)/g, '+');
  normalized = normalized.replace(/\bmillimet(?:er|re)s?\b/g, 'mm').replace(/\bdegrees?\b/g, 'degrees');
  return normalized.trim();
}

const toggleNames: Record<string, Extract<TeachingAction, { kind: 'toggle' }>['target']> = {
  braces: 'braces', brackets: 'braces', 'brackets and wires': 'braces',
  root: 'roots', roots: 'roots', 'schematic roots': 'roots', gums: 'gums', gingiva: 'gums',
  labels: 'labels', 'tooth numbers': 'labels', grid: 'grid', attachments: 'attachments',
};

/** One explicit teaching action per utterance; all tooth operations share the base parser. */
export function parseTeachingCommand(text: string, selected: string | null | undefined, ids: readonly string[], selectedIds?: readonly string[]): TeachingAction {
  const command = normalizeSpeechCommand(text);
  if (/^(?:try this setup|explore this setup|explore this lesson)$/.test(command)) return { kind: 'workspace', action: 'explore' };
  if (/^(?:restore my workspace|back to my saved case)$/.test(command)) return { kind: 'workspace', action: 'restore' };
  if (command === 'return to source lesson') return { kind: 'workspace', action: 'lesson' };
  const appliancePresets: Record<string, Extract<TeachingAction, { kind: 'appliance-display' }>['preset']> = {
    'place brackets only': 'brackets', 'place braces': 'braces', 'place expander bands': 'expander-bands',
    'place palatal expander': 'palatal-expander', 'place fixed retainer': 'retainer', 'remove teaching appliance': 'none',
  };
  if (Object.hasOwn(appliancePresets, command)) return { kind: 'appliance-display', preset: appliancePresets[command] };
  const history = command.match(/^(undo|redo) (?:the )?(?:last )?(\d+)(?: (?:changes?|requests?|commands?))?$/);
  if (history) {
    const count = Number(history[2]);
    if (!Number.isInteger(count) || count < 1 || count > 10) throw new CommandValidationError('Undo or redo between 1 and 10 complete requests.');
    return { kind: 'history', action: history[1] as 'undo' | 'redo', count };
  }
  if (/^(?:undo|redo)(?: that| the last (?:command|request))?$/.test(command)) return { kind: 'dental', command: { type: command.startsWith('undo') ? 'undo' : 'redo' } };
  if (/^(?:repeat(?: that| it)?|replay(?: that| it)?|do that again)(?: (?:more )?slowly| slower)?$/.test(command)) return { kind: 'replay', slower: /slowly|slower/.test(command) };
  if (/^(?:return|go back|back) to (?:the )?lesson$/.test(command)) return { kind: 'return-lesson' };
  if (/^(?:explain|narrate|read) (?:this|the|current) step$/.test(command)) return { kind: 'narrate', target: 'step' };
  if (/^(?:explain|narrate|read) (?:the )?answer(?: aloud)?$/.test(command)) return { kind: 'narrate', target: 'answer' };
  const question = command.match(/^(show|reveal|hide) (?:the )?(?:answer|explanation)$/);
  if (question) return { kind: 'question', visible: question[1] !== 'hide' };
  if (command === 'pause halfway') return { kind: 'progress', value: 0.5 };
  if (/^(?:start|show|open) (?:the )?(?:tooth )?anatomy lesson$/.test(command)) return { kind: 'anatomy-lesson', action: 'start' };
  if (command === 'compare translation and tipping') return { kind: 'anatomy-lesson', action: 'start' };
  const anatomyLesson = command.match(/^(?:demonstrate|show) (?:tooth )?(translation|tipping)(?: (?:in the )?anatomy lesson)?$/);
  if (anatomyLesson) return { kind: 'anatomy-lesson', action: anatomyLesson[1] as 'translation' | 'tipping' };
  const anatomy = command.match(/^(show|hide) (?:the )?(bone|alveolar bone|cutaway|cutaway view|ligament|periodontal ligament|pdl)$/);
  if (anatomy) return { kind: 'anatomy', action: /bone/.test(anatomy[2]) ? 'bone' : /cutaway/.test(anatomy[2]) ? 'cutaway' : 'ligament', visible: anatomy[1] === 'show' };
  const boneAppearance = command.match(/^make (?:the )?bone (transparent|opaque)$/);
  if (boneAppearance) return { kind: 'anatomy', action: 'opacity', value: boneAppearance[1] === 'transparent' ? 0.25 : 1 };
  const opacity = command.match(/^(?:set )?(?:bone )?opacity (?:to )?([\d.]+)(?:\s*(%|percent))?$/);
  if (opacity) {
    const value = Number(opacity[1]) / (opacity[2] ? 100 : 1);
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new CommandValidationError('Use bone opacity from 0 to 1, or 0 to 100 percent.');
    return { kind: 'anatomy', action: 'opacity', value };
  }
  const speed = command.match(/^(?:(?:set )?(?:playback )?speed (?:to )?)?(slow|half speed|normal speed|normal|fast|double speed|0\.5x|1x|2x)$/);
  if (speed) return { kind: 'speed', value: ['slow', 'half speed', '0.5x'].includes(speed[1]) ? 0.5 : ['fast', 'double speed', '2x'].includes(speed[1]) ? 2 : 1 };
  const workflow = command.match(/^start (braces|fixed braces|palatal expansion|archwire expansion) workflow$/);
  if (workflow) return { kind: 'workflow', action: 'start', id: workflow[1] === 'palatal expansion' ? 'palatal-expansion' : workflow[1] === 'archwire expansion' ? 'archwire-expansion' : 'fixed-braces' };
  if (command === 'next workflow step') return { kind: 'workflow', action: 'next' };
  if (command === 'previous workflow step') return { kind: 'workflow', action: 'previous' };
  if (command === 'restart workflow') return { kind: 'workflow', action: 'restart' };
  if (command === 'play demonstration') return { kind: 'workflow', action: 'play' };
  if (command === 'pause demonstration') return { kind: 'workflow', action: 'pause' };
  if (command === 'exit workflow') return { kind: 'workflow', action: 'exit' };
  const workflowPhases: Record<string, WorkflowPhase> = {
    'install brackets': 'brackets', 'bond brackets': 'brackets',
    'insert archwire': 'wire', 'engage archwire': 'wire', 'install expander': 'wire', 'fit expander': 'wire',
    'show forces': 'forces', 'activate expander': 'forces',
    'show movement': 'movement', 'demonstrate movement': 'movement', 'show retention': 'retention',
  };
  if (Object.hasOwn(workflowPhases, command)) return { kind: 'workflow', action: 'phase', phase: workflowPhases[command] };
  const select = (selector: string): string[] => {
    const scope = /^(?:all|upper|lower)$/.test(selector) ? `${selector} teeth` : selector;
    const parsed = parseCommand(`move ${scope} x 1 mm`, selected, ids, selectedIds);
    if ('teeth' in parsed) return parsed.teeth;
    if ('tooth' in parsed) return [parsed.tooth];
    throw new Error('Choose a tooth or a named group.');
  };
  const selection = command.match(/^(?:select|highlight) (.+)$/);
  if (selection) return { kind: 'select', teeth: select(selection[1]) };

  const view = command.match(/^(?:(?:show|switch to) (?:the )?)?(front|right|left|occlusal|3 ?d|perspective)(?: view)?$/);
  if (view) return { kind: 'view', view: view[1] === '3d' || view[1] === '3 d' ? 'perspective' : view[1] as 'front' | 'right' | 'left' | 'occlusal' | 'perspective' };
  const arch = command.match(/^(?:show|isolate) (?:the )?(upper|lower|both|all) (?:arch|arches|teeth|jaws?)$/);
  if (arch) return { kind: 'arch', arch: arch[1] === 'all' || arch[1] === 'both' ? 'both' : arch[1] as 'upper' | 'lower' };

  if (/^(?:show )?(?:before|initial)(?: positions?)?$/.test(command)) return { kind: 'comparison', mode: 'before' };
  if (/^(?:show )?(?:after|final)(?: positions?)?$/.test(command)) return { kind: 'comparison', mode: 'after' };
  if (/^(?:show (?:the )?original(?: overlay| positions?)?|show (?:comparison|overlay)|comparison on|overlay on)$/.test(command)) return { kind: 'comparison', mode: 'overlay' };
  if (/^(?:hide (?:the )?original(?: overlay| positions?)?|hide (?:comparison|overlay)|comparison off|overlay off)$/.test(command)) return { kind: 'comparison', mode: 'off' };

  const toggle = command.match(/^(show|hide) (?:the )?(.+)$/);
  if (toggle && Object.hasOwn(toggleNames, toggle[2])) return { kind: 'toggle', target: toggleNames[toggle[2]], visible: toggle[1] === 'show' };
  const toggleSuffix = command.match(/^(?:turn (?:the )?)?(.+) (on|off)$/);
  if (toggleSuffix && Object.hasOwn(toggleNames, toggleSuffix[1])) return { kind: 'toggle', target: toggleNames[toggleSuffix[1]], visible: toggleSuffix[2] === 'on' };

  const step = command.match(/^(next|previous) (?:lesson )?step$/);
  if (step) return { kind: 'lesson-step', action: step[1] as 'next' | 'previous' };
  if (command === 'restart lesson') return { kind: 'lesson-step', action: 'restart' };
  const stage = command.match(/^(next|previous) stage$/);
  if (stage) return { kind: 'stage', action: stage[1] as 'next' | 'previous' };
  const exactStage = command.match(/^(?:(?:go to|show) )?stage (\d+)$/);
  if (exactStage) {
    const value = Number(exactStage[1]);
    if (!Number.isInteger(value) || value < 0 || value > 50) throw new CommandValidationError('Choose a display stage from 0 to 50.');
    return { kind: 'stage', action: 'exact', stage: value };
  }
  if (/^(?:stop|pause)(?: animation| playback)?$/.test(command)) return { kind: 'stop' };
  if (/^(?:lecture mode on|enter lecture mode|start lecture)$/.test(command)) return { kind: 'lecture', enabled: true };
  if (/^(?:lecture mode off|exit lecture mode|end lecture)$/.test(command)) return { kind: 'lecture', enabled: false };

  const focus = command.match(/^(?:focus(?: on)?|zoom to) (.+)$/);
  if (focus) {
    const targets = select(focus[1]);
    if (targets.length !== 1) throw new CommandValidationError('Focus requires exactly one tooth.');
    return { kind: 'focus', tooth: targets[0] };
  }
  const attachment = command.match(/^(add|remove) (?:(rectangular|rectangle|ellipsoid|ellipsoidal|beveled|bevelled) )?attachments? (to|on|from) (.+)$/);
  if (attachment) {
    const teeth = select(attachment[4]);
    if (attachment[1] === 'remove') {
      if (attachment[2] || attachment[3] !== 'from') throw new CommandValidationError('Use “remove attachments from” and name the teeth.');
      return { kind: 'attachment', action: 'remove', teeth };
    }
    if (attachment[3] === 'from') throw new CommandValidationError('Use “add attachments to” and name the teeth.');
    const shape = attachment[2]?.startsWith('ellipsoid') ? 'ellipsoid' : attachment[2]?.startsWith('bevel') ? 'beveled' : 'rectangle';
    return { kind: 'attachment', action: 'add', teeth, shape };
  }
  return { kind: 'dental', command: parseCommand(command, selected, ids, selectedIds) };
}

export type TeachingLesson = { id: string; title: string; description: string; steps: { command: string; caption: string }[] };

/** Illustrative geometry demonstrations; values are not movement prescriptions. */
export const LESSONS: TeachingLesson[] = [
  {
    id: 'translation-tip-torque', title: 'Translation, tip and torque',
    description: 'Compare displacement with rotations about two different reference axes.',
    steps: [
      { command: 'reset all teeth', caption: 'Reset the demonstration to its original geometric positions.' },
      { command: 'focus tooth 11', caption: 'Use one upper central incisor to inspect three movement types.' },
      { command: 'move tooth 11 buccally 1 mm', caption: 'Translation shifts every point equally while preserving orientation.' },
      { command: 'reset tooth 11', caption: 'Return to the starting position before examining angular changes.' },
      { command: 'tip tooth 11 8 degrees', caption: 'Tip rotates about the buccolingual reference axis.' },
      { command: 'torque tooth 11 -6 degrees', caption: 'Torque adds rotation about the mesiodistal reference axis. The crown-centre pivot illustrates geometry, not root control.' },
    ],
  },
  {
    id: 'upper-lower-intrusion', title: 'Intrusion across both arches',
    description: 'Observe how rootward movement has opposite vertical directions in the two arches.',
    steps: [
      { command: 'reset all teeth', caption: 'Reset the demonstration to its original positions.' },
      { command: 'show both arches', caption: 'Compare the upper and lower incisors together.' },
      { command: 'select upper incisors', caption: 'The group contains all upper incisors present in the case.' },
      { command: 'intrude upper incisors 1 mm', caption: 'Upper intrusion follows the rootward direction defined by each reference frame.' },
      { command: 'intrude lower incisors 1 mm', caption: 'Lower intrusion follows its own rootward direction; it does not share the upper arch’s world-Y sign.' },
      { command: 'show original overlay', caption: 'The original positions make the two opposing geometric displacements visible.' },
    ],
  },
  {
    id: 'groups-and-expansion', title: 'Groups and buccal expansion',
    description: 'Use group selection to compare individual tooth directions within one arch.',
    steps: [
      { command: 'reset all teeth', caption: 'Start from the original setup.' },
      { command: 'show upper arch', caption: 'Isolate the upper arch for the demonstration.' },
      { command: 'select upper premolars', caption: 'Select the present first and second upper premolars on both sides.' },
      { command: 'move selected teeth buccally 0.5 mm', caption: 'Each selected tooth moves 0.5 mm along its own buccal reference direction.' },
      { command: 'select upper teeth', caption: 'Extend the selection to the whole upper arch.' },
      { command: 'expand upper teeth 0.5 mm', caption: 'Expansion here adds 0.5 mm buccally per tooth. It is not a requested total arch-width change or a skeletal expansion simulation.' },
    ],
  },
  {
    id: 'appliances-and-comparison', title: 'Appliances and before / after',
    description: 'Show how the schematic fixed appliance follows crowns during a geometric demonstration.',
    steps: [
      { command: 'reset all teeth', caption: 'Restore the original tooth positions.' },
      { command: 'show brackets', caption: 'Brackets follow the tooth crowns; the wire is a display connection rather than a force model.' },
      { command: 'select teeth 11,21', caption: 'Select the two upper central incisors.' },
      { command: 'move selected teeth buccally 1 mm', caption: 'Move the pair to create an easily visible classroom example.' },
      { command: 'show before', caption: 'Return the display to the original position without deleting the demonstration.' },
      { command: 'show after', caption: 'Show the final position again. This comparison describes geometry, not treatment feasibility.' },
    ],
  },
];
