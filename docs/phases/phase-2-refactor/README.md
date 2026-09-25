# Phase 2 — refactor

**Status:** next (starts after Phase 1 merges) · **Branch:** `naser/phase-2-refactor` (created from `naser/phase-1-tooling`, updated from main before its PR) · **PR:** — · **Owner:** auditor

**Goal:** a component-based structure with no behavior change. Work in slices, one commit per slice, full verification gate after every slice. A slice that breaks something it can't fix cleanly is reverted and noted, not forced.

Planned sub-phases (docs created as slices land):

- 2.1 dead-code removal — `useSpeech.ts`, legacy backend `/api/interpret`, unused exports/functions/CSS rules, commented-out code; candidates found with tooling (knip/ts-prune), each confirmed manually; everything removed gets listed
- 2.2 Studio split — reducer + feature hooks (useTryMode, useMechanics, useCaseScenario, useStagePlayback, useLectureMode, useCaseFiles, …), dispatcher modules for applyTeaching/preflight, feature components; the TeachingAdapter interface is the seam
- 2.3 CSS split — per-component stylesheets next to their components; global tokens/resets stay in one small file
- 2.4 other large files — classroom.ts, try-mode.ts, Viewer.tsx, WorkflowStudio.tsx, TeachingController.tsx, split where the seam is clean; skips noted with reasons
- 2.5 backend routers — split main.py (core/provider, teaching), delete the legacy route; `main.app` stays importable for the tests

Also: feature-folder organization of `src/` (documented in `docs/architecture/folder-structure.md`), ADRs for the refactor boundaries, and shrinking the `scripts/check-file-limits.mjs` allowlist as files split.

**Merge condition:** only after Phase 1 is merged, with this branch updated from main first (merge commit, never squash/rebase).
