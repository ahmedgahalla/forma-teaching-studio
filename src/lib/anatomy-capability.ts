import type { DentalCase } from './geometry';

export const SUPPORT_ANATOMY_UNAVAILABLE =
  'This model has crowns, roots and gingiva. Matching bone and ligament overlays are not available; use the Why teeth move lecture for the tissue mechanism.';

/** Atlas roots share a trunk; connected-component sleeves would bridge molar furcations. */
export function supportsTeachingAnatomy(model: DentalCase) {
  return model.demo && model.asset !== 'claude-atlas-v1';
}
