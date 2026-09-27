import { normalizeSpeechCommand } from '../lecture';
import { findGlossaryEntry } from './index';
import { glossaryActionsForStudy } from './plan';
import type { TeachingContext, TeachingPlan } from '../classroom/types';
import { validateTeachingPlan } from '../classroom/plan-validate';

export function parseGlossaryPlan(
  text: string,
  context: TeachingContext,
): TeachingPlan | undefined {
  const source = normalizeSpeechCommand(text);
  if (isGlossaryClose(source, context))
    return {
      actions: [{ kind: 'glossary', id: null }],
      summary: 'Definition closed.',
      clarification: null,
    };
  const request = source.match(
    /^(?:what is|what's|what are|define|explain|tell me about|show me) (?:the |a |an )?(.+)$/,
  );
  if (!request) return undefined;
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
        actions: glossaryActionsForStudy(entry.id, context.toothStudy),
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

export function isGlossaryClose(source: string, context: TeachingContext): boolean {
  return !!context.glossaryId && /^(?:close (?:the )?definition|hide that)$/.test(source);
}
