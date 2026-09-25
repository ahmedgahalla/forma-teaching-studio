import type { Axis, MovementDirection } from './model';

/** Known local grammar with an invalid amount or target, rather than unfamiliar wording. */
export class CommandValidationError extends Error {}

/** A target phrase outside the local grammar may be interpreted, never treated as a valid target. */
export class UnrecognizedCommandError extends Error {}

export type Command =
  | { type: 'move'; tooth: string; direction: MovementDirection; amount: number }
  | { type: 'rotate'; tooth: string; axis: Axis; amount: number }
  | { type: 'move_group'; teeth: string[]; direction: MovementDirection; amount: number }
  | { type: 'rotate_group'; teeth: string[]; axis: Axis; amount: number }
  | { type: 'orthodontic'; teeth: string[]; movement: 'tip' | 'torque' | 'rotate'; amount: number }
  | { type: 'reset'; teeth: string[] }
  | { type: 'appliance'; visible: boolean }
  | { type: 'ghost'; visible: boolean }
  | { type: 'stages'; count: number }
  | { type: 'undo' | 'redo' | 'play' };

const numberPattern = '([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:e[+-]?\\d+)?)';
const distanceUnit = '(?:mm|millimet(?:er|re)s?)';
const angleUnit = '(?:deg|degrees?)';
const directionPattern =
  '(buccal(?:ly)?|labial(?:ly)?|lingual(?:ly)?|palatal(?:ly)?|mesial(?:ly)?|distal(?:ly)?|intrude|intrusion|extrude|extrusion|[xyz])';
const directions: Record<string, MovementDirection> = {
  buccal: 'buccal',
  buccally: 'buccal',
  labial: 'buccal',
  labially: 'buccal',
  lingual: 'lingual',
  lingually: 'lingual',
  palatal: 'lingual',
  palatally: 'lingual',
  mesial: 'mesial',
  mesially: 'mesial',
  distal: 'distal',
  distally: 'distal',
  intrude: 'intrude',
  intrusion: 'intrude',
  extrude: 'extrude',
  extrusion: 'extrude',
  x: 'x',
  y: 'y',
  z: 'z',
};
const movementVerbs: Record<string, MovementDirection> = {
  intrude: 'intrude',
  extrude: 'extrude',
  retract: 'lingual',
  protract: 'buccal',
  expand: 'buccal',
  constrict: 'lingual',
  distalize: 'distal',
  distalise: 'distal',
  mesialize: 'mesial',
  mesialise: 'mesial',
};

function parseAmount(raw: string, limit: number, unit: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new CommandValidationError('Enter a finite movement amount.');
  if (value === 0 || Math.abs(value) > limit)
    throw new CommandValidationError(
      `Enter a nonzero amount between -${limit} and ${limit} ${unit}.`,
    );
  return value;
}

type Target = { ids: string[]; group: boolean };

/** Permanent FDI numbering only; an explicit list must resolve in full. */
function targets(
  selector: string,
  selectedId: string | null | undefined,
  availableIds: readonly string[],
  selectedIds?: readonly string[],
): Target {
  const scope = selector
    .trim()
    .replace(/^the /, '')
    .replace(/^(left|right) (upper|lower|maxillary|mandibular) /, '$2 $1 ')
    .replace(/^(upper|lower) front (?:six|6)(?: teeth)?$/, '$1 anterior teeth');
  let ids: string[];
  let group = false;
  if (!scope || /^(?:it|selected(?: tooth)?)$/.test(scope)) {
    if (!selectedId)
      throw new CommandValidationError(
        'Select a tooth first, or name one in the command, such as tooth 11.',
      );
    ids = [selectedId];
  } else if (/^(?:selected teeth|selection)$/.test(scope)) {
    ids = [...(selectedIds ?? (selectedId ? [selectedId] : []))];
    group = true;
  } else if (/^(?:tooth )?\d{2}$/.test(scope)) {
    ids = [scope.replace(/^tooth /, '')];
  } else if (/^teeth \d{2}(?:(?:\s*,\s*|\s+and\s+|\s+)\d{2})*$/.test(scope)) {
    ids = scope.match(/\d{2}/g)!;
    group = true;
  } else {
    const match = scope.match(
      /^(?:all )?(?:(upper|lower|maxillary|mandibular) )?(?:(left|right) )?(?:all )?(teeth|arch|incisors?|canines?|premolars?|molars?|anterior(?: teeth)?|posterior(?: teeth)?)$/,
    );
    if (!match || (match[3] === 'arch' && !match[1])) {
      const message =
        'Name one tooth, “teeth 11,12”, “selected teeth”, or an upper/lower tooth group.';
      // Do not reinterpret malformed FDI lists, an unnamed arch, or an unsupported
      // exclusion/constraint as permission to choose a different target.
      if (
        scope === 'arch' ||
        /\d|\b(?:except|excluding|exclude|without|only|but|not|never|unless|if|locked|fixed)\b/.test(
          scope,
        )
      )
        throw new CommandValidationError(message);
      throw new UnrecognizedCommandError(message);
    }
    const upper = match[1] === 'upper' || match[1] === 'maxillary';
    const lower = match[1] === 'lower' || match[1] === 'mandibular';
    const family = match[3],
      side = match[2];
    ids = availableIds.filter(id => {
      if (!/^[1-4][1-8]$/.test(id)) return false;
      const quadrant = Number(id[0]),
        number = Number(id[1]);
      if ((upper && quadrant > 2) || (lower && quadrant < 3)) return false;
      // FDI patient-side convention, independent of the viewport/camera.
      if (
        (side === 'left' && quadrant !== 2 && quadrant !== 3) ||
        (side === 'right' && quadrant !== 1 && quadrant !== 4)
      )
        return false;
      if (family.startsWith('incisor')) return number <= 2;
      if (family.startsWith('canine')) return number === 3;
      if (family.startsWith('premolar')) return number === 4 || number === 5;
      if (family.startsWith('molar')) return number >= 6;
      if (family.startsWith('anterior')) return number <= 3;
      if (family.startsWith('posterior')) return number >= 4;
      return true;
    });
    group = true;
  }
  ids = [...new Set(ids)];
  if (!ids.length)
    throw new CommandValidationError(
      'No teeth match this selection. Select teeth that are present in this case.',
    );
  for (const id of ids)
    if (!availableIds.includes(id))
      throw new CommandValidationError(`Tooth ${id} is not present in this case.`);
  return { ids, group };
}

function move(target: Target, direction: MovementDirection, amount: number): Command {
  return target.group
    ? { type: 'move_group', teeth: target.ids, direction, amount }
    : { type: 'move', tooth: target.ids[0], direction, amount };
}

/**
 * One complete explicit command per call. No treatment plan or amount is inferred.
 * Expansion/retraction are per-tooth buccal/lingual offsets, not arch-width targets.
 * Legacy single-tooth “rotate” defaults to world Y; group rotation uses long axes.
 */
export function parseCommand(
  text: string,
  selectedId: string | null | undefined,
  availableIds: readonly string[],
  selectedIds?: readonly string[],
): Command {
  const command = text
    .trim()
    .toLowerCase()
    .replace(/°/g, ' deg ')
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const select = (selector: string) => targets(selector, selectedId, availableIds, selectedIds);
  if (command === 'undo' || command === 'redo') return { type: command };
  if (/^(?:play(?: animation)?|animate)$/.test(command)) return { type: 'play' };
  if (/^(?:show (?:the )?original|(?:show )?ghost(?: on)?)$/.test(command))
    return { type: 'ghost', visible: true };
  if (/^(?:hide (?:the )?original|hide ghost|ghost off)$/.test(command))
    return { type: 'ghost', visible: false };
  if (/^(?:show (?:the )?braces|braces on)$/.test(command))
    return { type: 'appliance', visible: true };
  if (/^(?:hide (?:the )?braces|braces off)$/.test(command))
    return { type: 'appliance', visible: false };

  const stages = command.match(/^(?:create|generate) (\d+) stages?$/);
  if (stages) {
    const count = Number(stages[1]);
    if (!Number.isInteger(count) || count < 2 || count > 50)
      throw new CommandValidationError('Choose between 2 and 50 stages.');
    return { type: 'stages', count };
  }
  const reset = command.match(/^reset(?: (.+))?$/);
  if (reset) return { type: 'reset', teeth: select(reset[1] ?? '').ids };

  const movement = command.match(/^move (.+)$/);
  if (movement) {
    const directionFirst = movement[1].match(
      new RegExp(`^(?:(.+?) )?${directionPattern} (?:by )?${numberPattern} ?${distanceUnit}$`),
    );
    const amountFirst = movement[1].match(
      new RegExp(
        `^(?:(?!by(?: |$))(.+?) )?(?:by )?${numberPattern} ?${distanceUnit} ${directionPattern}$`,
      ),
    );
    if (directionFirst || amountFirst) {
      const target = select((directionFirst ?? amountFirst)![1] ?? '');
      const direction = directionFirst ? directionFirst[2] : amountFirst![3];
      const amount = directionFirst ? directionFirst[3] : amountFirst![2];
      return move(target, directions[direction], parseAmount(amount, 10, 'mm'));
    }
    throw new Error(
      'Use “move 11 buccally 1 mm” or “move upper incisors 1 mm x”. Include mm and one direction.',
    );
  }

  const direct = command.match(
    new RegExp(
      `^(${Object.keys(movementVerbs).join('|')}) (?:(?!by(?: |$))(.+?) )?(?:by )?${numberPattern} ?${distanceUnit}$`,
    ),
  );
  if (direct)
    return move(
      select(direct[2] ?? ''),
      movementVerbs[direct[1]],
      parseAmount(direct[3], 10, 'mm'),
    );

  const orthodontic = command.match(
    new RegExp(`^(tip|torque) (?:(?!by(?: |$))(.+?) )?(?:by )?${numberPattern} ?${angleUnit}$`),
  );
  if (orthodontic)
    return {
      type: 'orthodontic',
      teeth: select(orthodontic[2] ?? '').ids,
      movement: orthodontic[1] as 'tip' | 'torque',
      amount: parseAmount(orthodontic[3], 180, 'degrees'),
    };

  const rotation = command.match(/^rotate (.+)$/);
  if (rotation) {
    const axisPattern = '([xyz]|(?:tooth |long |occlusal )axis)';
    const amountFirst = rotation[1].match(
      new RegExp(
        `^(?:(?!by(?: |$))(.+?) )?(?:by )?${numberPattern} ?${angleUnit}(?: (?:about|around|on) (?:the )?${axisPattern}(?: axis)?)?$`,
      ),
    );
    const selectedAxisFirst = rotation[1].match(
      new RegExp(
        `^(?:(?:about|around|on) )?(?:the )?${axisPattern}(?: axis)? (?:by )?${numberPattern} ?${angleUnit}$`,
      ),
    );
    const axisFirst = rotation[1].match(
      new RegExp(
        `^(?:(.+?) )?(?:(?:about|around|on) )?(?:the )?${axisPattern}(?: axis)? (?:by )?${numberPattern} ?${angleUnit}$`,
      ),
    );
    if (amountFirst || axisFirst || selectedAxisFirst) {
      const target = select(selectedAxisFirst ? '' : ((axisFirst ?? amountFirst)![1] ?? ''));
      const amount = parseAmount(
        selectedAxisFirst ? selectedAxisFirst[2] : axisFirst ? axisFirst[3] : amountFirst![2],
        180,
        'degrees',
      );
      const axis = selectedAxisFirst
        ? selectedAxisFirst[1]
        : axisFirst
          ? axisFirst[2]
          : amountFirst![3];
      if ((axis && axis.length > 1) || (!axis && target.group))
        return { type: 'orthodontic', teeth: target.ids, movement: 'rotate', amount };
      return target.group
        ? { type: 'rotate_group', teeth: target.ids, axis: (axis || 'y') as Axis, amount }
        : { type: 'rotate', tooth: target.ids[0], axis: (axis || 'y') as Axis, amount };
    }
    throw new Error('Use “rotate 11 5 degrees around y” or “rotate upper incisors 5 degrees”.');
  }
  throw new Error(
    'Use an explicit tooth movement with mm or degrees, such as “intrude upper incisors 0.5 mm” or “torque selected teeth -3 degrees”. Automatic treatment planning is not supported.',
  );
}

/** Validate an external parser result using the same bounds and target checks as text commands. */
export function validateCommand(
  value: unknown,
  selectedId: string | null | undefined,
  availableIds: readonly string[],
  selectedIds?: readonly string[],
): Command {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The command must be an object.');
  const command = value as Record<string, unknown>;
  const requireFields = (...fields: string[]) => {
    const allowed = ['type', ...fields];
    if (
      Object.keys(command).some(key => !allowed.includes(key)) ||
      allowed.some(key => !(key in command))
    )
      throw new Error('The command contains missing or unexpected fields.');
  };
  const amount = () => {
    if (typeof command.amount !== 'number' || !Number.isFinite(command.amount))
      throw new Error('The amount must be a finite number.');
    return command.amount;
  };
  const target = (group: boolean) => {
    const ids = group ? command.teeth : [command.tooth];
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 32 ||
      ids.some(id => typeof id !== 'string' || !/^[1-4][1-8]$/.test(id))
    )
      throw new Error('Supply one or more permanent FDI tooth IDs.');
    return group ? `teeth ${ids.join(',')}` : `tooth ${ids[0]}`;
  };
  const axis = () => {
    if (command.axis !== 'x' && command.axis !== 'y' && command.axis !== 'z')
      throw new Error('Rotation axis must be X, Y, or Z.');
    return command.axis;
  };
  const parse = (text: string) => parseCommand(text, selectedId, availableIds, selectedIds);
  switch (command.type) {
    case 'move':
    case 'move_group': {
      requireFields(command.type === 'move' ? 'tooth' : 'teeth', 'direction', 'amount');
      if (
        typeof command.direction !== 'string' ||
        !['buccal', 'lingual', 'mesial', 'distal', 'intrude', 'extrude', 'x', 'y', 'z'].includes(
          command.direction,
        )
      )
        throw new Error('Unsupported movement direction.');
      return parse(
        `move ${target(command.type === 'move_group')} ${command.direction} ${amount()} mm`,
      );
    }
    case 'rotate':
    case 'rotate_group':
      requireFields(command.type === 'rotate' ? 'tooth' : 'teeth', 'axis', 'amount');
      return parse(
        `rotate ${target(command.type === 'rotate_group')} ${amount()} degrees around ${axis()}`,
      );
    case 'orthodontic':
      requireFields('teeth', 'movement', 'amount');
      if (
        command.movement !== 'tip' &&
        command.movement !== 'torque' &&
        command.movement !== 'rotate'
      )
        throw new Error('Unsupported orthodontic rotation.');
      return parse(`${command.movement} ${target(true)} ${amount()} degrees`);
    case 'reset':
      requireFields('teeth');
      return parse(`reset ${target(true)}`);
    case 'ghost':
    case 'appliance':
      requireFields('visible');
      if (typeof command.visible !== 'boolean')
        throw new Error('Visibility must be true or false.');
      return { type: command.type, visible: command.visible };
    case 'stages':
      requireFields('count');
      if (typeof command.count !== 'number' || !Number.isInteger(command.count))
        throw new Error('Stage count must be an integer.');
      return parse(`create ${command.count} stages`);
    case 'undo':
    case 'redo':
    case 'play':
      requireFields();
      return { type: command.type };
    default:
      throw new Error('Unsupported command type.');
  }
}
