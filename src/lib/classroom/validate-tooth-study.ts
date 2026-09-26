import { TOOTH_STUDY_VIEWS, type ToothStudyAction } from '../tooth-study/types';
import { fields, oneOf, toothIds, type TeachingContext } from './types';

/** Local-only schema: reject every unrecognized field, including on simple controls. */
export function validateToothStudyAction(
  action: Record<string, unknown>,
  context: TeachingContext,
): ToothStudyAction {
  if (action.action === 'open') {
    fields(action, ['kind', 'action', 'tooth'], ['view']);
    const tooth = toothIds([action.tooth], context)[0];
    return Object.hasOwn(action, 'view')
      ? { kind: 'tooth-study', action: 'open', tooth, view: oneOf(action.view, TOOTH_STUDY_VIEWS) }
      : { kind: 'tooth-study', action: 'open', tooth };
  }
  if (action.action === 'view') {
    fields(action, ['kind', 'action', 'view']);
    return { kind: 'tooth-study', action: 'view', view: oneOf(action.view, TOOTH_STUDY_VIEWS) };
  }
  fields(action, ['kind', 'action']);
  return { kind: 'tooth-study', action: oneOf(action.action, ['explain', 'close'] as const) };
}
