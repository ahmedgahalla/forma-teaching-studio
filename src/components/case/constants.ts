import type { MovementDirection, Vec3 } from '@/lib/model';
import type { AttachmentSpec } from '@/lib/attachments';
import type { Command } from '@/lib/commands';
import { TEACHING_CASES, type TeachingCaseId } from '@/lib/teaching-cases';
import type { CaseDiagramKind } from './StudioExperience';

export const directions: { id: MovementDirection; label: string; detail: string }[] = [
  { id: 'buccal', label: 'Buccal', detail: 'Labial / outward' },
  { id: 'lingual', label: 'Lingual', detail: 'Palatal / inward' },
  { id: 'mesial', label: 'Mesial', detail: 'Toward midline' },
  { id: 'distal', label: 'Distal', detail: 'Away from midline' },
  { id: 'intrude', label: 'Intrude', detail: 'Toward root' },
  { id: 'extrude', label: 'Extrude', detail: 'Toward occlusal' },
];

export const axisVectors: Record<string, Vec3> = {
  '+X': [1, 0, 0],
  '-X': [-1, 0, 0],
  '+Y': [0, 1, 0],
  '-Y': [0, -1, 0],
  '+Z': [0, 0, 1],
  '-Z': [0, 0, -1],
};

export const pretty = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

export const DEFAULT_ATTACHMENT: AttachmentSpec = {
  shape: 'rectangle',
  width: 2.5,
  height: 3.5,
  depth: 1,
  offsetMesial: 0,
  offsetOcclusal: 0,
  rotation: 0,
};

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'The operation could not be completed.';

export const EXAMPLES = [
  'select upper front six, install brackets on them, then put a wire through these brackets',
  'activate that wire by 0.5 mm, then show what happens',
  'use 0.018 inch wire instead',
  'explain that movement',
  'save experiment stage as setup one',
  'load dental class II division 1',
  'load crowding',
  'play case',
  'pause case',
  'explore this arrangement',
  'return to prepared case',
  'load deep bite',
  'choose posterior extrusion',
  'load anchorage',
  'select upper front six',
  'move the selected segment posteriorly 1 mm',
  'apply preview',
  'make the last movement smaller',
  'discard preview',
  'lock upper molars',
  'show roots',
  'show displacement traces',
  'play in reverse',
  'pause halfway',
  'show after',
  'save arrangement as example one',
  'compare with original',
  'undo the last two changes',
  'start braces workflow',
  'start palatal expansion workflow',
  'start archwire expansion workflow',
  'start anatomy lesson',
  'try this setup',
  'place palatal expander',
  'return to source lesson',
  'restore my workspace',
  'return to try mode',
];

export function commandLabel(c: Command) {
  const targets =
    'teeth' in c
      ? c.teeth.length > 6
        ? `${c.teeth.length} teeth`
        : c.teeth.join(', ')
      : 'tooth' in c
        ? c.tooth
        : '';
  if (c.type === 'move' || c.type === 'move_group')
    return `${targets} · ${c.direction} ${pretty(c.amount)} mm`;
  if (c.type === 'rotate' || c.type === 'rotate_group')
    return `${targets} · World ${c.axis.toUpperCase()} ${pretty(c.amount)}°`;
  if (c.type === 'orthodontic')
    return `${targets} · ${c.movement === 'rotate' ? 'Axial rotation' : c.movement} ${pretty(c.amount)}°`;
  if (c.type === 'reset') return `${targets} · Reset to original`;
  if (c.type === 'ghost') return `${c.visible ? 'Show' : 'Hide'} original positions`;
  if (c.type === 'appliance') return `${c.visible ? 'Show' : 'Hide'} brackets and archwires`;
  if (c.type === 'stages') return `Create ${c.count} display stages`;
  return c.type;
}

export const CASE_DIAGRAMS: Record<TeachingCaseId, CaseDiagramKind> = {
  'reference-occlusion': 'anatomy',
  'movement-types': 'translation',
  crowding: 'crowding',
  'midline-diastema': 'spacing',
  'increased-overjet': 'overjet',
  'anterior-crossbite': 'crossbite',
  deepbite: 'overbite',
  openbite: 'open-bite',
  'posterior-crossbite': 'crossbite',
  'anchorage-space-closure': 'braces',
  'occlusal-finishing': 'rotation',
  'removable-retention': 'retention',
};

export const CASE_CARDS = TEACHING_CASES.map(item => ({
  ...item,
  diagram: CASE_DIAGRAMS[item.id],
  variantCount: item.variants.length,
  concepts: [item.learningGoal],
}));
