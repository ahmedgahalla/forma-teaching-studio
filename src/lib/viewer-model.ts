import type { DentalCase } from './geometry';

/** Metadata edits reuse meshes; loading a case creates fresh geometry objects. */
export function sameViewerGeometry(previous: DentalCase, next: DentalCase): boolean {
  if (previous.teeth.length !== next.teeth.length || previous.gums.length !== next.gums.length)
    return false;
  const samePosition = (a: number[], b: number[]) => a.every((value, i) => value === b[i]);
  const teeth = new Map(previous.teeth.map(tooth => [tooth.id, tooth]));
  for (const tooth of next.teeth) {
    const before = teeth.get(tooth.id);
    if (
      !before ||
      before.geometry !== tooth.geometry ||
      before.rootGeometry !== tooth.rootGeometry ||
      !samePosition(before.position, tooth.position)
    )
      return false;
  }
  const gums = new Map(previous.gums.map(gum => [gum.id, gum]));
  return next.gums.every(gum => {
    const before = gums.get(gum.id);
    return (
      !!before && before.geometry === gum.geometry && samePosition(before.position, gum.position)
    );
  });
}
