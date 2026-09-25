import * as THREE from 'three';
import type { DentalCase, DentalTooth } from './geometry';
import type { Vec3 } from './model';
import { createDemoGingiva as gingiva, type GingivaNeck as Neck } from './demo-gingiva';

/**
 * Original, procedural teaching geometry; no patient scan or licensed mesh asset.
 * Morphology references (facts only, no figures or text copied):
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC6036925/ (tooth classes/cusp development)
 * https://pressbooks.gvsu.edu/introhumanosteology/chapter/dentition/
 * Dimensions, arch, gingiva and roots below are schematic, not clinical anatomy.
 * Shared case frame: +X patient left, +Y superior, +Z anterior, units millimetres.
 */
const NAMES = [
  'Central incisor',
  'Lateral incisor',
  'Canine',
  'First premolar',
  'Second premolar',
  'First molar',
  'Second molar',
];
const UPPER = [
  [8.5, 6.7, 10.4],
  [6.6, 6.3, 9.2],
  [7.5, 7.6, 10.8],
  [6.8, 8.9, 7.3],
  [6.5, 8.6, 7.1],
  [9.8, 10.8, 6.5],
  [9.2, 10.2, 6.3],
];
const LOWER = [
  [5.3, 5.7, 8.8],
  [5.7, 6.0, 9.1],
  [6.6, 7.0, 10.0],
  [6.7, 7.3, 7.2],
  [6.8, 8.0, 7.0],
  [10.1, 10.0, 6.4],
  [9.5, 9.5, 6.2],
];
const SIDES = 64;
const signedPower = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);
const gaussian = (v: number, sigma: number) => Math.exp((-v * v) / (2 * sigma * sigma));

// A single Bézier profile avoids horizontal bands from flattened interpolation knots.
function profile(t: number, [a, b, c, d, e]: number[]): number {
  const s = 1 - t;
  return a * s ** 4 + 4 * b * s ** 3 * t + 6 * c * s * s * t * t + 4 * d * s * t ** 3 + e * t ** 4;
}

function mesh(points: number[], indices: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function connect(indices: number[], start: number, next: number, sides = SIDES) {
  for (let k = 0; k < sides; k++) {
    const after = (k + 1) % sides;
    indices.push(start + k, next + k, start + after, start + after, next + k, next + after);
  }
}

// Coordinates are mesiodistal X, cervical-to-occlusal Y and buccal Z.
function crown(index: number, upper: boolean): THREE.BufferGeometry {
  const [width, depth, height] = (upper ? UPPER : LOWER)[index];
  const anterior = index < 3,
    canine = index === 2;
  const shoulder = anterior ? (canine ? 0.62 : 0.43) : 1.32;
  const cusps =
    index < 3
      ? []
      : index < 5
        ? [
            [-0.04, 0.48, 2.05],
            [0.05, -0.44, !upper && index === 3 ? 0.78 : 1.62],
          ]
        : [
            [-0.46, 0.43, 2.1],
            [0.43, 0.43, 1.8],
            [-0.44, -0.43, upper ? 2.25 : 1.9],
            [0.43, -0.43, upper ? 1.55 : 1.75],
            ...(!upper && index === 5 ? [[0.76, 0.04, 1.05]] : []),
          ];
  const relief = (u: number, v: number) => {
    if (index < 2)
      return -0.42 * Math.abs(u) ** 4 - 0.1 * v * v + 0.025 * Math.cos(u * Math.PI * 3);
    // Broad, rounded canine ridge rather than a sharp pyramidal point.
    if (canine) return -2.25 * (Math.sqrt(u * u + 0.11) - Math.sqrt(0.11)) - 0.24 * v * v;
    let y = -0.23;
    for (const [x, z, amplitude] of cusps)
      y += amplitude * gaussian(u - x, 0.29) * gaussian(v - z, 0.3);
    // Broad cusp slopes lead into a narrow central groove and shallow fossae.
    y -= 0.24 * gaussian(v + 0.025 * Math.sin(u * 6), 0.06) * gaussian(u, 0.66);
    if (index >= 5) y -= 0.17 * gaussian(u + 0.11 * v, 0.06) * gaussian(v, 0.64);
    if (upper && index >= 5) y += 0.19 * gaussian(v + 0.82 * u, 0.12) * gaussian(u, 0.58);
    return y;
  };
  const outline = (a: number, radius = 1): [number, number] => {
    let u = signedPower(Math.cos(a), anterior ? 0.71 : index < 5 ? 0.85 : 0.73) * radius;
    const v = signedPower(Math.sin(a), anterior ? 0.9 : 0.75) * radius;
    if (upper && index >= 5) u += 0.1 * v * radius; // Rhomboidal upper molar outline.
    return [u, v];
  };
  const points: number[] = [],
    indices: number[] = [];
  const rings = 36,
    capRings = 28;
  const widthProfile = anterior
    ? [0.69, 0.95, 1.04, canine ? 0.91 : 0.98, canine ? 0.91 : 0.98]
    : [0.72, 1.08, 1.04, 0.89, 0.89];
  const depthProfile = anterior
    ? [0.72, 1.16, 0.88, canine ? 0.32 : 0.18, canine ? 0.32 : 0.18]
    : [0.71, 1.09, 1.05, 0.89, 0.89];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const wx = profile(t, widthProfile),
      dz = profile(t, depthProfile);
    const envelope = Math.sin(Math.PI * t) ** 2;
    for (let k = 0; k < SIDES; k++) {
      const [u, v] = outline((k / SIDES) * Math.PI * 2);
      const lobes =
        gaussian(u, 0.22) + 0.45 * (gaussian(u - 0.55, 0.19) + gaussian(u + 0.55, 0.19));
      const labial = anterior && v > 0 ? 1 + (canine ? 0.065 : 0.028) * lobes * envelope : 1;
      const lingual =
        anterior && v < 0
          ? 1 +
            envelope *
              gaussian(u, 0.55) *
              (0.24 * gaussian(t - 0.25, 0.18) - 0.17 * gaussian(t - 0.65, 0.22))
          : 1;
      const edge = anterior ? relief(u, v) * t ** 3 : 0;
      points.push(
        (width / 2) * u * wx,
        (height - shoulder) * t + edge,
        (depth / 2) * v * dz * labial * lingual,
      );
    }
    if (j) connect(indices, (j - 1) * SIDES, j * SIDES);
  }
  const wx = widthProfile[4],
    dz = depthProfile[4];
  let previous = rings * SIDES;
  // Elliptical shoulder: zero radial derivative at the side join, and a rounded
  // incisal edge/occlusal perimeter. Side and cap share the same boundary ring.
  for (let j = 1; j < capRings; j++) {
    const phi = ((j / capRings) * Math.PI) / 2,
      r = Math.cos(phi),
      lift = Math.sin(phi),
      start = points.length / 3;
    for (let k = 0; k < SIDES; k++) {
      const [u, v] = outline((k / SIDES) * Math.PI * 2, r);
      points.push(
        (width / 2) * u * wx,
        height - shoulder + shoulder * lift + relief(u, v) * (anterior ? 1 : lift * lift),
        (depth / 2) * v * dz,
      );
    }
    connect(indices, previous, start);
    previous = start;
  }
  const top = points.length / 3;
  points.push(0, height + relief(0, 0), 0);
  const bottom = points.length / 3;
  points.push(0, 0, 0);
  for (let k = 0; k < SIDES; k++) {
    indices.push(previous + k, top, previous + ((k + 1) % SIDES));
    indices.push(bottom, k, (k + 1) % SIDES);
  }
  return mesh(points, indices);
}

function roots(index: number, upper: boolean): THREE.BufferGeometry {
  const [width, depth] = (upper ? UPPER : LOWER)[index];
  const length = index === 2 ? 16.4 : index < 2 ? 12.5 : 12;
  const branches: number[][] =
    index >= 5
      ? upper
        ? [
            [-0.24, 0.2],
            [0.24, 0.2],
            [0, -0.24],
          ]
        : [
            [-0.24, 0],
            [0.24, 0],
          ]
      : upper && index === 3
        ? [
            [0, -0.2],
            [0, 0.2],
          ]
        : [[0, 0]];
  const points: number[] = [],
    indices: number[] = [],
    sides = 40,
    rings = 32;
  for (const [bx, bz] of branches) {
    const first = points.length / 3;
    const single = branches.length === 1;
    const baseX = width * (single ? 0.345 : index === 3 ? 0.325 : upper ? 0.215 : 0.235);
    const baseZ = depth * (single ? 0.36 : index === 3 ? 0.235 : upper ? 0.225 : 0.35);
    const centerAt = (t: number) => [
      bx * width * (0.76 + 0.88 * t) + (index < 3 ? 0.85 : 0.52) * t * t,
      0.12 - length * t,
      bz * depth * (0.76 + 0.8 * t) + 0.38 * t * t,
    ];
    for (let j = 0; j < rings; j++) {
      // A rounded ellipsoidal apex has no tiny planar end cap. Sampling the
      // angle concentrates rings around the curved tip without degenerate faces.
      const phi = ((j / rings) * Math.PI) / 2,
        t = Math.sin(phi),
        taper = (1 - 0.72 * t) * Math.cos(phi);
      const [x, y, z] = centerAt(t);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const flute = 1 - 0.045 * Math.sin(2 * a) ** 2 * Math.sin(Math.PI * t);
        points.push(
          x + baseX * taper * Math.cos(a) * flute,
          y,
          z + baseZ * taper * Math.sin(a) * flute,
        );
      }
      if (j) connect(indices, first + (j - 1) * sides, first + j * sides, sides);
    }
    const top = points.length / 3;
    points.push(...centerAt(0));
    const bottom = points.length / 3;
    points.push(...centerAt(1));
    for (let k = 0; k < sides; k++) {
      indices.push(top, first + k, first + ((k + 1) % sides));
      indices.push(
        first + (rings - 1) * sides + k,
        bottom,
        first + (rings - 1) * sides + ((k + 1) % sides),
      );
    }
  }
  // Ring progression is rootward here, the opposite of the crown surface.
  for (let i = 0; i < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  return mesh(points, indices);
}

function orient(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) {
  geometry.applyMatrix4(matrix);
  if (matrix.determinant() < 0) {
    const indices = geometry.index!;
    for (let i = 0; i < indices.count; i += 3) {
      const value = indices.getX(i + 1);
      indices.setX(i + 1, indices.getX(i + 2));
      indices.setX(i + 2, value);
    }
  }
  geometry.computeVertexNormals();
}

export function createOrthodonticDemo(): DentalCase {
  const teeth: DentalTooth[] = [],
    gums: DentalCase['gums'] = [];
  for (const upper of [true, false]) {
    const dimensions = upper ? UPPER : LOWER,
      a = upper ? 27 : 24.8,
      b = upper ? 34 : 32;
    const sign = upper ? -1 : 1,
      necks: Neck[] = [];
    // Place by arc length, so broad posterior teeth do not overlap on the bend.
    let angle = 0,
      distance = 0,
      target = 0;
    for (let index = 0; index < 7; index++) {
      const [width, depth, height] = dimensions[index];
      target += index
        ? (dimensions[index - 1][0] + width) / 2 + (index >= 5 ? 0.5 : index >= 3 ? 0.3 : 0.18)
        : width / 2 + 0.1;
      while (distance < target) {
        const step = 0.0005;
        distance += Math.hypot(a * Math.cos(angle), b * Math.sin(angle)) * step;
        angle += step;
      }
      const sourceCrown = crown(index, upper),
        sourceRoot = roots(index, upper);
      const bracketMaterial = new THREE.MeshBasicMaterial();
      const sourceBracket = new THREE.Raycaster(
        new THREE.Vector3(0, height * 0.47, depth),
        new THREE.Vector3(0, 0, -1),
      )
        .intersectObject(new THREE.Mesh(sourceCrown, bracketMaterial), false)[0]
        .point.add(new THREE.Vector3(0, 0, 0.22));
      bracketMaterial.dispose();
      const cervical = -sign * (sourceCrown.boundingBox!.max.y + 1.6);
      necks.push({ angle, height: cervical, depth });
      for (const side of [-1, 1]) {
        const theta = side * angle;
        const tangent = new THREE.Vector3(a * Math.cos(theta), 0, -b * Math.sin(theta)).normalize();
        const buccal = new THREE.Vector3(b * Math.sin(theta), 0, a * Math.cos(theta)).normalize();
        const occlusal = new THREE.Vector3(0, sign, 0);
        const matrix = new THREE.Matrix4().makeBasis(tangent, occlusal, buccal);
        const geometry = sourceCrown.clone(),
          rootGeometry = sourceRoot.clone();
        orient(geometry, matrix);
        orient(rootGeometry, matrix);
        geometry.computeBoundingBox();
        const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
        rootGeometry.translate(-center.x, -center.y, -center.z);
        const bracket = sourceBracket.clone().applyMatrix4(matrix).sub(center);
        const origin = new THREE.Vector3(
          a * Math.sin(theta),
          cervical,
          b * Math.cos(theta) - 12,
        ).add(center);
        const quadrant = upper ? (side < 0 ? 1 : 2) : side < 0 ? 4 : 3;
        teeth.push({
          id: `${quadrant}${index + 1}`,
          name: NAMES[index],
          geometry,
          rootGeometry,
          position: origin.toArray() as Vec3,
          buccal: buccal.toArray() as Vec3,
          mesial: tangent.multiplyScalar(-side).toArray() as Vec3,
          occlusal: occlusal.toArray() as Vec3,
          bracketPosition: bracket.toArray() as Vec3,
          calibrated: true,
        });
      }
      sourceCrown.dispose();
      sourceRoot.dispose();
    }
    gums.push({
      id: upper ? 'upper_gum' : 'lower_gum',
      arch: upper ? 'upper' : 'lower',
      geometry: gingiva(necks, a, b, upper),
      position: [0, 0, 0],
    });
  }
  return {
    name: 'Orthodontic study · 28 teeth',
    demo: true,
    teeth: teeth.sort((a, b) => a.id.localeCompare(b.id)),
    gums,
  };
}
