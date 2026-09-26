import { UnrecognizedCommandError, CommandValidationError } from '../commands';
import { normalizeSpeechCommand, parseTeachingCommand, type TeachingAction } from '../lecture';
import {
  isMechanicsClause,
  isMechanicsSolveClause,
  planMechanicsClause,
} from '../mechanics-commands';
import { advance } from './advance';
import { copyContext } from './types';
import {
  clauses,
  isApplianceClause,
  isCaseClause,
  isTryClause,
  isWorkspaceClause,
  parseCaseAction,
} from './parse-clauses';
import { parseTryActions } from './parse-try';
import type { TeachingContext, TeachingPlan } from './types';
import { validateTeachingPlan } from './plan-validate';

export function buildTeachingPlan(text: string, context: TeachingContext): TeachingPlan {
  if (typeof text !== 'string' || !text.trim() || text.length > 1500)
    throw new Error('Give a classroom request of at most 1500 characters.');
  const normalized = normalizeSpeechCommand(text);
  const source = /^(?:stop|pause)(?:[.;,]| and| then)\s*(?:undo|redo)(?: that)?$/.test(normalized)
    ? normalized.match(/(?:undo|redo)(?: that)?$/)![0]
    : normalized;
  const next = copyContext(context),
    overrides = { arch: false, view: false, selection: false },
    actions: TeachingAction[] = [];
  if (isDentalArrangementClause(source)) {
    const match = source.match(
      /^(?:load|open|show) (?:the )?(?:dental )?class (i|ii|iii|1|2|3)(?: (?:division|div) (1|2))?(?: arrangement)?$/,
    );
    if (!match || ((match[1] === 'ii' || match[1] === '2') && !match[2]))
      throw new CommandValidationError(
        'Choose dental Class I, Class II division 1, Class II division 2, or Class III as a separate request.',
      );
    if (match[2] && !['ii', '2'].includes(match[1]))
      throw new CommandValidationError('Divisions 1 and 2 belong to the dental Class II examples.');
    const id = ['i', '1'].includes(match[1])
      ? 'dental-class-i'
      : ['iii', '3'].includes(match[1])
        ? 'dental-class-iii'
        : match[2] === '1'
          ? 'dental-class-ii-division-1'
          : 'dental-class-ii-division-2';
    return validateTeachingPlan(
      { actions: [{ kind: 'dental-arrangement', id }], summary: source, clarification: null },
      context,
      { allowLocalActions: true },
    );
  }
  if (clauses(source).some(isDentalArrangementClause))
    throw new CommandValidationError(
      'Load a dental arrangement as a separate request, then give commands for its model.',
    );
  // Match complete catalog titles before splitting their commas and conjunctions.
  const caseAction = parseCaseAction(source, context);
  if (caseAction) {
    try {
      return validateTeachingPlan(
        { actions: [caseAction], summary: source, clarification: null },
        context,
        { sourceText: source, allowLocalActions: true },
      );
    } catch (error) {
      throw new CommandValidationError(
        error instanceof Error ? error.message : 'Choose an available prepared case.',
      );
    }
  }
  if (clauses(source).length > 1 && clauses(source).some(clause => isCaseClause(clause, context)))
    throw new CommandValidationError(
      'Use a prepared case command as a separate request, then give commands for its arrangement.',
    );
  if (
    clauses(source).length > 1 &&
    clauses(source).some(clause => isWorkspaceClause(clause, context))
  )
    throw new CommandValidationError(
      'Change workspaces as a separate request, then give commands for the destination model.',
    );
  if (
    clauses(source).length > 1 &&
    clauses(source).some(clause => /^return to (?:the )?try mode$/.test(clause))
  )
    throw new Error(
      'Return to Try Mode as a separate request, then give commands for the restored case.',
    );
  const append = (action: TeachingAction) => {
    try {
      if (actions.length >= 8)
        throw new Error('Use at most eight actions in one classroom request.');
      advance(next, action, overrides);
      actions.push(action);
    } catch (error) {
      throw new CommandValidationError(
        error instanceof Error ? error.message : 'This action is unavailable in the current scene.',
      );
    }
  };
  const sourceClauses = clauses(source);
  for (let clauseIndex = 0; clauseIndex < sourceClauses.length; clauseIndex++) {
    let clause = sourceClauses[clauseIndex];
    const mechanicsActions = planMechanicsClause(clause, next);
    if (mechanicsActions) {
      mechanicsActions.forEach(action => append({ kind: 'mechanics', action }));
      if (
        mechanicsActions.length > 1 &&
        mechanicsActions.at(-1)?.type === 'solve' &&
        isMechanicsSolveClause(sourceClauses[clauseIndex + 1] || '')
      )
        clauseIndex++;
      continue;
    }
    if (clause === 'compare translation and tipping') {
      for (const action of ['translation', 'tipping'] as const) {
        append({ kind: 'anatomy-lesson', action });
        append({ kind: 'workflow', action: 'play' });
      }
      continue;
    }
    const anatomyDemonstration = clause.match(
      /^demonstrate (?:tooth )?(translation|tipping)(?: (?:in the )?anatomy lesson)?$/,
    );
    if (anatomyDemonstration) {
      append({
        kind: 'anatomy-lesson',
        action: anatomyDemonstration[1] as 'translation' | 'tipping',
      });
      append({ kind: 'workflow', action: 'play' });
      continue;
    }
    const demonstration = clause.match(
      /^(?:demonstrate|show) (?:the )?(fixed braces|braces|palatal expansion|archwire expansion)(?: (?:more )?slowly)?$/,
    );
    if (demonstration) {
      append({
        kind: 'workflow',
        action: 'start',
        id:
          demonstration[1] === 'palatal expansion'
            ? 'palatal-expansion'
            : demonstration[1] === 'archwire expansion'
              ? 'archwire-expansion'
              : 'fixed-braces',
      });
      if (/slowly$/.test(clause)) append({ kind: 'speed', value: 0.5 });
      append({ kind: 'workflow', action: 'play' });
      continue;
    }
    if (/^(?:demonstrate|show) expansion(?: slowly)?$/.test(clause))
      throw new Error('Name palatal expansion or archwire expansion.');
    if (/\bthem\b/.test(clause)) {
      if (!next.selectedIds.length)
        throw new CommandValidationError('Select a tooth group before referring to them.');
      clause = clause.replace(/\bthem\b/g, 'selected teeth');
    }
    if (
      next.arch !== 'both' &&
      !/^(?:save (?:arrangement|group)|compare (?:with )?(?:saved|arrangement))\b/.test(clause)
    )
      clause = clause.replace(
        /\b(?:incisors?|canines?|premolars?|molars?|anterior teeth|posterior teeth)\b/g,
        (family, offset: number, full: string) =>
          /(?:upper|lower|maxillary|mandibular)(?: (?:left|right))?\s+$/.test(full.slice(0, offset))
            ? family
            : `${next.arch} ${family}`,
      );
    const explicitPreview = /^preview /.test(clause);
    if (explicitPreview) clause = clause.slice(8);
    const replacement = clause.match(
      /^make (?:that|it) ([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?: (mm|degrees))?(?: instead)?$/,
    );
    if (replacement && next.tryLastMovement && !replacement[2]) {
      append({ kind: 'try', action: { type: 'revise', amount: Number(replacement[1]) } });
      if (next.autoApply && !explicitPreview) append({ kind: 'try', action: { type: 'apply' } });
      continue;
    }
    if (replacement && next.tryLastMovement)
      clause = `change last movement to ${replacement[1]} ${replacement[2]}`;
    const tryActions = parseTryActions(clause, next);
    if (tryActions) {
      tryActions.forEach(append);
      if (
        next.autoApply &&
        !explicitPreview &&
        tryActions.some(
          action => action.kind === 'try' && ['preview', 'revise'].includes(action.action.type),
        )
      )
        append({ kind: 'try', action: { type: 'apply' } });
      continue;
    }
    if (
      /^(?:move|intrude|extrude|retract|protract|expand|constrict|distali[sz]e|mesiali[sz]e|rotate|tip|torque)\b/.test(
        clause,
      ) &&
      !/\b(?:mm|cm|degrees?|deg)\b|°/.test(clause)
    ) {
      const angular = /^(?:rotate|tip|torque)\b/.test(clause);
      try {
        // This placeholder checks only whether the requested target/direction is known.
        // It is never included in the returned plan or sent to the executor.
        parseTeachingCommand(
          `${clause} 1 ${angular ? 'degrees' : 'mm'}`,
          next.selected,
          next.availableIds,
          next.selectedIds,
        );
        return {
          actions: [],
          summary: '',
          clarification: angular
            ? 'How many degrees should the teeth rotate?'
            : 'How many millimetres should the teeth move?',
        };
      } catch {
        /* Other unsupported wording remains available to the optional interpreter. */
      }
    }
    const action = parseTeachingCommand(clause, next.selected, next.availableIds, next.selectedIds);
    append(
      action.kind === 'return-lesson' && next.mode === 'case' && next.hasWorkflowOrigin
        ? { kind: 'workspace', action: 'lesson' }
        : action,
    );
    if (
      next.autoApply &&
      !explicitPreview &&
      next.tryMode &&
      action.kind === 'dental' &&
      ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
        action.command.type,
      )
    )
      append({ kind: 'try', action: { type: 'apply' } });
  }
  try {
    return validateTeachingPlan(
      {
        actions,
        summary: actions.length === 1 ? source : `${actions.length} classroom actions`,
        clarification: null,
      },
      context,
      { sourceText: source, allowLocalActions: true },
    );
  } catch (error) {
    throw new CommandValidationError(
      error instanceof Error ? error.message : 'The local command is invalid.',
    );
  }
}

export function parseTeachingPlan(text: string, context: TeachingContext): TeachingPlan {
  try {
    return buildTeachingPlan(text, context);
  } catch (error) {
    if (error instanceof UnrecognizedCommandError) throw error;
    // New mechanics stay deterministic and local, including useful validation errors.
    if (
      (context.tryMode && error instanceof CommandValidationError) ||
      (typeof text === 'string' &&
        clauses(normalizeSpeechCommand(text)).some(
          clause =>
            isDentalArrangementClause(clause) ||
            isMechanicsClause(clause) ||
            isCaseClause(clause, context) ||
            isTryClause(clause) ||
            isWorkspaceClause(clause, context) ||
            isApplianceClause(clause) ||
            /^(?:undo|redo) (?:the )?(?:last )?\d/.test(clause) ||
            /^(?:show|reveal|hide) (?:the )?(?:answer|explanation)$/.test(clause),
        ))
    )
      return {
        actions: [],
        summary: '',
        clarification:
          error instanceof Error ? error.message : 'Specify an explicit local classroom command.',
      };
    throw error;
  }
}

export function isDentalArrangementClause(text: string): boolean {
  return /^(?:load|open|show) (?:the )?(?:dental )?class\b/.test(text);
}
