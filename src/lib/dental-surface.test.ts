import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  dentalBackdrop,
  dentalCavity,
  dentalStagePalette,
  dentalSurface,
  updateDentalBackdrop,
} from './dental-surface';

describe('display-only dental surfaces', () => {
  it.each(['enamel', 'root', 'gingiva'] as const)(
    'shades %s without changing the source mesh, indexing or measurements',
    tissue => {
      const source = new THREE.BoxGeometry(5, 10, 4),
        original = Array.from(source.getAttribute('position').array),
        normals = Array.from(source.getAttribute('normal').array);
      const display = dentalSurface(source, [0, -1, 0], tissue);
      expect(Array.from(source.getAttribute('position').array)).toEqual(original);
      expect(Array.from(source.getAttribute('normal').array)).toEqual(normals);
      expect(source.getAttribute('color')).toBeUndefined();
      expect(Array.from(display.getAttribute('position').array)).toEqual(original);
      expect(Array.from(display.index!.array)).toEqual(Array.from(source.index!.array));
      expect(Array.from(display.getAttribute('normal').array)).toEqual(normals);
      expect(display.getAttribute('position')).not.toBe(source.getAttribute('position'));
      const colors = Array.from(display.getAttribute('color').array);
      expect(colors.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
      expect(new Set(colors.map(value => value.toFixed(4))).size).toBeGreaterThan(3);
      display.dispose();
      source.dispose();
    },
  );
  it('recognises concave relief, leaves convex surfaces unshaded and reuses the cached field', () => {
    const bowl = new THREE.PlaneGeometry(6, 6, 12, 12),
      positions = bowl.getAttribute('position');
    for (let i = 0; i < positions.count; i++)
      positions.setZ(i, 0.22 * (positions.getX(i) ** 2 + positions.getY(i) ** 2));
    bowl.computeVertexNormals();
    const original = Array.from(positions.array),
      weights = dentalCavity(bowl),
      center = 6 * 13 + 6;
    expect(weights[center]).toBeGreaterThan(0.08);
    expect(dentalCavity(bowl)).toBe(weights);
    expect([...weights].every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
    const scaled = bowl.clone().scale(4, 4, 4);
    expect(dentalCavity(scaled)[center]).toBeCloseTo(weights[center], 5);
    const dome = bowl.clone();
    const domePositions = dome.getAttribute('position');
    for (let i = 0; i < domePositions.count; i++) domePositions.setZ(i, -domePositions.getZ(i));
    dome.computeVertexNormals();
    expect(dentalCavity(dome)[center]).toBe(0);
    expect(Array.from(positions.array)).toEqual(original);
    bowl.dispose();
    scaled.dispose();
    dome.dispose();
  });
  it('follows the anatomical occlusal direction for upper and lower arches', () => {
    const source = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -4, 0),
      new THREE.Vector3(0, 4, 0),
    ]);
    const upper = dentalSurface(source, [0, -1, 0], 'enamel'),
      lower = dentalSurface(source, [0, 1, 0], 'enamel');
    const a = upper.getAttribute('color'),
      b = lower.getAttribute('color');
    expect(a.getX(0)).toBeGreaterThan(a.getX(1));
    expect(a.getX(0)).toBe(b.getX(1));
    expect(a.getZ(0)).toBe(b.getZ(1));
    upper.dispose();
    lower.dispose();
    source.dispose();
  });
  it.each(['midnight', 'clinical'] as const)(
    'creates an opaque %s backdrop with a brighter centre and no external asset',
    theme => {
      const texture = dentalBackdrop(theme),
        data = texture.image.data as Uint8Array,
        size = texture.image.width;
      expect(data.length).toBe(size * size * 4);
      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(data[(Math.floor(size / 2) * size + Math.floor(size / 2)) * 4]).toBeGreaterThan(
        data[0],
      );
      for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
      texture.dispose();
    },
  );
  it('switches the existing backdrop in place and restores its original colours', () => {
    const texture = dentalBackdrop('midnight'),
      data = texture.image.data as Uint8Array;
    const original = data.slice(),
      id = texture.uuid,
      version = texture.version;
    updateDentalBackdrop(texture, 'clinical');
    expect(texture.uuid).toBe(id);
    expect(texture.image.data).toBe(data);
    expect(texture.version).toBeGreaterThan(version);
    expect(data[0]).toBeGreaterThan(original[0] + 100);
    updateDentalBackdrop(texture, 'midnight');
    expect(data).toEqual(original);
    texture.dispose();
  });
  it('keeps fine editing guides legible against both stage palettes', () => {
    const luminance = (value: string) => {
      const color = new THREE.Color(value);
      return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
    };
    for (const palette of Object.values(dentalStagePalette))
      for (const cue of [palette.measurement, palette.trace, palette.curve]) {
        const a = luminance(palette.center),
          b = luminance(cue);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThan(3);
      }
  });
});
