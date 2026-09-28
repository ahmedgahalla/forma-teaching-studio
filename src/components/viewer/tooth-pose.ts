import { Euler, MathUtils, type Object3D } from 'three';
import { toothArch } from '@/lib/appliances';
import type { Pose, Tooth } from '@/lib/model';
import type { ViewerProps } from './viewer-types';
import { applyJawPoint, applyJawQuaternion } from '@/lib/jaw-opening';

type PoseDisplay = Pick<
  ViewerProps,
  'transforms' | 'ghostTransforms' | 'opening' | 'ghost' | 'roots' | 'jawOpen'
>;

/** Reuse rotation scratch space for both displayed and reference poses on every frame. */
export function createToothPoseUpdater(
  groups: ReadonlyMap<string, Object3D>,
  ghosts: ReadonlyMap<string, Object3D>,
  rootGhosts: ReadonlyMap<string, Object3D>,
  roots: ReadonlyMap<string, Object3D>,
) {
  const rotation = new Euler();
  const setPose = (
    object: Object3D,
    tooth: Tooth,
    pose: Pose | undefined,
    opening: number,
    jawOpen: boolean,
  ) => {
    object.position.set(
      tooth.position[0] + (pose?.translation[0] ?? 0),
      tooth.position[1] + (pose?.translation[1] ?? 0),
      tooth.position[2] + (pose?.translation[2] ?? 0),
    );
    if (pose) {
      rotation.set(
        pose.rotation[0] * MathUtils.DEG2RAD,
        pose.rotation[1] * MathUtils.DEG2RAD,
        pose.rotation[2] * MathUtils.DEG2RAD,
      );
      object.quaternion.setFromEuler(rotation);
    } else object.quaternion.identity();
    applyJawPoint(object.position, jawOpen).y -= opening;
    applyJawQuaternion(object.quaternion, jawOpen);
  };
  return (tooth: Tooth, display: PoseDisplay) => {
    const group = groups.get(tooth.id)!,
      original = ghosts.get(tooth.id)!;
    const lowerOpening = toothArch(tooth.id) === 'lower' ? display.opening : 0;
    const jawOpen = toothArch(tooth.id) === 'lower' && !!display.jawOpen;
    setPose(group, tooth, display.transforms[tooth.id], lowerOpening, jawOpen);
    group.updateMatrixWorld(true);
    setPose(original, tooth, display.ghostTransforms?.[tooth.id], lowerOpening, jawOpen);
    original.visible =
      group.visible &&
      display.ghost &&
      (original.position.distanceToSquared(group.position) > 1e-8 ||
        original.quaternion.angleTo(group.quaternion) > 1e-5);
    const shownRoot = roots.get(tooth.id);
    if (shownRoot) shownRoot.visible = display.roots;
    const root = rootGhosts.get(tooth.id);
    if (root) {
      root.position.copy(original.position);
      root.quaternion.copy(original.quaternion);
      root.visible = original.visible && display.roots;
    }
  };
}
