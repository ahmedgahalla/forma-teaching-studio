import { Mesh, type BufferGeometry, type Material, type Object3D, type Scene } from 'three';
import type { DentalCase } from '@/lib/geometry';
import type { Vec3 } from '@/lib/model';
import { toothArch } from '@/lib/appliances';
import { createGumFollower } from '@/lib/gum-follow';
import { applyJawPoint, applyJawQuaternion } from '@/lib/jaw-opening';

type Display = {
  gums: boolean;
  roots: boolean;
  opening: number;
  jawOpen?: boolean;
  arch: string;
  isolateSelection?: boolean;
};
export function createGumPresentation(
  model: DentalCase,
  groups: ReadonlyMap<string, Object3D>,
  material: Material,
  surface: (geometry: BufferGeometry, axis: Vec3, tissue: 'gingiva') => BufferGeometry,
  scene: Scene,
) {
  const meshes = model.gums.map(gum => {
    const geometry = surface(gum.geometry, [0, gum.arch === 'upper' ? -1 : 1, 0], 'gingiva');
    const mesh = new Mesh(geometry, material);
    mesh.position.fromArray(gum.position);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const follow =
      model.demo && model.asset && gum.arch
        ? createGumFollower(
            gum,
            model.teeth.filter(tooth => toothArch(tooth.id) === gum.arch),
            geometry,
            groups,
          )
        : null;
    return { mesh, gum, follow };
  });
  return {
    meshes,
    update(display: Display, cutawayId?: string) {
      for (const { mesh, gum, follow } of meshes) {
        mesh.castShadow = !display.roots && !cutawayId;
        mesh.visible =
          display.gums &&
          (cutawayId
            ? gum.arch === toothArch(cutawayId)
            : !display.isolateSelection &&
              (!gum.arch || display.arch === 'both' || gum.arch === display.arch));
        mesh.position.fromArray(gum.position);
        mesh.quaternion.identity();
        if (gum.arch === 'lower') {
          applyJawPoint(mesh.position, display.jawOpen).y -= display.opening;
          applyJawQuaternion(mesh.quaternion, display.jawOpen);
        }
        if (mesh.visible) follow?.(display.opening, display.jawOpen);
      }
    },
  };
}
