import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  Euler,
  MathUtils,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { createOrthodonticDemo } from './demo';
import { createRemovableRetainer } from './removable-retainer';
import { anatomicalFrame, type Vec3 } from './model';
import { toothMatrix } from './analysis';
import { orderedArchIds, toothArch } from './appliances';

const model = createOrthodonticDemo();
afterAll(() => {
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});
const worldVertex = (object: Object3D, index = 0) =>
  new Vector3()
    .fromBufferAttribute((object as Mesh).geometry.getAttribute('position'), index)
    .applyMatrix4(object.matrixWorld);

describe('removable clear-retainer teaching overlay', () => {
  it('builds lazily, keeps upper/lower pockets distinct and never invents shells for imports', () => {
    const kit = createRemovableRetainer(model),
      imported = createRemovableRetainer({ ...model, demo: false });
    kit.update({}, { visible: false });
    expect(kit.group.children).toHaveLength(0);
    imported.update({}, { visible: true });
    expect(imported.group.visible).toBe(false);
    expect(imported.group.children).toHaveLength(0);
    kit.update({}, { visible: true });
    expect(kit.group.visible).toBe(true);
    for (const arch of ['upper', 'lower'] as const)
      expect(
        kit.group
          .getObjectByName(`clear-retainer-${arch}`)!
          .children.filter(child => child.name.startsWith('retainer-crown-')),
      ).toHaveLength(14);
    expect(kit.group.userData).toMatchObject({
      schematic: true,
      removable: true,
      manufacturing: false,
    });
    expect(kit.group.getObjectByName('lingual-retainer-upper')).toBeUndefined();
    kit.dispose();
    imported.dispose();
  });

  it('generates trimmed transparent crown envelopes and visible margins without altering source geometry', () => {
    const tooth = model.teeth.find(tooth => tooth.id === '11')!,
      before = Array.from(tooth.geometry.getAttribute('position').array);
    const kit = createRemovableRetainer(model);
    kit.update({}, { visible: true });
    const shell = kit.group.getObjectByName('clear-pocket-11') as Mesh,
      edge = kit.group.getObjectByName('clear-margin-11') as Mesh;
    expect(shell.geometry).not.toBe(tooth.geometry);
    expect((shell.material as Material).transparent).toBe(true);
    expect((shell.material as Material).opacity).toBeLessThan(0.4);
    expect((shell.material as Material).depthWrite).toBe(false);
    expect(edge.geometry.getAttribute('position').count).toBeGreaterThan(12);
    const axis = new Vector3(...anatomicalFrame(tooth).occlusal),
      source = tooth.geometry.getAttribute('position');
    let minimum = Infinity;
    for (let i = 0; i < source.count; i++)
      minimum = Math.min(minimum, new Vector3().fromBufferAttribute(source, i).dot(axis));
    const points = shell.geometry.getAttribute('position');
    for (let i = 0; i < points.count; i++)
      expect(new Vector3().fromBufferAttribute(points, i).dot(axis)).toBeGreaterThanOrEqual(
        minimum + 0.4,
      );
    kit.group.traverse(object => {
      const geometry = (object as Mesh).geometry;
      if (geometry)
        expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(
          true,
        );
    });
    expect(Array.from(tooth.geometry.getAttribute('position').array)).toEqual(before);
    kit.dispose();
  });

  it('follows the exact crown matrix under combined translation/rotation and lower display opening', () => {
    const kit = createRemovableRetainer(model),
      tooth = model.teeth.find(tooth => tooth.id === '36')!;
    const transforms = {
      '36': { translation: [2, -1, 0.8] as Vec3, rotation: [12, -21, 7] as Vec3 },
    };
    kit.update(transforms, { visible: true, opening: 8 });
    const mesh = kit.group.getObjectByName('clear-pocket-36') as Mesh;
    const expected = new Vector3()
      .fromBufferAttribute(mesh.geometry.getAttribute('position'), 0)
      .applyMatrix4(toothMatrix(tooth, transforms));
    expected.y -= 8;
    expect(worldVertex(mesh).distanceTo(expected)).toBeLessThan(1e-8);
    const before = worldVertex(kit.group.getObjectByName('clear-pocket-16')!);
    kit.update(transforms, { visible: true, opening: 3 });
    expect(
      worldVertex(kit.group.getObjectByName('clear-pocket-16')!).distanceTo(before),
    ).toBeLessThan(1e-8);
    expect(worldVertex(mesh).y).toBeCloseTo(expected.y + 5, 8);
    kit.dispose();
  });

  it('updates the arch joining ribbons from the same tooth poses without reallocating buffers', () => {
    const kit = createRemovableRetainer(model);
    kit.update({}, { visible: true });
    const first = orderedArchIds(
        model.teeth.filter(tooth => toothArch(tooth.id) === 'upper').map(tooth => tooth.id),
        'upper',
      )[0],
      tooth = model.teeth.find(tooth => tooth.id === first)!;
    const bridge = kit.group.getObjectByName('clear-joins-upper') as Mesh,
      geometry = bridge.geometry;
    const old = worldVertex(bridge),
      quaternion = new Quaternion().setFromEuler(new Euler(0, MathUtils.degToRad(18), 0));
    kit.update({ [first]: { translation: [2, 1, -0.5], rotation: [0, 18, 0] } }, { visible: true });
    const expected = old
      .clone()
      .sub(new Vector3(...tooth.position))
      .applyQuaternion(quaternion)
      .add(new Vector3(...tooth.position))
      .add(new Vector3(2, 1, -0.5));
    expect(worldVertex(bridge).distanceTo(expected)).toBeLessThan(1e-5);
    expect(bridge.geometry).toBe(geometry);
    kit.dispose();
  });

  it('respects arch, visibility and cutaway toggles without showing a fixed lingual wire', () => {
    const kit = createRemovableRetainer(model);
    kit.update({}, { visible: true, arch: 'upper' });
    expect(kit.group.getObjectByName('clear-retainer-upper')!.visible).toBe(true);
    expect(kit.group.getObjectByName('clear-retainer-lower')!.visible).toBe(false);
    kit.update({}, { visible: true, cutaway: true });
    expect(kit.group.visible).toBe(false);
    kit.update({}, { visible: true, arch: 'lower', cutaway: false });
    expect(kit.group.visible).toBe(true);
    expect(kit.group.getObjectByName('clear-retainer-upper')!.visible).toBe(false);
    kit.update({}, { visible: false });
    expect(kit.group.visible).toBe(false);
    kit.dispose();
  });

  it('disposes each owned surface and material once while keeping source anatomy available', () => {
    const sourceDispose = vi.spyOn(model.teeth[0].geometry, 'dispose'),
      kit = createRemovableRetainer(model);
    kit.update({}, { visible: true });
    const geometries = new Set<BufferGeometry>(),
      materials = new Set<Material>();
    kit.group.traverse(object => {
      const mesh = object as Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material)
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          materials.add(material);
    });
    const spies = [...geometries, ...materials].map(resource => vi.spyOn(resource, 'dispose'));
    kit.dispose();
    kit.dispose();
    kit.update({}, { visible: true });
    expect(kit.group.children).toHaveLength(0);
    expect(kit.group.visible).toBe(false);
    spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(sourceDispose).not.toHaveBeenCalled();
    sourceDispose.mockRestore();
  });
});
