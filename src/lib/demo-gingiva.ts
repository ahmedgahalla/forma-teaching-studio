import * as THREE from 'three';

export type GingivaNeck = { angle: number; height: number; depth: number };

/** Original typodont gingiva. The basal arch is capped only at its posterior ends. */
export function createDemoGingiva(necks: GingivaNeck[], a: number, b: number, upper: boolean): THREE.BufferGeometry {
  const stations = [...necks.map(n => ({ ...n, angle: -n.angle })).reverse(), ...necks];
  const end = necks[necks.length - 1].angle + .16, sections = 240, topSteps = 32, baseSteps = 40, sides = topSteps + baseSteps;
  const points: number[] = [], indices: number[] = [], occlusal = upper ? -1 : 1;
  for (let j = 0; j <= sections; j++) {
    const angle = -end + j / sections * 2 * end;
    let right = stations.findIndex(n => n.angle >= angle); if (right < 0) right = stations.length - 1;
    const left = Math.max(0, right - 1), span = stations[right].angle - stations[left].angle;
    const t = span ? THREE.MathUtils.clamp((angle - stations[left].angle) / span, 0, 1) : 0;
    const blend = t * t * (3 - 2 * t), height = THREE.MathUtils.lerp(stations[left].height, stations[right].height, blend);
    const depth = THREE.MathUtils.lerp(stations[left].depth, stations[right].depth, blend), width = depth * .43 + .55;
    const papilla = Math.pow(Math.sin(t * Math.PI), 4);
    const normal = new THREE.Vector3(b * Math.sin(angle), 0, a * Math.cos(angle)).normalize();
    const add = (lateral: number, axial: number) => points.push(a * Math.sin(angle) + normal.x * lateral, height + occlusal * axial, b * Math.cos(angle) - 12 + normal.z * lateral);
    // Cervical saddles hug the two neck surfaces; the ridge rises between teeth.
    // The interior depression stays beneath crowns instead of cutting a flat rim across them.
    for (let k = 0; k <= topSteps; k++) {
      const u = -1 + k / topSteps * 2, shoulder = Math.exp(-Math.pow((Math.abs(u) - .67) / .25, 2));
      const saddle = -1.4 + (1 - u * u) * (.28 + 2.6 * shoulder);
      const interdental = -1.4 + 2.65 * Math.pow(1 - u * u, .65);
      add(u * width, THREE.MathUtils.lerp(saddle, interdental, papilla));
    }
    // Tapered vestibular walls and a broad, gently rounded basal surface.
    for (let k = 1; k < baseSteps; k++) {
      const phi = k / baseSteps * Math.PI, round = Math.sin(phi);
      add(Math.cos(phi) * width * (1 + .035 * round), -1.4 - 4.9 * Math.pow(round, .72));
    }
    if (j) for (let k = 0; k < sides; k++) {
      const previous = (j - 1) * sides, current = j * sides, next = (k + 1) % sides;
      indices.push(previous + k, current + k, previous + next, previous + next, current + k, current + next);
    }
  }
  for (const station of [0, sections]) {
    const first = station * sides, center = points.length / 3, midpoint = new THREE.Vector3();
    for (let k = 0; k < sides; k++) midpoint.add(new THREE.Vector3().fromArray(points, (first + k) * 3));
    points.push(...midpoint.divideScalar(sides).toArray());
    for (let k = 0; k < sides; k++) {
      const next = first + (k + 1) % sides;
      if (station === 0) indices.push(center, first + k, next); else indices.push(center, next, first + k);
    }
  }
  if (!upper) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
