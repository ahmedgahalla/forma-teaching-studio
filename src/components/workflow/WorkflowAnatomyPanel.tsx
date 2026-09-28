import type { ComponentProps } from 'react';
import type { DentalCase } from '@/lib/geometry';
import { supportsTeachingAnatomy, SUPPORT_ANATOMY_UNAVAILABLE } from '@/lib/anatomy-capability';
import AnatomyPanel from '../viewer/AnatomyPanel';

export function WorkflowAnatomyPanel({
  model,
  ...props
}: {
  model: DentalCase;
} & Omit<ComponentProps<typeof AnatomyPanel>, 'available' | 'unavailableReason'>) {
  return (
    <AnatomyPanel
      {...props}
      available={supportsTeachingAnatomy(model)}
      unavailableReason={model.asset ? SUPPORT_ANATOMY_UNAVAILABLE : undefined}
    />
  );
}
