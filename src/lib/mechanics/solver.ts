import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { emptyPose, type Transforms, type Vec3 } from '../model';
import type { MechanicsEndpoint, MechanicsExperiment, MechanicsResult } from './types';
import {
  MATERIAL_PRESETS,
  MECHANICS_ASSUMPTIONS,
  MECHANICS_LIMITS as LIMIT,
  SUPPORT_PRESETS,
} from './presets';
import {
  add,
  cross,
  dot,
  matrix,
  multiply,
  norm,
  scale,
  solvePositive,
  sub,
  unit,
  zeros,
} from './math';
import { beamBendingMatrix, sectionProperties, slotPlayRadians } from './beam';
import { rotateLocal, validateMechanicsConfiguration } from './state';

type Point = { initial: Vec3; rows: number[][] };
type Beam = {
  wire: string;
  rows: number[][];
  target: number[];
  stiffness: number[][];
  length: number;
  section: ReturnType<typeof sectionProperties>;
  material: keyof typeof MATERIAL_PRESETS;
};
type Twist = {
  row: number[];
  target: number;
  play: number;
  stiffness: number;
  length: number;
  radius: number;
  wire: string;
};
const sumProduct = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const dotRow = (axis: Vec3, rows: number[][]): number[] =>
  rows[0].map((_, j) => axis.reduce((sum, v, i) => sum + v * rows[i][j], 0));
const rowsSubtract = (b: number[][], a: number[][]) =>
  b.map((row, i) => row.map((v, j) => v - a[i][j]));
const at = (point: Point, q: number[]): Vec3 =>
  add(point.initial, point.rows.map(row => sumProduct(row, q)) as Vec3);

/** Pure, bounded initial-response calculation. No geometry mutation, biological time, or baseline update. */
export function solveMechanics(experiment: MechanicsExperiment): MechanicsResult {
  validateMechanicsConfiguration(experiment);
  const teeth = experiment.reference.teeth,
    config = experiment.config,
    preset = SUPPORT_PRESETS[config.support];
  const palate = config.expanders.find(e => e.palateStiffnessNPerMm !== undefined),
    palateIndex = teeth.length * 6;
  const n = palateIndex + (palate ? 1 : 0),
    supportK = matrix(n),
    beamK = matrix(n),
    activation = zeros(n);
  const indices = new Map(teeth.map((tooth, i) => [tooth.id, i * 6]));
  const supports = teeth.map(t => add(t.position, rotateLocal(t.supportLocal, t.rotation)));
  const lookup = (id: string) => {
    const i = indices.get(id);
    if (i === undefined) throw new Error(`Tooth ${id} is absent from this mechanics reference.`);
    return i;
  };
  const point = (id: string, local: Vec3): Point => {
    const index = lookup(id),
      tooth = teeth[index / 6],
      initial = add(tooth.position, rotateLocal(local, tooth.rotation));
    const r = sub(initial, supports[index / 6]),
      rows = Array.from({ length: 3 }, () => zeros(n));
    for (let axis = 0; axis < 3; axis++) rows[axis][index + axis] = 1;
    rows[0][index + 4] = r[2];
    rows[0][index + 5] = -r[1];
    rows[1][index + 3] = -r[2];
    rows[1][index + 5] = r[0];
    rows[2][index + 3] = r[1];
    rows[2][index + 4] = -r[0];
    return { initial, rows };
  };
  const bracket = (id: string) =>
    point(id, config.brackets[id] || teeth[lookup(id) / 6].bracketLocal);
  const meanPoint = (ids: string[]): Point => {
    const points = ids.map(bracket);
    return {
      initial: scale(
        points.reduce((sum, item) => add(sum, item.initial), [0, 0, 0] as Vec3),
        1 / ids.length,
      ),
      rows: [0, 1, 2].map(axis =>
        zeros(n).map(
          (_, j) => points.reduce((sum, item) => sum + item.rows[axis][j], 0) / ids.length,
        ),
      ),
    };
  };
  const expanderData = config.expanders.map(item => {
    const from = meanPoint(item.left),
      to = meanPoint(item.right),
      axis = unit(sub(to.initial, from.initial));
    if (Math.abs(axis[0]) < 0.7 || item.left.some(id => item.right.includes(id)))
      throw new Error('The palatal actuator needs separated contralateral upper supports.');
    return {
      item,
      from,
      to,
      axis,
      row: dotRow(axis, rowsSubtract(to.rows, from.rows)),
      center: scale(add(from.initial, to.initial), 0.5),
    };
  });
  const palateData = palate ? expanderData.find(item => item.item.id === palate.id)! : undefined;
  const addSpring = (k: number[][], row: number[], stiffness: number) => {
    for (let i = 0; i < n; i++)
      if (row[i]) for (let j = 0; j < n; j++) if (row[j]) k[i][j] += stiffness * row[i] * row[j];
  };
  teeth.forEach((tooth, t) => {
    const side =
      palateData && /^[12]/.test(tooth.id)
        ? Math.sign(dot(sub(supports[t], palateData.center), palateData.axis))
        : 0;
    for (let d = 0; d < 6; d++) {
      const row = zeros(n);
      row[t * 6 + d] = 1;
      if (d < 3 && palateData) row[palateIndex] = (-side * palateData.axis[d]) / 2;
      addSpring(supportK, row, d < 3 ? preset.translationNPerMm : preset.rotationNmmPerRad);
    }
  });
  if (palate) supportK[palateIndex][palateIndex] += palate.palateStiffnessNPerMm!;
  const beams: Beam[] = [],
    twists: Twist[] = [];
  for (const wire of config.wires) {
    const wirePoints = wire.teeth.map(bracket),
      xs = wirePoints.map(p => p.initial[0]),
      span = Math.max(...xs) - Math.min(...xs),
      middle = (Math.max(...xs) + Math.min(...xs)) / 2;
    if (wire.expansionMm && span < 1)
      throw new Error(
        'Transverse wire expansion requires a span across at least 1 mm of the case X axis.',
      );
    const offsets = wirePoints.map(
      p => [span ? ((p.initial[0] - middle) / span) * wire.expansionMm : 0, 0, 0] as Vec3,
    );
    for (let index = 0; index < wire.teeth.length - 1; index++) {
      const a = wirePoints[index],
        b = wirePoints[index + 1],
        length = norm(sub(b.initial, a.initial)),
        x = unit(sub(b.initial, a.initial));
      const occlusal = add(
        teeth[lookup(wire.teeth[index]) / 6].occlusal,
        teeth[lookup(wire.teeth[index + 1]) / 6].occlusal,
      );
      let candidate = sub(occlusal, scale(x, dot(occlusal, x)));
      if (norm(candidate) < 0.01)
        candidate = cross(Math.abs(x[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1], x);
      const y = unit(candidate),
        z = unit(cross(x, y)),
        axes = [x, y, z],
        rows: number[][] = [],
        target: number[] = [];
      for (let end = 0; end < 2; end++) {
        const current = end ? b : a,
          toothIndex = lookup(wire.teeth[index + end]);
        axes.forEach(axis => {
          rows.push(dotRow(axis, current.rows));
          target.push(dot(axis, offsets[index + end]));
        });
        axes.forEach(axis => {
          const row = zeros(n);
          axis.forEach((v, j) => {
            row[toothIndex + 3 + j] = v;
          });
          rows.push(row);
          target.push(0);
        });
      }
      const stiffness = beamBendingMatrix(length, wire.material, wire.section),
        section = sectionProperties(wire.section);
      beams.push({
        wire: wire.id,
        rows,
        target,
        stiffness,
        length,
        section,
        material: wire.material,
      });
      // Transform local span stiffness through rigid bracket offsets into the shared tooth system.
      for (let i = 0; i < 12; i++)
        for (let j = 0; j < 12; j++)
          if (stiffness[i][j]) {
            for (let r = 0; r < n; r++)
              if (rows[i][r]) {
                activation[r] += rows[i][r] * stiffness[i][j] * target[j];
                for (let c = 0; c < n; c++)
                  if (rows[j][c]) beamK[r][c] += rows[i][r] * stiffness[i][j] * rows[j][c];
              }
          }
      if (wire.section.shape === 'rectangle') {
        const material = MATERIAL_PRESETS[wire.material];
        twists.push({
          row: rows[9].map((v, i) => v - rows[3][i]),
          target: MathUtils.degToRad(wire.torqueDeg) / (wire.teeth.length - 1),
          play: 2 * slotPlayRadians(wire.section),
          stiffness: ((material.youngNPerMm2 / (2 * (1 + material.poisson))) * section.j) / length,
          length,
          radius: Math.hypot(section.y, section.z),
          wire: wire.id,
        });
      }
    }
  }
  const endpoint = (end: MechanicsEndpoint): Point => {
    if (end.kind === 'tooth') return point(end.tooth, end.local);
    const tad = config.tads.find(t => t.id === end.id);
    if (!tad) throw new Error('An elastic refers to an absent TAD.');
    return { initial: tad.position, rows: Array.from({ length: 3 }, () => zeros(n)) };
  };
  const elasticData = config.elastics.map(item => {
    const from = endpoint(item.from),
      to = endpoint(item.to),
      initialLength = norm(sub(to.initial, from.initial));
    if (initialLength < 0.1) throw new Error('Elastic attachments must be at least 0.1 mm apart.');
    const direction = unit(sub(to.initial, from.initial));
    return {
      item,
      from,
      to,
      initialLength,
      direction,
      row: dotRow(direction, rowsSubtract(to.rows, from.rows)),
    };
  });
  const linearK = supportK.map((row, i) => row.map((v, j) => v + beamK[i][j]));
  const free = Array.from({ length: n }, (_, i) => i).filter(
    i => i >= palateIndex || !config.fixedTeeth.includes(teeth[Math.floor(i / 6)].id),
  );
  function evaluate(q: number[], tangent = true) {
    const gradient = multiply(linearK, q).map((v, i) => v - activation[i]);
    const hessian = tangent ? linearK.map(row => [...row]) : [];
    let energy = 0.5 * sumProduct(q, multiply(linearK, q)) - sumProduct(activation, q);
    const scalar = (row: number[], force: number, stiffness: number) => {
      for (let i = 0; i < n; i++)
        if (row[i]) {
          gradient[i] += force * row[i];
          if (tangent && stiffness)
            for (let j = 0; j < n; j++) if (row[j]) hessian[i][j] += stiffness * row[i] * row[j];
        }
    };
    for (const twist of twists) {
      const value = sumProduct(twist.row, q) - twist.target,
        excess = Math.max(0, Math.abs(value) - twist.play);
      if (excess) {
        scalar(twist.row, twist.stiffness * excess * Math.sign(value), twist.stiffness);
        energy += 0.5 * twist.stiffness * excess ** 2;
      }
    }
    for (const expander of expanderData) {
      const compression = sumProduct(expander.row, q) - expander.item.activationMm;
      if (compression < 0) {
        scalar(
          expander.row,
          expander.item.stiffnessNPerMm * compression,
          expander.item.stiffnessNPerMm,
        );
        energy += 0.5 * expander.item.stiffnessNPerMm * compression ** 2;
      }
    }
    for (const elastic of elasticData) {
      const length = elastic.initialLength + sumProduct(elastic.row, q);
      if (length < 0.01)
        throw new Error('Elastic attachments collapse outside this teaching model.');
      const law = elastic.item.law;
      const tension =
        law.kind === 'constant'
          ? law.forceN
          : law.stiffnessNPerMm * Math.max(0, length - law.restLengthMm);
      if (tension > LIMIT.forceN + 1e-8)
        throw new Error('Elastic tension exceeds the 20 N software domain; reduce its activation.');
      if (!tension) continue;
      energy +=
        law.kind === 'constant'
          ? tension * length
          : 0.5 * law.stiffnessNPerMm * (length - law.restLengthMm) ** 2;
      scalar(elastic.row, tension, law.kind === 'spring' ? law.stiffnessNPerMm : 0);
    }
    return { gradient, hessian, energy };
  }
  let q = zeros(n),
    iterations = 0,
    residual = Infinity;
  for (; iterations < LIMIT.maxIterations; iterations++) {
    const current = evaluate(q);
    residual = Math.max(
      0,
      ...free.map(i => Math.abs(current.gradient[i]) / (i < palateIndex && i % 6 >= 3 ? 10 : 1)),
    );
    if (residual < 1e-8) break;
    const stepFree = solvePositive(
      free.map(i => free.map(j => current.hessian[i][j])),
      free.map(i => -current.gradient[i]),
    );
    const step = zeros(n);
    free.forEach((index, i) => {
      step[index] = stepFree[i];
    });
    const slope = sumProduct(current.gradient, step);
    let factor = 1,
      accepted = false;
    for (let line = 0; line < 24; line++) {
      const candidate = q.map((v, i) => v + factor * step[i]);
      if (evaluate(candidate, false).energy <= current.energy + 1e-4 * factor * slope + 1e-12) {
        q = candidate;
        accepted = true;
        break;
      }
      factor *= 0.5;
    }
    if (!accepted) throw new Error('The mechanical solve did not converge; reduce the activation.');
  }
  if (residual >= 1e-8 || q.some(v => !Number.isFinite(v)))
    throw new Error('The mechanical solve did not converge within its iteration limit.');
  const final = evaluate(q, false),
    supportGradient = multiply(supportK, q),
    transforms: Transforms = {},
    maxStrain = new Map(config.wires.map(w => [w.id, 0]));
  for (const beam of beams) {
    const d = beam.rows.map((row, i) => sumProduct(row, q) - beam.target[i]),
      l = beam.length;
    for (const s of [0, 0.5, 1]) {
      const curvature = (a: number, b: number, c: number, e: number) =>
        ((12 * s - 6) / l ** 2) * a +
        ((6 * s - 4) / l) * b +
        ((-12 * s + 6) / l ** 2) * c +
        ((6 * s - 2) / l) * e;
      const strain =
        Math.abs(curvature(d[1], d[5], d[7], d[11])) * beam.section.y +
        Math.abs(curvature(d[2], -d[4], d[8], -d[10])) * beam.section.z;
      maxStrain.set(beam.wire, Math.max(maxStrain.get(beam.wire)!, strain));
    }
  }
  for (const twist of twists)
    maxStrain.set(
      twist.wire,
      Math.max(
        maxStrain.get(twist.wire)!,
        (twist.radius / twist.length) *
          Math.max(0, Math.abs(sumProduct(twist.row, q) - twist.target) - twist.play),
      ),
    );
  for (const wire of config.wires)
    if (maxStrain.get(wire.id)! > MATERIAL_PRESETS[wire.material].maxStrain)
      throw new Error(
        `${wire.id}: wire strain is outside the declared ideal-elastic domain. Reduce activation or choose a more flexible section.`,
      );
  let maxDisplacement = 0,
    maxRotation = 0;
  const toothResults = teeth.map((tooth, t) => {
    const u = q.slice(t * 6, t * 6 + 3) as Vec3,
      rotation = q.slice(t * 6 + 3, t * 6 + 6) as Vec3,
      angle = norm(rotation);
    const delta = angle
      ? new Quaternion().setFromAxisAngle(new Vector3(...scale(rotation, 1 / angle)), angle)
      : new Quaternion();
    const offset = new Vector3(...sub(tooth.position, supports[t])).applyQuaternion(delta);
    const center = add(add(supports[t], u), offset.toArray() as Vec3),
      displacement = sub(center, tooth.position);
    const finalRotation = delta.multiply(
      new Quaternion().setFromEuler(new Euler(...(tooth.rotation.map(MathUtils.degToRad) as Vec3))),
    );
    const euler = new Euler().setFromQuaternion(finalRotation);
    const baseline = experiment.reference.transforms[tooth.id] || emptyPose();
    transforms[tooth.id] = {
      translation: add(baseline.translation, displacement),
      rotation: [euler.x, euler.y, euler.z].map(MathUtils.radToDeg) as Vec3,
    };
    maxDisplacement = Math.max(maxDisplacement, norm(displacement));
    maxRotation = Math.max(maxRotation, MathUtils.radToDeg(angle));
    if (
      norm(displacement) > tooth.rootLengthMm * LIMIT.maxRootDisplacementFraction ||
      MathUtils.radToDeg(angle) > LIMIT.maxRotationDeg
    )
      throw new Error(
        `${tooth.id}: initial response is outside the small-displacement domain. Reduce the activation or load.`,
      );
    const load = supportGradient
      .slice(t * 6, t * 6 + 6)
      .map((v, i) => v - final.gradient[t * 6 + i]);
    return {
      id: tooth.id,
      displacementMm: displacement,
      rotationRad: rotation,
      forceN: load.slice(0, 3) as Vec3,
      momentNmm: load.slice(3, 6) as Vec3,
      supportReactionN: load.slice(0, 3).map(v => -v) as Vec3,
      supportReactionNmm: load.slice(3, 6).map(v => -v) as Vec3,
      fixed: config.fixedTeeth.includes(tooth.id),
    };
  });
  const tads = config.tads.map(tad => ({
    id: tad.id,
    position: [...tad.position] as Vec3,
    reactionN: [0, 0, 0] as Vec3,
  }));
  const elastics = elasticData.map(elastic => {
    const from = at(elastic.from, q),
      to = at(elastic.to, q),
      length = elastic.initialLength + sumProduct(elastic.row, q),
      law = elastic.item.law;
    const forceN =
        law.kind === 'constant'
          ? law.forceN
          : law.stiffnessNPerMm * Math.max(0, length - law.restLengthMm),
      direction = elastic.direction;
    [elastic.item.from, elastic.item.to].forEach((end, i) => {
      if (end.kind === 'tad') {
        const tad = tads.find(item => item.id === end.id)!;
        tad.reactionN = add(tad.reactionN, scale(direction, (i ? 1 : -1) * forceN));
      }
    });
    return { id: elastic.item.id, from, to, forceN, direction };
  });
  const expanders = expanderData.map(({ item, from, to, row, axis }) => {
    const opening = sumProduct(row, q),
      forceN = item.stiffnessNPerMm * Math.max(0, item.activationMm - opening),
      skeletalOpeningMm = item.palateStiffnessNPerMm === undefined ? 0 : q[palateIndex];
    return {
      id: item.id,
      from: at(from, q),
      to: at(to, q),
      forceN,
      direction: axis,
      dentalOpeningMm: opening - skeletalOpeningMm,
      skeletalOpeningMm,
      applianceDeflectionMm: forceN / item.stiffnessNPerMm,
    };
  });
  const warnings = [
    'Support and material limits are software-domain assumptions, not clinical safety thresholds.',
  ];
  if (!maxDisplacement && !maxRotation)
    warnings.push(
      'No effective activation or applied load: this configuration has zero initial response.',
    );
  if (config.wires.some(w => w.torqueDeg !== 0))
    warnings.push(
      'Wire torque is an imposed relative end twist, not a per-tooth torque prescription.',
    );
  return {
    revision: experiment.revision,
    transforms,
    teeth: toothResults,
    wires: config.wires.map(w => ({
      id: w.id,
      points: w.teeth.map(id => at(bracket(id), q)),
      maxStrain: maxStrain.get(w.id)!,
    })),
    elastics,
    expanders,
    tads,
    diagnostics: {
      iterations,
      residual,
      maxDisplacementMm: maxDisplacement,
      maxRotationDeg: maxRotation,
      assumptions: [...MECHANICS_ASSUMPTIONS],
      warnings,
    },
  };
}
