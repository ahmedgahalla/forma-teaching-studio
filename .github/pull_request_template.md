## What changed and why

<!-- A few sentences. Link the issue/phase context if any. -->

## Phase / feature

<!-- Which numbered phase or sub-phase this belongs to, e.g. "Phase 2.3 — CSS split".
     Every PR belongs to one; create the sub-phase doc if it doesn't exist. -->

## Screenshots

<!-- Required for any visual change: before/after at 1600×900. Delete this section if nothing visual changed. -->

## Docs updated

- [ ] Numbered phase / sub-phase doc under `docs/phases/` updated in this PR
- [ ] Any guide or record this change invalidates was fixed in this PR
- [ ] (Builder PRs: `docs/STATUS.md` intentionally NOT touched — auditor-owned)

## Standards checklist (AGENTS.md)

- [ ] Verification gate run locally and passing (tests, typecheck, lint, format, limits, build, backend pytest)
- [ ] Browser check done for affected screens
- [ ] No new file over 300 lines; no duplicated or dead code introduced
- [ ] Content kept as data, separate from logic
- [ ] Three.js resources disposed; no render-loop allocations
- [ ] New logic has tests
