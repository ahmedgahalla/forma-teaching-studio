import { validateApplianceDisplay } from '../appliance-display';
import { validateAttachment } from '../attachments';
import { validateMechanicsExperiment } from '../mechanics/state';
import { isPose, type Transforms } from '../model';
import { validateLectureSetup, type LectureSetup } from '../planning';
import { TOOTH_STUDY_VIEWS } from '../tooth-study/types';
import { boolean, choice, fields, object } from './fields';
import { lectureSceneModel, lectureSourceIds, validateLectureSource } from './model';
import type { LectureScene } from './types';

const setupFields = [
  'camera',
  'selectedIds',
  'arch',
  'view',
  'gums',
  'labels',
  'grid',
  'stage',
  'opening',
  'anatomy',
  'magnification',
  'forceVectors',
  'wirePreset',
];

function validateSetup(raw: unknown, ids: Set<string>): LectureSetup {
  const value = object(raw);
  fields(value, setupFields, [
    'jawOpen',
    'mechanicsResponse',
    'responseRevealed',
    'predictResponse',
    'playbackSpeed',
    'reverse',
  ]);
  fields(object(value.anatomy), ['bone', 'opacity', 'cutaway', 'ligament']);
  fields(object(value.wirePreset), ['material', 'section']);
  if (value.camera !== null)
    fields(object(value.camera), ['position', 'target', 'up', 'view', 'far', 'maxDistance']);
  const setup = validateLectureSetup(value, ids, 50);
  if (setup.camera && setup.camera.position.every((n, i) => n === setup.camera!.target[i]))
    throw new Error('The saved lecture camera must be away from its target.');
  return structuredClone(setup);
}

export function validateLectureTransforms(raw: unknown, ids: Set<string>): Transforms {
  const value = object(raw),
    result: Transforms = {};
  for (const [id, pose] of Object.entries(value)) {
    if (!ids.has(id) || !isPose(pose)) throw new Error('Invalid lecture tooth pose.');
    fields(object(pose), ['translation', 'rotation']);
    if ([...pose.translation, ...pose.rotation].some(n => Math.abs(n) > 10000))
      throw new Error('Lecture tooth poses exceed the supported range.');
    result[id] = { translation: [...pose.translation], rotation: [...pose.rotation] };
  }
  return result;
}

export function validateLectureScene(raw: unknown): LectureScene {
  const value = object(raw);
  fields(
    value,
    [
      'source',
      'transforms',
      'setup',
      'roots',
      'braces',
      'attachments',
      'bracketStyle',
      'ligatureColor',
      'applianceDisplay',
      'isolated',
    ],
    ['toothStudy', 'attachmentsByTooth', 'mechanics'],
  );
  const source = validateLectureSource(value.source),
    ids = lectureSourceIds(source);
  if (typeof value.ligatureColor !== 'string' || !/^#[\da-f]{6}$/i.test(value.ligatureColor))
    throw new Error('Use a six-digit lecture ligature colour.');
  const scene: LectureScene = {
    source,
    transforms: validateLectureTransforms(value.transforms, ids),
    setup: validateSetup(value.setup, ids),
    roots: boolean(value.roots),
    braces: boolean(value.braces),
    attachments: boolean(value.attachments),
    bracketStyle: choice(value.bracketStyle, ['metal', 'ceramic']),
    ligatureColor: value.ligatureColor,
    applianceDisplay: validateApplianceDisplay(value.applianceDisplay),
    isolated: boolean(value.isolated),
  };
  if (value.toothStudy !== undefined) {
    const study = object(value.toothStudy);
    fields(study, ['tooth', 'view']);
    if (typeof study.tooth !== 'string' || !ids.has(study.tooth))
      throw new Error('The studied tooth must be present in the lecture model.');
    scene.toothStudy = { tooth: study.tooth, view: choice(study.view, TOOTH_STUDY_VIEWS) };
  }
  if (value.attachmentsByTooth !== undefined) {
    scene.attachmentsByTooth = {};
    for (const [id, spec] of Object.entries(object(value.attachmentsByTooth))) {
      if (!ids.has(id)) throw new Error('A lecture attachment refers to an absent tooth.');
      fields(object(spec), [
        'shape',
        'width',
        'height',
        'depth',
        'offsetMesial',
        'offsetOcclusal',
        'rotation',
      ]);
      scene.attachmentsByTooth[id] = validateAttachment(spec);
    }
  }
  if (value.mechanics !== undefined) {
    const mechanics = object(value.mechanics);
    fields(mechanics, [
      'version',
      'revision',
      'reference',
      'config',
      'stages',
      'stageIndex',
      'result',
      'applied',
      'comparison',
    ]);
    fields(object(mechanics.reference), ['teeth', 'transforms']);
    // Persist inputs only; the shown scene poses are independent of discarded numerical results.
    scene.mechanics = validateMechanicsExperiment(mechanics, lectureSceneModel(scene));
  }
  return scene;
}
