import { Euler, MathUtils, Quaternion } from 'three';
import { emptyPose, type Transforms, type Vec3 } from './model';
import type { MechanicsExperiment, MechanicsResult } from './mechanics/types';

/** Display-only amplification. Neither experiment results nor measurements use these poses. */
export function mechanicsDisplayPoses(reference: Transforms, result: Transforms, progress: number, magnification = 1): Transforms {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1 || ![1, 5, 10, 25, 50].includes(magnification)) throw new Error('Invalid mechanics presentation scale.');
  if (!progress) return reference;
  if (progress === 1 && magnification === 1) return result;
  const displayed: Transforms = {}, factor = progress * magnification;
  for (const id of new Set([...Object.keys(reference), ...Object.keys(result)])) {
    const start = reference[id] || emptyPose(), end = result[id] || emptyPose();
    const q0 = new Quaternion().setFromEuler(new Euler(...start.rotation.map(MathUtils.degToRad) as Vec3));
    const q1 = new Quaternion().setFromEuler(new Euler(...end.rotation.map(MathUtils.degToRad) as Vec3));
    const delta = q0.clone().invert().multiply(q1); if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const halfAngle = Math.acos(MathUtils.clamp(delta.w, -1, 1)), sine = Math.sin(halfAngle);
    const scale = Math.abs(sine) < 1e-10 ? factor : Math.sin(halfAngle * factor) / sine;
    delta.set(delta.x * scale, delta.y * scale, delta.z * scale, Math.cos(halfAngle * factor)).normalize();
    const rotation = new Euler().setFromQuaternion(q0.multiply(delta), 'XYZ');
    displayed[id] = { translation: start.translation.map((value, axis) => value + (end.translation[axis] - value) * factor) as Vec3, rotation: [rotation.x, rotation.y, rotation.z].map(MathUtils.radToDeg) as Vec3 };
  }
  return displayed;
}

export function explainMechanics(experiment: MechanicsExperiment, result: MechanicsResult | null = experiment.result): string {
  if (!result) throw new Error('Calculate a supported response before asking for its explanation.');
  const d = result.diagnostics;
  const moving = result.teeth.filter(tooth => Math.hypot(...tooth.displacementMm) > 1e-8).length;
  const parts = [`This is the initial elastic response of ${moving} teeth in a synthetic teaching model.`,
    `The largest calculated displacement is ${d.maxDisplacementMm.toFixed(4)} millimetres, and the largest rotation is ${d.maxRotationDeg.toFixed(3)} degrees.`,
    `The configuration contains ${experiment.config.wires.length} wire, ${experiment.config.elastics.length} elastic connection, and ${experiment.config.expanders.length} expander.`,
    'The response starts from the same unloaded reference each time. Display magnification does not change these values.',
    ...d.warnings, ...d.assumptions];
  return parts.join(' ');
}
