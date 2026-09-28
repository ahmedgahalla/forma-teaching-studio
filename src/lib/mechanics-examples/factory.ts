import type { DentalCase } from '../geometry';
import { anatomicalFrame, type Transforms, type Vec3 } from '../model';
import { add, scale, sub, norm } from '../mechanics/math';
import { createMechanicsExperiment, rotateLocal, transitionMechanics } from '../mechanics/state';
import type { MechanicsAction, MechanicsTooth } from '../mechanics/types';
import { mechanicsExample, mechanicsExampleTargets, type MechanicsExampleAction } from './catalog';

/** Authored loads for a virtual elastic rig, never clinical force prescriptions. */
export function createMechanicsExample(
  model: DentalCase,
  baseline: Transforms,
  selected: string,
  action: MechanicsExampleAction,
) {
  mechanicsExample(action.id, action.variant);
  const targets = mechanicsExampleTargets(
    action.id,
    selected,
    model.teeth.map(tooth => tooth.id),
  );
  let experiment = createMechanicsExperiment(model, baseline);
  const tooth = experiment.reference.teeth.find(item => item.id === targets[0])!;
  const frame = anatomicalFrame(model.teeth.find(item => item.id === tooth.id)!);
  const apply = (input: MechanicsAction) => {
    experiment = transitionMechanics(experiment, input);
  };
  const point = (item: MechanicsTooth, local: Vec3) =>
    add(item.position, rotateLocal(local, item.rotation));
  let count = 0;
  const pull = (local: Vec3, direction: Vec3, forceN: number) => {
    const id = `example-${++count}`;
    apply({ type: 'tad', id, position: add(point(tooth, local), scale(direction, 12)) });
    apply({
      type: 'elastic',
      id,
      from: { kind: 'tooth', tooth: tooth.id, local },
      to: { kind: 'tad', id },
      law: { kind: 'constant', forceN },
    });
  };
  const couple = (centre: Vec3, arm: Vec3, direction: Vec3, forceN: number) => {
    pull(add(centre, arm), direction, forceN);
    pull(sub(centre, arm), scale(direction, -1), forceN);
  };
  const zero: Vec3 = [0, 0, 0];
  apply({ type: 'brackets', teeth: targets, installed: true });
  if (action.id === 'crown-pull') {
    pull(tooth.bracketLocal, scale(tooth.buccal, action.variant === 'lingual' ? -1 : 1), 0.2);
  } else if (action.id === 'counter-couple') {
    pull(tooth.bracketLocal, tooth.buccal, 0.2);
    const lever = sub(tooth.bracketLocal, tooth.supportLocal),
      length = norm(lever);
    if (length < 0.001) throw new Error('This attachment has no lever arm for the example.');
    couple(
      tooth.bracketLocal,
      scale(lever, 2 / length),
      scale(tooth.buccal, -1),
      ((0.2 * length) / 4) * (action.variant === 'half' ? 0.5 : 1),
    );
  } else if (action.id === 'axial-rotation' || action.id === 'inclination') {
    const axial = action.id === 'axial-rotation';
    couple(
      zero,
      scale(axial ? frame.buccal : frame.occlusal, 2),
      scale(
        rotateLocal(axial ? frame.mesial : frame.buccal, tooth.rotation),
        action.variant === 'reverse' ? -1 : 1,
      ),
      0.2,
    );
  } else if (action.id === 'vertical') {
    pull(zero, scale(tooth.occlusal, action.variant === 'intrusion' ? -1 : 1), 0.2);
  } else if (action.id === 'balanced-intrusion') {
    const direction = scale(tooth.occlusal, -1);
    if (action.variant === 'single') pull(tooth.bracketLocal, direction, 0.2);
    else {
      pull(scale(frame.buccal, 2), direction, 0.1);
      pull(scale(frame.buccal, -2), direction, 0.1);
    }
  } else if (action.id === 'anchorage') {
    const other = experiment.reference.teeth.find(item => item.id === targets[1])!;
    if (action.variant === 'fixed')
      apply({ type: 'tad', id: 'example-anchor', position: point(other, other.bracketLocal) });
    apply({
      type: 'elastic',
      id: 'example-reciprocal',
      from: { kind: 'tooth', tooth: tooth.id, local: tooth.bracketLocal },
      to:
        action.variant === 'fixed'
          ? { kind: 'tad', id: 'example-anchor' }
          : { kind: 'tooth', tooth: other.id, local: other.bracketLocal },
      law: { kind: 'constant', forceN: 0.2 },
    });
  } else {
    apply({
      type: 'wire',
      id: 'example-wire',
      teeth: targets,
      material: action.variant === 'large-beta' ? 'beta-titanium' : 'stainless-steel',
      section: {
        shape: 'rectangle',
        heightMm: (action.variant === 'small-steel' ? 0.017 : 0.019) * 25.4,
        widthMm: 0.025 * 25.4,
      },
      expansionMm: 0,
      torqueDeg: 16,
    });
  }
  return { experiment: transitionMechanics(experiment, { type: 'solve' }), targets };
}
