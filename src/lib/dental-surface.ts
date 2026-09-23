import * as THREE from 'three';
import type { Vec3 } from './model';

export type DentalStageTheme = 'midnight' | 'clinical';

/** Stage and editing cues only; tissue colour and illumination do not change. */
export const dentalStagePalette = {
  midnight: {
    edge: '#101b2d', center: '#293e52', clear: '#172433',
    gridMajor: '#51677b', gridMinor: '#293c4c',
    selected: '#73d6f1', locked: '#a7b1c4', contact: '#dfac82',
    ghost: '#46c5cf', ghostOpacity: .24,
    marker: '#ffc777', measurement: '#edb477', trace: '#f0ba63', curve: '#68d0cc',
  },
  clinical: {
    edge: '#d5e0e9', center: '#edf3f7', clear: '#e4ecf2',
    gridMajor: '#98acbc', gridMinor: '#bfced9',
    selected: '#0c7084', locked: '#a4afbf', contact: '#dfac82',
    ghost: '#008799', ghostOpacity: .25,
    marker: '#a65314', measurement: '#874814', trace: '#946015', curve: '#007f84',
  },
} as const;

const cavityCache = new WeakMap<THREE.BufferGeometry, Float32Array>();

/** Dimensionless local concavity, computed once per immutable source geometry. */
export function dentalCavity(source: THREE.BufferGeometry): Float32Array {
  const cached = cavityCache.get(source); if (cached) return cached;
  const positions = source.getAttribute('position'), normals = source.getAttribute('normal');
  const result = new Float32Array(positions.count); cavityCache.set(source, result);
  if (!normals || !source.index) return result;
  const neighbours = Array.from({ length: positions.count }, () => new Set<number>());
  const index = source.index;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    neighbours[a].add(b).add(c); neighbours[b].add(a).add(c); neighbours[c].add(a).add(b);
  }
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), delta = new THREE.Vector3(), sum = new THREE.Vector3(), raw = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i); normal.fromBufferAttribute(normals, i).normalize(); sum.set(0, 0, 0);
    let weight = 0, length = 0;
    for (const j of neighbours[i]) {
      delta.fromBufferAttribute(positions, j).sub(point); const distance = delta.length(); if (distance < 1e-8) continue;
      sum.addScaledVector(delta, 1 / distance); weight += 1 / distance; length += distance;
    }
    if (weight) raw[i] = THREE.MathUtils.clamp((sum.divideScalar(weight).dot(normal) / (length / neighbours[i].size) - .015) * 3, 0, 1);
  }
  // One spatial average removes isolated triangulation speckles, without a texture or shader pass.
  for (let i = 0; i < result.length; i++) {
    let sum = raw[i] * 2; for (const j of neighbours[i]) sum += raw[j];
    result[i] = sum / (neighbours[i].size + 2);
  }
  return result;
}

/** Display-only colour: the exportable mesh and anatomical frame stay untouched. */
export function dentalSurface(source: THREE.BufferGeometry, occlusal: Vec3, tissue: 'enamel' | 'root' | 'gingiva') {
  const geometry = source.clone(), positions = geometry.getAttribute('position');
  const axis = new THREE.Vector3(...occlusal), point = new THREE.Vector3();
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < positions.count; i++) { const height = point.fromBufferAttribute(positions, i).dot(axis); low = Math.min(low, height); high = Math.max(high, height); }
  const cervical = new THREE.Color(tissue === 'enamel' ? '#ded0b7' : tissue === 'root' ? '#c5a982' : '#a65260');
  const body = new THREE.Color(tissue === 'enamel' ? '#f0eadb' : tissue === 'root' ? '#e3cdae' : '#c77985');
  const edge = new THREE.Color(tissue === 'enamel' ? '#f4f3ed' : tissue === 'root' ? '#e8d6b8' : '#d99099');
  const colors = new Float32Array(positions.count * 3), color = new THREE.Color();
  const cavity = tissue === 'enamel' ? dentalCavity(source) : undefined;
  for (let i = 0; i < positions.count; i++) {
    const t = (point.fromBufferAttribute(positions, i).dot(axis) - low) / Math.max(high - low, .001);
    const bodyMix = THREE.MathUtils.smoothstep(t, 0, tissue === 'gingiva' ? .65 : .46);
    color.copy(cervical).lerp(body, bodyMix).lerp(edge, THREE.MathUtils.smoothstep(t, .7, 1) * .68);
    if (cavity) color.multiplyScalar(1 - .16 * cavity[i]);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Recolour the existing texture so theme changes preserve the scene and camera. */
export function updateDentalBackdrop(texture: THREE.DataTexture, theme: DentalStageTheme) {
  const size = texture.image.width, data = texture.image.data as Uint8Array, palette = dentalStagePalette[theme];
  const edge = new THREE.Color(palette.edge), center = new THREE.Color(palette.center), color = new THREE.Color();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x / (size - 1) - .5) * 1.15, (y / (size - 1) - .55) * 1.4);
    color.copy(center).lerp(edge, THREE.MathUtils.smoothstep(radius, .05, .85)).convertLinearToSRGB();
    const offset = (y * size + x) * 4;
    data[offset] = Math.round(color.r * 255); data[offset + 1] = Math.round(color.g * 255); data[offset + 2] = Math.round(color.b * 255); data[offset + 3] = 255;
  }
  texture.needsUpdate = true;
}

/** Neutral studio backdrop, generated locally without an external texture request. */
export function dentalBackdrop(theme: DentalStageTheme = 'midnight') {
  const size = 96, texture = new THREE.DataTexture(new Uint8Array(size * size * 4), size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  updateDentalBackdrop(texture, theme);
  return texture;
}
