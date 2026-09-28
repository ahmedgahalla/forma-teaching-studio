import { Quaternion, Vector3, type BufferGeometry } from 'three';

/** Reorient authored smooth normals with their local triangle surface; scratch storage is reused. */
export function createGumNormalUpdater(geometry: BufferGeometry) {
  const positions = geometry.getAttribute('position').array,
    normals = geometry.getAttribute('normal');
  const authored = new Float32Array(normals.array),
    index = geometry.index!.array;
  const count = normals.count,
    offsets = new Uint32Array(count + 1);
  for (let i = 0; i < index.length; i++) offsets[index[i] + 1]++;
  for (let i = 1; i <= count; i++) offsets[i] += offsets[i - 1];
  const cursor = offsets.slice(),
    faces = new Uint32Array(index.length);
  for (let i = 0; i < index.length; i++) faces[cursor[index[i]]++] = i - (i % 3);
  const rest = new Float32Array(count * 3),
    dirty = new Uint8Array(count),
    changed = new Uint32Array(count);
  const from = new Vector3(),
    to = new Vector3(),
    normal = new Vector3(),
    rotation = new Quaternion();
  const geometricNormal = (vertex: number, target: Vector3) => {
    let x = 0,
      y = 0,
      z = 0;
    for (let f = offsets[vertex]; f < offsets[vertex + 1]; f++) {
      const face = faces[f],
        a = index[face] * 3,
        b = index[face + 1] * 3,
        c = index[face + 2] * 3;
      const ux = positions[b] - positions[a],
        uy = positions[b + 1] - positions[a + 1],
        uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a],
        vy = positions[c + 1] - positions[a + 1],
        vz = positions[c + 2] - positions[a + 2];
      x += uy * vz - uz * vy;
      y += uz * vx - ux * vz;
      z += ux * vy - uy * vx;
    }
    return target.set(x, y, z).normalize();
  };
  for (let i = 0; i < count; i++) geometricNormal(i, from).toArray(rest, i * 3);
  return {
    reset: () => normals.array.set(authored),
    update(vertices: Uint32Array, length: number) {
      let total = 0;
      for (let i = 0; i < length; i++) {
        const vertex = vertices[i];
        for (let f = offsets[vertex]; f < offsets[vertex + 1]; f++) {
          const face = faces[f];
          for (let corner = 0; corner < 3; corner++) {
            const neighbour = index[face + corner];
            if (!dirty[neighbour]) {
              dirty[neighbour] = 1;
              changed[total++] = neighbour;
            }
          }
        }
      }
      for (let i = 0; i < total; i++) {
        const vertex = changed[i];
        dirty[vertex] = 0;
        from.fromArray(rest, vertex * 3);
        rotation.setFromUnitVectors(from, geometricNormal(vertex, to));
        normal
          .fromArray(authored, vertex * 3)
          .applyQuaternion(rotation)
          .normalize();
        normals.setXYZ(vertex, normal.x, normal.y, normal.z);
      }
    },
  };
}
