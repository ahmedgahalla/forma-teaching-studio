import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { createGumNormalUpdater } from './gum-normals';

it('rotates custom smooth normals with a changed face rather than replacing their authored tilt', () => {
  const geometry = new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
    .setAttribute('normal', new Float32BufferAttribute([0, 0.6, 0.8, 0, 0.6, 0.8, 0, 0.6, 0.8], 3))
    .setIndex([0, 1, 2]);
  const authored = geometry.getAttribute('normal').array.slice();
  const normals = createGumNormalUpdater(geometry);
  geometry.getAttribute('position').setXYZ(2, 0, 0, 1);
  normals.update(new Uint32Array([2]), 1);
  for (let i = 0; i < 3; i++)
    expect(
      new Vector3()
        .fromBufferAttribute(geometry.getAttribute('normal'), i)
        .distanceTo(new Vector3(0, -0.8, 0.6)),
    ).toBeLessThan(1e-6);
  normals.reset();
  expect(geometry.getAttribute('normal').array).toEqual(authored);
  geometry.dispose();
});
