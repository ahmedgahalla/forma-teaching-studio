import type { Vec3 } from '../model';
import type { ForceLaw, MechanicsAction, MechanicsEndpoint, WireSection } from './types';
import { MECHANICS_LIMITS as LIMIT } from './presets';
import { slotPlayRadians } from './beam';

function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('Invalid mechanics object.'); return value as Record<string, unknown>; }
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []) { if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) throw new Error('Missing or unexpected mechanics fields.'); }
function number(value: unknown, min: number, max: number): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Enter a finite mechanics value between ${min} and ${max}.`); return value; }
function id(value: unknown): string { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,47}$/.test(value)) throw new Error('Use a short, unique appliance identifier.'); return value; }
function bool(value: unknown) { if (typeof value !== 'boolean') throw new Error('A mechanics switch must be true or false.'); return value; }
function choice<T extends string>(value: unknown, choices: readonly T[]): T { if (!choices.includes(value as T)) throw new Error('Unsupported mechanics option.'); return value as T; }
function point(value: unknown, bound: number): Vec3 { if (!Array.isArray(value) || value.length !== 3) throw new Error('A point needs three millimetre coordinates.'); return value.map(n => number(n, -bound, bound)) as Vec3; }
function teeth(value: unknown, ids?: readonly string[]): string[] { if (!Array.isArray(value) || !value.length || value.length > LIMIT.teeth || value.some(v => typeof v !== 'string' || !/^[1-4][1-8]$/.test(v) || ids && !ids.includes(v)) || new Set(value).size !== value.length) throw new Error('Choose unique teeth present in this experiment.'); return [...value] as string[]; }
export function validateWireSection(value: unknown): WireSection {
  const v = object(value); let result: WireSection;
  if (v.shape === 'round') { fields(v, ['shape', 'diameterMm']); result = { shape: 'round', diameterMm: number(v.diameterMm, LIMIT.sectionMinMm, LIMIT.sectionMaxMm) }; if (result.diameterMm > .022 * 25.4) throw new Error('Round wire must fit the ideal 0.022 inch slot.'); }
  else { fields(v, ['shape', 'widthMm', 'heightMm']); choice(v.shape, ['rectangle']); result = { shape: 'rectangle', widthMm: number(v.widthMm, LIMIT.sectionMinMm, LIMIT.sectionMaxMm), heightMm: number(v.heightMm, LIMIT.sectionMinMm, LIMIT.sectionMaxMm) }; slotPlayRadians(result); }
  return result;
}
function endpoint(value: unknown, ids?: readonly string[]): MechanicsEndpoint {
  const v = object(value);
  if (v.kind === 'tad') { fields(v, ['kind', 'id']); return { kind: 'tad', id: id(v.id) }; }
  fields(v, ['kind', 'tooth', 'local']); choice(v.kind, ['tooth']); return { kind: 'tooth', tooth: teeth([v.tooth], ids)[0], local: point(v.local, LIMIT.localPointMm) };
}
function law(value: unknown): ForceLaw {
  const v = object(value);
  if (v.kind === 'constant') { fields(v, ['kind', 'forceN']); return { kind: 'constant', forceN: number(v.forceN, 0, LIMIT.forceN) }; }
  fields(v, ['kind', 'stiffnessNPerMm', 'restLengthMm']); choice(v.kind, ['spring']); return { kind: 'spring', stiffnessNPerMm: number(v.stiffnessNPerMm, .001, LIMIT.stiffnessNPerMm), restLengthMm: number(v.restLengthMm, 0, 200) };
}
/** Strict validation shared by typed UI, local command parser and untrusted JSON. */
export function validateMechanicsAction(value: unknown, availableIds?: readonly string[]): MechanicsAction {
  const v = object(value), material = () => choice(v.material, ['stainless-steel', 'beta-titanium'] as const);
  switch (v.type) {
    case 'brackets': fields(v, ['type', 'teeth', 'installed']); return { type: v.type, teeth: teeth(v.teeth, availableIds), installed: bool(v.installed) };
    case 'bracket-position': fields(v, ['type', 'tooth', 'local']); return { type: v.type, tooth: teeth([v.tooth], availableIds)[0], local: point(v.local, LIMIT.localPointMm) };
    case 'wire': fields(v, ['type', 'id', 'teeth', 'material', 'section'], ['expansionMm', 'torqueDeg']); return { type: v.type, id: id(v.id), teeth: teeth(v.teeth, availableIds), material: material(), section: validateWireSection(v.section), ...(v.expansionMm === undefined ? {} : { expansionMm: number(v.expansionMm, -LIMIT.expansionMm, LIMIT.expansionMm) }), ...(v.torqueDeg === undefined ? {} : { torqueDeg: number(v.torqueDeg, -LIMIT.torqueDeg, LIMIT.torqueDeg) }) };
    case 'wire-material': fields(v, ['type', 'id', 'material']); return { type: v.type, id: id(v.id), material: material() };
    case 'wire-section': fields(v, ['type', 'id', 'section']); return { type: v.type, id: id(v.id), section: validateWireSection(v.section) };
    case 'wire-activation': fields(v, ['type', 'id', 'expansionMm'], ['torqueDeg']); return { type: v.type, id: id(v.id), expansionMm: number(v.expansionMm, -LIMIT.expansionMm, LIMIT.expansionMm), ...(v.torqueDeg === undefined ? {} : { torqueDeg: number(v.torqueDeg, -LIMIT.torqueDeg, LIMIT.torqueDeg) }) };
    case 'tad': fields(v, ['type', 'id', 'position']); return { type: v.type, id: id(v.id), position: point(v.position, LIMIT.pointMm) };
    case 'elastic': fields(v, ['type', 'id', 'from', 'to', 'law']); return { type: v.type, id: id(v.id), from: endpoint(v.from, availableIds), to: endpoint(v.to, availableIds), law: law(v.law) };
    case 'expander': fields(v, ['type', 'id', 'left', 'right', 'activationMm', 'stiffnessNPerMm'], ['palateStiffnessNPerMm']); return { type: v.type, id: id(v.id), left: teeth(v.left, availableIds), right: teeth(v.right, availableIds), activationMm: number(v.activationMm, 0, LIMIT.expansionMm), stiffnessNPerMm: number(v.stiffnessNPerMm, .001, LIMIT.stiffnessNPerMm), ...(v.palateStiffnessNPerMm === undefined ? {} : { palateStiffnessNPerMm: number(v.palateStiffnessNPerMm, .001, LIMIT.stiffnessNPerMm) }) };
    case 'remove': fields(v, ['type', 'kind', 'id']); return { type: v.type, kind: choice(v.kind, ['wire', 'tad', 'elastic', 'expander']), id: id(v.id) };
    case 'support': fields(v, ['type', 'preset']); return { type: v.type, preset: choice(v.preset, ['standard', 'soft', 'firm']) };
    case 'anchor': fields(v, ['type', 'teeth', 'fixed']); return { type: v.type, teeth: teeth(v.teeth, availableIds), fixed: bool(v.fixed) };
    case 'stage': fields(v, ['type', 'index']); { const index = number(v.index, 0, LIMIT.stages - 1); if (!Number.isInteger(index)) throw new Error('Choose a whole stage index.'); return { type: v.type, index }; }
    case 'save-stage': fields(v, ['type', 'label']); if (typeof v.label !== 'string' || !v.label.trim() || v.label.length > 80) throw new Error('Name the stage using 1–80 characters.'); return { type: v.type, label: v.label.trim() };
    case 'compare-without-tad': fields(v, ['type', 'id']); return { type: v.type, id: id(v.id) };
    case 'solve': case 'explain': case 'apply': case 'discard': fields(v, ['type']); return { type: v.type };
    default: throw new Error('Unsupported mechanics action.');
  }
}
