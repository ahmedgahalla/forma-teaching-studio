import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { LECTURE_CAMERA_MARGIN, perspectiveFitDistance, perspectiveFitFrame } from './camera-fit';
import { VOICE_HUD_SAFE_AREA } from './lecture-layout';

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

  it('fits actual arch points without combining posterior width with anterior depth', () => {
    const box = new Box3(new Vector3(-30, -5, -20), new Vector3(30, 5, 20));
    const points = [
      new Vector3(-30, -5, -20),
      new Vector3(30, 5, -20),
      new Vector3(-8, -5, 20),
      new Vector3(8, 5, 20),
    ];
    const original = points.map(point => point.toArray());
    const direction = new Vector3(0, 0, 1),
      up = new Vector3(0, 1, 0);
    const distance = perspectiveFitDistance(box, direction, up, 90, 1, 1, points);
    expect(distance).toBeCloseTo(28);
    expect(perspectiveFitDistance(box, direction, up, 90, 1, 1)).toBeCloseTo(50);
    expect(points.map(point => point.toArray())).toEqual(original);
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

  it.each([0.45, 1.4, 2.9])(
    'centers asymmetric points at the closest fitting distance: %f',
    aspect => {
      const points = [
        new Vector3(-20, -10, -18),
        new Vector3(30, 16, -5),
        new Vector3(-4, -6, 20),
        new Vector3(3, 8, 14),
      ];
      const box = new Box3().setFromPoints(points),
        direction = new Vector3(0.3, 0.2, 1).normalize(),
        up = new Vector3(0, 1, 0),
        before = JSON.stringify({ points, box, direction, up });
      const fit = perspectiveFitFrame(
        box,
        direction,
        up,
        34,
        aspect,
        LECTURE_CAMERA_MARGIN,
        points,
        0,
      );
      const camera = new PerspectiveCamera(34, aspect, 0.1, 1000);
      camera.position.copy(fit.target).addScaledVector(direction, fit.distance);
      camera.lookAt(fit.target);
      camera.updateMatrixWorld();
      const projected = points.map(point => point.clone().project(camera));
      const x = projected.map(point => point.x),
        y = projected.map(point => point.y);
      expect(Math.max(...x) + Math.min(...x)).toBeCloseTo(0, 7);
      expect(Math.max(...y) + Math.min(...y)).toBeCloseTo(0, 7);
      expect(Math.max(...x.map(Math.abs))).toBeLessThanOrEqual(0.78 + 1e-10);
      expect(Math.max(...y.map(Math.abs))).toBeLessThanOrEqual(0.9 + 1e-10);
      expect(Math.max(Math.max(...x) / 0.78, Math.max(...y) / 0.9)).toBeCloseTo(1);
      expect(fit.distance).toBeLessThanOrEqual(
        perspectiveFitDistance(box, direction, up, 34, aspect, LECTURE_CAMERA_MARGIN, points),
      );
      expect(JSON.stringify({ points, box, direction, up })).toBe(before);
    },
  );

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

  it.each([0, VOICE_HUD_SAFE_AREA, 0.3])(
    'fits and centers above a bottom safe area of %f',
    bottom => {
      const direction = new Vector3(0.3, 0.2, 1).normalize();
      const camera = new PerspectiveCamera(34, 2, 0.1, 10000);
      const frame = perspectiveFitFrame(
        bounds,
        direction,
        camera.up,
        34,
        2,
        LECTURE_CAMERA_MARGIN,
        undefined,
        bottom,
      );
      camera.position.copy(frame.target).addScaledVector(direction, frame.distance);
      camera.lookAt(frame.target);
      camera.updateMatrixWorld();
      const ys = [];
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const point = new Vector3(x, y, z).project(camera);
            ys.push(point.y);
            expect(Math.abs(point.x)).toBeLessThanOrEqual(0.78 + 1e-10);
          }
      const halfHeight = (1 - bottom) / LECTURE_CAMERA_MARGIN.vertical;
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(bottom - halfHeight - 1e-10);
      expect(Math.max(...ys)).toBeLessThanOrEqual(bottom + halfHeight + 1e-10);
      expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(bottom, 7);
      expect((1 - Math.min(...ys)) / 2).toBeLessThan(1 - bottom);
    },
  );

  it.each([-0.1, 1, NaN])('rejects an invalid camera safe area: %s', bottom => {
    expect(() =>
      perspectiveFitFrame(
        bounds,
        new Vector3(0, 0, 1),
        new Vector3(0, 1, 0),
        34,
        2,
        LECTURE_CAMERA_MARGIN,
        undefined,
        bottom,
      ),
    ).toThrow('Invalid camera safe area.');
  });

  it('fills 78% of width without imposing the same margin on a tall root silhouette', () => {
    const direction = new Vector3(0, 0, 1),
      up = new Vector3(0, 1, 0);
    for (const [width, height, aspect] of [
      [70, 20, 2],
      [70, 55, 2],
      [70, 55, 0.55],
    ]) {
      const box = new Box3(
        new Vector3(-width / 2, -height / 2, -5),
        new Vector3(width / 2, height / 2, 5),
      );
      const camera = new PerspectiveCamera(34, aspect, 0.1, 1000);
      camera.position.z = perspectiveFitDistance(
        box,
        direction,
        up,
        34,
        aspect,
        LECTURE_CAMERA_MARGIN,
      );
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const corner = box.max.clone().project(camera);
      expect(corner.x).toBeLessThanOrEqual(0.78 + 1e-10);
      expect(corner.y).toBeLessThanOrEqual(0.9 + 1e-10);
      expect(Math.max(corner.x / 0.78, corner.y / 0.9)).toBeCloseTo(1);
    }
  });

  it.each([
    { horizontal: 0.9, vertical: 1.2 },
    { horizontal: 1.2, vertical: 0.9 },
    { horizontal: NaN, vertical: 1.2 },
    { horizontal: 1.2, vertical: Infinity },
  ])('rejects invalid per-axis margins: %j', margin => {
    expect(() =>
      perspectiveFitDistance(bounds, new Vector3(0, 0, 1), new Vector3(0, 1, 0), 34, 2, margin),
    ).toThrow('Invalid camera fit parameters.');
  });
});
