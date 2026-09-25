const boundary = '(^|(?:[;,\\n]|[.!?](?=\\s)|\\b(?:and then|then|also|after that|and)\\b)\\s*)';
const verbs =
  'show|hide|reveal|conceal|display|see|look|view|take|select|highlight|focus|zoom|move|translate|rotate|tip|torque|intrude|extrude|expand|constrict|reset|add|remove|install|bond|put|thread|connect|use|set|change|make|activate|calculate|solve|compare|save|open|start|play|pause|stop|repeat|return|undo|redo|explain|analyze|analyse|lock|unlock';
const guarded =
  /\b(?:don't|do not|not to|never|avoid|not|cannot|can't|unless|if|what would|what might|should i|should we|would it|could it|how much|how far|is it safe|prescribe|diagnose|recommend treatment|treatment plan|my patient|biologically safe)\b/;
const gerunds: Record<string, string> = {
  showing: 'show',
  hiding: 'hide',
  selecting: 'select',
  highlighting: 'highlight',
  moving: 'move',
  rotating: 'rotate',
  installing: 'install',
  putting: 'put',
  adding: 'add',
  removing: 'remove',
  looking: 'look',
  revealing: 'reveal',
  explaining: 'explain',
  comparing: 'compare',
};
const anatomy = '(roots?|gums|gingiva|bone|tooth numbers)';
const layer = (value: string) =>
  value === 'root' ? 'roots' : value === 'gingiva' ? 'gums' : value;

/** Explicit wording aliases only. Unknown clauses, quantities and conditional language stay intact. */
export function normalizeClassroomLanguage(text: string): string {
  let value = text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/−/g, '-')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .trim();
  if (guarded.test(value)) return value;
  const rewrite = (
    pattern: string,
    replacement: (prefix: string, ...captures: string[]) => string,
  ) => {
    value = value.replace(new RegExp(boundary + pattern, 'g'), (...args: unknown[]) =>
      replacement(...(args.slice(1, -2) as [string, ...string[]])),
    );
  };
  for (let pass = 0; pass < 4; pass++) {
    rewrite(
      '(?:for (?:this|the|our|my) (?:lecture|class|lesson|demonstration|demo)[,:]?\\s+)',
      prefix => prefix,
    );
    rewrite(
      `(?:please |(?:(?:can|could|would) you(?: please)? |(?:i would like|i'd like|i want)(?: you)? to |let us |let's ))(?=(?:${verbs}|please|would you mind)\\b)`,
      prefix => prefix,
    );
    rewrite(
      `would you mind (?:please )?(${Object.keys(gerunds).join('|')})\\b`,
      (prefix, verb) => prefix + gerunds[verb],
    );
  }
  rewrite(
    '(?:take a look|look|view)(?: at (?:it|the model|the teeth))? from (?:the )?(above|top|front|right|left)(?: side)?\\b',
    (prefix, direction) =>
      `${prefix}show ${direction === 'above' || direction === 'top' ? 'occlusal' : direction} view`,
  );
  rewrite(
    '(?:(?:show|switch to|give me) (?:a |the )?)?(?:top[- ]down|overhead) view\\b',
    prefix => `${prefix}show occlusal view`,
  );
  rewrite(
    `make (?:the )?${anatomy} (disappear|invisible|visible|appear)\\b`,
    (prefix, target, state) =>
      `${prefix}${state === 'disappear' || state === 'invisible' ? 'hide' : 'show'} ${layer(target)}`,
  );
  rewrite(
    `(reveal|display|conceal|see|show|hide) (?:me )?(?:the )?${anatomy}\\b`,
    (prefix, action, target) =>
      `${prefix}${action === 'conceal' || action === 'hide' ? 'hide' : 'show'} ${layer(target)}`,
  );
  // Top/bottom name an arch only beside a dental noun or an explicit appliance target.
  // Camera directions and bare positional language keep their existing meanings.
  value = value.replace(
    /\b(top|bottom) (?=(?:(?:left|right) )?(?:front|back|anterior|posterior|incisors?|canines?|premolars?|molars?|teeth|arch|jaw)\b)/g,
    (_, arch: string) => `${arch === 'top' ? 'upper' : 'lower'} `,
  );
  rewrite(
    '((?:put|place|install|add|bond|attach|fit) (?:a |an |the )?(?:brackets?|braces|(?:arch)?wires?)) (?:in|on|to) (?:the )?(top|bottom|upper|lower)(?: (?:teeth|arch|jaw))?(?=$|[;,\\n.!?]|\\s+(?:and then|then|also|after that|and)\\b)',
    (prefix, action, arch) =>
      `${prefix}${action} on ${arch === 'top' || arch === 'upper' ? 'upper' : 'lower'} teeth`,
  );
  // These named anatomical groups are resolved before spoken numerals become quantities.
  value = value.replace(
    /\b(upper|lower|maxillary|mandibular) (?:front (?:six|6)|(?:six|6) front)(?: teeth)?\b/g,
    '$1 anterior teeth',
  );
  value = value.replace(
    /\b(upper|lower|maxillary|mandibular) (?:front (?:four|4)|(?:four|4) front)(?: teeth)?\b/g,
    '$1 incisors',
  );
  value = value.replace(
    /\b(upper|lower) (front|back) teeth\b/g,
    (_, arch: string, group: string) =>
      `${arch} ${group === 'front' ? 'anterior' : 'posterior'} teeth`,
  );
  value = value.replace(
    /\b(upper|lower) teeth at the (front|back)\b/g,
    (_, arch: string, group: string) =>
      `${arch} ${group === 'front' ? 'anterior' : 'posterior'} teeth`,
  );
  return value;
}
