import type { GlossaryContent } from './types';
import { caseVisual } from './visuals';

export const OCCLUSION_GLOSSARY: readonly GlossaryContent[] = [
  {
    id: 'overjet',
    term: 'Overjet',
    aliases: ['over jet', 'horizontal overlap'],
    definition:
      'Overjet is the horizontal relationship of the upper incisors to the lower incisors when the teeth bite together. It is distinct from their vertical overlap, called overbite.',
    show: caseVisual('increased-overjet', 'segment-retraction'),
    related: ['overbite', 'crossbite'],
  },
  {
    id: 'overbite',
    term: 'Overbite',
    aliases: ['over bite', 'vertical overlap'],
    definition:
      'Overbite is the vertical overlap of the upper incisors over the lower incisors when the teeth bite together. An increased overlap is described as a deep bite.',
    show: caseVisual('deepbite', 'anterior-intrusion'),
    related: ['overjet', 'deep-bite', 'open-bite'],
  },
  {
    id: 'crossbite',
    term: 'Crossbite',
    aliases: ['cross bite', 'anterior crossbite', 'posterior crossbite'],
    definition:
      'A crossbite is a reversed relationship in which one or more upper teeth bite inside their opposing lower teeth. It may involve anterior or posterior teeth; the displayed relationship alone does not establish its cause.',
    show: caseVisual('anterior-crossbite', 'local-repositioning'),
    related: ['overjet', 'buccal', 'lingual'],
  },
  {
    id: 'open-bite',
    term: 'Open bite',
    aliases: ['openbite', 'anterior open bite'],
    definition:
      'An open bite is a lack of vertical overlap or contact between opposing teeth in part of the bite. In an anterior open bite, a gap remains between the front teeth when the posterior teeth meet.',
    show: caseVisual('openbite', 'anterior-extrusion'),
    related: ['overbite', 'deep-bite', 'extrusion'],
  },
  {
    id: 'deep-bite',
    term: 'Deep bite',
    aliases: ['deepbite', 'deep overbite'],
    definition:
      'A deep bite is an increased vertical overlap of the upper and lower front teeth. It describes a relationship, without by itself explaining the underlying cause.',
    show: caseVisual('deepbite', 'anterior-intrusion'),
    related: ['overbite', 'open-bite', 'intrusion'],
  },
  {
    id: 'crowding',
    term: 'Crowding',
    aliases: ['dental crowding', 'crowded teeth'],
    definition:
      'Crowding occurs when the space available in a dental arch is insufficient for the teeth to align regularly. Teeth may overlap, rotate or sit outside the arch line.',
    show: caseVisual('crowding', 'position-then-rotation'),
    related: ['diastema', 'rotation'],
  },
  {
    id: 'diastema',
    term: 'Diastema',
    aliases: ['midline diastema', 'diastemas', 'diastemata'],
    definition:
      'A diastema is a space between adjacent teeth. A midline diastema is the space between the central incisors.',
    show: caseVisual('midline-diastema', 'symmetric-closure'),
    related: ['crowding', 'mesial'],
  },
  {
    id: 'angle-class-i',
    term: 'Angle Class I',
    aliases: ['angle class one', 'angle class 1', 'class one', 'class 1', 'class i'],
    definition:
      'In Angle Class I, the mesiobuccal cusp of the upper first molar aligns with the buccal groove of the lower first molar. This molar relationship does not by itself mean every tooth is well aligned.',
    related: ['angle-class-ii', 'angle-class-iii', 'buccal'],
  },
  {
    id: 'angle-class-ii',
    term: 'Angle Class II',
    aliases: ['angle class two', 'angle class 2', 'class two', 'class 2', 'class ii'],
    definition:
      'In Angle Class II, the upper first molar’s mesiobuccal cusp lies mesial to the lower first molar’s buccal groove. This dental classification alone does not establish the skeletal jaw relationship.',
    related: ['angle-class-i', 'angle-class-iii', 'mesial'],
  },
  {
    id: 'angle-class-iii',
    term: 'Angle Class III',
    aliases: ['angle class three', 'angle class 3', 'class three', 'class 3', 'class iii'],
    definition:
      'In Angle Class III, the upper first molar’s mesiobuccal cusp lies distal to the lower first molar’s buccal groove. This dental classification alone does not establish the skeletal jaw relationship.',
    related: ['angle-class-i', 'angle-class-ii', 'distal'],
  },
];
