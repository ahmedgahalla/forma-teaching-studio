import type { TeachingAction } from '../lecture';
import type { BiologyView } from '../teaching-biology';

export const GLOSSARY_REVIEW_STATUS = 'Teaching draft — pending educator review';
export const GLOSSARY_DISCLAIMER = `${GLOSSARY_REVIEW_STATUS} · synthetic model`;

export type GlossaryEntry = {
  id: string;
  term: string;
  aliases: readonly string[];
  definition: string;
  show?: readonly TeachingAction[];
  biology?: BiologyView;
  related: readonly string[];
  status: typeof GLOSSARY_REVIEW_STATUS;
};

/** Authored content receives the shared review status when the catalogue is assembled. */
export type GlossaryContent = Omit<GlossaryEntry, 'status'>;
