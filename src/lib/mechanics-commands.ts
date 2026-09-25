import { CommandValidationError, parseCommand } from './commands';
import type { Vec3 } from './model';
import type {
  ForceLaw,
  MechanicsAction,
  MechanicsConfig,
  MechanicsEndpoint,
  MechanicsExperiment,
  WireMaterial,
  WireSection,
} from './mechanics/types';

/** A ray-picked point stays attached to its tooth; the world point is only for fixed anchors. */
export type PointedReference = {
  tooth: string;
  localPoint: Vec3;
  worldPoint: Vec3;
  surface?: 'crown' | 'root' | 'gingiva';
};
export type MechanicsFocus = {
  teeth?: string[];
  wireId?: string;
  tadId?: string;
  elasticId?: string;
  expanderId?: string;
  lastParameter?: 'wire-section' | 'wire-activation' | 'elastic-force';
};
export type MechanicsCommandContext = {
  config: MechanicsConfig;
  bracketAnchors: Record<string, Vec3>;
  focus: MechanicsFocus;
  stageIndex: number;
  stageCount: number;
  hasResult: boolean;
  wirePreset?: { material: WireMaterial; section: WireSection };
  elasticPreset?: ForceLaw;
};
export type MechanicsSceneContext = {
  mode: 'case' | 'workflow';
  synthetic: boolean;
  selected: string;
  selectedIds: string[];
  availableIds: string[];
  arch?: 'upper' | 'lower' | 'both';
  pointed?: PointedReference;
  mechanics?: MechanicsCommandContext;
};

export function mechanicsCommandContext(
  experiment: MechanicsExperiment,
  focus: MechanicsFocus = {},
  wirePreset?: MechanicsCommandContext['wirePreset'],
  elasticPreset?: ForceLaw,
): MechanicsCommandContext {
  return {
    config: structuredClone(experiment.config),
    bracketAnchors: Object.fromEntries(
      experiment.reference.teeth.map(tooth => [tooth.id, [...tooth.bracketLocal]]),
    ),
    focus: structuredClone(focus),
    stageIndex: experiment.stageIndex,
    stageCount: experiment.stages.length,
    hasResult: !!experiment.result,
    ...(wirePreset ? { wirePreset: structuredClone(wirePreset) } : {}),
    ...(elasticPreset ? { elasticPreset: structuredClone(elasticPreset) } : {}),
  };
}

export function reduceMechanicsFocus(
  focus: MechanicsFocus,
  action: MechanicsAction,
): MechanicsFocus {
  const next = structuredClone(focus);
  if (action.type === 'brackets' || action.type === 'anchor') next.teeth = [...action.teeth];
  if (action.type === 'wire') {
    next.wireId = action.id;
    next.teeth = [...action.teeth];
  }
  if (['wire-material', 'wire-section', 'wire-activation'].includes(action.type) && 'id' in action)
    next.wireId = action.id;
  if (action.type === 'wire-section' || action.type === 'wire-activation')
    next.lastParameter = action.type;
  if (action.type === 'tad') next.tadId = action.id;
  if (action.type === 'elastic') {
    next.elasticId = action.id;
    next.lastParameter = 'elastic-force';
  }
  if (action.type === 'expander') next.expanderId = action.id;
  if (action.type === 'remove') {
    const key = `${action.kind}Id` as 'wireId' | 'tadId' | 'elasticId' | 'expanderId';
    if (next[key] === action.id) delete next[key];
  }
  return next;
}

const fail = (message: string): never => {
  throw new CommandValidationError(message);
};
const nextId = (prefix: string, ids: string[]) => {
  let n = 1;
  while (ids.includes(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
};
export const sameMechanicsIntent = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'number' && typeof b === 'number')
    return (
      Number.isFinite(a) &&
      Number.isFinite(b) &&
      Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b))
    );
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameMechanicsIntent(value, b[index]))
    );
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const first = a as Record<string, unknown>,
      second = b as Record<string, unknown>;
    return (
      Object.keys(first).length === Object.keys(second).length &&
      Object.keys(first).every(
        key => Object.hasOwn(second, key) && sameMechanicsIntent(first[key], second[key]),
      )
    );
  }
  return a === b;
};
const number = '([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))';

export function isMechanicsClause(text: string): boolean {
  text = normalizeMechanicsWording(text);
  if (
    /^(?:(?:install|add|place|put) (?:a |the )?(?:palatal )?expander\b|activate (?:the |this |that )?expander\b|remove (?:the |this |that )?(?:wire|tad|elastic|expander)\b)/.test(
      text,
    )
  )
    return true;
  return /^(?:(?:install|add|bond|remove) (?:the |a |an )?brackets?\b|(?:put|insert|make|create|add|install|engage) (?:the |a |an )?(?:arch)?wires?\b|(?:put|place|add|install) (?:a |the )?(?:tad|mini[ -]?screw)\b|connect\b|(?:use|set|change|make)\b.*\b(?:wire|steel|titanium|tension|force)\b|(?:set|change|make) (?:that|it)\b|(?:show|calculate|solve|explain|compare)\b.*\b(?:happens?|response|result|movement|tad)\b|(?:activate|expand|widen) (?:the |this |that )?(?:arch)?wires?\b|(?:save|show|go to) (?:mechanics |experiment )?stage\b|(?:fix|release)\b.*\bmechanically\b)/.test(
    text,
  );
}

function normalizeMechanicsWording(text: string): string {
  if (/^place (?:braces|brackets only)$/.test(text)) return text;
  return text
    .replace(/ for me$/, '')
    .replace(/^(install|add|bond|remove|attach|fit|put|place) (?:the )?braces\b/, '$1 brackets')
    .replace(/^(?:attach|fit|put|place) (?:the )?brackets\b/, 'install brackets')
    .replace(/^(?:run|thread|fit|place|attach) (a |an |the )?((?:arch)?wires?)\b/, 'put $1$2')
    .replace(/^show me what /, 'show what ')
    .replace(/^(?:replace|switch) (?:the |this |that )?wire (?:with|to) /, 'change the wire to ')
    .replace(/\bover here\b/g, 'here');
}

export function isMechanicsSolveClause(text: string): boolean {
  return /^(?:show what (?:will )?happen(?:s)?(?: after that)?|(?:calculate|show|solve) (?:the |this )?(?:initial |mechanical )?(?:response|result))$/.test(
    normalizeMechanicsWording(text),
  );
}

function current(context: MechanicsSceneContext): MechanicsCommandContext {
  if (context.mode !== 'case')
    return fail(
      'Explore this setup in the free workspace before placing or calculating appliances.',
    );
  if (!context.synthetic)
    return fail(
      'Mechanical teaching experiments require the synthetic model; imported scans keep geometric editing.',
    );
  return (
    context.mechanics ||
    fail('Open the mechanics controls to establish this experiment and its visible presets.')
  );
}

function targets(text: string | undefined, context: MechanicsSceneContext): string[] {
  let requested = (text || 'selected teeth')
    .replace(/^(?:on|to|for|through) /, '')
    .replace(/^the /, '')
    .replace(/\bsegment\b/g, 'teeth')
    .replace(/^(?:these|those) brackets$/, 'selected teeth');
  requested = requested
    .replace(/^all (?:of )?the /, 'all ')
    .replace(/^every (upper|lower) tooth$/, 'all $1 teeth')
    .replace(/^(?:all |every )?(?:teeth|tooth) (?:in|on) (?:the )?(upper|lower) arch$/, '$1 teeth')
    .replace(/^(?:whole|entire) (upper|lower) (?:arch|jaw)$/, '$1 teeth');
  if (/^(?:all teeth|every tooth|all brackets|whole arch|entire arch)$/.test(requested))
    requested = context.arch && context.arch !== 'both' ? `${context.arch} teeth` : 'all teeth';
  if (
    /^(?:both (?:arches|jaws)|(?:the )?(?:whole|entire) mouth|all teeth in both arches)$/.test(
      requested,
    )
  )
    requested = 'all teeth';
  if (
    context.arch &&
    context.arch !== 'both' &&
    /^(?:incisors?|canines?|premolars?|molars?|anterior(?: teeth)?|posterior(?: teeth)?)$/.test(
      requested,
    )
  )
    requested = `${context.arch} ${requested}`;
  if (/^(?:here|there|this tooth|that tooth)$/.test(requested)) {
    if (!context.pointed || !context.availableIds.includes(context.pointed.tooth))
      return fail('Point to a tooth first, or name the teeth to use.');
    // A picked member of a selected group denotes that highlighted group.
    if (/^(?:here|there)$/.test(requested) && context.selectedIds.includes(context.pointed.tooth))
      return [...context.selectedIds];
    return [context.pointed.tooth];
  }
  if (
    /^(?:them|these(?: teeth)?|those(?: teeth)?|this group|that group)$/.test(requested) &&
    !context.selectedIds.length &&
    context.mechanics?.focus.teeth?.length
  ) {
    const focused = context.mechanics.focus.teeth;
    if (focused.some(id => !context.availableIds.includes(id)))
      return fail('The referenced teeth are no longer in this model. Select the target again.');
    return [...focused];
  }
  const selector =
    /^(?:them|these(?: teeth)?|those(?: teeth)?|selected|this group|that group)$/.test(requested)
      ? 'selected teeth'
      : requested;
  const parsed = parseCommand(
    `move ${selector} x 1 mm`,
    context.selected,
    context.availableIds,
    context.selectedIds,
  );
  if ('teeth' in parsed) return parsed.teeth;
  if ('tooth' in parsed) return [parsed.tooth];
  return fail('Select a tooth or a named group first.');
}

function wire(context: MechanicsCommandContext) {
  return (
    context.config.wires.find(item => item.id === context.focus.wireId) ||
    (context.config.wires.length === 1 ? context.config.wires[0] : undefined) ||
    fail('Choose the wire to change in the mechanics panel.')
  );
}
function tad(context: MechanicsCommandContext) {
  return (
    context.config.tads.find(item => item.id === context.focus.tadId) ||
    (context.config.tads.length === 1 ? context.config.tads[0] : undefined) ||
    fail('Place or select the TAD to use.')
  );
}
function section(text: string): WireSection | undefined {
  const rectangular = text.match(
    new RegExp(`${number}\\s*(?:x|by|×)\\s*${number}\\s*(mm|inch(?:es)?|in)\\b`),
  );
  if (rectangular) {
    const scale = rectangular[3] === 'mm' ? 1 : 25.4;
    return {
      shape: 'rectangle',
      heightMm: Number(rectangular[1]) * scale,
      widthMm: Number(rectangular[2]) * scale,
    };
  }
  const round = text.match(new RegExp(`${number}\\s*(mm|inch(?:es)?|in)\\b`));
  if (round)
    return { shape: 'round', diameterMm: Number(round[1]) * (round[2] === 'mm' ? 1 : 25.4) };
}
function material(text: string): WireMaterial | undefined {
  if (/\b(?:stainless(?: steel)?|steel)\b/.test(text)) return 'stainless-steel';
  if (/\b(?:beta[ -]?titanium|tma)\b/.test(text)) return 'beta-titanium';
}

/** The parser returns configuration intents only. It never invents forces or tooth displacement. */
function parseMechanicsClause(
  text: string,
  scene: MechanicsSceneContext,
): MechanicsAction[] | undefined {
  text = normalizeMechanicsWording(text);
  if (!isMechanicsClause(text)) return undefined;
  if (/^(?:set|change|make) (?:that|it)\b/.test(text) && !scene.mechanics?.focus.lastParameter)
    return undefined;
  // Preserve the authored workflow vocabulary. Explicit targeting still requests free exploration.
  if (
    scene.mode === 'workflow' &&
    /^(?:install brackets|bond brackets|insert archwire|engage archwire|install expander|fit expander|activate expander|show movement)$/.test(
      text,
    )
  )
    return undefined;
  if (text === 'place palatal expander') return undefined;
  if (/^(?:show|explain) (?:tooth )?(?:translation|tipping)$/.test(text)) return undefined;
  const context = current(scene),
    config = context.config;
  const selectedEntity = <T extends { id: string }>(
    kind: 'wire' | 'tad' | 'elastic' | 'expander',
    values: T[],
  ): T =>
    values.find(value => value.id === context.focus[`${kind}Id`]) ||
    (values.length === 1 ? values[0] : undefined) ||
    fail(`Choose the ${kind} to change in the mechanics panel.`);
  const remove = text.match(/^remove (?:the |this |that )?(wire|tad|elastic|expander)$/);
  if (remove) {
    const kind = remove[1] as 'wire' | 'tad' | 'elastic' | 'expander';
    return [
      { type: 'remove', kind, id: selectedEntity(kind, config[`${kind}s`] as { id: string }[]).id },
    ];
  }
  const installExpander = text.match(
    new RegExp(
      `^(?:install|add|place|put) (?:a |the )?(?:palatal )?expander(?: on (.+?))? with activation ${number} mm (?:and )?stiffness ${number} n/mm(?: (?:and )?palate stiffness ${number} n/mm)?$`,
    ),
  );
  if (installExpander) {
    const teeth = targets(installExpander[1], scene),
      left = teeth.filter(id => id[0] === '2'),
      right = teeth.filter(id => id[0] === '1');
    if (!left.length || !right.length || left.length + right.length !== teeth.length)
      return fail('Select upper teeth on both sides for this palatal-expander teaching setup.');
    return [
      {
        type: 'expander',
        id: nextId(
          'expander',
          config.expanders.map(item => item.id),
        ),
        left,
        right,
        activationMm: Number(installExpander[2]),
        stiffnessNPerMm: Number(installExpander[3]),
        ...(installExpander[4] === undefined
          ? {}
          : { palateStiffnessNPerMm: Number(installExpander[4]) }),
      },
    ];
  }
  const activateExpander = text.match(
    new RegExp(`^activate (?:the |this |that )?expander (?:by |to )?${number} mm$`),
  );
  if (activateExpander)
    return [
      {
        type: 'expander',
        ...structuredClone(selectedEntity('expander', config.expanders)),
        activationMm: Number(activateExpander[1]),
      },
    ];
  if (/^(?:install|add|place|put) (?:a |the )?(?:palatal )?expander\b/.test(text))
    return fail(
      'Choose the upper attachment teeth and specify activation in mm and appliance stiffness in N/mm, or use the expander controls.',
    );
  const bracket = text.match(
    /^(install|add|bond|remove) (?:the )?brackets?(?: (?:on|to|from))?(?: (.+))?$/,
  );
  if (bracket)
    return [
      { type: 'brackets', teeth: targets(bracket[2], scene), installed: bracket[1] !== 'remove' },
    ];
  const makeWire = text.match(
    /^(?:put|insert|make|create|add|install|engage) (?:a |an |the )?(?:arch)?wires?(?: (?:through|on|for))?(?: (.+))?$/,
  );
  if (makeWire) {
    const teeth = targets(makeWire[1], scene),
      preset = context.wirePreset;
    if (!preset) return fail('Choose a visible wire material and cross-section preset first.');
    const actions: MechanicsAction[] = [],
      usedIds = config.wires.map(item => item.id);
    for (const upper of [true, false]) {
      const group = teeth
        .filter(id => Number(id[0]) < 3 === upper)
        .sort((a, b) => {
          const order = (id: string) =>
            ['1', '4'].includes(id[0]) ? 8 - Number(id[1]) : 8 + Number(id[1]);
          return order(a) - order(b);
        });
      if (!group.length) continue;
      if (group.length < 2)
        return fail(
          'A wire needs at least two teeth in each requested arch. Select a larger group or one arch.',
        );
      const overlapping = config.wires.filter(item => item.teeth.some(id => group.includes(id)));
      const existing = overlapping.find(item => item.teeth.every(id => group.includes(id)));
      if (overlapping.length && (overlapping.length !== 1 || !existing))
        return fail(
          'Existing wires extend beyond this group or overlap one another. Remove the conflicting wire or include all of its teeth.',
        );
      const missing = group.filter(id => !config.brackets[id]);
      if (missing.length) actions.push({ type: 'brackets', teeth: missing, installed: true });
      if (existing) actions.push({ type: 'wire', ...structuredClone(existing), teeth: group });
      else {
        if (usedIds.length >= 4)
          return fail('This experiment supports up to four wires. Remove an unused wire first.');
        const id = nextId('wire', usedIds);
        usedIds.push(id);
        actions.push({ type: 'wire', id, teeth: group, ...structuredClone(preset) });
      }
    }
    return actions;
  }
  if (/^(?:put|place|add|install) (?:a |the )?(?:tad|mini[ -]?screw) (?:here|there)$/.test(text)) {
    if (!scene.pointed || !scene.availableIds.includes(scene.pointed.tooth))
      return fail('Point to the synthetic attachment location before placing a TAD.');
    return [
      {
        type: 'tad',
        id: nextId(
          'tad',
          config.tads.map(item => item.id),
        ),
        position: [...scene.pointed.worldPoint],
      },
    ];
  }
  if (isMechanicsSolveClause(text)) return [{ type: 'solve' }];
  if (/^explain (?:that |this |the )?(?:movement|response|result)(?: aloud)?$/.test(text))
    return [{ type: 'explain' }];
  if (/^compare (?:it |this |that )?without (?:the |this |that )?tad$/.test(text))
    return [{ type: 'compare-without-tad', id: tad(context).id }];
  const activation = text.match(
    new RegExp(
      `^(?:activate|expand|widen) (?:the |this |that )?(?:arch)?wire (?:by |to )?${number} mm$`,
    ),
  );
  if (activation)
    return [
      {
        type: 'wire-activation',
        id: wire(context).id,
        expansionMm: Number(activation[1]),
        torqueDeg: wire(context).torqueDeg,
      },
    ];
  const torque = text.match(
    new RegExp(`^(?:set|change|make) (?:the |this |that )?wire torque (?:to )?${number} degrees$`),
  );
  if (torque)
    return [
      {
        type: 'wire-activation',
        id: wire(context).id,
        expansionMm: wire(context).expansionMm,
        torqueDeg: Number(torque[1]),
      },
    ];
  if (/^(?:use|set|change|make)\b/.test(text) && /\b(?:wire|steel|titanium|tma)\b/.test(text)) {
    const selected = wire(context),
      requestedSection = section(text),
      requestedMaterial = material(text);
    if (/\b(?:niti|nickel[ -]?titanium)\b/.test(text))
      return fail(
        'NiTi hysteresis is not supported by this elastic teaching model. Choose stainless steel or beta-titanium.',
      );
    const actions: MechanicsAction[] = [];
    if (requestedMaterial)
      actions.push({ type: 'wire-material', id: selected.id, material: requestedMaterial });
    if (requestedSection)
      actions.push({ type: 'wire-section', id: selected.id, section: requestedSection });
    if (!actions.length)
      return fail(
        'What wire size? Give its diameter, or height × width, with mm or inches. Thickness and tension are separate settings.',
      );
    return actions;
  }
  const replacement = text.match(
    new RegExp(
      `^(?:make|set|change) (?:that|it) (?:to )?${number}(?: (mm|n|newtons?|gf|grams? force))?(?: instead)?$`,
    ),
  );
  if (replacement) {
    const amount = Number(replacement[1]),
      unit =
        replacement[2] || (context.focus.lastParameter?.startsWith('wire-') ? 'mm' : undefined);
    if (unit === 'mm' && context.focus.lastParameter === 'wire-section') {
      const selected = wire(context);
      if (selected.section.shape !== 'round')
        return fail(
          'Give both height and width for this rectangular wire, or explicitly request a round wire diameter.',
        );
      return [
        { type: 'wire-section', id: selected.id, section: { shape: 'round', diameterMm: amount } },
      ];
    }
    if (unit === 'mm' && context.focus.lastParameter === 'wire-activation')
      return [
        {
          type: 'wire-activation',
          id: wire(context).id,
          expansionMm: amount,
          torqueDeg: wire(context).torqueDeg,
        },
      ];
    const elastic = config.elastics.find(item => item.id === context.focus.elasticId);
    if (unit && unit !== 'mm' && context.focus.lastParameter === 'elastic-force' && elastic)
      return [
        {
          type: 'elastic',
          ...structuredClone(elastic),
          law: { kind: 'constant', forceN: amount * (/^(?:gf|gram)/.test(unit) ? 0.00980665 : 1) },
        },
      ];
    return fail('Name which wire dimension, activation or elastic tension to replace.');
  }
  const connect = text.match(
    /^connect (?:the |this |that )?(?:tad|mini[ -]?screw|it) to (.+?)(?: (?:at|with) ([\d.]+)\s*(n|newtons?|gf|grams? force)(?: (?:total|each))?)?$/,
  );
  if (connect) {
    const anchor = tad(context),
      teeth = targets(connect[1], scene);
    const law: ForceLaw | undefined = connect[2]
      ? {
          kind: 'constant',
          forceN: Number(connect[2]) * (/^(?:gf|gram)/.test(connect[3]) ? 0.00980665 : 1),
        }
      : context.elasticPreset;
    if (!law)
      return fail(
        'Specify the total elastic tension in N or gf, or choose a visible elastic preset first.',
      );
    if (teeth.length > 1 && law.kind === 'spring')
      return fail(
        'Connect a spring to one tooth at a time so its rest length and attachment are explicit.',
      );
    if (teeth.length > 1 && / each$/.test(text))
      return fail(
        'Use a total tension for this group; it is distributed equally across the selected tooth connections.',
      );
    const ids = config.elastics.map(item => item.id);
    return teeth.map(tooth => {
      const local =
        config.brackets[tooth] ||
        (scene.pointed?.tooth === tooth ? scene.pointed.localPoint : undefined);
      if (!local)
        return fail(`Install a bracket on ${tooth}, or point to its attachment location.`);
      const id = nextId('elastic', ids);
      ids.push(id);
      return {
        type: 'elastic',
        id,
        from: { kind: 'tad', id: anchor.id },
        to: { kind: 'tooth', tooth, local: [...local] },
        law:
          law.kind === 'constant'
            ? { kind: 'constant', forceN: law.forceN / teeth.length }
            : structuredClone(law),
      };
    });
  }
  const tension = text.match(
    new RegExp(
      `^(?:set|change|make) (?:the |this |that )?(?:elastic )?(?:tension|force) (?:to )?${number} (n|newtons?|gf|grams? force)$`,
    ),
  );
  if (tension) {
    const elastic =
      config.elastics.find(item => item.id === context.focus.elasticId) ||
      (config.elastics.length === 1 ? config.elastics[0] : undefined);
    if (!elastic) return fail('Select one elastic connection before replacing its tension.');
    return [
      {
        type: 'elastic',
        ...structuredClone(elastic),
        law: {
          kind: 'constant',
          forceN: Number(tension[1]) * (/^(?:gf|gram)/.test(tension[2]) ? 0.00980665 : 1),
        },
      },
    ];
  }
  const stage = text.match(/^save (?:mechanics |experiment )?stage (?:as )?(.+)$/);
  if (stage) return [{ type: 'save-stage', label: stage[1].replace(/^["']|["']$/g, '') }];
  const go = text.match(/^(?:show|go to) (?:mechanics |experiment )stage (\d+)$/);
  if (go) return [{ type: 'stage', index: Number(go[1]) }];
  const anchor = text.match(/^(fix|release) (.+?) mechanically$/);
  if (anchor)
    return [{ type: 'anchor', teeth: targets(anchor[2], scene), fixed: anchor[1] === 'fix' }];
  return fail(
    'Name the appliance, target and required parameter. Wire sizes use mm or inches; elastic tension uses N or gf.',
  );
}

export function planMechanicsClause(
  text: string,
  scene: MechanicsSceneContext,
): MechanicsAction[] | undefined {
  const actions = parseMechanicsClause(text, scene);
  if (
    actions &&
    scene.mechanics?.hasResult &&
    actions.some(action =>
      ['wire-material', 'wire-section', 'wire-activation', 'elastic', 'expander'].includes(
        action.type,
      ),
    )
  )
    return [...actions, { type: 'solve' }];
  return actions;
}

/** Advance only serializable preflight context, never the caller's experiment. */
export function advanceMechanicsContext(
  scene: MechanicsSceneContext,
  action: MechanicsAction,
): void {
  const context = current(scene),
    config = context.config,
    focus = context.focus;
  const present = (teeth: string[]) => {
    if (!teeth.length || teeth.some(id => !scene.availableIds.includes(id)))
      fail('Choose teeth present in this model.');
  };
  const entity = <T extends { id: string }>(items: T[], id: string) =>
    items.find(item => item.id === id) ||
    fail(`The ${id} reference is unavailable; select the appliance again.`);
  const replace = <T extends { id: string }>(items: T[], value: T) => {
    const index = items.findIndex(item => item.id === value.id);
    if (index < 0) items.push(value);
    else items[index] = value;
  };
  const endpoint = (value: MechanicsEndpoint) => {
    if (value.kind === 'tad') entity(config.tads, value.id);
    else present([value.tooth]);
  };
  switch (action.type) {
    case 'brackets':
      present(action.teeth);
      if (
        !action.installed &&
        config.wires.some(item => item.teeth.some(id => action.teeth.includes(id)))
      )
        fail('Remove the connected wire before removing its brackets.');
      action.teeth.forEach(id => {
        if (action.installed)
          config.brackets[id] ||= [
            ...(context.bracketAnchors[id] ||
              fail(`No synthetic bracket anchor exists for ${id}.`)),
          ];
        else delete config.brackets[id];
      });
      focus.teeth = [...action.teeth];
      scene.selectedIds = [...action.teeth];
      scene.selected = action.teeth[0];
      break;
    case 'bracket-position':
      present([action.tooth]);
      if (!config.brackets[action.tooth]) fail('Install the bracket before moving its attachment.');
      config.brackets[action.tooth] = [...action.local];
      break;
    case 'wire': {
      present(action.teeth);
      if (action.teeth.length < 2 || action.teeth.some(id => !config.brackets[id]))
        fail('Install brackets on at least two target teeth before connecting a wire.');
      if (new Set(action.teeth.map(id => (Number(id[0]) < 3 ? 'upper' : 'lower'))).size !== 1)
        fail('One archwire connects teeth from one arch.');
      replace(config.wires, {
        ...structuredClone(action),
        expansionMm: action.expansionMm ?? 0,
        torqueDeg: action.torqueDeg ?? 0,
      });
      focus.wireId = action.id;
      focus.teeth = [...action.teeth];
      scene.selectedIds = [...action.teeth];
      scene.selected = action.teeth[0];
      break;
    }
    case 'wire-material':
      entity(config.wires, action.id).material = action.material;
      focus.wireId = action.id;
      break;
    case 'wire-section':
      entity(config.wires, action.id).section = structuredClone(action.section);
      focus.wireId = action.id;
      focus.lastParameter = 'wire-section';
      break;
    case 'wire-activation':
      Object.assign(entity(config.wires, action.id), {
        expansionMm: action.expansionMm,
        torqueDeg: action.torqueDeg ?? 0,
      });
      focus.wireId = action.id;
      focus.lastParameter = 'wire-activation';
      break;
    case 'tad':
      replace(config.tads, { id: action.id, position: [...action.position] });
      focus.tadId = action.id;
      break;
    case 'elastic':
      endpoint(action.from);
      endpoint(action.to);
      replace(config.elastics, structuredClone(action));
      focus.elasticId = action.id;
      focus.lastParameter = 'elastic-force';
      break;
    case 'expander':
      present([...action.left, ...action.right]);
      replace(config.expanders, structuredClone(action));
      focus.expanderId = action.id;
      break;
    case 'support':
      config.support = action.preset;
      break;
    case 'anchor':
      present(action.teeth);
      config.fixedTeeth = action.fixed
        ? [...new Set([...config.fixedTeeth, ...action.teeth])]
        : config.fixedTeeth.filter(id => !action.teeth.includes(id));
      break;
    case 'remove': {
      if (action.kind === 'tad')
        config.elastics = config.elastics.filter(
          item =>
            !(
              (item.from.kind === 'tad' && item.from.id === action.id) ||
              (item.to.kind === 'tad' && item.to.id === action.id)
            ),
        );
      const key = `${action.kind}s` as 'wires' | 'tads' | 'elastics' | 'expanders';
      const items = config[key] as { id: string }[];
      entity(items, action.id);
      items.splice(
        items.findIndex(item => item.id === action.id),
        1,
      );
      break;
    }
    case 'save-stage':
      if (context.stageCount >= 20) fail('An experiment can contain up to 20 stages.');
      context.stageCount++;
      context.stageIndex = context.stageCount - 1;
      return;
    case 'stage':
      if (action.index >= context.stageCount) fail('Choose an existing experiment stage.');
      context.stageIndex = action.index;
      context.hasResult = false;
      return;
    case 'solve': {
      const active =
        config.wires.some(item => item.expansionMm !== 0 || item.torqueDeg !== 0) ||
        config.elastics.some(item => item.law.kind === 'spring' || item.law.forceN > 0) ||
        config.expanders.some(item => item.activationMm !== 0);
      if (!active)
        fail(
          'Brackets and a passive wire do not create an activated response. Set wire activation, elastic tension or expander activation first.',
        );
      context.hasResult = true;
      return;
    }
    case 'compare-without-tad':
      entity(config.tads, action.id);
      if (!context.hasResult)
        fail('Calculate the current response before comparing it without the TAD.');
      return;
    case 'explain':
    case 'apply':
      if (!context.hasResult) fail('Calculate a valid mechanical response first.');
      return;
    case 'discard':
      context.hasResult = false;
      return;
  }
  context.hasResult = false;
}
