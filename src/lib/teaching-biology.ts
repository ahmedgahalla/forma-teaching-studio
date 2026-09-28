export type BiologyView = 'overview' | 'compression' | 'tension';

export const BIOLOGY_SCOPE =
  'Illustrative tissue biology; not a stress map or prediction for this model.';
export const BIOLOGY_LIMITS =
  'These are separate local examples, not two fixed sides of a tooth. Responses vary around the root with loading, tissue properties and time. PDL width and cells are enlarged for visibility.';

export const BIOLOGY_VIGNETTES = {
  compression: {
    title: 'Compression',
    caption:
      'Compression-associated signaling can promote osteoclast activity and local bone resorption.',
    description:
      'A narrowed periodontal ligament space is drawn between the root surface and bone. Inward arrows indicate local compression. An osteoclast is shown at a scalloped bone surface, not on the root.',
    cell: 'Osteoclast',
    response: 'Bone resorption',
  },
  tension: {
    title: 'Tension',
    caption:
      'Tension-associated signaling can support osteoblast activity and local bone formation.',
    description:
      'A widened periodontal ligament space is drawn between the root surface and bone. Outward arrows indicate local tension. Osteoblasts line a patterned band of new bone.',
    cell: 'Osteoblasts',
    response: 'Bone formation',
  },
} as const;

/** Primary experiments and mechanical modeling; none validates Forma's synthetic anatomy. */
export const BIOLOGY_SOURCES = [
  {
    label: 'Human PDL',
    title: 'Otero et al. (2016): RANKL and OPG in loaded human periodontal ligament',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26823650/',
    evidence: 'Human tissue study',
  },
  {
    label: 'Resorption',
    title: 'Yang et al. (2018): RANKL deletion in periodontal ligament and bone lining cells',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29483595/',
    evidence: 'Mouse experiment',
  },
  {
    label: 'Formation',
    title: 'Mao et al. (2018): Tension-associated bone formation during tooth movement',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29224185/',
    evidence: 'Rat experiment',
  },
  {
    label: 'Pattern limits',
    title: 'Cattaneo et al. (2009): Strains in periodontal ligament and alveolar bone',
    url: 'https://pubmed.ncbi.nlm.nih.gov/19419455/',
    evidence: 'Finite-element study',
  },
] as const;
