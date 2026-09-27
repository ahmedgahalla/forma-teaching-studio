import type { GlossaryContent } from './types';
import { caseVisual } from './visuals';

export const MECHANICS_GLOSSARY: readonly GlossaryContent[] = [
  {
    id: 'anchorage',
    term: 'Anchorage',
    aliases: ['orthodontic anchorage', 'anchor age'],
    definition:
      'Anchorage is resistance to unwanted tooth movement during an orthodontic movement. Forma’s prepared example compares authored anterior and posterior movement allocations, without calculating biological anchorage.',
    show: caseVisual('anchorage-space-closure', 'posterior-held'),
    related: ['translation', 'periodontal-ligament'],
  },
  {
    id: 'translation',
    term: 'Translation (bodily movement)',
    aliases: ['translation', 'bodily movement', 'bodily translation', 'body movement'],
    definition:
      'Translation, or bodily movement, moves a tooth without changing its orientation. In the geometric example, every point on the crown and root moves by the same distance and direction.',
    show: caseVisual('movement-types', 'translation'),
    related: ['tipping', 'torque', 'rotation'],
  },
  {
    id: 'tipping',
    term: 'Tipping',
    aliases: ['tip', 'tooth tipping', 'tilting'],
    definition:
      'Tipping changes a tooth’s inclination, so crown and root points follow different paths around a centre of rotation. Forma shows an authored geometric example rather than predicting a clinical centre of rotation.',
    show: caseVisual('movement-types', 'tip'),
    related: ['translation', 'torque', 'rotation'],
  },
  {
    id: 'torque',
    term: 'Torque',
    aliases: ['root torque', 'tooth torque', 'tork'],
    definition:
      'In orthodontic teaching, torque refers to buccolingual root control and tooth inclination. Forma’s example shows an authored inclination change, without calculating the force system or tissue response that produces it.',
    show: caseVisual('movement-types', 'torque'),
    related: ['tipping', 'translation', 'buccal'],
  },
  {
    id: 'rotation',
    term: 'Rotation',
    aliases: ['tooth rotation', 'axial rotation'],
    definition:
      'Axial rotation turns a tooth around its long axis, changing which way its crown faces. This differs from translating the whole tooth or changing its inclination.',
    show: caseVisual('movement-types', 'axial-rotation'),
    related: ['translation', 'tipping', 'crowding'],
  },
  {
    id: 'intrusion',
    term: 'Intrusion',
    aliases: ['tooth intrusion', 'dental intrusion'],
    definition:
      'Intrusion is movement of a tooth rootward into its supporting socket, approximately along its long axis. Forma illustrates the displacement without predicting the supporting tissues’ response.',
    show: caseVisual('deepbite', 'anterior-intrusion'),
    related: ['extrusion', 'deep-bite', 'apex'],
  },
  {
    id: 'extrusion',
    term: 'Extrusion',
    aliases: ['tooth extrusion', 'dental extrusion'],
    definition:
      'Extrusion moves a tooth out of its socket toward the opposing arch, approximately along its long axis. It is the opposite direction to intrusion.',
    show: caseVisual('openbite', 'anterior-extrusion'),
    related: ['intrusion', 'open-bite'],
  },
  {
    id: 'retention',
    term: 'Retention',
    aliases: ['orthodontic retention', 'retaining teeth'],
    definition:
      'Retention is the maintenance of tooth positions after active movement. Forma’s passive holding example keeps the authored arrangement still; it does not prescribe a retainer or a wear schedule.',
    show: caseVisual('removable-retention', 'passive-hold'),
    related: ['translation', 'crowding', 'diastema'],
  },
];
