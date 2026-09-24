import { Euler, MathUtils, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { DentalCase, DentalTooth } from './geometry';
import { emptyPose, type Transforms, type Vec3 } from './model';

export function toothMatrix(tooth: DentalTooth, transforms: Transforms): Matrix4 {
  const pose = transforms[tooth.id] || emptyPose();
  return new Matrix4().compose(new Vector3(...tooth.position).add(new Vector3(...pose.translation)), new Quaternion().setFromEuler(new Euler(...pose.rotation.map(MathUtils.degToRad) as Vec3)), new Vector3(1, 1, 1));
}
export type SurfaceIntersection = { a: string; b: string };
const trees = new WeakMap<BufferGeometry, MeshBVH>();
function surfaceTree(geometry: BufferGeometry): MeshBVH {
  let tree = trees.get(geometry);
  if (!tree) { tree = new MeshBVH(geometry, { indirect: true }); trees.set(geometry, tree); }
  return tree;
}
function intersectsUsingBothTrees(tree: MeshBVH, geometry: BufferGeometry, relative: Matrix4) {
  // intersectsGeometry otherwise scans every triangle of its second mesh for each
  // candidate leaf. Supply our indirect BVH synchronously without taking ownership
  // of a renderer's existing boundsTree or changing any mesh attribute/index.
  const prior = Object.getOwnPropertyDescriptor(geometry, 'boundsTree');
  if (prior && !prior.configurable && (!('writable' in prior) || !prior.writable)) return tree.intersectsGeometry(geometry, relative);
  const other = surfaceTree(geometry);
  Object.defineProperty(geometry, 'boundsTree', prior && !prior.configurable ? { value: other } : { value: other, writable: true, configurable: true });
  try { return tree.intersectsGeometry(geometry, relative); }
  finally { if (prior) Object.defineProperty(geometry, 'boundsTree', prior); else delete geometry.boundsTree; }
}
/** Triangle-surface intersection at final poses; not penetration depth or tissue clearance. */
export function findSurfaceIntersections(model: DentalCase, transforms: Transforms): SurfaceIntersection[] {
  const pieces = model.teeth.map(tooth => { if (!tooth.geometry.boundingBox) tooth.geometry.computeBoundingBox(); const matrix = toothMatrix(tooth, transforms); return { tooth, matrix, box: tooth.geometry.boundingBox!.clone().applyMatrix4(matrix) }; });
  const result: SurfaceIntersection[] = [];
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = pieces[i], b = pieces[j]; if (!a.box.intersectsBox(b.box)) continue;
    const tree = surfaceTree(a.tooth.geometry);
    const relative = a.matrix.clone().invert().multiply(b.matrix);
    if (intersectsUsingBothTrees(tree, b.tooth.geometry, relative)) result.push({ a: a.tooth.id, b: b.tooth.id });
  }
  return result;
}

export function centreDistance(model: DentalCase, transforms: Transforms, a: string, b: string) {
  const first = model.teeth.find(t => t.id === a), second = model.teeth.find(t => t.id === b);
  if (!first || !second) return null;
  const p = new Vector3(...first.position).add(new Vector3(...(transforms[a]?.translation || [0, 0, 0])));
  const q = new Vector3(...second.position).add(new Vector3(...(transforms[b]?.translation || [0, 0, 0])));
  return p.distanceTo(q);
}
export function archSpans(model: DentalCase, transforms: Transforms, original: Transforms = {}) {
  return [{ name: 'Upper canine centres', a: '13', b: '23' }, { name: 'Lower canine centres', a: '43', b: '33' }, { name: 'Upper first-molar centres', a: '16', b: '26' }, { name: 'Lower first-molar centres', a: '46', b: '36' }].map(pair => ({ ...pair, initial: centreDistance(model, original, pair.a, pair.b), final: centreDistance(model, transforms, pair.a, pair.b) })).filter(pair => pair.initial !== null && pair.final !== null);
}
export function movementRows(model: DentalCase, transforms: Transforms, original: Transforms = {}) {
  return model.teeth.map(tooth => {
    const pose = transforms[tooth.id] || emptyPose(), start = original[tooth.id] || emptyPose();
    const delta = pose.translation.map((value, axis) => value - start.translation[axis]);
    const q = new Quaternion().setFromEuler(new Euler(...pose.rotation.map(MathUtils.degToRad) as Vec3));
    const initial = new Quaternion().setFromEuler(new Euler(...start.rotation.map(MathUtils.degToRad) as Vec3));
    return { id: tooth.id, name: tooth.name, x: delta[0], y: delta[1], z: delta[2], displacement: Math.hypot(...delta), orientationChange: MathUtils.radToDeg(q.angleTo(initial)) };
  });
}
