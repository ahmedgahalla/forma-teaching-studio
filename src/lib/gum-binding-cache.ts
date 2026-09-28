import type { BufferGeometry } from 'three';
import type { DentalTooth, Gum } from './geometry';

export type GumBinding = { indices: Uint8Array; weights: Float32Array; vertices: Uint32Array[] };
type Entry = { key: string; gum: BufferGeometry; surfaces: BufferGeometry[]; binding: GumBinding };
const cache = new WeakMap<BufferGeometry, Entry[]>();
const reference = new Map<string, Entry[]>();
const keyFor = (gum: Gum, teeth: DentalTooth[]) =>
  `${gum.arch}/${teeth
    .map(
      tooth =>
        `${tooth.id}:${tooth.position.map((value, i) => Math.round((value - gum.position[i]) * 1e8))}`,
    )
    .join('/')}`;
const surfacesFor = (teeth: DentalTooth[]) =>
  teeth.flatMap(tooth => [tooth.geometry, ...(tooth.rootGeometry ? [tooth.rootGeometry] : [])]);
function sameGeometry(a: BufferGeometry, b: BufferGeometry, gum = false) {
  for (const name of gum ? ['position', 'dentalData'] : ['position']) {
    const x = a.getAttribute(name),
      y = b.getAttribute(name);
    if (!x || !y || x.count !== y.count || x.itemSize !== y.itemSize) return false;
    for (let i = 0; i < x.count; i++)
      for (let c = 0; c < x.itemSize; c++)
        if (Math.fround(x.getComponent(i, c)) !== Math.fround(y.getComponent(i, c))) return false;
  }
  return true;
}
export function cacheGumBinding(
  gum: Gum,
  teeth: DentalTooth[],
  binding: GumBinding,
  canonical = false,
) {
  const entry = {
    key: keyFor(gum, teeth),
    gum: gum.geometry,
    surfaces: surfacesFor(teeth),
    binding,
  };
  const entries = (cache.get(gum.geometry) || []).filter(
    value =>
      value.key !== entry.key ||
      value.surfaces.length !== entry.surfaces.length ||
      value.surfaces.some((geometry, i) => geometry !== entry.surfaces[i]),
  );
  entries.push(entry);
  if (entries.length > 4) entries.shift();
  cache.set(gum.geometry, entries);
  if (canonical) {
    const known = (reference.get(gum.id) || []).filter(value => value.key !== entry.key);
    known.push(entry);
    reference.set(gum.id, known.slice(-4));
  }
  return binding;
}
export function cachedGumBinding(gum: Gum, teeth: DentalTooth[]) {
  const key = keyFor(gum, teeth),
    surfaces = surfacesFor(teeth),
    entries = cache.get(gum.geometry) || [];
  const cached = entries.find(
    entry =>
      entry.key === key &&
      entry.surfaces.length === surfaces.length &&
      entry.surfaces.every((geometry, i) => geometry === surfaces[i]),
  );
  if (cached) {
    entries.splice(entries.indexOf(cached), 1);
    entries.push(cached);
    return cached.binding;
  }
  // Saved atlas files create new geometries. Compare actual inputs, never only their asset marker.
  const original = reference
    .get(gum.id)
    ?.find(
      entry =>
        entry.key === key &&
        entry.surfaces.length === surfaces.length &&
        sameGeometry(entry.gum, gum.geometry, true) &&
        entry.surfaces.every((geometry, i) => sameGeometry(geometry, surfaces[i])),
    );
  if (original) return cacheGumBinding(gum, teeth, original.binding);
}
export function makeGumBinding(
  indices: Uint8Array,
  weights: Float32Array,
  toothCount: number,
): GumBinding {
  const vertices = Array.from({ length: toothCount }, () => [] as number[]);
  for (let i = 0; i < weights.length; i++)
    if (weights[i]) vertices[indices[i]].push(Math.floor(i / 3));
  return { indices, weights, vertices: vertices.map(values => new Uint32Array(values)) };
}
