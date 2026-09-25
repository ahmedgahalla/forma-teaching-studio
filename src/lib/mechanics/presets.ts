/** Engineering assumptions for a synthetic teaching rig, never patient-specific coefficients. */
export const SUPPORT_PRESETS = {
  standard: { label: 'Standard virtual support', translationNPerMm: 100, rotationNmmPerRad: 1000 },
  soft: { label: 'Half-stiffness virtual support', translationNPerMm: 50, rotationNmmPerRad: 500 },
  firm: {
    label: 'Double-stiffness virtual support',
    translationNPerMm: 200,
    rotationNmmPerRad: 2000,
  },
} as const;
export const MATERIAL_PRESETS = {
  'stainless-steel': {
    label: 'Stainless steel — ideal elastic',
    youngNPerMm2: 200000,
    poisson: 0.3,
    maxStrain: 0.002,
  },
  'beta-titanium': {
    label: 'Beta titanium — ideal elastic',
    youngNPerMm2: 69000,
    poisson: 0.3,
    maxStrain: 0.003,
  },
} as const;
export const MECHANICS_SOURCES = [
  {
    title: 'Reduced tooth support and beam-element methodology (not its remodeling law)',
    url: 'https://link.springer.com/article/10.1186/s40510-018-0255-8',
  },
  {
    title: 'Measured alloy differences; a teaching preset is not a manufacturer specification',
    url: 'https://pubmed.ncbi.nlm.nih.gov/17045145/',
  },
  {
    title: '69 GPa beta-titanium assumption used in an orthodontic beam analysis',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7510485/',
  },
  {
    title: 'Wire dimensions and slot clearance affect torque expression',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32924097/',
  },
  {
    title: 'Expander force depends on appliance and supporting-structure compliance',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3880096/',
  },
] as const;
export const MECHANICS_LIMITS = {
  teeth: 32,
  wires: 4,
  tads: 8,
  elastics: 12,
  expanders: 1,
  stages: 20,
  sectionMinMm: 0.2,
  sectionMaxMm: 0.8,
  expansionMm: 2,
  torqueDeg: 20,
  forceN: 20,
  stiffnessNPerMm: 1000,
  pointMm: 200,
  localPointMm: 30,
  maxRotationDeg: 5,
  maxRootDisplacementFraction: 0.05,
  maxIterations: 40,
} as const;
export const MECHANICS_ASSUMPTIONS = [
  'Initial elastic response of a synthetic virtual support, not patient movement or a treatment prediction.',
  'Virtual support stiffnesses and support origins are authored teaching assumptions; tissues are not calibrated.',
  'Wire spans use small-deflection Euler–Bernoulli bending, ideal axial slip and seated bracket slopes.',
  'Rectangular wire uses ideal relative-twist clearance in a 0.022 × 0.028 inch slot; no friction, notching or plasticity.',
  'Material moduli are representative engineering presets; Poisson ratio and strain limits are declared software assumptions, not clinical safety limits.',
  'TADs are ideal fixed anchors; elastic laws have no force decay or biological response.',
  'Elastic directions and attachment moment arms are evaluated in the unloaded reference; spring extension is linearized for initial response.',
  'Optional symmetric palate compliance is a scalar virtual spring, not a model of sutural separation.',
  'Each stage is solved against the same unloaded reference. There is no time or remodeling accumulation.',
] as const;
