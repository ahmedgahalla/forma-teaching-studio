import { validateCommand } from '../commands';
import type { TeachingAction } from '../lecture';
import { validateTryAction } from '../try-mode';
import { validateMechanicsAction } from '../mechanics/validation';
import { WORKFLOWS } from '../workflows';
import {
  boolean,
  fields,
  oneOf,
  record,
  toothIds,
  PHASES,
  VIEWS,
  type TeachingContext,
} from './types';

export function validateAction(value: unknown, context: TeachingContext): TeachingAction {
  const action = record(value),
    only = (...names: string[]) => fields(action, ['kind', ...names]);
  switch (action.kind) {
    case 'mechanics':
      only('action');
      return { kind: 'mechanics', action: validateMechanicsAction(action.action) };
    case 'dental-arrangement':
      only('id');
      return {
        kind: 'dental-arrangement',
        id: oneOf(action.id, [
          'dental-class-i',
          'dental-class-ii-division-1',
          'dental-class-ii-division-2',
          'dental-class-iii',
        ] as const),
      };
    case 'case': {
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
    case 'workspace':
      only('action');
      return {
        kind: 'workspace',
        action: oneOf(action.action, ['explore', 'restore', 'lesson'] as const),
      };
    case 'appliance-display': {
      fields(action, ['kind', 'preset'], ['progress', 'palate']);
      const display: Extract<TeachingAction, { kind: 'appliance-display' }> = {
        kind: 'appliance-display',
        preset: oneOf(action.preset, [
          'none',
          'brackets',
          'braces',
          'expander-bands',
          'palatal-expander',
          'retainer',
        ] as const),
      };
      if (Object.hasOwn(action, 'progress')) {
        if (
          typeof action.progress !== 'number' ||
          !Number.isFinite(action.progress) ||
          action.progress < 0 ||
          action.progress > 1
        )
          throw new Error('Appliance illustration progress must be between 0 and 1.');
        display.progress = action.progress;
      }
      if (Object.hasOwn(action, 'palate')) display.palate = boolean(action.palate);
      return display;
    }
    case 'try':
      only('action');
      return { kind: 'try', action: validateTryAction(action.action, context.availableIds) };
    case 'try-display':
      only('target', 'visible');
      return {
        kind: 'try-display',
        target: oneOf(action.target, ['traces', 'curve'] as const),
        visible: boolean(action.visible),
      };
    case 'try-playback':
      only('direction');
      return {
        kind: 'try-playback',
        direction: oneOf(action.direction, ['forward', 'reverse'] as const),
      };
    case 'history':
      only('action', 'count');
      if (
        typeof action.count !== 'number' ||
        !Number.isInteger(action.count) ||
        action.count < 1 ||
        action.count > 10
      )
        throw new Error('Undo or redo between 1 and 10 complete requests.');
      return {
        kind: 'history',
        action: oneOf(action.action, ['undo', 'redo'] as const),
        count: action.count,
      };
    case 'dental': {
      only('command');
      const command = record(action.command);
      if ('teeth' in command) toothIds(command.teeth, context);
      return {
        kind: 'dental',
        command: validateCommand(
          command,
          context.selected,
          context.availableIds,
          context.selectedIds,
        ),
      };
    }
    case 'select':
      only('teeth');
      return { kind: 'select', teeth: toothIds(action.teeth, context) };
    case 'focus':
      only('tooth');
      return { kind: 'focus', tooth: toothIds([action.tooth], context)[0] };
    case 'view':
      only('view');
      return { kind: 'view', view: oneOf(action.view, VIEWS) as TeachingContext['view'] };
    case 'arch':
      only('arch');
      return { kind: 'arch', arch: oneOf(action.arch, ['upper', 'lower', 'both'] as const) };
    case 'toggle':
      only('target', 'visible');
      return {
        kind: 'toggle',
        target: oneOf(action.target, [
          'braces',
          'roots',
          'gums',
          'labels',
          'grid',
          'attachments',
        ] as const),
        visible: boolean(action.visible),
      };
    case 'comparison':
      only('mode');
      return {
        kind: 'comparison',
        mode: oneOf(action.mode, ['before', 'after', 'overlay', 'off'] as const),
      };
    case 'stage':
      if (action.action === 'exact') {
        only('action', 'stage');
        if (
          typeof action.stage !== 'number' ||
          !Number.isInteger(action.stage) ||
          action.stage < 0 ||
          action.stage > 50
        )
          throw new Error('Choose a display stage from 0 to 50.');
        return { kind: 'stage', action: 'exact', stage: action.stage };
      }
      only('action');
      return { kind: 'stage', action: oneOf(action.action, ['next', 'previous'] as const) };
    case 'stop':
    case 'return-lesson':
      only();
      return { kind: action.kind };
    case 'lecture':
      only('enabled');
      return { kind: 'lecture', enabled: boolean(action.enabled) };
    case 'lesson-step':
      only('action');
      return {
        kind: 'lesson-step',
        action: oneOf(action.action, ['next', 'previous', 'restart'] as const),
      };
    case 'workflow':
      if (action.action === 'start') {
        only('action', 'id');
        return {
          kind: 'workflow',
          action: 'start',
          id: oneOf(
            action.id,
            WORKFLOWS.map(w => w.id),
          ),
        };
      }
      if (action.action === 'phase') {
        only('action', 'phase');
        return {
          kind: 'workflow',
          action: 'phase',
          phase: oneOf(action.phase, PHASES) as Extract<
            TeachingAction,
            { kind: 'workflow'; action: 'phase' }
          >['phase'],
        };
      }
      only('action');
      return {
        kind: 'workflow',
        action: oneOf(action.action, [
          'next',
          'previous',
          'restart',
          'play',
          'pause',
          'exit',
        ] as const),
      };
    case 'anatomy':
      if (action.action === 'opacity') {
        only('action', 'value');
        if (
          typeof action.value !== 'number' ||
          !Number.isFinite(action.value) ||
          action.value < 0 ||
          action.value > 1
        )
          throw new Error('Use bone opacity from 0 to 1.');
        return { kind: 'anatomy', action: 'opacity', value: action.value };
      }
      only('action', 'visible');
      return {
        kind: 'anatomy',
        action: oneOf(action.action, ['bone', 'cutaway', 'ligament'] as const),
        visible: boolean(action.visible),
      };
    case 'speed':
      only('value');
      return { kind: 'speed', value: oneOf(action.value, [0.5, 1, 2] as const) };
    case 'narrate':
      only('target');
      return { kind: 'narrate', target: oneOf(action.target, ['step', 'answer'] as const) };
    case 'question':
      only('visible');
      return { kind: 'question', visible: boolean(action.visible) };
    case 'progress':
      only('value');
      if (
        typeof action.value !== 'number' ||
        !Number.isFinite(action.value) ||
        action.value < 0 ||
        action.value > 1
      )
        throw new Error('Set demonstration progress between 0 and 1.');
      return { kind: 'progress', value: action.value };
    case 'replay':
      only('slower');
      return { kind: 'replay', slower: boolean(action.slower) };
    case 'anatomy-lesson':
      only('action');
      return {
        kind: 'anatomy-lesson',
        action: oneOf(action.action, ['start', 'translation', 'tipping'] as const),
      };
    case 'attachment': {
      if (action.action === 'remove') {
        only('action', 'teeth');
        return { kind: 'attachment', action: 'remove', teeth: toothIds(action.teeth, context) };
      }
      fields(action, ['kind', 'action', 'teeth'], ['shape']);
      oneOf(action.action, ['add']);
      return {
        kind: 'attachment',
        action: 'add',
        teeth: toothIds(action.teeth, context),
        shape:
          action.shape === undefined
            ? 'rectangle'
            : oneOf(action.shape, ['rectangle', 'ellipsoid', 'beveled'] as const),
      };
    }
    default:
      throw new Error('Unsupported classroom action.');
  }
}
