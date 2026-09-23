import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createOrthodonticDemo } from './demo';
import type { DentalTooth } from './geometry';

const model = createOrthodonticDemo();
const upper = (id: string) => Number(id[0]) <= 2;
const bounds = (geometry: THREE.BufferGeometry, position: number[] = [0, 0, 0]) => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.clone().translate(new THREE.Vector3(...position));
};

function signedVolume(geometry: THREE.BufferGeometry) {
  const points = geometry.getAttribute('position'), index = geometry.index!;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let volume = 0;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(points, index.getX(i)); b.fromBufferAttribute(points, index.getX(i + 1)); c.fromBufferAttribute(points, index.getX(i + 2));
    volume += a.dot(b.cross(c)) / 6;
  }
  return volume;
}

function axialRange(tooth: DentalTooth) {
  const points = tooth.geometry.getAttribute('position'), axis = new THREE.Vector3(...tooth.occlusal!);
  const values = Array.from({ length: points.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(points, i).dot(axis));
  return [Math.min(...values), Math.max(...values)];
}

function surfacePoint(tooth: DentalTooth, axial: number, mesial: number, buccal: number, direction: 'buccal' | 'occlusal', root = false) {
  const axes = { buccal: new THREE.Vector3(...tooth.buccal), occlusal: new THREE.Vector3(...tooth.occlusal!), mesial: new THREE.Vector3(...tooth.mesial) };
  const origin = axes.occlusal.clone().multiplyScalar(axial).addScaledVector(axes.mesial, mesial).addScaledVector(axes.buccal, buccal);
  const material = new THREE.MeshBasicMaterial();
  const hit = new THREE.Raycaster(origin, axes[direction].clone().negate()).intersectObject(new THREE.Mesh(root ? tooth.rootGeometry! : tooth.geometry, material))[0];
  material.dispose();
  expect(hit, `Missing ${direction} surface on ${tooth.id}`).toBeDefined();
  return hit.point;
}

afterAll(() => {
  model.teeth.forEach(t => { t.geometry.dispose(); t.rootGeometry?.dispose(); });
  model.gums.forEach(g => g.geometry.dispose());
});

describe('schematic orthodontic demo', () => {
  it('contains 28 uniquely numbered permanent teeth, both gingival arches and no wisdom teeth', () => {
    expect(model.demo).toBe(true);
    expect(model.teeth).toHaveLength(28);
    expect(new Set(model.teeth.map(t => t.id)).size).toBe(28);
    for (const quadrant of [1, 2, 3, 4]) {
      expect(model.teeth.filter(t => t.id.startsWith(String(quadrant))).map(t => t.id)).toEqual(Array.from({ length: 7 }, (_, i) => `${quadrant}${i + 1}`));
    }
    expect(model.gums.map(g => g.arch)).toEqual(['upper', 'lower']);
  });

  it('has finite, nondegenerate, consistently outward closed crown and root meshes', () => {
    for (const tooth of model.teeth) for (const geometry of [tooth.geometry, tooth.rootGeometry!]) {
      expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
      const points = geometry.getAttribute('position'), index = geometry.index!;
      const edges = new Map<string, number>();
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let minTriangleAreaSquared = Infinity;
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(points, ids[0]); b.fromBufferAttribute(points, ids[1]); c.fromBufferAttribute(points, ids[2]);
        minTriangleAreaSquared = Math.min(minTriangleAreaSquared, b.sub(a).cross(c.sub(a)).lengthSq());
        for (let e = 0; e < 3; e++) {
          const key = [ids[e], ids[(e + 1) % 3]].sort((a, b) => a - b).join(':'); edges.set(key, (edges.get(key) || 0) + 1);
        }
      }
      expect(minTriangleAreaSquared).toBeGreaterThan(1e-12);
      expect([...edges.values()].every(count => count === 2)).toBe(true);
      expect(signedVolume(geometry)).toBeGreaterThan(10);
    }
  });

  it('centers each pivot on the crown and registers schematic roots in that same frame', () => {
    for (const tooth of model.teeth) {
      expect(bounds(tooth.geometry).getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-5);
      const crownBox = bounds(tooth.geometry, tooth.position), rootBox = bounds(tooth.rootGeometry!, tooth.position);
      if (upper(tooth.id)) {
        expect(rootBox.max.y).toBeGreaterThan(crownBox.max.y + 10);
        expect(Math.abs(rootBox.min.y - crownBox.max.y)).toBeLessThan(.2);
      } else {
        expect(rootBox.min.y).toBeLessThan(crownBox.min.y - 10);
        expect(Math.abs(rootBox.max.y - crownBox.min.y)).toBeLessThan(.2);
      }
      expect(crownBox.clone().expandByScalar(1).intersectsBox(rootBox)).toBe(true);
    }
  });

  it('uses calibrated orthonormal anatomical directions and the correct arch-specific occlusal sign', () => {
    for (const tooth of model.teeth) {
      expect(tooth.calibrated).toBe(true);
      const vectors = [tooth.buccal, tooth.mesial, tooth.occlusal!].map(v => new THREE.Vector3(...v));
      vectors.forEach(v => expect(v.length()).toBeCloseTo(1, 10));
      expect(vectors[0].dot(vectors[1])).toBeCloseTo(0, 10);
      expect(vectors[0].dot(vectors[2])).toBeCloseTo(0, 10);
      expect(vectors[1].dot(vectors[2])).toBeCloseTo(0, 10);
      expect(tooth.occlusal).toEqual([0, upper(tooth.id) ? -1 : 1, 0]);
      expect(Math.sign(tooth.position[0])).toBe([1, 4].includes(Number(tooth.id[0])) ? -1 : 1);
      const marker = new THREE.Vector3(...tooth.bracketPosition!);
      expect(marker.dot(vectors[0])).toBeGreaterThan(2);
      expect(bounds(tooth.geometry).expandByScalar(1).containsPoint(marker)).toBe(true);
    }
  });

  it('maintains a 3.2 mm visible interarch gap and an upper arch anterior to the lower', () => {
    const top = model.teeth.filter(t => upper(t.id)).map(t => bounds(t.geometry, t.position));
    const bottom = model.teeth.filter(t => !upper(t.id)).map(t => bounds(t.geometry, t.position));
    expect(Math.min(...top.map(b => b.min.y))).toBeCloseTo(1.6, 5);
    expect(Math.max(...bottom.map(b => b.max.y))).toBeCloseTo(-1.6, 5);
    const central = (id: string) => model.teeth.find(t => t.id === id)!;
    expect(central('11').position[2]).toBeGreaterThan(central('41').position[2] + 1);
  });

  it('separates adjacent crowns instead of interpenetrating on the arch bend', () => {
    const pairs = model.teeth.filter(t => t.id[1] !== '7').map(t => [t, model.teeth.find(n => Number(n.id) === Number(t.id) + 1)!]);
    pairs.push(['11', '21'].map(id => model.teeth.find(t => t.id === id)!));
    pairs.push(['31', '41'].map(id => model.teeth.find(t => t.id === id)!));
    for (const [a, b] of pairs) {
      const axis = new THREE.Vector3(...b.position).sub(new THREE.Vector3(...a.position)); axis.y = 0; axis.normalize();
      const project = (tooth: typeof a) => {
        const vertices = tooth.geometry.getAttribute('position'), values: number[] = [];
        for (let i = 0; i < vertices.count; i++) values.push(new THREE.Vector3().fromBufferAttribute(vertices, i).add(new THREE.Vector3(...tooth.position)).dot(axis));
        return [Math.min(...values), Math.max(...values)];
      };
      expect(project(b)[0] - project(a)[1]).toBeGreaterThan(.01);
    }
  });

  it('has distinct incisal blades, rounded canine ridges and multi-cusp posterior surfaces', () => {
    const incisor = model.teeth.find(t => t.id === '11')!;
    const lowerIncisor = model.teeth.find(t => t.id === '41')!;
    expect(bounds(incisor.geometry).getSize(new THREE.Vector3()).x).toBeGreaterThan(bounds(lowerIncisor.geometry).getSize(new THREE.Vector3()).x + 2);
    const height = (tooth: DentalTooth, x: number, z: number) => surfacePoint(tooth, 30, x, z, 'occlusal').dot(new THREE.Vector3(...tooth.occlusal!));
    const canine = model.teeth.find(t => t.id === '13')!;
    expect(height(incisor, 0, 0) - height(incisor, 2.5, 0)).toBeLessThan(.4);
    expect(height(canine, 0, 0) - height(canine, 2.5, 0)).toBeGreaterThan(1);
    const premolar = model.teeth.find(t => t.id === '14')!;
    const premolarFossa = height(premolar, 0, 0);
    expect(height(premolar, 0, 1.6) - premolarFossa).toBeGreaterThan(.4);
    expect(height(premolar, 0, -1.6) - premolarFossa).toBeGreaterThan(.25);
    for (const id of ['16', '36']) {
      const tooth = model.teeth.find(t => t.id === id)!;
      const fossa = height(tooth, 0, 0);
      for (const x of [-1.8, 1.8]) for (const z of [-1.8, 1.8]) expect(height(tooth, x, z) - fossa).toBeGreaterThan(.4);
    }
  });

  it('keeps a single convex sweep across the visible anterior labial face without horizontal profile shelves', () => {
    for (const id of ['11', '12', '13', '31', '32', '33']) {
      const tooth = model.teeth.find(t => t.id === id)!, [low, high] = axialRange(tooth), buccal = new THREE.Vector3(...tooth.buccal);
      const depths = Array.from({ length: 7 }, (_, i) => surfacePoint(tooth, low + (high - low) * (.3 + i * .05), 0, 30, 'buccal').dot(buccal));
      const slopes = depths.slice(1).map((value, i) => value - depths[i]);
      for (let i = 1; i < slopes.length; i++) expect(slopes[i] - slopes[i - 1], `Labial shelf on ${id}`).toBeLessThan(-.006);
    }
  });

  it('joins single roots to the cervical crown contour and terminates in rounded apices', () => {
    for (const id of ['11', '13', '15', '31', '33', '35']) {
      const tooth = model.teeth.find(t => t.id === id)!, [cervical] = axialRange(tooth), buccal = new THREE.Vector3(...tooth.buccal);
      const crown = surfacePoint(tooth, cervical + .03, 0, 30, 'buccal');
      const root = surfacePoint(tooth, cervical - .03, 0, 30, 'buccal', true);
      expect(Math.abs(crown.clone().sub(root).dot(buccal))).toBeLessThan(.18);
      const points = tooth.rootGeometry!.getAttribute('position'), normals = tooth.rootGeometry!.getAttribute('normal');
      const rootward = new THREE.Vector3(...tooth.occlusal!).negate();
      const axial = Array.from({ length: points.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(points, i).dot(rootward));
      const apex = Math.max(...axial), tips = axial.map((value, i) => ({ value, i })).filter(p => apex - p.value < 1e-5);
      expect(tips).toHaveLength(1); // No planar disk across the end of a root cone.
      expect(new THREE.Vector3().fromBufferAttribute(normals, tips[0].i).dot(rootward)).toBeGreaterThan(.98);
    }
  });

  it('keeps finite closed gingiva outside the rest gap', () => {
    for (const gum of model.gums) {
      expect(Array.from(gum.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      expect(signedVolume(gum.geometry)).toBeGreaterThan(100);
      const index = gum.geometry.index!, edges = new Map<string, number>();
      for (let i = 0; i < index.count; i += 3) for (let side = 0; side < 3; side++) {
        const a = index.getX(i + side), b = index.getX(i + (side + 1) % 3);
        const key = [a, b].sort((a, b) => a - b).join(':');
        edges.set(key, (edges.get(key) || 0) + (a < b ? 1 : -1));
      }
      expect([...edges.values()].every(value => value === 0)).toBe(true);
      const box = bounds(gum.geometry);
      if (gum.arch === 'upper') expect(box.min.y).toBeGreaterThan(5);
      else expect(box.max.y).toBeLessThan(-5);
    }
  });
});
