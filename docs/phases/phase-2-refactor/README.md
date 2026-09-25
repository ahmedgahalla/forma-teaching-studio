# Phase 2 — refactor

**Status:** in review · **Branch:** `naser/phase-2-refactor` (on merged Phase 1 main) · **PR:** #2 · **Owner:** auditor

**Goal:** a component-based structure with no behavior change — dead code out, the monoliths split, folders by feature — in gated slices with the full verification gate after each.

## Sub-phases

- [2.1 — dead-code removal](2.1-dead-code-removal.md): 23-agent verification workflow, then `useSpeech`/speech-controller/`exportSTL`/27 unexports, 119 dead CSS rules, and the legacy backend `/api/interpret` route (tests re-hosted, docs corrected)
- [2.2 — Studio split](2.2-studio-split.md): 5,123 → 1,011 lines via sixteen state hooks, the typed `CaseStudioApi` bundle, AST-rewritten view extraction (~20 components), and ten handler factories with late binding
- [2.3 — CSS split](2.3-css-split.md): every oversized stylesheet → `@import` index + ordered partials (cascade preserved byte-for-byte)
- [2.4 — other large files, disables, folders](2.4-other-large-files.md): classroom/ package, TeachingCommandBar out, LESSONS → data; disables ledger (16 resolved, 17 justified, zero TODOs); feature folders + regenerated 24-entry allowlist
- [2.5 — backend modules](2.5-backend-routers.md): main.py 1,079 → 148 + six modules, monkeypatch seams preserved

**Decisions:** [ADR 003 — refactor boundaries](../../decisions/003-refactor-boundaries.md); layout in [architecture/folder-structure.md](../../architecture/folder-structure.md).

## Outcome — verification gate on the final branch state (2026-09-25)

| Check                  | Result                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`             | **1,575 / 1,575 passing** (24 tests removed with their dead code in 2.1, listed there)                                                                                                          |
| `npm run typecheck`    | clean (now `--incremental false`; lessons #9)                                                                                                                                                   |
| `npm run lint`         | clean at `--max-warnings 0`; **zero TODO disables** (16 resolved, 17 standing each with a written reason)                                                                                       |
| `npm run format:check` | clean                                                                                                                                                                                           |
| `npm run check:limits` | 244 files OK; allowlist regenerated to 24 justified entries (was 30) and now also scans untracked files                                                                                         |
| `npm run build`        | clean static export                                                                                                                                                                             |
| backend `pytest`       | **470 / 470 passing** (61 legacy-route tests removed/re-hosted in 2.1c)                                                                                                                         |
| Browser check          | six baseline screens pixel-identical at 1600×900 after every risky slice and on the final state; DPR 2 verified; prepared case, braces workflow and typed bracket/wire commands clicked through |

## Before → after

| File                        |          Before | After                                                          |
| --------------------------- | --------------: | -------------------------------------------------------------- |
| `src/components/Studio.tsx` |     5,123 lines | 1,011 (orchestrator) + 35 `case/` modules ≤300                 |
| `src/app/globals.css`       |     4,573 lines | 20 ordered partials ≤300                                       |
| `src/lib/classroom.ts`      |     1,701 lines | 8-module package behind a barrel                               |
| `backend/main.py`           |     1,079 lines | 148 + six modules                                              |
| `src/components/` root      | flat, 30+ files | eight feature folders                                          |
| TODO lint disables          |              33 | 0 (17 standing, individually justified)                        |
| Dead code                   |               — | −~1,100 lines TS/Py, −549 lines CSS, −85 tests-worth re-hosted |
