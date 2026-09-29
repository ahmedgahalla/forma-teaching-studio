import {
  AdditiveBlending,
  Box3,
  Color,
  FrontSide,
  Mesh,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
  type Group,
} from 'three';
import type { DentalCase } from './geometry';
import type { MechanicsExperiment } from './mechanics/types';
import { displayedTadPoints } from './mechanics-tad-view';
import type { Transforms } from './model';
import { toothMatrix } from './analysis';
import { toothArch } from './appliances';
import { applyJawMatrix, applyJawPoint } from './jaw-opening';

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
  jawOpen = false,
) {
  const bounds = new Box3(),
    selected = new Set(ids);
  for (const tooth of model.teeth) {
    if (!selected.has(tooth.id)) continue;
    const matrix = toothMatrix(tooth, transforms);
    if (toothArch(tooth.id) === 'lower') applyJawMatrix(matrix, jawOpen).elements[13] -= opening;
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

/** Evaluated only for camera requests; consume each reused point before advancing. */
export function* displayedToothPoints(
  model: DentalCase,
  transforms: Transforms,
  ids: string[],
  roots: boolean,
  opening: number,
  jawOpen = false,
) {
  const selected = new Set(ids),
    point = new Vector3();
  for (const tooth of model.teeth) {
    if (!selected.has(tooth.id)) continue;
    const matrix = toothMatrix(tooth, transforms);
    if (toothArch(tooth.id) === 'lower') applyJawMatrix(matrix, jawOpen).elements[13] -= opening;
    for (const geometry of [
      tooth.geometry,
      ...(roots && tooth.rootGeometry ? [tooth.rootGeometry] : []),
    ]) {
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++)
        yield point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
    }
  }
}

/** Fit visible gingiva and TADs as well as the crowns, keeping hardware inside the camera. */
export function* displayedFitPoints(
  model: DentalCase,
  transforms: Transforms,
  ids: string[],
  roots: boolean,
  opening: number,
  includeGums: boolean,
  jawOpen = false,
  mechanics?: MechanicsExperiment | null,
) {
  yield* displayedToothPoints(model, transforms, ids, roots, opening, jawOpen);
  if (mechanics) yield* displayedTadPoints(mechanics, ids, opening, jawOpen);
  if (!includeGums) return;
  const arches = new Set(ids.map(toothArch)),
    point = new Vector3();
  for (const gum of model.gums) {
    if (gum.arch && !arches.has(gum.arch)) continue;
    const positions = gum.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i);
      point.x += gum.position[0];
      point.y += gum.position[1];
      point.z += gum.position[2];
      if (gum.arch === 'lower') applyJawPoint(point, jawOpen).y -= opening;
      yield point;
    }
  }
}

/** Claude Atlas' additive surface glow; the natural enamel material stays untouched. */
export function selectionGlowMaterial(hover = false) {
  return new ShaderMaterial({
    name: hover ? 'tooth-hover-glow' : 'tooth-selection-glow',
    uniforms: {
      uColor: { value: new Color(hover ? 0xffe7b0 : 0xffd27f) },
      uBase: { value: hover ? 0.11 : 0.2 },
      uRim: { value: hover ? 0.75 : 1.15 },
    },
    side: FrontSide,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uBase, uRim;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.0);
        gl_FragColor = vec4(uColor * (uBase + uRim * f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Shares scene-owned geometry/material; poses come from the tooth group, never copied per frame. */
export function createSelectionGlow(
  group: Group,
  crownGeometry: BufferGeometry,
  rootGeometry: BufferGeometry | undefined,
  material: ShaderMaterial,
  hoverMaterial = material,
) {
  const add = (geometry: BufferGeometry) => {
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    mesh.renderOrder = 10;
    mesh.raycast = () => {};
    group.add(mesh);
    return mesh;
  };
  const crown = add(crownGeometry),
    root = rootGeometry ? add(rootGeometry) : undefined;
  return (selected: boolean, showRoots: boolean, isolated = false, hovered = false) => {
    crown.material = selected ? material : hoverMaterial;
    crown.visible = (selected || hovered) && group.visible && !isolated;
    if (root) {
      root.material = crown.material;
      root.visible = crown.visible && showRoots;
    }
  };
}

/** One pair of scene-owned materials serves every tooth; source geometry stays borrowed. */
export function createSelectionGlows(teeth: DentalCase['teeth'], groups: Map<string, Group>) {
  const selected = selectionGlowMaterial(),
    hovered = selectionGlowMaterial(true),
    glows = new Map<string, ReturnType<typeof createSelectionGlow>>();
  for (const tooth of teeth)
    glows.set(
      tooth.id,
      createSelectionGlow(
        groups.get(tooth.id)!,
        tooth.geometry,
        tooth.rootGeometry,
        selected,
        hovered,
      ),
    );
  return {
    update(id: string, active: boolean, roots: boolean, isolated = false, preview = false) {
      glows.get(id)?.(active, roots, isolated, preview);
    },
    dispose() {
      selected.dispose();
      hovered.dispose();
      glows.clear();
    },
  };
}

export { layoutToothLabels, type ToothLabelAnchor } from './tooth-label-layout';

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
