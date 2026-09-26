import type { TeachingAction } from '../lecture';
import { resolveToothName } from '../tooth-anatomy';
import { TOOTH_STUDY_VIEWS, type ToothStudyView } from '../tooth-study/types';
import type { TeachingContext, TeachingPlan } from './types';

export const CLOSE_TOOTH_STUDY_LAST =
  'Close tooth study as the final action, then give commands for the restored view.';

const SIDES: Record<string, ToothStudyView> = {
  buccal: 'buccal',
  labial: 'buccal',
  cheek: 'buccal',
  lingual: 'lingual',
  palatal: 'lingual',
  tongue: 'lingual',
  mesial: 'mesial',
  distal: 'distal',
  occlusal: 'occlusal',
  incisal: 'occlusal',
  biting: 'occlusal',
  top: 'occlusal',
  apical: 'apical',
  'root tip': 'apical',
};
const side = `(${Object.keys(SIDES).join('|')})(?: (?:side|surface|view|edge))?`;
const OPEN = new RegExp(`^(?:show|study)(?: me)? (?:the )?(.+?)(?: from (?:the )?${side})?$`);
const VIEW = new RegExp(`^view(?: it)? from (?:the )?${side}$`);
const EXPLAIN =
  /^(?:explain this tooth|explain it|tell me about (?:this tooth|it)|how many roots does it have|what is this tooth)$/;
const CLOSE = /^(?:back to (?:the )?full mouth|close tooth view|exit tooth study|show all teeth)$/;
type Match =
  | { action: 'open'; target: string; view?: ToothStudyView }
  | { action: 'view'; view: ToothStudyView }
  | { action: 'turn' | 'explain' | 'close' };

function match(text: string, context: TeachingContext): Match | undefined {
  const numbered = /^(?:tooth )([1-4]\d)$/.exec(text);
  if (numbered) return { action: 'open', target: text };
  const open = text.match(OPEN);
  if (open && (/^tooth \d+$/.test(open[1]) || resolveToothName(open[1])))
    return { action: 'open', target: open[1], ...(open[2] ? { view: SIDES[open[2]] } : {}) };
  const view = text.match(VIEW);
  if (view) return { action: 'view', view: SIDES[view[1]] };
  if (/^(?:turn it|next side)$/.test(text)) return { action: 'turn' };
  if (EXPLAIN.test(text)) return { action: 'explain' };
  // Outside a study, retain the existing whole-mouth arch command.
  if (CLOSE.test(text) && (text !== 'show all teeth' || context.toothStudy))
    return { action: 'close' };
}

export function adjacentToothView(view: ToothStudyView, direction = 1): ToothStudyView {
  const count = TOOTH_STUDY_VIEWS.length;
  return TOOTH_STUDY_VIEWS[(TOOTH_STUDY_VIEWS.indexOf(view) + direction + count) % count];
}

const ask = (clarification: string): TeachingPlan => ({ actions: [], summary: '', clarification });

/** Exact local grammar. An omitted side means the patient's right; an arch is required. */
export function parseToothStudyClause(
  text: string,
  context: TeachingContext,
): TeachingAction[] | TeachingPlan | undefined {
  const found = match(text, context);
  if (!found) return undefined;
  const studied = context.toothStudy;
  if (found.action === 'open') {
    const numbered = /^tooth (\d+)$/.exec(found.target);
    const named = resolveToothName(
      found.target,
      context.arch === 'both' ? undefined : context.arch,
    );
    const tooth = numbered?.[1] || (named && 'tooth' in named ? named.tooth : undefined);
    if (!tooth) return ask('Say upper or lower, for example “show the upper first molar”.');
    return [
      { kind: 'tooth-study', action: 'open', tooth, ...(found.view ? { view: found.view } : {}) },
    ];
  }
  if (found.action === 'explain') {
    if (studied) return [{ kind: 'tooth-study', action: 'explain' }];
    if (context.selectedIds.length !== 1)
      return ask('Select one tooth or name it, for example “show tooth 16”.');
    return [
      { kind: 'tooth-study', action: 'open', tooth: context.selectedIds[0] },
      { kind: 'tooth-study', action: 'explain' },
    ];
  }
  if (!studied)
    return ask(
      found.action === 'close'
        ? 'No tooth study is open.'
        : 'Open a tooth first, for example “show tooth 16”.',
    );
  if (found.action === 'close') return [{ kind: 'tooth-study', action: 'close' }];
  return [
    {
      kind: 'tooth-study',
      action: 'view',
      view: found.action === 'view' ? found.view : adjacentToothView(studied.view),
    },
  ];
}

export function isToothStudyClause(text: string, context: TeachingContext): boolean {
  return !!match(text, context);
}

/** Keep the existing global top-view alias except inside a tooth study. */
export function preserveToothStudyTop(text: string, context: TeachingContext): string {
  return context.toothStudy
    ? text.replace(/\bview from (?:the )?top\b/gi, 'view from the occlusal')
    : text;
}
