import {
  BackSide,
  Box3,
  Color,
  ShaderMaterial,
  Vector2,
  Vector3,
  type ColorRepresentation,
} from 'three';
import type { DentalCase } from './geometry';
import type { Transforms } from './model';
import { toothMatrix } from './analysis';
import { toothArch } from './appliances';

export function isToothVisible(
  id: string,
  options: {
    arch: 'both' | 'upper' | 'lower';
    selectedIds: string[];
    isolateSelection?: boolean;
    cutawayId?: string;
  },
) {
  if (options.cutawayId) return id === options.cutawayId;
  return (
    (!options.isolateSelection || options.selectedIds.includes(id)) &&
    (options.arch === 'both' || toothArch(id) === options.arch)
  );
}

/** Bounds use displayed poses, including lower-arch opening, without touching source buffers. */
export function displayedToothBounds(
  model: DentalCase,
  transforms: Transforms,
  ids: string[],
  roots: boolean,
  opening: number,
) {
  const bounds = new Box3(),
    selected = new Set(ids);
  for (const tooth of model.teeth) {
    if (!selected.has(tooth.id)) continue;
    const matrix = toothMatrix(tooth, transforms);
    if (toothArch(tooth.id) === 'lower') matrix.elements[13] -= opening;
    for (const geometry of [
      tooth.geometry,
      ...(roots && tooth.rootGeometry ? [tooth.rootGeometry] : []),
    ]) {
      const local =
        geometry.boundingBox?.clone() ||
        new Box3().setFromBufferAttribute(
          geometry.getAttribute('position') as import('three').BufferAttribute,
        );
      bounds.union(local.applyMatrix4(matrix));
    }
  }
  return bounds;
}

/** A selected-only back-face silhouette; no duplicate geometry or full-screen pass. */
export function selectionContourMaterial(color: ColorRepresentation) {
  return new ShaderMaterial({
    uniforms: {
      color: { value: new Color(color) },
      viewport: { value: new Vector2(1, 1) },
      thickness: { value: 1.6 },
    },
    side: BackSide,
    depthTest: true,
    depthWrite: false,
    vertexShader: `
      uniform vec2 viewport;
      uniform float thickness;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        vec4 projected = projectionMatrix * viewPosition;
        vec2 direction = (projectionMatrix * vec4(viewNormal, 0.0)).xy;
        direction /= max(length(direction), 0.00001);
        projected.xy += direction * (2.0 * thickness / viewport) * projected.w;
        gl_Position = projected;
      }`,
    fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }',
  });
}

export type ToothLabelAnchor = {
  id: string;
  x: number;
  y: number;
  depth: number;
  selected: boolean;
  locked: boolean;
};

/** Keep labels on stable anchors; omit collisions with selected teeth taking priority. */
export function layoutToothLabels(anchors: ToothLabelAnchor[], width: number, height: number) {
  const placed: (ToothLabelAnchor & { width: number; height: number })[] = [];
  const ordered = [...anchors].sort(
    (a, b) => Number(b.selected) - Number(a.selected) || a.id.localeCompare(b.id),
  );
  for (const anchor of ordered) {
    const w = anchor.locked ? 77 : 32,
      h = 22;
    if (
      ![anchor.x, anchor.y, anchor.depth].every(Number.isFinite) ||
      anchor.depth <= -1 ||
      anchor.depth >= 1 ||
      anchor.x - w / 2 < 6 ||
      anchor.x + w / 2 > width - 6 ||
      anchor.y - h / 2 < 6 ||
      anchor.y + h / 2 > height - 6
    )
      continue;
    if (
      placed.some(
        other =>
          Math.abs(other.x - anchor.x) < (other.width + w) / 2 + 4 &&
          Math.abs(other.y - anchor.y) < (other.height + h) / 2 + 3,
      )
    )
      continue;
    placed.push({ ...anchor, width: w, height: h });
  }
  return placed;
}

export function cameraViewDirection(
  view: 'perspective' | 'occlusal' | 'front' | 'right' | 'left',
  arch: 'both' | 'upper' | 'lower',
) {
  return view === 'occlusal'
    ? new Vector3(0, arch === 'upper' ? -1 : 1, 0.001).normalize()
    : view === 'front'
      ? new Vector3(0, 0, 1)
      : view === 'right'
        ? new Vector3(-1, 0.03, 0).normalize()
        : view === 'left'
          ? new Vector3(1, 0.03, 0).normalize()
          : new Vector3(0.62, 0.42, 1.3).normalize();
}
