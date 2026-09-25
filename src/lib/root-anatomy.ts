import type { Vec3 } from './model';

/** Centers use the crown/root's shared local case-XYZ frame, in millimetres.
 * Radii are along rootward × buccal, then buccal. These are display envelopes,
 * not measured periodontal thickness or patient anatomy. */
export type RootSection = { center: Vec3; radii: [number, number] };
export type RootAnatomy = { version: 1; trunk?: RootSection[]; branches: RootSection[][] };

export function validateRootAnatomy(raw: unknown, occlusal?: Vec3): RootAnatomy {
  const fail = (): never => {
    throw new Error('Invalid synthetic root anatomy metadata.');
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail();
  const value = raw as Record<string, unknown>;
  if (
    value.version !== 1 ||
    !Array.isArray(value.branches) ||
    value.branches.length < 1 ||
    value.branches.length > 3
  )
    return fail();
  const sections = (input: unknown): RootSection[] => {
    if (!Array.isArray(input) || input.length < 2 || input.length > 64) return fail();
    const result = input.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return fail();
      const { center, radii } = item as Record<string, unknown>;
      if (
        !Array.isArray(center) ||
        center.length !== 3 ||
        !center.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 80)
      )
        return fail();
      if (
        !Array.isArray(radii) ||
        radii.length !== 2 ||
        !radii.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0.015 && n <= 12)
      )
        return fail();
      return { center: [...center] as Vec3, radii: [...radii] as [number, number] };
    });
    for (let i = 1; i < result.length; i++) {
      const difference = result[i].center.map((n, k) => n - result[i - 1].center[k]);
      const distance = Math.hypot(...difference);
      if (
        distance < 0.00001 ||
        distance > 15 ||
        (occlusal && difference.reduce((sum, n, k) => sum - n * occlusal[k], 0) <= 0.00001)
      )
        return fail();
    }
    return result;
  };
  return {
    version: 1,
    ...(value.trunk !== undefined ? { trunk: sections(value.trunk) } : {}),
    branches: value.branches.map(sections),
  };
}
