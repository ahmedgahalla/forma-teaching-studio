import { Vector3, type BufferGeometry } from 'three';

/** Nearest authored surface vertex is sufficient for qualitative display weights, not collision tests. */
export function gumSurfaceDistance(geometries: BufferGeometry[]) {
  const count = geometries.reduce(
    (sum, geometry) => sum + geometry.getAttribute('position').count,
    0,
  );
  const positions = new Float32Array(count * 3),
    order = new Uint32Array(count);
  let offset = 0;
  for (const geometry of geometries) {
    const attribute = geometry.getAttribute('position');
    for (let i = 0; i < attribute.count; i++) {
      positions[offset * 3] = attribute.getX(i);
      positions[offset * 3 + 1] = attribute.getY(i);
      positions[offset * 3 + 2] = attribute.getZ(i);
      order[offset] = offset++;
    }
  }
  const build = (start: number, end: number, depth: number) => {
    if (end - start < 2) return;
    const axis = depth % 3,
      middle = (start + end) >>> 1;
    order.subarray(start, end).sort((a, b) => positions[a * 3 + axis] - positions[b * 3 + axis]);
    build(start, middle, depth + 1);
    build(middle + 1, end, depth + 1);
  };
  build(0, count, 0);
  let x = 0,
    y = 0,
    z = 0,
    best = 0;
  const visit = (start: number, end: number, depth: number) => {
    if (start >= end) return;
    const middle = (start + end) >>> 1,
      index = order[middle] * 3,
      axis = depth % 3;
    const dx = x - positions[index],
      dy = y - positions[index + 1],
      dz = z - positions[index + 2];
    best = Math.min(best, dx * dx + dy * dy + dz * dz);
    const delta = axis === 0 ? dx : axis === 1 ? dy : dz;
    if (delta < 0) {
      visit(start, middle, depth + 1);
      if (delta * delta < best) visit(middle + 1, end, depth + 1);
    } else {
      visit(middle + 1, end, depth + 1);
      if (delta * delta < best) visit(start, middle, depth + 1);
    }
  };
  return (point: Vector3, limit: number) => {
    x = point.x;
    y = point.y;
    z = point.z;
    best = limit * limit;
    visit(0, count, 0);
    return Math.sqrt(best);
  };
}
