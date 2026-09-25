import type { TeachingAction } from '../lecture';
import { TEACHING_CASES } from '../teaching-cases';
import type { TeachingContext } from './types';
import { CommandValidationError } from '../commands';

export const VERBS =
  '(?:load|choose|show|hide|highlight|select|focus|zoom|move|rotate|tip|torque|intrude|extrude|retract|protract|expand|constrict|distali[sz]e|mesiali[sz]e|reset|start|open|isolate|switch|install|bond|insert|engage|fit|activate|demonstrate|compare|play|animate|pause|stop|next|previous|restart|create|generate|add|remove|set|make|turn|repeat|replay|do|undo|redo|explain|narrate|read|reveal|return|go|back|lecture|enter|exit|end|leave|lock|unlock|close|change|increase|decrease|save|apply|accept|discard|cancel|try|explore|restore|place|put|connect|use|calculate|solve|fix|release|widen|attach|run|thread|replace|preview)';
export function clauses(text: string): string[] {
  // Split only before an action verb: commas/"and" inside tooth lists and appliance names stay intact.
  return text
    .split(
      new RegExp(
        `(?:,\\s*(?:(?:and|then)\\s+)?|\\s+(?:and then|and|then)\\s+|[;.]\\s+)(?=${VERBS}\\b)`,
        'i',
      ),
    )
    .map(part => part.trim())
    .filter(Boolean);
}

const caseName = (text: string) =>
  text.toLowerCase().replace(/[-·]/g, ' ').replace(/\s+/g, ' ').trim();
const caseControl =
  /^(?:(?:play|pause|reset|restart) (?:the )?(?:prepared )?case|(?:explore|try) this arrangement|return to (?:the )?prepared case|(?:set|show) (?:the )?case progress\b)/;
export function isCaseClause(text: string, context: TeachingContext): boolean {
  return (
    /^load\b|^(?:open|start) (?:a |the )?(?:prepared |teaching )?case\b|^choose\b/.test(text) ||
    caseControl.test(text) ||
    (!!context.caseId &&
      context.mode === 'case' &&
      !context.caseExploring &&
      /^(?:(?:play|pause) demonstration|pause halfway)$/.test(text)) ||
    (!!context.caseId &&
      context.mode === 'case' &&
      /^(?:demonstrate\b|try this setup$|explore this setup$|(?:return|go back|back) to (?:the )?lesson$|(?:how (?:do|should) (?:i|we) )?(?:treat|correct|fix|recommend|suggest|plan)\b)/.test(
        text,
      ))
  );
}

/** Case aliases select only catalog entries; selecting a variation never implies playback. */
export function parseCaseAction(
  text: string,
  context: TeachingContext,
): Extract<TeachingAction, { kind: 'case' }> | undefined {
  if (!isCaseClause(text, context)) return undefined;
  const separate = () => {
    if (clauses(text).length > 1)
      throw new CommandValidationError(
        'Use a prepared case command as a separate request, then give commands for its arrangement.',
      );
  };
  const load = text.match(
    /^(?:load|open|start) (?:(?:a|the) )?(?:(?:prepared|teaching) )?(?:case )?(.+?)(?: case)?$/,
  );
  if (load) {
    const name = caseName(load[1]);
    const definition = TEACHING_CASES.find(item =>
      [item.id, item.title, ...(item.aliases || [])].some(alias => caseName(alias) === name),
    );
    if (definition) return { kind: 'case', action: 'load', id: definition.id };
    separate();
    throw new CommandValidationError(
      `Choose a prepared case: ${TEACHING_CASES.map(item => item.aliases?.[0] || item.title).join(', ')}.`,
    );
  }
  const control = text.match(/^(play|pause|reset|restart) (?:the )?(?:prepared )?case$/);
  if (control)
    return {
      kind: 'case',
      action: control[1] === 'restart' ? 'reset' : (control[1] as 'play' | 'pause' | 'reset'),
    };
  if (/^(play|pause) demonstration$/.test(text))
    return { kind: 'case', action: text.startsWith('play') ? 'play' : 'pause' };
  if (text === 'pause halfway') return { kind: 'case', action: 'progress', value: 0.5 };
  if (/^(?:(?:explore|try) this arrangement|try this setup|explore this setup)$/.test(text))
    return { kind: 'case', action: 'explore' };
  if (/^(?:return|go back|back) to (?:the )?(?:prepared case|lesson)$/.test(text))
    return { kind: 'case', action: 'return' };
  const progress = text.match(
    /^(?:set|show) (?:the )?case progress (?:to )?([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|percent)?$/,
  );
  if (progress)
    return {
      kind: 'case',
      action: 'progress',
      value: Number(progress[1]) / (progress[2] ? 100 : 1),
    };
  const definition = TEACHING_CASES.find(item => item.id === context.caseId);
  if (!definition || context.mode !== 'case')
    throw new CommandValidationError(
      'Load a prepared teaching case before choosing its authored variation.',
    );
  const requested = text.match(
    /^(?:demonstrate|choose) (?:the )?(?:variation |variant |approach )?(.+)$/,
  );
  const movementAliases: Record<string, string[]> = {
    tip: ['tipping', 'crown tipping'],
    torque: ['torque'],
    'axial-rotation': ['rotation'],
    'anterior-intrusion': ['intrusion', 'incisor intrusion', 'anterior intrusion'],
  };
  const variant =
    requested &&
    definition.variants.find(item =>
      [item.id, item.title, ...(item.aliases || []), ...(movementAliases[item.id] || [])].some(
        alias => caseName(alias) === caseName(requested[1]),
      ),
    );
  if (variant) return { kind: 'case', action: 'variant', id: variant.id };
  separate();
  throw new CommandValidationError(
    `Choose an authored variation for ${definition.title}: ${definition.variants.map(item => item.title).join('; ')}. These are prepared teaching examples.`,
  );
}

/** Destination routing and interpreter context are shared with the provider and unit-tested. */
export function teachingActionMode(
  action: TeachingAction,
  current: TeachingContext['mode'],
): TeachingContext['mode'] {
  if (
    action.kind === 'case' ||
    action.kind === 'dental-arrangement' ||
    (action.kind === 'workflow' && action.action === 'exit')
  )
    return 'case';
  if (action.kind === 'anatomy-lesson' || (action.kind === 'workflow' && action.action === 'start'))
    return 'workflow';
  return current;
}

export function interpreterTeachingContext(context: TeachingContext): TeachingContext {
  const wire = { ...context };
  for (const field of [
    'caseId',
    'caseVariantId',
    'caseExploring',
    'tryMode',
    'lockedIds',
    'tryPreview',
    'tryLastMovement',
    'tryLastIds',
    'savedArrangementNames',
    'tryArchTargets',
    'canRestoreWorkspace',
    'hasWorkflowOrigin',
    'autoApply',
  ] as const)
    delete wire[field];
  if (
    wire.lastActions?.some(action =>
      [
        'case',
        'dental-arrangement',
        'try',
        'history',
        'try-display',
        'try-playback',
        'workspace',
        'appliance-display',
      ].includes(action.kind),
    )
  )
    delete wire.lastActions;
  return wire;
}

export function isWorkspaceClause(text: string, context: TeachingContext) {
  return (
    /^(?:try this setup|explore this setup|explore this lesson|restore my workspace|back to my saved case|return to source lesson)$/.test(
      text,
    ) ||
    (context.mode === 'case' &&
      context.hasWorkflowOrigin &&
      /^(?:return|go back|back) to (?:the )?lesson$/.test(text))
  );
}

export function isApplianceClause(text: string) {
  return /^(?:place (?:brackets|braces|expander|palatal|fixed)|remove teaching appliance)\b/.test(
    text,
  );
}

export function isTryClause(text: string) {
  return /^(?:(?:enter|start|open|exit|leave) try(?: mode)?|return to (?:the )?try mode|(?:lock|unlock|close|save (?:arrangement|group)|change (?:the )?last movement|make (?:the )?last movement|halve (?:the )?last movement)|(?:move|rotate) (?:the )?(?:selected )?segment|(?:change|increase|decrease) (?:the )?width|fit .+ (?:to|onto) (?:the )?(?:(?:upper|lower) )?arch|(?:apply|accept|discard|cancel) (?:the )?preview|compare (?:with )?(?:the )?(?:original|saved|arrangement)|unrestricted (?:movement )?(?:on|off)|(?:show|hide) (?:the )?(?:displacement traces|arch curve)|play (?:in reverse|forward)|reverse animation|pause halfway)\b/.test(
    text,
  );
}

/** Explicit geometric mechanics only; values and allocation rules are never guessed. */
