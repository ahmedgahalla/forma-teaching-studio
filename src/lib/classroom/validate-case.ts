import type { TeachingAction } from '../lecture';
import { fields, oneOf } from './types';

export function validateCaseAction(
  action: Record<string, unknown>,
): Extract<TeachingAction, { kind: 'case' }> {
  const only = (...names: string[]) => fields(action, ['kind', ...names]);
  if (action.action === 'load' || action.action === 'variant') {
    only('action', 'id');
    if (typeof action.id !== 'string')
      throw new Error('Choose an authored teaching case or variation.');
    return { kind: 'case', action: action.action, id: action.id };
  }
  if (action.action === 'progress') {
    only('action', 'value');
    if (
      typeof action.value !== 'number' ||
      !Number.isFinite(action.value) ||
      action.value < 0 ||
      action.value > 1
    )
      throw new Error('Set prepared case progress between 0 and 1.');
    return { kind: 'case', action: 'progress', value: action.value };
  }
  only('action');
  return {
    kind: 'case',
    action: oneOf(action.action, ['play', 'pause', 'reset', 'explore', 'return'] as const),
  };
}
