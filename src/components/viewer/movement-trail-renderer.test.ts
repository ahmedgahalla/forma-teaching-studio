// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Color, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Sprite, Vector3 } from 'three';
import { dentalStagePalette } from '@/lib/dental-surface';
import { Line2 } from 'three/addons/lines/Line2.js';
import type { MovementTrail } from '@/lib/movement-trails';
import { createMovementTrailRenderer } from './movement-trail-renderer';

const fillText = vi.fn();
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    fillText,
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

function setup(toothId = '11', roots = true) {
  const camera = new PerspectiveCamera(40, 1.5, 0.1, 1000);
  camera.position.z = 50;
  camera.updateMatrixWorld();
  const trail: MovementTrail = {
    toothId,
    crownPoint: [0, 1, 0],
    rootPoint: roots ? [0, -1, 0] : null,
    progress: [0, 0.5, 1],
    crown: new Float32Array([0, 1, 0, 1, 1, 0, 2, 1, 0]),
    root: roots ? new Float32Array([0, -1, 0, 1, -1, 0, 2, -1, 0]) : null,
  };
  const renderer = createMovementTrailRenderer(camera);
  renderer.setTrail(trail);
  const tooth = new Group();
  const display = { movementTrail: trail, trailProgress: 0, selected: toothId, roots, opening: 0 };
  const crown = renderer.group.children[0] as Group;
  const root = renderer.group.children[1] as Group;
  const render = (progress: number) => {
    display.trailProgress = progress;
    tooth.position.set(progress * 2, toothId[0] === '3' ? -display.opening : 0, 0);
    tooth.updateMatrixWorld();
    renderer.update(display, tooth, 900, 600);
    renderer.group.updateMatrixWorld(true);
  };
  return { camera, trail, renderer, tooth, display, crown, root, render };
}

function line(group: Group) {
  return group.children[0] as Line2;
}
function marker(group: Group) {
  return group.children[1] as Mesh;
}
function label(group: Group) {
  return group.children[2] as Sprite;
}
function segmentEnd(group: Group, index: number) {
  return new Vector3().fromBufferAttribute(line(group).geometry.getAttribute('instanceEnd'), index);
}

describe('crown/root movement trail rendering', () => {
  it('keeps theme contrast while changing existing line and marker materials in place', () => {
    const s = setup();
    const geometry = line(s.crown).geometry;
    const material = line(s.crown).material;
    for (const palette of [dentalStagePalette.clinical, dentalStagePalette.midnight]) {
      s.renderer.setPalette(palette);
      const luminance = (value: string) => {
        const color = new Color(value);
        return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
      };
      for (const [group, color] of [
        [s.crown, palette.selected],
        [s.root, palette.trace],
      ] as const) {
        expect(line(group).material.color.getHexString()).toBe(color.slice(1));
        expect((marker(group).material as MeshBasicMaterial).color.getHexString()).toBe(
          color.slice(1),
        );
        const a = luminance(color),
          b = luminance(palette.center);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThan(3);
      }
      expect(line(s.crown).geometry).toBe(geometry);
      expect(line(s.crown).material).toBe(material);
    }
    s.renderer.dispose();
  });
  it('draws only earlier samples and the exact current endpoint, including reverse and seek', () => {
    const s = setup();
    s.render(0);
    expect(line(s.crown).geometry.instanceCount).toBe(0);
    expect(marker(s.crown).position.toArray()).toEqual([0, 1, 0]);
    s.render(0.75);
    expect(line(s.crown).geometry.instanceCount).toBe(2);
    expect(segmentEnd(s.crown, 0).toArray()).toEqual([1, 1, 0]);
    expect(segmentEnd(s.crown, 1).toArray()).toEqual([1.5, 1, 0]);
    s.render(0.25);
    expect(line(s.crown).geometry.instanceCount).toBe(1);
    expect(segmentEnd(s.crown, 0).toArray()).toEqual([0.5, 1, 0]);
    expect(segmentEnd(s.crown, 1).toArray()).toEqual([2, 1, 0]);
    s.render(1);
    expect(segmentEnd(s.crown, 0).toArray()).toEqual([1, 1, 0]);
    expect(segmentEnd(s.crown, 1).toArray()).toEqual([2, 1, 0]);
    s.render(0.5);
    expect(line(s.crown).geometry.instanceCount).toBe(1);
    expect(segmentEnd(s.crown, 0).toArray()).toEqual([1, 1, 0]);
    expect(s.trail.crown).toEqual(new Float32Array([0, 1, 0, 1, 1, 0, 2, 1, 0]));
    s.render(0);
    expect(line(s.crown).visible).toBe(false);
    expect(marker(s.crown).position.toArray()).toEqual([0, 1, 0]);
    s.renderer.dispose();
  });

  it('uses the displayed tooth matrix for rotated crown and root endpoints and offsets opening once', () => {
    const s = setup('31');
    s.display.opening = 8;
    s.tooth.rotation.z = Math.PI / 2;
    s.render(0.25);
    const crownWorld = new Vector3()
      .fromArray(s.trail.crownPoint)
      .applyMatrix4(s.tooth.matrixWorld);
    const rootWorld = new Vector3().fromArray(s.trail.rootPoint!).applyMatrix4(s.tooth.matrixWorld);
    expect(marker(s.crown).getWorldPosition(new Vector3()).distanceTo(crownWorld)).toBeLessThan(
      1e-6,
    );
    expect(marker(s.root).getWorldPosition(new Vector3()).distanceTo(rootWorld)).toBeLessThan(1e-6);
    expect(
      segmentEnd(s.crown, 0).applyMatrix4(s.renderer.group.matrixWorld).distanceTo(crownWorld),
    ).toBeLessThan(1e-6);
    expect(
      segmentEnd(s.root, 0).applyMatrix4(s.renderer.group.matrixWorld).distanceTo(rootWorld),
    ).toBeLessThan(1e-6);
    expect(s.renderer.group.position.y).toBe(-8);
    s.display.opening = 12;
    s.render(0.25);
    expect(marker(s.crown).getWorldPosition(new Vector3()).y).toBeCloseTo(-12);
    const starts = line(s.crown).geometry.getAttribute('instanceStart');
    expect(starts.getY(0)).toBe(1);
    s.renderer.dispose();
  });

  it('uses shape, pattern and in-canvas text as well as colour, with CSS-sized labels and lines', () => {
    const s = setup();
    s.render(0.75);
    expect(fillText).toHaveBeenCalledWith('Crown point', 27, 42);
    expect(fillText).toHaveBeenCalledWith('Root point', 27, 42);
    expect(label(s.crown).name).toBe('Crown point');
    expect(label(s.root).name).toBe('Root point');
    expect(marker(s.crown).geometry.type).toBe('SphereGeometry');
    expect(marker(s.root).geometry.type).toBe('CircleGeometry');
    expect(marker(s.root).geometry.getAttribute('position').count).toBe(6);
    expect(line(s.crown).material.dashed).toBe(false);
    expect(line(s.root).material.dashed).toBe(true);
    expect(line(s.crown).material.color.equals(line(s.root).material.color)).toBe(false);
    expect(line(s.crown).material.resolution.toArray()).toEqual([900, 600]);
    const firstScale = label(s.crown).scale.x;
    s.camera.position.z = 100;
    s.camera.updateMatrixWorld();
    s.render(0.75);
    expect(label(s.crown).scale.x).toBeCloseTo(firstScale * 2);
    s.renderer.update(s.display, s.tooth, 1800, 1200);
    expect(label(s.crown).scale.x).toBeCloseTo(firstScale);
    expect(line(s.crown).material.linewidth).toBe(2.6);
    s.renderer.dispose();
  });

  it('hides roots independently and suppresses stale, hidden, mismatched, and inactive paths', () => {
    const s = setup();
    s.render(0.5);
    expect(s.renderer.group.visible).toBe(true);
    s.display.roots = false;
    s.render(0.5);
    expect(s.crown.visible).toBe(true);
    expect(s.root.visible).toBe(false);
    s.display.roots = true;
    s.render(0.5);
    expect(s.root.visible).toBe(true);
    s.tooth.visible = false;
    s.render(0.5);
    expect(s.renderer.group.visible).toBe(false);
    s.tooth.visible = true;
    s.display.selected = '12';
    s.render(0.5);
    expect(s.renderer.group.visible).toBe(false);
    s.display.selected = '11';
    s.renderer.update(s.display, s.tooth, 900, 600, true);
    expect(s.renderer.group.visible).toBe(false);
    s.renderer.update(s.display, undefined, 900, 600);
    expect(s.renderer.group.visible).toBe(false);
    s.renderer.update({ ...s.display, movementTrail: { ...s.trail } }, s.tooth, 900, 600);
    expect(s.renderer.group.visible).toBe(false);
    s.renderer.update({ ...s.display, movementTrail: null }, s.tooth, 900, 600);
    expect(s.renderer.group.visible).toBe(false);
    s.renderer.setTrail(null);
    s.render(0.5);
    expect(s.renderer.group.visible).toBe(false);
    s.renderer.dispose();
    const rootless = setup('11', false);
    rootless.display.roots = true;
    rootless.render(0.5);
    expect(rootless.crown.visible).toBe(true);
    expect(rootless.root.visible).toBe(false);
    rootless.renderer.dispose();
  });

  it('keeps a stationary reference point but hides its zero-length line independently', () => {
    const s = setup();
    s.trail.rootPoint = [0, 0, 0];
    s.trail.root = new Float32Array(9);
    s.trail.crownPoint = [0, 2, 0];
    s.trail.crown = new Float32Array([0, 2, 0, -Math.SQRT2, Math.SQRT2, 0, -2, 0, 0]);
    s.renderer.setTrail(null);
    s.renderer.setTrail(s.trail);
    s.display.trailProgress = 1;
    s.tooth.rotation.z = Math.PI / 2;
    s.tooth.updateMatrixWorld();
    s.renderer.update(s.display, s.tooth, 900, 600);
    expect(s.root.visible).toBe(true);
    expect(marker(s.root).position.toArray()).toEqual([0, 0, 0]);
    expect(line(s.root).visible).toBe(false);
    expect(line(s.root).geometry.instanceCount).toBe(0);
    expect(line(s.crown).visible).toBe(true);
    s.renderer.dispose();
  });

  it('reuses buffers and distances on every frame and disposes replaced/final resources', () => {
    const s = setup();
    const geometry = line(s.crown).geometry;
    const position = geometry.getAttribute('instanceStart');
    const distance = geometry.getAttribute('instanceDistanceEnd');
    const computeDistances = vi.spyOn(line(s.root), 'computeLineDistances');
    const setPositions = vi.spyOn(geometry, 'setPositions');
    const disposeOld = vi.spyOn(geometry, 'dispose');
    for (let i = 0; i < 100; i++) s.render((i % 17) / 16);
    expect(line(s.crown).geometry).toBe(geometry);
    expect(geometry.getAttribute('instanceStart')).toBe(position);
    expect(geometry.getAttribute('instanceDistanceEnd')).toBe(distance);
    expect(computeDistances).not.toHaveBeenCalled();
    expect(setPositions).not.toHaveBeenCalled();
    s.renderer.setTrail(s.trail);
    expect(disposeOld).not.toHaveBeenCalled();
    s.renderer.setTrail({ ...s.trail });
    expect(disposeOld).toHaveBeenCalledOnce();
    const disposers = [s.crown, s.root].flatMap(group => [
      vi.spyOn(line(group).geometry, 'dispose'),
      vi.spyOn(line(group).material, 'dispose'),
      vi.spyOn(marker(group).geometry, 'dispose'),
      vi.spyOn(marker(group).material as import('three').Material, 'dispose'),
      vi.spyOn(label(group).material, 'dispose'),
      vi.spyOn(label(group).material.map!, 'dispose'),
    ]);
    const scene = new Group();
    scene.add(s.renderer.group);
    s.renderer.dispose();
    expect(scene.children).toHaveLength(0);
    for (const dispose of disposers) expect(dispose).toHaveBeenCalledOnce();
  });
});
