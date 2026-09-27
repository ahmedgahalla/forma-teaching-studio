import { ANATOMY_GLOSSARY } from './anatomy';
import { OCCLUSION_GLOSSARY } from './occlusion';
import { MECHANICS_GLOSSARY } from './mechanics';
import { GLOSSARY_REVIEW_STATUS, type GlossaryEntry } from './types';

export { GLOSSARY_DISCLAIMER, GLOSSARY_REVIEW_STATUS } from './types';
export type { GlossaryEntry } from './types';

export const GLOSSARY: readonly GlossaryEntry[] = [
  ...ANATOMY_GLOSSARY,
  ...OCCLUSION_GLOSSARY,
  ...MECHANICS_GLOSSARY,
].map(entry => ({ ...entry, status: GLOSSARY_REVIEW_STATUS }));

/** Exact, bounded lookup after cosmetic normalization; no fuzzy or remote interpretation. */
export function normalizeGlossaryTerm(text: string): string {
  return text.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY.find(entry => entry.id === id);
}

export function findGlossaryEntry(term: string): GlossaryEntry | undefined {
  const normalized = normalizeGlossaryTerm(term);
  return GLOSSARY.find(entry =>
    [entry.id, entry.term, ...entry.aliases].some(
      alias => normalizeGlossaryTerm(alias) === normalized,
    ),
  );
}
