import { getTeachingAssetCase } from '../anatomy-assets';
import type { ApplianceDisplay } from '../appliance-display';
import { createDemo, type DentalCase } from '../geometry';
import { createMechanicsExperiment, transitionMechanics } from '../mechanics/state';
import type { WireSection } from '../mechanics/types';
import { emptyPose, type Transforms } from '../model';
import type { LectureScene } from './types';
import { tadLearningScenes } from './sample-tad-learning';

const upper = ['17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27'];
const all = [...upper, ...upper.map(id => `${Number(id[0]) === 1 ? 4 : 3}${id[1]}`)];

/** Absolute authored poses; these are not outputs of an appliance solver. */
export function caseJourneyPoses() {
  const finish: Transforms = Object.fromEntries(all.map(id => [id, emptyPose()]));
  const start = structuredClone(finish);
  for (const id of upper) {
    const index = Number(id[1]);
    const inward = index >= 3 ? 1.6 : 0;
    start[id].translation[0] = inward ? (id[0] === '1' ? 1 : -1) * inward : 0;
  }
  // Small displaced/rotated incisors provide a separate alignment objective.
  start['12'].translation = [-1, 0, 2.5];
  start['12'].rotation[1] = -8;
  start['22'].translation = [1, 0, 2.5];
  start['22'].rotation[1] = 8;
  const expanded = structuredClone(start);
  for (const id of upper.filter(id => Number(id[1]) >= 3)) expanded[id].translation[0] = 0;
  const aligned = structuredClone(finish);
  aligned['12'].translation = [-0.375, 0, 0.9375];
  aligned['12'].rotation[1] = -3;
  aligned['22'].translation = [0.375, 0, 0.9375];
  aligned['22'].rotation[1] = 3;
  return { start, expanded, aligned, finish };
}

function scene(
  transforms: Transforms,
  preset: ApplianceDisplay['preset'] = 'none',
  view: LectureScene['setup']['view'] = 'occlusal',
): LectureScene {
  return {
    source: { kind: 'reference' },
    transforms: structuredClone(transforms),
    setup: {
      camera: null,
      selectedIds: [...upper],
      arch: 'upper',
      view,
      gums: false,
      labels: false,
      grid: false,
      stage: 10,
      opening: 0,
      jawOpen: true,
      anatomy: { bone: false, ligament: false, cutaway: false, opacity: 0.35 },
      magnification: 1,
      forceVectors: false,
      wirePreset: { material: 'stainless-steel', section: { shape: 'round', diameterMm: 0.35 } },
      mechanicsResponse: false,
      responseRevealed: false,
      predictResponse: false,
      playbackSpeed: 1,
      reverse: false,
    },
    roots: false,
    braces: preset !== 'none',
    attachments: false,
    bracketStyle: 'metal',
    ligatureColor: '#3298bb',
    applianceDisplay: { preset, progress: 0, palate: false },
    isolated: false,
  };
}

function wireScene(
  model: DentalCase,
  poses: Transforms,
  activation: number,
  section?: WireSection,
) {
  const value = scene(poses, 'braces');
  if (section) value.setup.wirePreset.section = section;
  let experiment = createMechanicsExperiment(model, poses);
  experiment = transitionMechanics(experiment, { type: 'brackets', teeth: upper, installed: true });
  experiment = transitionMechanics(experiment, {
    type: 'wire',
    id: 'case-upper-wire',
    teeth: upper,
    ...value.setup.wirePreset,
    expansionMm: activation,
    torqueDeg: 0,
  });
  value.mechanics = experiment;
  value.setup.forceVectors = true;
  return value;
}

/** One continuous case on the loaded model, with independent restore data per step. */
export function caseJourneyScenes() {
  const { start, expanded, aligned, finish } = caseJourneyPoses();
  const asset = getTeachingAssetCase();
  const model = asset ?? createDemo();
  try {
    const scenes = {
      assess: scene(start, 'none', 'perspective'),
      objectives: scene(start),
      bands: scene(start, 'expander-bands'),
      expander: scene(start, 'palatal-expander'),
      expansion: scene(expanded, 'palatal-expander'),
      reassess: scene(expanded, 'palatal-expander'),
      brackets: scene(expanded, 'brackets'),
      passiveWire: wireScene(model, expanded, 0),
      activeWire: wireScene(model, expanded, 0.15),
      alignment: scene(aligned, 'braces'),
      finishing: scene(finish, 'braces', 'front'),
      review: wireScene(model, finish, 0, { shape: 'rectangle', widthMm: 0.635, heightMm: 0.432 }),
      debond: scene(finish, 'none', 'perspective'),
      retention: scene(finish, 'retainer'),
    };
    for (const key of ['assess', 'review', 'debond'] as const) {
      scenes[key].setup.arch = 'both';
      scenes[key].setup.selectedIds = [...all];
      scenes[key].setup.jawOpen = false;
      scenes[key].setup.gums = true;
    }
    scenes.assess.setup.jawOpen = true;
    scenes.review.roots = true;
    scenes.review.setup.view = 'perspective';
    scenes.review.setup.gums = false;
    for (const key of ['expansion', 'reassess'] as const) scenes[key].applianceDisplay.progress = 1;
    return { ...scenes, ...tadLearningScenes(scenes.passiveWire) };
  } finally {
    // Fallback scene preparation owns its geometry; the loaded Atlas is shared.
    if (!asset) {
      model.teeth.forEach(tooth => {
        tooth.geometry.dispose();
        tooth.rootGeometry?.dispose();
      });
      model.gums.forEach(gum => gum.geometry.dispose());
    }
  }
}
