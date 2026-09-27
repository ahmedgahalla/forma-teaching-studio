import { useState } from 'react';
import type { DentalCase } from '@/lib/geometry';
import { useToothStudyState } from './tooth-study';

/** Explanations belong to the displayed model and participate in classroom snapshots. */
export function useExplanationState(model: DentalCase) {
  const study = useToothStudyState(model);
  const [definition, setDefinition] = useState<{ model: DentalCase; id: string } | null>(null);
  const glossaryId = definition?.model === model ? definition.id : null;
  const setGlossaryId = (id: string | null, targetModel = model) =>
    setDefinition(id ? { model: targetModel, id } : null);
  return { ...study, glossaryId, setGlossaryId };
}
