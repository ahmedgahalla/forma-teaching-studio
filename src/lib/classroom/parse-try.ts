import { CommandValidationError } from '../commands';
import { parseTeachingCommand, type TeachingAction } from '../lecture';
import type { TryAction } from '../try-mode';
import type { TeachingContext } from './types';

export function parseTryActions(
  text: string,
  context: TeachingContext,
): TeachingAction[] | undefined {
  if (!isTryClause(text)) return undefined;
  const wrap = (...actions: TryAction[]): TeachingAction[] =>
    actions.map(action => ({ kind: 'try', action }));
  const select = (selector = 'selected teeth'): string[] => {
    const parsed = parseTeachingCommand(
      `select ${selector}`,
      context.selected,
      context.availableIds,
      context.selectedIds,
    );
    if (parsed.kind !== 'select') throw new Error('Select the teeth for this preview.');
    return parsed.teeth;
  };
  const pair = (selector: string): [string, string] => {
    const teeth = select(selector);
    if (teeth.length !== 2)
      throw new Error(
        'Select or name exactly two teeth; first and second follow the stated selection order.',
      );
    return [teeth[0], teeth[1]];
  };
  const quantity = '([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))';
  if (/^return to (?:the )?try mode$/.test(text))
    return context.mode === 'workflow'
      ? [{ kind: 'workflow', action: 'exit' }, ...wrap({ type: 'enter' })]
      : wrap({ type: 'enter' });
  const display = text.match(/^(show|hide) (?:the )?(displacement traces|arch curve)$/);
  if (display)
    return [
      {
        kind: 'try-display',
        target: display[2] === 'arch curve' ? 'curve' : 'traces',
        visible: display[1] === 'show',
      },
    ];
  if (/^(?:play in reverse|reverse animation|play forward)$/.test(text))
    return [{ kind: 'try-playback', direction: text === 'play forward' ? 'forward' : 'reverse' }];
  if (text === 'pause halfway') {
    return [{ kind: 'progress', value: 0.5 }];
  }
  if (/^(?:enter|start|open) try(?: mode)?$/.test(text)) return wrap({ type: 'enter' });
  if (/^(?:exit|leave) try(?: mode)?$/.test(text)) return wrap({ type: 'exit' });
  if (/^(?:apply|accept) (?:the )?preview$/.test(text)) return wrap({ type: 'apply' });
  if (/^(?:discard|cancel) (?:the )?preview$/.test(text)) return wrap({ type: 'cancel' });
  const lock = text.match(/^(lock|unlock) (.+)$/);
  if (lock) return wrap({ type: 'lock', teeth: select(lock[2]), locked: lock[1] === 'lock' });
  const unrestricted = text.match(/^unrestricted (?:movement )?(on|off)$/);
  if (unrestricted) return wrap({ type: 'unrestricted', enabled: unrestricted[1] === 'on' });
  const movement = text.match(
    new RegExp(
      `^move (?:the )?(?:selected )?segment(?: of)?(?: (.+?))? (posterior(?:ly)?|anterior(?:ly)?|upward|up|downward|down|[xyz]) (?:by )?${quantity} mm$`,
    ),
  );
  if (movement) {
    const direction = movement[2],
      axis = /^[xyz]$/.test(direction)
        ? (direction as 'x' | 'y' | 'z')
        : /^(?:posterior|anterior)/.test(direction)
          ? 'z'
          : 'y';
    const sign = /^(?:posterior|down)/.test(direction) ? -1 : 1;
    return wrap({
      type: 'preview',
      edit: {
        type: 'segment-translate',
        teeth: select(movement[1]),
        axis,
        amount: Number(movement[3]) * sign,
      },
    });
  }
  const rotation = text.match(
    new RegExp(
      `^rotate (?:the )?(?:selected )?segment(?: of)?(?: (.+?))? (?:by )?${quantity} degrees (?:around|about|on) (?:case )?([xyz])(?: axis)?$`,
    ),
  );
  if (rotation)
    return wrap({
      type: 'preview',
      edit: {
        type: 'segment-rotate',
        teeth: select(rotation[1]),
        amount: Number(rotation[2]),
        axis: rotation[3] as 'x' | 'y' | 'z',
      },
    });
  const gap = text.match(
    new RegExp(
      `^close (?:(?:the )?selected gap|(?:the )?gap between (.+?))(?: to ${quantity} mm)? (?:(?:with|using) )?(equal(?:ly)?|first|second)(?: (?:movement|tooth(?: only)?))?$`,
    ),
  );
  if (gap)
    return wrap({
      type: 'preview',
      edit: {
        type: 'close-gap',
        teeth: pair(gap[1] || 'selected teeth'),
        gap: gap[2] ? Number(gap[2]) : 0,
        rule: gap[3].startsWith('equal') ? 'equal' : (gap[3] as 'first' | 'second'),
      },
    });
  const width = text.match(
    new RegExp(
      `^(change|increase|decrease) (?:the )?width between (.+?) (?:by )?${quantity} mm symmetrically$`,
    ),
  );
  if (width) {
    if (width[1] !== 'change' && Number(width[3]) <= 0)
      throw new Error(
        'Use a positive amount with increase or decrease, or a signed amount with change.',
      );
    return wrap({
      type: 'preview',
      edit: {
        type: 'change-width',
        teeth: pair(width[2]),
        amount: Number(width[3]) * (width[1] === 'decrease' ? -1 : 1),
      },
    });
  }
  const fit = text.match(
    new RegExp(
      `^fit (.+?) (?:to|onto) (?:the )?(?:(upper|lower) )?arch(?: curve)? (?:with )?width ${quantity} mm (?:and )?depth ${quantity} mm$`,
    ),
  );
  if (fit) {
    const teeth = select(fit[1]),
      arches = new Set(teeth.map(id => (Number(id[0]) <= 2 ? 'upper' : 'lower')));
    if (arches.size !== 1 || (fit[2] && !arches.has(fit[2] as 'upper' | 'lower')))
      throw new Error('Fit teeth from one named arch at a time.');
    const arch = teeth[0][0] < '3' ? 'upper' : 'lower';
    return wrap(
      { type: 'set-arch', arch, width: Number(fit[3]), depth: Number(fit[4]) },
      { type: 'preview', edit: { type: 'fit-arch', teeth, arch } },
    );
  }
  const revise = text.match(
    new RegExp(`^change (?:the )?last movement to ${quantity} (mm|degrees)$`),
  );
  if (revise)
    return wrap({ type: 'revise', amount: Number(revise[1]), unit: revise[2] as 'mm' | 'degrees' });
  if (
    /^(?:make (?:the )?last movement (?:smaller|half(?: as (?:large|big))?)|halve (?:the )?last movement)$/.test(
      text,
    )
  )
    return wrap({ type: 'revise', factor: 0.5 });
  const saved = text.match(/^save (arrangement|group) (?:as )?(.+)$/);
  if (saved) {
    const name = saved[2].replace(/^["']|["']$/g, '');
    return wrap(
      saved[1] === 'group'
        ? { type: 'save-group', name, teeth: select() }
        : { type: 'save-snapshot', name },
    );
  }
  if (/^compare (?:with )?(?:the )?original(?: arrangement)?$/.test(text))
    return [{ kind: 'comparison', mode: 'overlay' }];
  const compare = text.match(/^compare (?:with )?(?:saved(?: arrangement)?|arrangement) (.+)$/);
  if (compare) {
    const name = compare[1].replace(/^["']|["']$/g, '');
    return wrap({
      type: 'compare-snapshot',
      name: context.savedArrangementNames?.find(saved => saved.toLowerCase() === name) || name,
    });
  }
  if (/^close\b/.test(text))
    throw new Error(
      'Which two teeth and allocation rule: equal movement, first tooth only, or second tooth only?',
    );
  if (/^rotate\b/.test(text))
    throw new Error('How many degrees, and around which fixed case axis: x, y, or z?');
  if (/^move\b/.test(text))
    throw new Error(
      'How many millimetres should the segment move? Use posterior (−Z), anterior (+Z), upward (+Y), downward (−Y), or case x/y/z.',
    );
  if (/^fit\b/.test(text))
    throw new Error(
      'Specify the arch curve width and depth in millimetres, and select teeth from one arch.',
    );
  if (/^(?:change|increase|decrease) (?:the )?width\b/.test(text))
    throw new Error('Name two teeth, a width change in millimetres, and say “symmetrically”.');
  if (/^save (?:arrangement|group)\b/.test(text))
    throw new Error('What name should the saved arrangement or group have?');
  if (/^(?:change|make|halve)\b/.test(text))
    throw new Error(
      'Give the replacement amount with mm or degrees, or say “make last movement smaller” to halve its original amount.',
    );
  throw new Error(
    'Use one explicit Try Mode action, including the selected teeth and any required amount.',
  );
}

/** Local English planner. Unknown wording throws without applying any part of a request. */
