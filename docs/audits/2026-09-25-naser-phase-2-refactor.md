# Audit — naser/phase-2-refactor (PR #2)

Self-audit by the auditor (the branch author), per the CLAUDE.md procedure and Naser's instruction to review the PR before he confirms the merge. A self-audit cannot substitute for the human review on a change of this size; it documents what was checked and what a reviewer should look at hardest.

**Verification gate:** all eight steps pass on the final branch state (table in the phase README): 1,575/1,575 frontend, 470/470 backend, typecheck (`--incremental false`), lint at zero warnings, format, limits (244 files), build, and the six-screen browser check (pixel-identical to `docs/baselines/2026-09-25-main-0b2e7db/`, DPR 2 verified, prepared case + braces workflow + typed bracket/wire commands clicked through).

## Blocking

None found.

## Should fix (soon, not necessarily this PR)

1. **Per-view props for the `case/` views.** Every extracted view takes the whole `CaseStudioApi`; formally each depends on everything. This was a deliberate extraction seam (ADR 003) but should be narrowed view-by-view before the bundle ossifies. Filed as follow-up in the handoff.
2. **`try-mode.ts` (974 lines)** is the largest justified allowlist entry with a plausible seam (state machine vs. geometric objectives vs. serialization). It resisted this round only for time-risk reasons; it should be the first 2.4-style split next iteration.
3. **CSS near-duplicates.** The un-minified partials expose repeated selector blocks (e.g. timeline-era leftovers already removed, but sibling patterns remain across `.braces-studio`/`.teaching-studio` scopes). A dedupe pass with visual checks would trim real bytes; belongs in its own small PR.

## Suggestions

- The 17 standing lint-disable justifications are individually written but scattered; a lint rule or check that requires the `-- reason` suffix on any new disable would keep the ledger honest automatically (lessons-learned promotion candidate).
- `scripts/check-file-limits.mjs` counts by lines only; a max-function-length heuristic would catch the next `advance`-style single-function growth inside an allowlisted file.
- The extraction tooling (AST renamer, region extractor, import-rewriter) lives in the session scratchpad; if a third split round is expected, commit them under `scripts/refactor/` so the next session doesn't rebuild them.

## Process notes a reviewer should weigh

- Two commits landed red and were fixed forward transparently: `2aa997d` (classroom split, masked by the incremental-typecheck false green; fixed in `781edba` + lessons #9) and the 2.3 splitter's `@import` semicolon (caught by the build in `018b5c1`). Both failure modes now have automated guards.
- Test-count changes are deliberate and inventoried in 2.1: −24 frontend (dead speech controller + exportSTL), backend 531→470 (legacy route; `resolve_targets` coverage re-hosted, `/health`+CORS kept, the bridge's 404 test still pins the route's absence).
- The riskiest review surfaces, in order: `case/actions-io.ts` `load()` (the biggest verbatim-moved state cascade), `case/preflight.ts` (wrapped verbatim), `teaching-load-kinds.ts` (the split dispatcher family), and the two-phase api assembly at the bottom of `Studio.tsx`.

**Merge conditions status:** CI green pending on GitHub at audit time (local gate green); zero Blocking findings; phase docs updated in the PR. Merge intentionally withheld for Naser's review.
