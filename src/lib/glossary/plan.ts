import type { TeachingAction } from '../lecture';
import { GLOSSARY, getGlossaryEntry } from './index';

export function glossaryActions(id: string): TeachingAction[] {
  const entry = getGlossaryEntry(id);
  if (!entry) throw new Error('Choose an authored glossary term.');
  return [...(entry.show ?? []), { kind: 'glossary', id }];
}

/** Only authored visual sequences may cross the prepared-case request boundary. */
export function isGlossaryVisualPlan(actions: readonly unknown[]): boolean {
  return GLOSSARY.some(entry => {
    if (!entry.show?.length) return false;
    const candidates = [entry.show, glossaryActions(entry.id)];
    return candidates.some(
      candidate =>
        candidate.length === actions.length &&
        candidate.every((expected, index) => {
          const actual = actions[index];
          return (
            !!actual &&
            typeof actual === 'object' &&
            Object.keys(actual).length === Object.keys(expected).length &&
            Object.entries(expected).every(
              ([key, value]) => (actual as Record<string, unknown>)[key] === value,
            )
          );
        }),
    );
  });
}
