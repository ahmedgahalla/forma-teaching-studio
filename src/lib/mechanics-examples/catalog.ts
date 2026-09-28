export const MECHANICS_EXAMPLES = [
  {
    id: 'crown-pull',
    title: 'Crown pull',
    question: 'Why does a force at the crown also turn the tooth?',
    target: 'selected',
    variants: [
      { id: 'buccal', label: 'Buccal pull' },
      { id: 'lingual', label: 'Lingual pull' },
    ],
  },
  {
    id: 'counter-couple',
    title: 'Pull with a counter-couple',
    question: 'What changes when an opposing couple balances the moment?',
    target: 'selected',
    variants: [
      { id: 'balanced', label: 'Balanced moment' },
      { id: 'half', label: 'Half counter-couple' },
    ],
  },
  {
    id: 'axial-rotation',
    title: 'Axial rotation couple',
    question: 'Can equal opposite forces rotate a tooth without a net force?',
    target: 'selected',
    variants: [
      { id: 'forward', label: 'First direction' },
      { id: 'reverse', label: 'Reverse direction' },
    ],
  },
  {
    id: 'inclination',
    title: 'Buccolingual inclination couple',
    question: 'How does changing the couple plane change its rotation axis?',
    target: 'selected',
    variants: [
      { id: 'forward', label: 'First direction' },
      { id: 'reverse', label: 'Reverse direction' },
    ],
  },
  {
    id: 'vertical',
    title: 'Intrusion and extrusion',
    question: 'What changes when the axial load is reversed?',
    target: 'selected',
    variants: [
      { id: 'intrusion', label: 'Intrusion' },
      { id: 'extrusion', label: 'Extrusion' },
    ],
  },
  {
    id: 'balanced-intrusion',
    title: 'Molar intrusion balance',
    question: 'Does splitting the same load across both sides reduce tipping?',
    target: 'molar',
    variants: [
      { id: 'single', label: 'Buccal side only' },
      { id: 'balanced', label: 'Both sides' },
    ],
  },
  {
    id: 'anchorage',
    title: 'Reciprocal and fixed anchorage',
    question: 'Where does the equal opposite reaction go?',
    target: '13 and 16',
    variants: [
      { id: 'reciprocal', label: 'Tooth anchorage' },
      { id: 'fixed', label: 'Ideal fixed anchor' },
    ],
  },
  {
    id: 'wire-play',
    title: 'Wire twist and slot play',
    question: 'Does the same total twist engage both wire sizes equally?',
    target: '13 and 16',
    variants: [
      { id: 'large-steel', label: 'Larger steel wire' },
      { id: 'small-steel', label: 'Smaller steel wire' },
      { id: 'large-beta', label: 'Larger beta titanium wire' },
    ],
  },
] as const;

export type MechanicsExampleId = (typeof MECHANICS_EXAMPLES)[number]['id'];
export type MechanicsExampleAction = {
  kind: 'mechanics-example';
  id: MechanicsExampleId;
  variant: string;
};

export function mechanicsExample(id: unknown, variant: unknown) {
  const example = MECHANICS_EXAMPLES.find(item => item.id === id);
  if (!example || !example.variants.some(item => item.id === variant))
    throw new Error('Choose a named mechanics example and one of its displayed variations.');
  return example;
}

export function mechanicsExampleTargets(id: MechanicsExampleId, selected: string, ids: string[]) {
  const target = MECHANICS_EXAMPLES.find(example => example.id === id)!.target;
  const targets =
    target === 'selected'
      ? [selected]
      : target === 'molar'
        ? [/^[1-4][67]$/.test(selected) ? selected : '16']
        : ['13', '16'];
  if (targets.some(tooth => !ids.includes(tooth)))
    throw new Error(`This example needs teeth ${targets.join(', ')} in the current model.`);
  return targets;
}
