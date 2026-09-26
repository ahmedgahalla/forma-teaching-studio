import { ARCH_ALIASES, CLASS_ALIASES, SIDE_ALIASES } from './aliases';
import {
  TOOTH_CLASS_NAMES,
  TOOTH_CLASSES,
  TOOTH_CONTENT,
  type DentalArch,
  type ToothClass,
  type ToothClassContent,
} from './content';

export type { DentalArch, ToothClass } from './content';

/** Shown on every surface that displays tooth-study content. */
export const TOOTH_ANATOMY_DISCLAIMER =
  'Teaching draft — pending educator review · synthetic model';

export type ToothAnatomy = ToothClassContent & {
  id: string;
  /** Formal name on the patient's side, e.g. "Maxillary right first molar". */
  name: string;
  /** Classroom name, e.g. "Upper right first molar". */
  shortName: string;
  arch: DentalArch;
  side: 'right' | 'left';
  toothClass: ToothClass;
  className: string;
  anterior: boolean;
  /** Surface wording: labial for incisors and canines, palatal for upper teeth. */
  facial: 'labial' | 'buccal';
  inner: 'palatal' | 'lingual';
  biting: 'incisal' | 'occlusal';
  rootCount: number;
};

/** FDI 11–17, 21–27, 31–37 and 41–47: every tooth in Forma's synthetic model. */
export const TOOTH_ANATOMY_IDS: readonly string[] = [1, 2, 3, 4].flatMap(quadrant =>
  TOOTH_CLASSES.map((_, index) => `${quadrant}${index + 1}`),
);

export function hasToothAnatomy(id: string): boolean {
  return TOOTH_ANATOMY_IDS.includes(id);
}

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);

/** Derive arch, side and class from the FDI digits; content is authored per class and arch. */
export function getToothAnatomy(id: string): ToothAnatomy {
  if (!hasToothAnatomy(id))
    throw new Error('Tooth study covers teeth 11–17, 21–27, 31–37 and 41–47.');
  const quadrant = Number(id[0]),
    toothClass = TOOTH_CLASSES[Number(id[1]) - 1];
  const arch: DentalArch = quadrant <= 2 ? 'upper' : 'lower',
    side = quadrant === 1 || quadrant === 4 ? 'right' : 'left',
    className = TOOTH_CLASS_NAMES[toothClass],
    anterior = Number(id[1]) <= 3,
    content = TOOTH_CONTENT[arch][toothClass];
  return {
    ...content,
    id,
    name: `${arch === 'upper' ? 'Maxillary' : 'Mandibular'} ${side} ${className}`,
    shortName: `${capitalize(arch)} ${side} ${className}`,
    arch,
    side,
    toothClass,
    className,
    anterior,
    facial: anterior ? 'labial' : 'buccal',
    inner: arch === 'upper' ? 'palatal' : 'lingual',
    biting: anterior ? 'incisal' : 'occlusal',
    rootCount: content.roots.length,
  };
}

/** The spoken explanation, prefixed with the tooth name and ending with the review status. */
export function spokenToothExplanation(id: string): string {
  const tooth = getToothAnatomy(id);
  return `${tooth.name}, tooth ${id}. ${tooth.explanation} ${TOOTH_ANATOMY_DISCLAIMER}.`;
}

/** Root count and names for display, e.g. "3 roots · mesiobuccal, distobuccal, palatal". */
export function rootSummary(tooth: ToothAnatomy): string {
  return tooth.rootCount === 1
    ? '1 root · single root'
    : `${tooth.rootCount} roots · ${tooth.roots.map(root => root.toLowerCase()).join(', ')}`;
}

export type ToothNameMatch = { tooth: string } | { missing: 'arch' };

const pattern = (aliases: Record<string, unknown>) =>
  Object.keys(aliases)
    .sort((a, b) => b.length - a.length)
    .map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
const toothName = new RegExp(
  `^(?:the )?(?:patient'?s )?(?:(${pattern(ARCH_ALIASES)}) )?(?:(${pattern(SIDE_ALIASES)}) )?(?:(${pattern(ARCH_ALIASES)}) )?(${pattern(CLASS_ALIASES)})$`,
);

/**
 * Resolve a spoken single-tooth name to its FDI number. Returns null for text
 * that is not a single named tooth (groups such as "upper molars" stay with the
 * existing grammar). An unspoken side defaults to the patient's right (1x upper,
 * 4x lower); an unspoken arch uses `defaultArch` or is reported so the caller can ask.
 */
export function resolveToothName(text: string, defaultArch?: DentalArch): ToothNameMatch | null {
  const match = text.trim().replace(/\s+/g, ' ').toLowerCase().match(toothName);
  if (!match) return null;
  const [, before, side, after, name] = match;
  if (before && after && ARCH_ALIASES[before] !== ARCH_ALIASES[after]) return null;
  const arch = ARCH_ALIASES[before || after || ''] ?? defaultArch;
  if (!arch) return { missing: 'arch' };
  const right = (SIDE_ALIASES[side] ?? 'right') === 'right';
  const quadrant = arch === 'upper' ? (right ? 1 : 2) : right ? 4 : 3;
  return { tooth: `${quadrant}${TOOTH_CLASSES.indexOf(CLASS_ALIASES[name]) + 1}` };
}
