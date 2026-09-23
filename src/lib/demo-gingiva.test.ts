import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createDemoGingiva } from './demo-gingiva';

const necks = [.2, .48, .77, 1.03, 1.24, 1.52, 1.8].map(angle => ({ angle, height: 10, depth: 8 }));
function surface(mesh: THREE.Mesh, angle: number, lateral: number) {
  const normal = new THREE.Vector3(34 * Math.sin(angle), 0, 27 * Math.cos(angle)).normalize();
  const origin = new THREE.Vector3(27 * Math.sin(angle), 30, 34 * Math.cos(angle) - 12).addScaledVector(normal, lateral);
  return new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0]?.point.y;
}

describe('authored gingival arch base', () => {
  it('raises tissue between tooth emergences while preserving a low cervical margin at each neck', () => {
    const geometry = createDemoGingiva(necks, 27, 34, false), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
    const emergence = surface(mesh, .48, 0)!, papilla = surface(mesh, .34, 0)!, margin = surface(mesh, .48, 8 * .35)!;
    expect(Number.isFinite(emergence)).toBe(true); expect(Number.isFinite(papilla)).toBe(true);
    expect(papilla - emergence).toBeGreaterThan(1.5);
    expect(margin).toBeGreaterThan(10); expect(margin).toBeLessThan(10.8);
    // No posterior bridge across the oral space; the U ends are capped individually.
    expect(new THREE.Raycaster(new THREE.Vector3(0, 30, -12), new THREE.Vector3(0, -1, 0)).intersectObject(mesh)).toHaveLength(0);
    geometry.dispose(); material.dispose();
  });

  it.each([true, false])('exports a finite watertight volume without degenerate triangles (upper=%s)', upper => {
    const geometry = createDemoGingiva(necks, 27, 34, upper), p = geometry.getAttribute('position'), index = geometry.index!, edges = new Map<string, number>();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let volume = 0;
    expect([...p.array, ...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
      expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-10);
      volume += a.dot(b.cross(c)) / 6;
      for (let k = 0; k < 3; k++) { const key = [ids[k], ids[(k + 1) % 3]].sort((x, y) => x - y).join('/'); edges.set(key, (edges.get(key) || 0) + 1); }
    }
    expect([...edges.values()].every(count => count === 2)).toBe(true); expect(volume).toBeGreaterThan(100);
    geometry.dispose();
  });
});
