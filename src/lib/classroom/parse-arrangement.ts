import { CommandValidationError } from '../commands';
import type { TeachingContext, TeachingPlan } from './types';
import { validateTeachingPlan } from './plan-validate';

export function isDentalArrangementClause(text: string): boolean {
  return /^(?:load|open|show) (?:the )?(?:dental )?class\b/.test(text);
}

export function parseArrangement(
  source: string,
  context: TeachingContext,
): TeachingPlan | undefined {
  if (!isDentalArrangementClause(source)) return undefined;
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
