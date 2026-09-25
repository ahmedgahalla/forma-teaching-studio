import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createAttachmentGeometry, validateAttachment, type AttachmentSpec } from './attachments';
import { createOrthodonticDemo } from './demo';
import type { DentalTooth } from './geometry';

const settings = (override: Partial<AttachmentSpec> = {}): AttachmentSpec => ({
  shape: 'rectangle',
  width: 3,
  height: 4,
  depth: 1,
  offsetMesial: 0,
  offsetOcclusal: 0,
  rotation: 0,
  ...override,
});
const tooth = (upper = false): DentalTooth => ({
  id: upper ? '11' : '31',
  name: 'Teaching crown',
  calibrated: true,
  geometry: new THREE.BoxGeometry(6, 10, 4),
  position: [15, 8, -4],
  buccal: [0, 0, 1],
  mesial: [1, 0, 0],
  occlusal: [0, upper ? -1 : 1, 0],
});

describe('attachment specifications', () => {
  it('accepts all supported shapes and the declared software boundaries without modifying input', () => {
    for (const shape of ['rectangle', 'ellipsoid', 'beveled'] as const) {
      const input = settings({
        shape,
        width: 0.2,
        height: 6,
        depth: 0.2,
        offsetMesial: -5,
        offsetOcclusal: 5,
        rotation: -180,
      });
      expect(validateAttachment(input)).toEqual(input);
      expect(validateAttachment(input)).not.toBe(input);
    }
  });

  it.each([
    { shape: 'optimized' },
    { width: 0 },
    { width: 0.199 },
    { height: 6.001 },
    { depth: NaN },
    { depth: '1' },
    { offsetMesial: -5.01 },
    { offsetOcclusal: Infinity },
    { offsetMesial: undefined },
    { rotation: 180.1 },
    { rotation: null },
  ])('rejects unsupported or nonfinite geometry settings %j', override => {
    expect(() => validateAttachment({ ...settings(), ...override })).toThrow();
  });

  it.each([null, [], 42, 'rectangle', {}].map(value => ({ value })))(
    'rejects incomplete specifications: $value',
    ({ value }) => {
      expect(() => validateAttachment(value)).toThrow();
    },
  );
});

describe('attachment placement and geometry', () => {
  it.each(['rectangle', 'ellipsoid', 'beveled'] as const)(
    'creates a finite, closed, outward %s mesh with the requested dimensions',
    shape => {
      const target = tooth(),
        geometry = createAttachmentGeometry(target, settings({ shape }));
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(3, 5);
      expect(size.y).toBeCloseTo(4, 5);
      expect(size.z).toBeCloseTo(1, 5);
      expect(geometry.boundingBox!.min.z).toBeCloseTo(1.97, 5);
      expect(geometry.boundingBox!.max.z).toBeCloseTo(2.97, 5);
      const positions = geometry.getAttribute('position'),
        normals = geometry.getAttribute('normal');
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
      const index = geometry.index
        ? Array.from(geometry.index.array)
        : Array.from({ length: positions.count }, (_, i) => i);
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      const edges = new Map<string, { count: number; direction: number }>();
      let volume = 0;
      const pointKey = (index: number) =>
        [positions.getX(index), positions.getY(index), positions.getZ(index)]
          .map(v => Math.round(v * 1e5))
          .join(',');
      for (let i = 0; i < index.length; i += 3) {
        a.fromBufferAttribute(positions, index[i]);
        b.fromBufferAttribute(positions, index[i + 1]);
        c.fromBufferAttribute(positions, index[i + 2]);
        expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-14);
        volume += a.dot(b.cross(c)) / 6;
        for (let side = 0; side < 3; side++) {
          const start = pointKey(index[i + side]),
            end = pointKey(index[i + ((side + 1) % 3)]),
            key = [start, end].sort().join('/');
          const edge = edges.get(key) || { count: 0, direction: 0 };
          edge.count++;
          edge.direction += start < end ? 1 : -1;
          edges.set(key, edge);
        }
      }
      expect(volume).toBeGreaterThan(1);
      expect([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0)).toBe(
        true,
      );
      geometry.dispose();
      target.geometry.dispose();
    },
  );

  it('uses anatomical offsets with opposite superior/inferior directions for the two arches', () => {
    for (const upper of [false, true]) {
      const target = tooth(upper),
        geometry = createAttachmentGeometry(
          target,
          settings({ offsetMesial: 1, offsetOcclusal: 0.75 }),
        );
      const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
      expect(center.x).toBeCloseTo(1, 5);
      expect(center.y).toBeCloseTo(upper ? -0.75 : 0.75, 5);
      expect(center.z).toBeCloseTo(2.47, 5);
      geometry.dispose();
      target.geometry.dispose();
    }
  });

  it('rotates attachment dimensions around the buccal normal without moving its placement centre', () => {
    const target = tooth(),
      geometry = createAttachmentGeometry(
        target,
        settings({ width: 4, height: 2, rotation: 90, offsetMesial: 0.6 }),
      );
    const size = geometry.boundingBox!.getSize(new THREE.Vector3()),
      center = geometry.boundingBox!.getCenter(new THREE.Vector3());
    expect(size.x).toBeCloseTo(2, 5);
    expect(size.y).toBeCloseTo(4, 5);
    expect(size.z).toBeCloseTo(1, 5);
    expect(center.x).toBeCloseTo(0.6, 5);
    expect(center.y).toBeCloseTo(0, 5);
    geometry.dispose();
    target.geometry.dispose();
  });

  it('places the base on actual buccal surfaces of all 28 demo crowns', () => {
    const model = createOrthodonticDemo(),
      material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    for (const target of model.teeth) {
      const before = Array.from(target.geometry.getAttribute('position').array);
      const geometry = createAttachmentGeometry(target, settings()),
        direction = new THREE.Vector3(...target.buccal);
      const hit = new THREE.Raycaster(
        direction.clone().multiplyScalar(40),
        direction.clone().negate(),
      ).intersectObject(new THREE.Mesh(target.geometry, material))[0];
      const positions = geometry.getAttribute('position'),
        base: number[] = [];
      for (let i = 0; i < positions.count; i++)
        base.push(
          new THREE.Vector3().fromBufferAttribute(positions, i).sub(hit.point).dot(direction),
        );
      expect(Math.min(...base)).toBeCloseTo(-0.03, 5);
      expect(Math.max(...base)).toBeCloseTo(0.97, 5);
      expect(Array.from(target.geometry.getAttribute('position').array)).toEqual(before);
      geometry.dispose();
      target.geometry.dispose();
      target.rootGeometry?.dispose();
    }
    model.gums.forEach(g => g.geometry.dispose());
    material.dispose();
  });

  it('stays registered to the crown under translation, rotation and stage transforms', () => {
    const target = tooth(true),
      geometry = createAttachmentGeometry(target, settings({ shape: 'beveled', rotation: 25 }));
    const positions = geometry.getAttribute('position'),
      group = new THREE.Group(),
      attachment = new THREE.Mesh(geometry);
    group.add(attachment);
    group.position.fromArray(target.position).add(new THREE.Vector3(2, -1, 3));
    group.rotation.set(0.2, -0.4, 0.7);
    group.updateMatrixWorld(true);
    for (const i of [0, 12, positions.count - 1]) {
      const original = new THREE.Vector3().fromBufferAttribute(positions, i);
      const expected = original.clone().applyQuaternion(group.quaternion).add(group.position);
      expect(attachment.localToWorld(original).distanceTo(expected)).toBeLessThan(1e-9);
    }
    geometry.dispose();
    target.geometry.dispose();
  });

  it('reports uncalibrated teeth and positions outside the crown instead of floating an attachment', () => {
    const target = tooth();
    expect(() => createAttachmentGeometry({ ...target, calibrated: false }, settings())).toThrow(
      /Calibrate tooth/,
    );
    expect(() => createAttachmentGeometry(target, settings({ offsetMesial: 5 }))).toThrow(
      /misses tooth.*Reduce/i,
    );
    target.geometry.dispose();
  });
});
