import { add, scale } from '../mechanics/math';
import { rotateLocal, transitionMechanics } from '../mechanics/state';
import type { LectureScene, LectureStep } from './types';
import { CASE_JOURNEY_SOURCES } from './sample-case-journey-sources';

/** A visible fixed-anchor comparison rig, not an anatomically approved insertion site. */
export function tadLearningScenes(passiveWire: LectureScene) {
  const placed = structuredClone(passiveWire);
  const experiment = placed.mechanics!;
  const posterior = experiment.reference.teeth.find(tooth => tooth.id === '16')!;
  const position = add(
    add(posterior.position, rotateLocal(posterior.bracketLocal, posterior.rotation)),
    add(scale(posterior.buccal, 8), scale(posterior.occlusal, -6)),
  );
  placed.mechanics = transitionMechanics(experiment, {
    type: 'tad',
    id: 'case-optional-anchor',
    position,
  });
  placed.setup.selectedIds = ['13', '14', '15', '16', '17'];
  placed.setup.view = 'right';
  placed.setup.forceVectors = false;
  const connected = structuredClone(placed);
  connected.mechanics = transitionMechanics(connected.mechanics!, {
    type: 'elastic',
    id: 'case-optional-elastic',
    from: { kind: 'tooth', tooth: '13', local: [...experiment.config.brackets['13']] },
    to: { kind: 'tad', id: 'case-optional-anchor' },
    law: { kind: 'constant', forceN: 0 },
  });
  const active = structuredClone(connected);
  active.mechanics = transitionMechanics(active.mechanics!, {
    ...active.mechanics!.config.elastics[0],
    type: 'elastic',
    law: { kind: 'constant', forceN: 0.2 },
  });
  active.setup.forceVectors = true;
  return { tadPlacement: placed, tadConnection: connected, tadResponse: active };
}

export function tadLearningSteps(scenes: ReturnType<typeof tadLearningScenes>): LectureStep[] {
  const source = CASE_JOURNEY_SOURCES[7];
  return [
    {
      id: 'place-optional-tad',
      title: '10. Optional TAD anchor',
      notes: `Optional anchorage example within the learning walkthrough, not a required stage of this case. The TAD position is an offset schematic reference, not a clinically assessed insertion site. Source: ${source.title}. ${source.url}`,
      question: 'What can provide anchorage independently of the neighboring teeth?',
      answer:
        'Optional example: a temporary anchorage device (TAD) provides an anchor point; this schematic position is not a placement recommendation.',
      scene: scenes.tadPlacement,
    },
    {
      id: 'connect-tad-elastic',
      title: '11. Connect an elastic',
      notes:
        'The passive connection uses the same bracket, TAD and unloaded tooth reference as the next step. The wire remains passive; adding hardware does not itself imply a load.',
      question: 'Does drawing an elastic connection establish an active load?',
      answer:
        'The elastic connects tooth 13’s bracket to the TAD; this passive connection applies no modeled pull.',
      scene: scenes.tadConnection,
    },
    {
      id: 'test-tad-response',
      title: '12. Calculate the TAD response',
      notes:
        'Calculate the initial elastic response, then replay it. The small illustrative load is a software input, not a clinical force prescription. The TAD is an ideal fixed point; the model does not predict tissue remodeling, implant stability or treatment progress. The following alignment stage is separately authored.',
      question: 'Does this response determine the later alignment stage?',
      answer:
        'This illustrative elastic load pulls on tooth 13 while the TAD stays fixed; replay shows an initial elastic response, not treatment progress.',
      scene: scenes.tadResponse,
    },
  ];
}
