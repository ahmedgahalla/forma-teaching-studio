import type { GlossaryContent } from './types';

/** Conservative teaching descriptions; representative views do not certify anatomical detail. */
export const ANATOMY_GLOSSARY: readonly GlossaryContent[] = [
  {
    id: 'mesial',
    term: 'Mesial',
    aliases: ['mesial surface', 'mezial'],
    definition:
      'Mesial means toward the midline of the dental arch. A tooth’s mesial surface faces the next tooth toward that midline.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'mesial' }],
    related: ['distal', 'buccal'],
  },
  {
    id: 'distal',
    term: 'Distal',
    aliases: ['distal surface'],
    definition:
      'Distal means away from the midline along the dental arch. It describes the surface opposite the mesial surface.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'distal' }],
    related: ['mesial', 'marginal-ridge'],
  },
  {
    id: 'buccal',
    term: 'Buccal',
    aliases: ['buccal surface', 'buckle'],
    definition:
      'Buccal describes the tooth surface facing the cheek, especially on premolars and molars.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'buccal' }],
    related: ['labial', 'lingual'],
  },
  {
    id: 'labial',
    term: 'Labial',
    aliases: ['labial surface'],
    definition:
      'Labial describes the tooth surface facing the lips, especially on incisors and canines.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '11', view: 'buccal' }],
    related: ['buccal', 'palatal'],
  },
  {
    id: 'lingual',
    term: 'Lingual',
    aliases: ['lingual surface'],
    definition:
      'Lingual describes the tooth surface facing the tongue. On upper teeth, this inner surface is also called palatal.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '46', view: 'lingual' }],
    related: ['palatal', 'buccal'],
  },
  {
    id: 'palatal',
    term: 'Palatal',
    aliases: ['palatal surface'],
    definition:
      'Palatal describes the inner surface of an upper tooth facing the palate, or roof of the mouth.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'lingual' }],
    related: ['lingual', 'cusp-of-carabelli'],
  },
  {
    id: 'occlusal',
    term: 'Occlusal',
    aliases: ['occlusal surface', 'occlusal table'],
    definition:
      'Occlusal describes the chewing surface of a premolar or molar, where cusps, ridges and grooves shape the crown.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'occlusal' }],
    related: ['incisal', 'cusp', 'fossa'],
  },
  {
    id: 'incisal',
    term: 'Incisal',
    aliases: ['incisal edge', 'incisal surface'],
    definition:
      'Incisal refers to the cutting edge of an anterior tooth. Incisors have an incisal edge rather than a broad occlusal table.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '11', view: 'occlusal' }],
    related: ['occlusal', 'mamelons'],
  },
  {
    id: 'apex',
    term: 'Apex',
    aliases: ['root apex', 'apices', 'root tip'],
    definition:
      'The apex is the tip of a tooth root. A tooth with several roots has an apex at the end of each root.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '13', view: 'apical' }],
    related: ['furcation', 'root-trunk'],
  },
  {
    id: 'cervical-line',
    term: 'Cervical line / CEJ',
    aliases: ['cervical line', 'cej', 'c e j', 'cementoenamel junction', 'cemento enamel junction'],
    definition:
      'The cervical line, or cementoenamel junction, marks where crown enamel meets root cementum. It separates the anatomical crown from the root.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '11', view: 'buccal' }],
    related: ['root-trunk', 'cingulum'],
  },
  {
    id: 'cusp',
    term: 'Cusp',
    aliases: ['cusps', 'tooth cusp'],
    definition:
      'A cusp is a raised point or rounded prominence on a tooth crown. Canines have one main cusp, while premolars and molars have several.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '13', view: 'buccal' }],
    related: ['occlusal', 'cusp-of-carabelli'],
  },
  {
    id: 'cingulum',
    term: 'Cingulum',
    aliases: ['cingula', 'singulum'],
    definition:
      'The cingulum is the rounded prominence near the cervical part of the lingual or palatal surface of an anterior tooth.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '11', view: 'lingual' }],
    related: ['cervical-line', 'marginal-ridge', 'fossa'],
  },
  {
    id: 'mamelons',
    term: 'Mamelons',
    aliases: ['mamelon', 'mammelons', 'mamellons'],
    definition:
      'Mamelons are small rounded bumps on the incisal edge of a newly erupted incisor. They commonly become less visible as the edge wears.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '11', view: 'buccal' }],
    related: ['incisal'],
  },
  {
    id: 'marginal-ridge',
    term: 'Marginal ridge',
    aliases: ['marginal ridges'],
    definition:
      'Marginal ridges form the mesial and distal borders of a posterior tooth’s occlusal surface. They also border the lingual or palatal surface of anterior teeth.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '11', view: 'lingual' }],
    related: ['mesial', 'distal', 'cingulum'],
  },
  {
    id: 'oblique-ridge',
    term: 'Oblique ridge',
    aliases: ['oblique ridges'],
    definition:
      'The oblique ridge crosses the occlusal surface of an upper molar diagonally, connecting the mesiopalatal and distobuccal cusp regions.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'occlusal' }],
    related: ['occlusal', 'cusp'],
  },
  {
    id: 'fossa',
    term: 'Fossa',
    aliases: ['fossae', 'dental fossa'],
    definition:
      'A fossa is a shallow depression in a tooth crown. Examples include the palatal fossa of an upper incisor and the fossae on a molar’s chewing surface.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '11', view: 'lingual' }],
    related: ['cingulum', 'marginal-ridge', 'occlusal'],
  },
  {
    id: 'cusp-of-carabelli',
    term: 'Cusp of Carabelli',
    aliases: ['carabelli', 'carabelli cusp', 'cusp of karabelli', 'karabelli'],
    definition:
      'The cusp of Carabelli is a variable accessory feature on the palatal side of the mesiopalatal cusp of an upper molar, especially the first molar. It may range from a small groove or pit to a distinct cusp.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'lingual' }],
    related: ['palatal', 'cusp', 'oblique-ridge'],
  },
  {
    id: 'furcation',
    term: 'Furcation',
    aliases: ['root furcation', 'furcations'],
    definition:
      'The furcation is the region where the root trunk divides into separate roots in a tooth with more than one root.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'buccal' }],
    related: ['root-trunk', 'apex'],
  },
  {
    id: 'root-trunk',
    term: 'Root trunk',
    aliases: ['root trunks'],
    definition:
      'The root trunk is the undivided part of a multirooted tooth between the cervical line and the furcation.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'buccal' }],
    related: ['furcation', 'cervical-line'],
  },
  {
    id: 'periodontal-ligament',
    term: 'Periodontal ligament',
    aliases: ['pdl', 'p d l', 'periodontal ligaments'],
    definition:
      'The periodontal ligament is the connective tissue between root cementum and the tooth socket’s alveolar bone. It supports the tooth and participates in the tissue response to loading.',
    show: [
      { kind: 'case', action: 'load', id: 'reference-occlusion' },
      { kind: 'toggle', target: 'roots', visible: true },
      { kind: 'toggle', target: 'gums', visible: false },
    ],
    biology: 'overview',
    related: ['alveolar-bone', 'anchorage'],
  },
  {
    id: 'alveolar-bone',
    term: 'Alveolar bone',
    aliases: ['alveolar process', 'tooth socket', 'socket bone'],
    definition:
      'Alveolar bone forms and supports the sockets that hold the tooth roots. Nael Teaching Studio’s separate tissue diagrams illustrate its relationship with the periodontal ligament, without patient-specific bone anatomy.',
    show: [
      { kind: 'case', action: 'load', id: 'reference-occlusion' },
      { kind: 'toggle', target: 'roots', visible: true },
      { kind: 'toggle', target: 'gums', visible: false },
    ],
    biology: 'overview',
    related: ['periodontal-ligament', 'apex'],
  },
  {
    id: 'fdi-numbering',
    term: 'FDI numbering',
    aliases: ['fdi', 'f d i', 'f d i numbering', 'tooth numbering', 'two digit numbering'],
    definition:
      'FDI numbering identifies a permanent tooth with two digits: the quadrant first, then its position from the midline. Tooth 16 is the upper right first molar; left and right refer to the patient.',
    show: [{ kind: 'tooth-study', action: 'open', tooth: '16', view: 'buccal' }],
    related: ['mesial', 'distal'],
  },
];
