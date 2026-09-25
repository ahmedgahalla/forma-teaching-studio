import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { perspectiveFitDistance } from './camera-fit';

describe('perspective fit for every dental view', () => {
  const bounds = new Box3(new Vector3(-34, -22, -28), new Vector3(38, 30, 35));
  const views = [
    ['perspective', new Vector3(0.38, 0.2, 1.3)],
    ['front', new Vector3(0, 0, 1)],
    ['right', new Vector3(-1, 0.03, 0)],
    ['upper occlusal', new Vector3(0, -1, 0.001)],
    ['lower occlusal', new Vector3(0, 1, 0.001)],
  ] as const;

  it.each(views)(
    'keeps all corners inside the %s camera with margin at desktop and portrait aspects',
    (_, direction) => {
      for (const aspect of [850 / 525, 2.5, 0.55]) {
        const camera = new PerspectiveCamera(34, aspect, 0.1, 10000);
        const center = bounds.getCenter(new Vector3());
        camera.position
          .copy(center)
          .addScaledVector(
            direction.clone().normalize(),
            perspectiveFitDistance(bounds, direction, camera.up, camera.fov, aspect),
          );
        camera.lookAt(center);
        camera.updateMatrixWorld(true);
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
              const projected = new Vector3(x, y, z).project(camera);
              expect(Math.abs(projected.x)).toBeLessThanOrEqual(1 / 1.18 + 1e-10);
              expect(Math.abs(projected.y)).toBeLessThanOrEqual(1 / 1.18 + 1e-10);
              expect(projected.z).toBeGreaterThan(-1);
              expect(projected.z).toBeLessThan(1);
            }
      }
    },
  );

  it('accounts for near-corner depth, rather than only fitting the central plane', () => {
    const deep = new Box3(new Vector3(-10, -10, -50), new Vector3(10, 10, 50));
    const distance = perspectiveFitDistance(
      deep,
      new Vector3(0, 0, 1),
      new Vector3(0, 1, 0),
      90,
      1,
      1,
    );
    expect(distance).toBeCloseTo(60, 12);
  });

  it('is invariant to world offset and direction magnitude, and leaves inputs unchanged', () => {
    const direction = new Vector3(0.38, 0.2, 1.3),
      up = new Vector3(0, 1, 0);
    const snapshot = JSON.stringify({ bounds, direction, up });
    const distance = perspectiveFitDistance(bounds, direction, up, 34, 1.6);
    const shifted = bounds.clone().translate(new Vector3(1000, -250, 13));
    expect(
      perspectiveFitDistance(shifted, direction.clone().multiplyScalar(9), up, 34, 1.6),
    ).toBeCloseTo(distance, 10);
    expect(JSON.stringify({ bounds, direction, up })).toBe(snapshot);
  });

  it('requires more distance when a horizontal field of view shrinks', () => {
    const wide = new Box3(new Vector3(-40, -4, -2), new Vector3(40, 4, 2));
    const landscape = perspectiveFitDistance(
      wide,
      new Vector3(0, 0, 1),
      new Vector3(0, 1, 0),
      34,
      2,
    );
    const portrait = perspectiveFitDistance(
      wide,
      new Vector3(0, 0, 1),
      new Vector3(0, 1, 0),
      34,
      0.5,
    );
    expect(portrait).toBeGreaterThan(landscape * 3.8);
  });
});
