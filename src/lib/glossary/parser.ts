import { normalizeSpeechCommand, parseTeachingCommand } from '../lecture';
import { findGlossaryEntry } from './index';
import { glossaryActions } from './plan';
import type { TeachingContext, TeachingPlan } from '../classroom/types';
import { validateTeachingPlan } from '../classroom/plan-validate';
import { isToothStudyClause } from '../classroom/parse-tooth-study';
import { clauses } from '../classroom/parse-clauses';

export function parseGlossaryPlan(
  text: string,
  context: TeachingContext,
): TeachingPlan | undefined {
  const source = normalizeSpeechCommand(text);
  if (/^(?:close (?:the )?definition|hide that)$/.test(source))
    return {
      actions: [{ kind: 'glossary', id: null }],
      summary: 'Definition closed.',
      clarification: null,
    };
  const request = source.match(
    /^(?:what is|what's|what are|define|explain|tell me about|show me) (?:the |a |an )?(.+)$/,
  );
  if (!request || isToothStudyClause(source, context)) return undefined;
  // Preserve every existing single-action command, including narration and display controls.
  try {
    parseTeachingCommand(
      clauses(source)[0],
      context.selected,
      context.availableIds,
      context.selectedIds,
    );
    return undefined;
  } catch {
    /* Only authored glossary terms are resolved below. */
  }
  const entry = findGlossaryEntry(request[1]);
  if (!entry && source.startsWith('show me ')) return undefined;
  if (!entry)
    return {
      actions: [],
      summary: '',
      clarification:
        'That term is not in the teaching glossary yet. Try “what is torque”, “explain tipping”, or “what is the cusp of Carabelli”.',
    };
  try {
    return validateTeachingPlan(
      {
        actions: glossaryActions(entry.id),
        summary: `Explain ${entry.term}.`,
        clarification: null,
      },
      context,
      { allowLocalActions: true },
    );
  } catch (error) {
    return {
      actions: [],
      summary: '',
      clarification:
        error instanceof Error
          ? error.message
          : 'This explanation is unavailable in the current model.',
    };
  }
}
