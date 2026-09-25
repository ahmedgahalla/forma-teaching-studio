import audit from './teaching-case-audit.json';

type Pair = { a: string; b: string };
type VariantAudit = {
  sampleCount: number;
  frames: { progress: number; crownPairs: Pair[]; rootPairs: Pair[] }[];
};
const cases = audit.cases as Record<string, { variants: Record<string, VariantAudit> }>;

/** Reports measured discrete samples; never labels an interpolated path collision-free. */
export function casePathAudit(caseId: string, variantId: string) {
  const result = cases[caseId]?.variants[variantId];
  if (!result) return null;
  const pairs = new Map<string, { a: string; b: string; tissue: 'crown' | 'root' }>();
  for (const frame of result.frames)
    for (const tissue of ['crown', 'root'] as const) {
      for (const pair of frame[`${tissue}Pairs`])
        pairs.set(`${tissue}/${pair.a}/${pair.b}`, { ...pair, tissue });
    }
  return { samples: result.sampleCount, pairs: [...pairs.values()], limitation: audit.limitation };
}
