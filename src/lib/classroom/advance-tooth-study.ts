import type { ToothStudyAction } from '../tooth-study/types';
import { hasToothAnatomy } from '../tooth-anatomy';
import type { TeachingContext } from './types';

/** Return an opened tooth so the caller records its explicit selection override. */
export function advanceToothStudy(
  context: TeachingContext,
  action: ToothStudyAction,
): string | undefined {
  if (action.action === 'explain' && !context.toothStudy) {
    if (context.selectedIds.length !== 1)
      throw new Error('Select one tooth or name it, for example “show tooth 16”.');
    return advanceToothStudy(context, {
      kind: 'tooth-study',
      action: 'open',
      tooth: context.selectedIds[0],
    });
  }
  if (action.action === 'open') {
    if (!context.synthetic)
      throw new Error('Tooth study uses the synthetic teaching model, not an imported case.');
    if (!hasToothAnatomy(action.tooth))
      throw new Error('Tooth study covers teeth 11–17, 21–27, 31–37 and 41–47.');
    if (!context.availableIds.includes(action.tooth))
      throw new Error(`Tooth ${action.tooth} is not in the current model.`);
    context.mode = 'case';
    context.workflowId = null;
    context.playing = false;
    context.toothStudy = { tooth: action.tooth, view: action.view ?? 'buccal' };
    context.arch = Number(action.tooth[0]) <= 2 ? 'upper' : 'lower';
    context.layers = { ...context.layers, roots: true, gums: false, labels: false };
    return action.tooth;
  }
  if (!context.toothStudy || context.mode !== 'case')
    throw new Error('Open a tooth first, for example “show tooth 16”.');
  if (action.action === 'view') context.toothStudy = { ...context.toothStudy, view: action.view };
  if (action.action === 'close') delete context.toothStudy;
}
