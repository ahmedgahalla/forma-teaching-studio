import { normalizeSpeechCommand, type TeachingAction } from '../lecture';
import {
  isMechanicsClause,
  isMechanicsSolveClause,
  planMechanicsClause,
  sameMechanicsIntent,
} from '../mechanics-commands';
import type { MechanicsAction } from '../mechanics/types';
import { advance } from './advance';
import { copyContext } from './types';
import { validateAction } from './validate-action';
import type { TeachingContext, TeachingPlan } from './types';
import { clauses } from './parse-clauses';
import { fields, record, type PlanValidationOptions } from './types';

export function auditNumbers(text: string, actions: TeachingAction[]) {
  const source = normalizeSpeechCommand(text).replace(/°/g, ' degrees');
  if (
    /\b(?:don't|do not|never|avoid|what if|should i|is it safe|prescribe|diagnose|treatment plan)\b/.test(
      source,
    )
  )
    throw new Error(
      'Give an explicit classroom action; hypothetical or clinical instructions are not executable commands.',
    );
  const quantities = [
    ...source.matchAll(/([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|degrees?|deg)\b/g),
  ].map(m => ({
    amount: Number(m[1]) * (m[2] === 'cm' ? 10 : 1),
    unit: /^(?:mm|cm)$/.test(m[2]) ? 'distance' : 'angle',
  }));
  for (const action of actions)
    if (action.kind === 'dental' && 'amount' in action.command) {
      const command = action.command,
        unit = command.type === 'move' || command.type === 'move_group' ? 'distance' : 'angle';
      const index = quantities.findIndex(
        q => q.unit === unit && Math.abs(q.amount - command.amount) < 1e-10,
      );
      if (index < 0)
        throw new Error(
          'Every tooth movement needs its explicit requested amount and unit; an interpreter cannot invent a value.',
        );
      quantities.splice(index, 1);
    }
  const progressClauses = clauses(source).filter(clause =>
    /\b(?:progress|halfway|percent)\b|%/.test(clause),
  );
  for (const action of actions)
    if (action.kind === 'progress') {
      const index = progressClauses.findIndex(clause => {
        if (clause === 'pause halfway') return action.value === 0.5;
        const values = [
          ...clause.matchAll(
            /(?<![\w.])([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(%|percent)?(?![\w.])/g,
          ),
        ];
        return (
          values.length === 1 &&
          Math.abs(Number(values[0][1]) / (values[0][2] ? 100 : 1) - action.value) < 1e-10
        );
      });
      if (index < 0)
        throw new Error(
          'Demonstration progress needs its requested fraction, percentage, or the explicit “pause halfway” preset.',
        );
      progressClauses.splice(index, 1);
    }
}

/** Validate against CURRENT context; async callers pass the revision captured when requesting interpretation. */
export function validateTeachingPlan(
  value: unknown,
  context: TeachingContext,
  options: PlanValidationOptions = {},
): TeachingPlan {
  if (options.expectedRevision !== undefined && options.expectedRevision !== context.revision)
    throw new Error('The teaching context changed. Repeat the request for the current scene.');
  const plan = record(value);
  fields(plan, ['actions', 'summary', 'clarification']);
  if (
    !Array.isArray(plan.actions) ||
    plan.actions.length > 8 ||
    typeof plan.summary !== 'string' ||
    plan.summary.length > 600 ||
    (plan.clarification !== null &&
      (typeof plan.clarification !== 'string' ||
        !plan.clarification.trim() ||
        plan.clarification.length > 600))
  )
    throw new Error('Invalid classroom plan.');
  if (plan.clarification !== null) {
    if (plan.actions.length) throw new Error('A clarification cannot contain executable actions.');
    return { actions: [], summary: plan.summary, clarification: plan.clarification as string };
  }
  if (!plan.actions.length) throw new Error('A classroom plan needs at least one action.');
  const automatic = new Set<unknown>();
  let requestedActions = plan.actions;
  // Only text/voice requests opt in. Numeric controls and explicit previews remain reviewable.
  if (
    context.autoApply &&
    context.mode === 'case' &&
    context.tryMode &&
    options.sourceText !== undefined &&
    !clauses(normalizeSpeechCommand(options.sourceText)).some(clause => /^preview\b/.test(clause))
  ) {
    requestedActions = [];
    for (const [index, raw] of plan.actions.entries()) {
      requestedActions.push(raw);
      const movement =
        (raw?.kind === 'dental' &&
          ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
            raw.command?.type,
          )) ||
        (raw?.kind === 'try' && ['preview', 'revise'].includes(raw.action?.type));
      const applied =
        plan.actions[index + 1]?.kind === 'try' &&
        plan.actions[index + 1]?.action?.type === 'apply';
      if (movement && !applied) {
        const apply = { kind: 'try', action: { type: 'apply' } };
        requestedActions.push(apply);
        automatic.add(apply);
      }
    }
    if (requestedActions.length > 8)
      throw new Error(
        'Use at most eight actions in one classroom request, including movement application.',
      );
  }
  const next = copyContext(context),
    overrides = { arch: false, view: false, selection: false },
    actions: TeachingAction[] = [];
  const sourceClauses =
    options.sourceText === undefined || options.allowLocalActions
      ? []
      : clauses(normalizeSpeechCommand(options.sourceText));
  const mechanicsClauses = sourceClauses
    .map((text, index) => ({ text, index }))
    .filter(clause => isMechanicsClause(clause.text));
  let mechanicsCursor = 0;
  let expectedMechanics: MechanicsAction[] = [];
  for (const [index, raw] of requestedActions.entries()) {
    const action = validateAction(raw, next);
    if (
      action.kind === 'mechanics' &&
      action.action.type === 'stage' &&
      requestedActions.length !== 1
    )
      throw new Error(
        'Recall an experiment stage as a separate request, then give instructions for its setup.',
      );
    if (
      action.kind === 'mechanics' &&
      options.sourceText !== undefined &&
      !options.allowLocalActions
    ) {
      if (!expectedMechanics.length) {
        const source = mechanicsClauses[mechanicsCursor++];
        expectedMechanics = planMechanicsClause(source?.text || '', next) || [];
        // An adjacent explicit solve is satisfied by the replacement's required solve.
        if (
          source &&
          expectedMechanics.length > 1 &&
          expectedMechanics.at(-1)?.type === 'solve' &&
          isMechanicsSolveClause(sourceClauses[source.index + 1] || '')
        )
          mechanicsCursor++;
      }
      if (!sameMechanicsIntent(expectedMechanics.shift(), action.action))
        throw new Error(
          'The appliance action must match the requested targets, explicit values or visible preset.',
        );
    }
    if (
      [
        'case',
        'dental-arrangement',
        'try',
        'history',
        'try-display',
        'try-playback',
        'workspace',
        'appliance-display',
      ].includes(action.kind) &&
      !options.allowLocalActions &&
      !automatic.has(raw)
    )
      throw new Error(
        'Prepared cases, Try Mode mechanics, workspace transfers, appliance placement and counted history use local commands only.',
      );
    if (action.kind === 'dental-arrangement' && requestedActions.length !== 1)
      throw new Error(
        'Load a dental arrangement as a separate request, then give commands for its model.',
      );
    if (action.kind === 'case' && plan.actions.length !== 1)
      throw new Error(
        'Use a prepared case command as a separate request, then give commands for its arrangement.',
      );
    if (action.kind === 'workspace' && plan.actions.length !== 1)
      throw new Error(
        'Change workspaces as a separate request, then give commands for the destination model.',
      );
    if (action.kind === 'history' && plan.actions.length !== 1)
      throw new Error('Use counted undo or redo as a separate request.');
    if (
      action.kind === 'dental' &&
      ['undo', 'redo'].includes(action.command.type) &&
      plan.actions.length !== 1
    )
      throw new Error('Use undo or redo as a separate request.');
    if (action.kind === 'replay' && plan.actions.length !== 1)
      throw new Error(
        'Use replay as a separate request; say “repeat that more slowly” to change its speed.',
      );
    const enteringTry =
      action.kind === 'workflow' &&
      action.action === 'exit' &&
      index === requestedActions.length - 2 &&
      requestedActions[index + 1]?.kind === 'try' &&
      requestedActions[index + 1]?.action?.type === 'enter';
    if (
      (action.kind === 'return-lesson' ||
        (action.kind === 'workflow' && action.action === 'exit')) &&
      index !== requestedActions.length - 1 &&
      !enteringTry
    )
      throw new Error('Return to the lesson or case before giving another request.');
    advance(next, action, overrides);
    actions.push(action);
  }
  if (
    expectedMechanics.length ||
    (mechanicsCursor < mechanicsClauses.length && context.mode !== 'workflow')
  )
    throw new Error('The plan omitted part of the requested appliance instructions.');
  if (options.sourceText !== undefined) auditNumbers(options.sourceText, actions);
  return { actions, summary: plan.summary, clarification: null };
}
