import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { gumSurfaceDistance } from './gum-surface-distance';

it('matches an exhaustive nearest-vertex search across separate crown/root surfaces', () => {
  const values = Array.from({ length: 180 }, (_, i) => Math.sin(i * 7.31) * 5);
  const crown = new BufferGeometry().setAttribute(
    'position',
    new Float32BufferAttribute(values.slice(0, 90), 3),
  );
  const root = new BufferGeometry().setAttribute(
    'position',
    new Float32BufferAttribute(values.slice(90), 3),
  );
  const distance = gumSurfaceDistance([crown, root]);
  const points = [crown, root].flatMap(geometry => {
    const attr = geometry.getAttribute('position');
    return Array.from({ length: attr.count }, (_, i) => new Vector3().fromBufferAttribute(attr, i));
  });
  for (let i = 0; i < 30; i++) {
    const target = new Vector3(Math.cos(i) * 10, Math.sin(i * 2) * 4, i / 3 - 5);
    const expected = Math.min(...points.map(point => point.distanceTo(target)));
    expect(distance(target, 30)).toBeCloseTo(expected, 12);
    expect(distance(target, 1)).toBeCloseTo(Math.min(expected, 1), 12);
  }
  expect([...crown.getAttribute('position').array, ...root.getAttribute('position').array]).toEqual(
    Array.from(new Float32Array(values)),
  );
  crown.dispose();
  root.dispose();
});

it('handles coincident surface vertices without changing its distance limit', () => {
  const geometry = new BufferGeometry().setAttribute(
    'position',
    new Float32BufferAttribute(Array(90).fill(0), 3),
  );
  const distance = gumSurfaceDistance([geometry]);
  expect(distance(new Vector3(0, 0, 0), 8)).toBe(0);
  expect(distance(new Vector3(3, 4, 0), 8)).toBe(5);
  expect(distance(new Vector3(20, 0, 0), 8)).toBe(8);
  geometry.dispose();
});
