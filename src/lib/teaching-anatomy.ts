import * as THREE from 'three';
import type { DentalCase, DentalTooth } from './geometry';
import { anatomicalFrame, type Transforms } from './model';
import { toothMatrix } from './analysis';
import { toothArch } from './appliances';

export type AnatomyViewState = {
  bone: boolean;
  opacity: number;
  cutaway: boolean;
  ligament: boolean;
};
export type AnatomyLabel = {
  name: string;
  color: string;
  position: THREE.Vector3;
  side: 'left' | 'right';
};
export const DEFAULT_ANATOMY: AnatomyViewState = {
  bone: false,
  opacity: 0.45,
  cutaway: false,
  ligament: false,
};
export const ANATOMY_SOURCE = 'https://www.nidcr.nih.gov/health-info/gum-disease';

type Profile = { axial: number; x: number; z: number; rx: number; rz: number };
type RootEnvelope = { sections: Profile[]; terminal: boolean };
type Frame = { right: THREE.Vector3; rootward: THREE.Vector3; buccal: THREE.Vector3 };
type Options = {
  selected: string;
  arch?: 'upper' | 'lower' | 'both';
  opening?: number;
  roots?: boolean;
  gums?: boolean;
};
const COLORS = {
  crown: '#efe6d3',
  root: '#e2cba7',
  gum: '#d48d99',
  ligament: '#d9ad63',
  bone: '#c6c8b4',
};

export function anatomyCutawayTooth(
  model: DentalCase,
  state: AnatomyViewState | undefined,
  selected: string,
) {
  return model.demo && state?.cutaway
    ? model.teeth.find(tooth => tooth.id === selected && tooth.rootGeometry && tooth.calibrated)
    : undefined;
}

function frameFor(tooth: DentalTooth): Frame {
  const axes = anatomicalFrame(tooth),
    buccal = new THREE.Vector3(...axes.buccal),
    rootward = new THREE.Vector3(...axes.occlusal).negate();
  return {
    rootward,
    buccal,
    right: new THREE.Vector3().crossVectors(rootward, buccal).normalize(),
  };
}
const fromFrame = (frame: Frame, x: number, axial: number, z: number) =>
  frame.right
    .clone()
    .multiplyScalar(x)
    .addScaledVector(frame.rootward, axial)
    .addScaledVector(frame.buccal, z);

// New assets explicitly identify the cervical trunk and distal root branches.
// Legacy schematic roots retain mesh-plane extraction by connected component.
// These envelopes are teaching sockets, not segmented alveolar bone.
function rootProfiles(tooth: DentalTooth, frame: Frame): RootEnvelope[] {
  if (tooth.rootAnatomy) {
    const convert = (
      sections: NonNullable<DentalTooth['rootAnatomy']>['branches'][number],
      terminal: boolean,
    ): RootEnvelope => ({
      terminal,
      sections: sections.map(section => {
        const center = new THREE.Vector3(...section.center);
        return {
          axial: center.dot(frame.rootward),
          x: center.dot(frame.right),
          z: center.dot(frame.buccal),
          rx: section.radii[0],
          rz: section.radii[1],
        };
      }),
    });
    return [
      ...(tooth.rootAnatomy.trunk ? [convert(tooth.rootAnatomy.trunk, false)] : []),
      ...tooth.rootAnatomy.branches.map(branch => convert(branch, true)),
    ];
  }
  const geometry = tooth.rootGeometry!,
    positions = geometry.getAttribute('position'),
    parent = Array.from({ length: positions.count }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  if (!geometry.index) {
    const vertices = new Map<string, number>();
    for (let i = 0; i < positions.count; i++) {
      const key = [positions.getX(i), positions.getY(i), positions.getZ(i)]
        .map(v => Math.round(v * 1e5))
        .join('/');
      const previous = vertices.get(key);
      if (previous !== undefined) parent[i] = previous;
      else vertices.set(key, i);
    }
  }
  const index = geometry.index;
  for (let i = 0; i < (index?.count || positions.count); i += 3) {
    const a = index ? index.getX(i) : i,
      b = index ? index.getX(i + 1) : i + 1,
      c = index ? index.getX(i + 2) : i + 2;
    parent[find(b)] = find(a);
    parent[find(c)] = find(a);
  }
  const branches = new Map<
      number,
      { points: THREE.Vector3[]; edges: [THREE.Vector3, THREE.Vector3][] }
    >(),
    point = new THREE.Vector3();
  const local: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const root = find(i),
      branch = branches.get(root) || { points: [], edges: [] };
    local[i] = new THREE.Vector3(
      point.dot(frame.right),
      point.dot(frame.rootward),
      point.dot(frame.buccal),
    );
    branch.points.push(local[i]);
    branches.set(root, branch);
  }
  for (let i = 0; i < (index?.count || positions.count); i += 3) {
    const ids = [0, 1, 2].map(k => (index ? index.getX(i + k) : i + k)),
      branch = branches.get(find(ids[0]))!;
    for (let k = 0; k < 3; k++) branch.edges.push([local[ids[k]], local[ids[(k + 1) % 3]]]);
  }
  return [...branches.values()]
    .filter(branch => branch.points.length > 20)
    .map(branch => {
      const min = Math.min(...branch.points.map(p => p.y)),
        max = Math.max(...branch.points.map(p => p.y));
      // Exact mesh-plane intersections avoid stair steps from wide vertex bands.
      return {
        terminal: true,
        sections: Array.from({ length: 33 }, (_, i) => {
          const axial = THREE.MathUtils.lerp(min, max, i / 32),
            sample = THREE.MathUtils.clamp(axial, min + 0.0001, max - 0.0001);
          let lowX = Infinity,
            highX = -Infinity,
            lowZ = Infinity,
            highZ = -Infinity;
          for (const [a, b] of branch.edges) {
            if (
              Math.abs(a.y - b.y) < 1e-8 ||
              sample < Math.min(a.y, b.y) ||
              sample > Math.max(a.y, b.y)
            )
              continue;
            const t = (sample - a.y) / (b.y - a.y),
              x = THREE.MathUtils.lerp(a.x, b.x, t),
              z = THREE.MathUtils.lerp(a.z, b.z, t);
            lowX = Math.min(lowX, x);
            highX = Math.max(highX, x);
            lowZ = Math.min(lowZ, z);
            highZ = Math.max(highZ, z);
          }
          return {
            axial,
            x: (lowX + highX) / 2,
            z: (lowZ + highZ) / 2,
            rx: Math.max(0.025, (highX - lowX) / 2),
            rz: Math.max(0.025, (highZ - lowZ) / 2),
          };
        }),
      };
    });
}

/** Root-following cavity, rounded apical closure, and a separate alveolar body. */
function sleeve(
  envelope: RootEnvelope,
  frame: Frame,
  inner: number,
  outer: number,
  cutaway: boolean,
  bone: boolean,
) {
  const { sections: profiles, terminal } = envelope;
  const rings = bone ? profiles.slice(Math.min(4, Math.max(0, profiles.length - 2))) : profiles,
    sides = cutaway ? 32 : 64,
    cols = cutaway ? sides + 1 : sides;
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const angleStart = cutaway ? Math.PI / 2 : 0,
    angleSpan = cutaway ? Math.PI : Math.PI * 2;
  const body = new THREE.Color(bone ? COLORS.bone : COLORS.ligament),
    socket = body.clone().multiplyScalar(0.89),
    section = new THREE.Color(bone ? '#e9dfc8' : '#eed397');
  const add = (point: THREE.Vector3, color: THREE.Color) => {
    const id = positions.length / 3;
    positions.push(...point.toArray());
    colors.push(color.r, color.g, color.b);
    return id;
  };
  const paths = [inner, outer].map((offset, layer) => {
    const path = rings.map((p, j) => {
      const t = j / (rings.length - 1);
      return {
        ...p,
        axial: p.axial + (bone && layer ? 0.4 : 0),
        rx: bone && layer ? Math.max(p.rx + 1.35, rings[0].rx + outer - 0.65 * t) : p.rx + offset,
        rz: bone && layer ? Math.max(p.rz + 1.35, rings[0].rz + outer - 0.65 * t) : p.rz + offset,
      };
    });
    const end = path[path.length - 1];
    for (let j = 1; terminal && j <= 8; j++) {
      const angle = ((j / 8) * Math.PI) / 2;
      path.push({
        ...end,
        axial: end.axial + (bone ? (layer ? 2.2 : 0.75) : offset) * Math.sin(angle),
        rx: j === 8 ? 0 : end.rx * Math.cos(angle),
        rz: j === 8 ? 0 : end.rz * Math.cos(angle),
      });
    }
    return path;
  });
  const vertices = paths.map((path, layer) =>
    path.map(p => {
      if (!p.rx) return [add(fromFrame(frame, p.x, p.axial, p.z), layer ? body : socket)];
      return Array.from({ length: cols }, (_, k) => {
        const angle = angleStart + (k / sides) * angleSpan;
        return add(
          fromFrame(frame, p.x + p.rx * Math.sin(angle), p.axial, p.z + p.rz * Math.cos(angle)),
          layer ? body : socket,
        );
      });
    }),
  );
  const count = paths[0].length,
    at = (layer: number, j: number, k: number) =>
      vertices[layer][j][vertices[layer][j].length === 1 ? 0 : k % cols];
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
  // Duplicated section vertices give the sawn surfaces their own flat normals and color.
  const sectionQuad = (...source: [number, number, number, number]) => {
    const ids = source.map(id => add(new THREE.Vector3().fromArray(positions, id * 3), section));
    quad(ids[0], ids[1], ids[2], ids[3]);
  };
  for (let j = 0; j < count - 1; j++)
    for (let k = 0; k < sides; k++) {
      if (terminal && j === count - 2) {
        indices.push(at(0, j, k), at(0, j, k + 1), at(0, j + 1, k));
        indices.push(at(1, j, k), at(1, j + 1, k), at(1, j, k + 1));
      } else {
        quad(at(0, j, k), at(0, j, k + 1), at(0, j + 1, k + 1), at(0, j + 1, k));
        quad(at(1, j, k), at(1, j + 1, k), at(1, j + 1, k + 1), at(1, j, k + 1));
      }
    }
  for (let k = 0; k < sides; k++)
    sectionQuad(at(0, 0, k), at(1, 0, k), at(1, 0, k + 1), at(0, 0, k + 1));
  if (!terminal)
    for (let k = 0; k < sides; k++)
      sectionQuad(
        at(0, count - 1, k),
        at(0, count - 1, k + 1),
        at(1, count - 1, k + 1),
        at(1, count - 1, k),
      );
  if (cutaway)
    for (let j = 0; j < count - 1; j++) {
      sectionQuad(at(0, j, 0), at(0, j + 1, 0), at(1, j + 1, 0), at(1, j, 0));
      sectionQuad(at(0, j, sides), at(1, j, sides), at(1, j + 1, sides), at(0, j + 1, sides));
    }
  for (let i = 0; i < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Synthetic reference anatomy only. Gingiva/bone support facts: NIDCR gum-disease
 * overview (ANATOMY_SOURCE). Socket shape and the deliberately enlarged yellow PDL
 * sleeve are original explanatory geometry, never a measured tissue thickness.
 * Supporting tissues stay at their reference pose; no tissue response is simulated.
 */
export function createTeachingAnatomy(model: DentalCase) {
  const group = new THREE.Group();
  group.name = 'teaching-anatomy';
  group.visible = false;
  const boneMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.82,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const ligamentMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });
  const cache = new Map<
    string,
    { bone: THREE.BufferGeometry[]; ligament: THREE.BufferGeometry[]; profiles: RootEnvelope[] }
  >();
  let disposed = false;
  const result = {
    group,
    bounds: new THREE.Box3(),
    gumPlanes: [] as THREE.Plane[],
    labels: [] as AnatomyLabel[],
    cutawayTooth: undefined as DentalTooth | undefined,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.clear();
      cache.forEach(entry => [...entry.bone, ...entry.ligament].forEach(g => g.dispose()));
      cache.clear();
      boneMaterial.dispose();
      ligamentMaterial.dispose();
    },
  };
  function cached(tooth: DentalTooth, cutaway: boolean) {
    const key = `${tooth.id}/${cutaway}`;
    let entry = cache.get(key);
    if (entry) return entry;
    const frame = frameFor(tooth),
      profiles = rootProfiles(tooth, frame);
    entry = {
      bone: profiles.map(p => sleeve(p, frame, 0.58, 1.8, cutaway, true)),
      ligament: profiles.map(p => sleeve(p, frame, 0.08, 0.46, cutaway, false)),
      profiles,
    };
    cache.set(key, entry);
    return entry;
  }
  function update(transforms: Transforms, state: AnatomyViewState | undefined, options: Options) {
    if (disposed) return;
    group.clear();
    group.visible = false;
    result.bounds.makeEmpty();
    result.gumPlanes = [];
    result.labels = [];
    result.cutawayTooth = undefined;
    if (!model.demo || !state || (!state.bone && !state.ligament && !state.cutaway)) return;
    if (!Number.isFinite(state.opacity) || state.opacity < 0 || state.opacity > 1)
      throw new Error('Bone opacity must be between 0 and 1.');
    const cutaway = anatomyCutawayTooth(model, state, options.selected),
      opening = options.opening || 0;
    if (state.cutaway && !cutaway) return;
    result.cutawayTooth = cutaway;
    boneMaterial.opacity = state.opacity;
    boneMaterial.depthWrite = state.opacity >= 1;
    for (const tooth of model.teeth) {
      if (
        !tooth.rootGeometry ||
        !tooth.calibrated ||
        (cutaway
          ? tooth.id !== cutaway.id
          : options.arch && options.arch !== 'both' && toothArch(tooth.id) !== options.arch)
      )
        continue;
      const entry = cached(tooth, !!cutaway),
        offset = new THREE.Vector3(...tooth.position);
      if (toothArch(tooth.id) === 'lower') offset.y -= opening;
      for (const [name, shown, geometries, material] of [
        ['bone', state.bone, entry.bone, boneMaterial],
        ['ligament', state.ligament, entry.ligament, ligamentMaterial],
      ] as const) {
        if (!shown) continue;
        geometries.forEach((geometry, i) => {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = `${name}-${tooth.id}-${i}`;
          mesh.position.copy(offset);
          group.add(mesh);
          result.bounds.union(geometry.boundingBox!.clone().translate(offset));
        });
      }
    }
    if (cutaway) {
      const frame = frameFor(cutaway),
        root = cutaway.rootGeometry!,
        positions = root.getAttribute('position'),
        rootBox = new THREE.Box3().setFromBufferAttribute(positions as THREE.BufferAttribute);
      const rootCenter = rootBox.getCenter(new THREE.Vector3()),
        reference = new THREE.Vector3(...cutaway.position);
      if (toothArch(cutaway.id) === 'lower') reference.y -= opening;
      const posed = toothMatrix(cutaway, transforms);
      if (toothArch(cutaway.id) === 'lower') posed.elements[13] -= opening;
      const sourceBounds = rootBox
        .clone()
        .union(
          new THREE.Box3().setFromBufferAttribute(
            cutaway.geometry.getAttribute('position') as THREE.BufferAttribute,
          ),
        )
        .expandByScalar(2.3)
        .translate(reference);
      const center = sourceBounds.getCenter(new THREE.Vector3()),
        half = sourceBounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      // World-space positive half-spaces keep only this socket's gingival fragment.
      for (const [axis, extent] of [
        [new THREE.Vector3(1, 0, 0), half.x],
        [new THREE.Vector3(0, 1, 0), half.y],
        [new THREE.Vector3(0, 0, 1), half.z],
      ] as const)
        for (const sign of [-1, 1]) {
          const normal = axis.clone().multiplyScalar(sign);
          result.gumPlanes.push(
            new THREE.Plane().setFromNormalAndCoplanarPoint(
              normal,
              center.clone().addScaledVector(normal, -extent),
            ),
          );
        }
      const buccalPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        frame.buccal.clone().negate(),
        reference.clone().addScaledVector(frame.buccal, rootCenter.dot(frame.buccal)),
      );
      result.gumPlanes.push(buccalPlane);
      const envelopes = cached(cutaway, true).profiles,
        profiles = envelopes[0].sections,
        neck = profiles[0];
      const branch = envelopes.find(envelope => envelope.terminal)!.sections,
        middle = branch[Math.floor(branch.length / 2)];
      const label = (
        name: string,
        color: string,
        position: THREE.Vector3,
        side: AnatomyLabel['side'],
      ) => result.labels.push({ name, color, position, side });
      label('Crown', COLORS.crown, new THREE.Vector3().applyMatrix4(posed), 'left');
      if (options.roots !== false) {
        label('Root', COLORS.root, rootCenter.clone().applyMatrix4(posed), 'left');
        result.bounds.union(rootBox.clone().applyMatrix4(posed));
      }
      if (options.gums !== false) {
        label(
          'Gingiva',
          COLORS.gum,
          fromFrame(frame, neck.x - neck.rx - 1, neck.axial - 0.2, neck.z - 0.5).add(reference),
          'right',
        );
        for (const gum of model.gums.filter(gum => gum.arch === toothArch(cutaway.id))) {
          const offset = new THREE.Vector3(...gum.position);
          if (gum.arch === 'lower') offset.y -= opening;
          result.bounds.union(
            new THREE.Box3()
              .setFromBufferAttribute(
                gum.geometry.getAttribute('position') as THREE.BufferAttribute,
              )
              .translate(offset)
              .intersect(sourceBounds),
          );
        }
      }
      if (state.ligament)
        label(
          'Periodontal ligament',
          COLORS.ligament,
          fromFrame(frame, middle.x + middle.rx + 0.27, middle.axial, middle.z).add(reference),
          'right',
        );
      if (state.bone)
        label(
          'Supporting bone',
          COLORS.bone,
          fromFrame(frame, middle.x + middle.rx + 1.3, middle.axial, middle.z).add(reference),
          'right',
        );
      result.bounds.union(
        new THREE.Box3()
          .setFromBufferAttribute(
            cutaway.geometry.getAttribute('position') as THREE.BufferAttribute,
          )
          .applyMatrix4(posed),
      );
    }
    group.visible = group.children.length > 0;
    group.updateMatrixWorld(true);
  }
  return result;
}

/** Bounded label columns leave the centre clear, including narrow lecture screens. */
export function layoutAnatomyLabels(
  labels: AnatomyLabel[],
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const compact = width < 520,
    labelWidth = Math.min(compact ? 121 : 170, Math.max(70, width * 0.3));
  const top = Math.min(96, height * 0.25),
    bottom = Math.max(top + 1, height - 48),
    row = Math.min(42, (bottom - top) / 3);
  const projected = labels.map(label => {
    const point = label.position.clone().project(camera);
    return {
      ...label,
      anchorX: ((point.x + 1) * width) / 2,
      anchorY: ((1 - point.y) * height) / 2,
      depth: point.z,
      x: label.side === 'left' ? 9 : width - labelWidth - 9,
      y: 0,
      width: labelWidth,
    };
  });
  for (const side of ['left', 'right']) {
    const column = projected
      .filter(label => label.side === side)
      .sort((a, b) => a.anchorY - b.anchorY);
    column.forEach((label, i) => {
      label.y = THREE.MathUtils.clamp(
        label.anchorY - 14,
        top + i * row,
        bottom - (column.length - i) * row,
      );
    });
    for (let i = 1; i < column.length; i++)
      column[i].y = Math.max(column[i].y, column[i - 1].y + row);
  }
  return projected;
}
