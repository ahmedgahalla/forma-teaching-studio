import { Box3, MathUtils, Vector3 } from 'three';
import type { DentalTooth, Gum } from './geometry';
import { gumSurfaceDistance } from './gum-surface-distance';
import { cachedGumBinding, cacheGumBinding, makeGumBinding } from './gum-binding-cache';

/** Display skinning weights, not tissue mechanics. Evaluate once against immutable rest surfaces. */
export function gumInfluences(gum: Gum, teeth: DentalTooth[]) {
  const cached = cachedGumBinding(gum, teeth);
  if (cached) return cached;
  for (const geometry of [
    gum.geometry,
    ...teeth.flatMap(tooth => [
      tooth.geometry,
      ...(tooth.rootGeometry ? [tooth.rootGeometry] : []),
    ]),
  ])
    if (!geometry.boundingBox) geometry.computeBoundingBox();
  const position = gum.geometry.getAttribute('position');
  const indices = new Uint8Array(position.count * 3),
    weights = new Float32Array(indices.length);
  const surfaces = teeth.map(tooth => ({
    origin: new Vector3(...tooth.position),
    bounds: new Box3()
      .copy(tooth.geometry.boundingBox!)
      .union(tooth.rootGeometry?.boundingBox || tooth.geometry.boundingBox!),
    distance: gumSurfaceDistance([
      tooth.geometry,
      ...(tooth.rootGeometry ? [tooth.rootGeometry] : []),
    ]),
  }));
  const world = new Vector3(),
    local = new Vector3();
  const nearest = new Float64Array(3),
    selected = new Uint8Array(3);
  const ordered = new Uint8Array(teeth.length),
    lowerBounds = new Float64Array(teeth.length);
  const bounds = gum.geometry.boundingBox!,
    data = gum.geometry.getAttribute('dentalData');
  for (let vertex = 0; vertex < position.count; vertex++) {
    world.fromBufferAttribute(position, vertex);
    const depth = gum.arch === 'upper' ? bounds.max.y - world.y : world.y - bounds.min.y;
    const attachment =
      MathUtils.smoothstep(depth, 2, 10) *
      (data ? 1 - MathUtils.smoothstep(data.getZ(vertex), 0.25, 0.75) : 1);
    if (!attachment) continue;
    world.x += gum.position[0];
    world.y += gum.position[1];
    world.z += gum.position[2];
    nearest.fill(8);
    for (let tooth = 0; tooth < surfaces.length; tooth++) {
      local.copy(world).sub(surfaces[tooth].origin);
      lowerBounds[tooth] = surfaces[tooth].bounds.distanceToPoint(local);
      let slot = tooth;
      while (slot > 0 && lowerBounds[ordered[slot - 1]] > lowerBounds[tooth]) {
        ordered[slot] = ordered[slot - 1];
        slot--;
      }
      ordered[slot] = tooth;
    }
    for (let candidate = 0; candidate < surfaces.length; candidate++) {
      const tooth = ordered[candidate];
      if (lowerBounds[tooth] >= nearest[2]) break;
      const surface = surfaces[tooth];
      local.copy(world).sub(surface.origin);
      const distance = surface.distance(local, nearest[2]);
      if (distance >= nearest[2]) continue;
      let slot = 2;
      while (slot > 0 && distance < nearest[slot - 1]) {
        nearest[slot] = nearest[slot - 1];
        selected[slot] = selected[slot - 1];
        slot--;
      }
      nearest[slot] = distance;
      selected[slot] = tooth;
    }
    let total = 0;
    for (let slot = 0; slot < 3; slot++) {
      const weight = nearest[slot] < 8 ? 1 / (0.15 + nearest[slot]) ** 4 : 0;
      indices[vertex * 3 + slot] = selected[slot];
      weights[vertex * 3 + slot] = weight;
      total += weight;
    }
    const follow = attachment * (1 - MathUtils.smoothstep(nearest[0], 0.75, 8));
    if (total)
      for (let slot = 0; slot < 3; slot++) {
        const weight = (weights[vertex * 3 + slot] * follow) / total;
        weights[vertex * 3 + slot] = weight < 0.0001 ? 0 : weight;
      }
  }
  return cacheGumBinding(gum, teeth, makeGumBinding(indices, weights, teeth.length));
}
