import { createOrthodonticDemo } from './demo';
import type { DentalCase } from './geometry';

const schematicModels = new WeakMap<DentalCase, DentalCase>();

/** The socket lesson needs its own authored support profiles; never wrap atlas molar trunks. */
export function workflowAnatomyModel(base: DentalCase, id: string): DentalCase {
  if (id !== 'anatomy' || base.asset !== 'claude-atlas-v1') return base;
  let model = schematicModels.get(base);
  if (!model) {
    model = createOrthodonticDemo();
    model.name = 'Schematic tooth and socket teaching model';
    schematicModels.set(base, model);
  }
  return model;
}
