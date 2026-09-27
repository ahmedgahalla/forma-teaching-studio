import type { TeachingAction } from '../lecture';
import { GLOSSARY, getGlossaryEntry } from './index';
import type { ToothStudyContext, ToothStudyView } from '../tooth-study/types';

const SURFACE_VIEWS: Readonly<Record<string, ToothStudyView>> = {
  mesial: 'mesial',
  distal: 'distal',
  buccal: 'buccal',
  labial: 'buccal',
  lingual: 'lingual',
  palatal: 'lingual',
  occlusal: 'occlusal',
  incisal: 'occlusal',
  apex: 'apical',
};

export function glossaryActions(id: string): TeachingAction[] {
  const entry = getGlossaryEntry(id);
  if (!entry) throw new Error('Choose an authored glossary term.');
  return [...(entry.show ?? []), { kind: 'glossary', id }];
}

export function glossaryActionsForStudy(
  id: string,
  study?: Pick<ToothStudyContext, 'tooth' | 'view'>,
): TeachingAction[] {
  const view = study && SURFACE_VIEWS[id];
  return view
    ? [
        { kind: 'tooth-study', action: 'view', view },
        { kind: 'glossary', id },
      ]
    : glossaryActions(id);
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
