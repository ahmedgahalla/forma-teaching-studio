import { CommandValidationError } from './commands';
import type { MechanicsSceneContext } from './mechanics-commands';
import type { MechanicsAction } from './mechanics/types';

/** Mirror committed bracket settings while validating a compound teaching request. */
export function advanceBracketContext(
  scene: MechanicsSceneContext,
  action: Extract<MechanicsAction, { type: 'brackets' | 'bracket-position' }>,
) {
  const context = scene.mechanics!,
    config = context.config;
  const ids = action.type === 'brackets' ? action.teeth : [action.tooth];
  const fail = (message: string): never => {
    throw new CommandValidationError(message);
  };
  if (!ids.length || ids.some(id => !scene.availableIds.includes(id)))
    fail('Choose teeth present in this model.');
  if (action.type === 'brackets') {
    if (!action.installed && config.wires.some(wire => wire.teeth.some(id => ids.includes(id))))
      fail('Remove the connected wire before removing its brackets.');
    for (const id of ids) {
      if (action.installed)
        config.brackets[id] ||= [
          ...(context.bracketAnchors[id] || fail(`No synthetic bracket anchor exists for ${id}.`)),
        ];
      else {
        delete config.brackets[id];
        if (config.bracketAngles) delete config.bracketAngles[id];
      }
    }
    context.focus.teeth = [...ids];
    scene.selectedIds = [...ids];
    scene.selected = ids[0];
  } else {
    if (!config.brackets[action.tooth]) fail('Install the bracket before moving its attachment.');
    config.brackets[action.tooth] = [...action.local];
    if (action.angleDeg !== undefined) {
      if (action.angleDeg) (config.bracketAngles ||= {})[action.tooth] = action.angleDeg;
      else if (config.bracketAngles) delete config.bracketAngles[action.tooth];
    }
  }
  if (config.bracketAngles && !Object.keys(config.bracketAngles).length)
    delete config.bracketAngles;
}
