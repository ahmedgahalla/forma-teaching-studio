/** Tooth-name aliases for the deterministic tooth-study grammar (content as data). */
import type { DentalArch, ToothClass } from './content';

/** Spoken and typed name aliases (lower-case, after classroom-language normalization). */
export const ARCH_ALIASES: Record<string, DentalArch> = {
  upper: 'upper',
  maxillary: 'upper',
  top: 'upper',
  lower: 'lower',
  mandibular: 'lower',
  bottom: 'lower',
};
export const SIDE_ALIASES: Record<string, 'right' | 'left'> = { right: 'right', left: 'left' };
export const CLASS_ALIASES: Record<string, ToothClass> = {
  'central incisor': 'central-incisor',
  central: 'central-incisor',
  'lateral incisor': 'lateral-incisor',
  lateral: 'lateral-incisor',
  canine: 'canine',
  cuspid: 'canine',
  'eye tooth': 'canine',
  'first premolar': 'first-premolar',
  '1st premolar': 'first-premolar',
  'first bicuspid': 'first-premolar',
  '1st bicuspid': 'first-premolar',
  'second premolar': 'second-premolar',
  '2nd premolar': 'second-premolar',
  'second bicuspid': 'second-premolar',
  '2nd bicuspid': 'second-premolar',
  'first molar': 'first-molar',
  '1st molar': 'first-molar',
  'six-year molar': 'first-molar',
  'six year molar': 'first-molar',
  '6-year molar': 'first-molar',
  '6 year molar': 'first-molar',
  'second molar': 'second-molar',
  '2nd molar': 'second-molar',
  'twelve-year molar': 'second-molar',
  'twelve year molar': 'second-molar',
  '12-year molar': 'second-molar',
  '12 year molar': 'second-molar',
};
