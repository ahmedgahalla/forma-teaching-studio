# ADR 003 — Phase 2 refactor boundaries

**Date:** 2026-09-25 · **Status:** accepted · **Phase:** [2 — refactor](../phases/phase-2-refactor/README.md)

## Context

Studio.tsx held the whole case workspace (5,123 lines, ~70 useState); globals.css, classroom.ts and backend/main.py were similar monoliths. Phase 2 had to split them with zero behavior change, under CI, right before a demo.

## Decisions

**The api-bundle seam for views.** CaseStudio's extracted views receive one typed `CaseStudioApi` prop (state-hook returns + derived values + handlers) instead of bespoke prop lists. Chosen because it made the extraction mechanical and verifiable (AST-rewritten references, excess-property checking on assembly) without changing a single callback's behavior. The cost — views formally depend on the whole api — is accepted and documented; narrowing per-view props is deliberate follow-up, not a blocker.

**Handler factories with late binding.** Handlers moved into `createXxxActions(api, refs)` factories; Studio assembles the api in two phases (state literal, then `Object.assign` of factory results). Mutual recursion between handlers goes through the api object, which is exactly how the old closures resolved each other. Mutable refs travel in a separate `CaseRefs` container because the react-hooks refs rule (correctly) refuses ref reads through a render-visible bundle; the one place the rule cannot model — passing the container to factories that only build event-time closures — carries a file-scoped, justified disable in Studio.tsx only.

**Ordered CSS partials, not per-component regrouping.** Oversized stylesheets became `@import` indexes over ordered partials. Regrouping rules per component would have reordered the cascade; the demo cannot absorb subtle specificity flips. The partials live next to their feature; the index preserves byte order.

**Barrels for split lib packages.** `lib/classroom.ts` re-exports from `lib/classroom/*` so fifty import sites and the backend-mirrored fixtures stay untouched.

**Backend split with a re-exporting main.** `backend/main.py` keeps the app object and provider seams and re-exports moved names, because the test suite monkeypatches `main.<name>`; moving the seams would have rewritten 470 tests for no behavioral gain.

**What was deliberately not split** (allowlist-justified in `scripts/check-file-limits.mjs`): Viewer.tsx — one WebGL scene lifecycle where splitting the renderer effect invites disposal/leak bugs; the four feature panels (TryPanel, MechanicsPanel, WorkflowStudio, StudioExperience) — each is a single feature's cohesive view; single-algorithm engines (try-mode state machine, solver, advance switch, grammars); content-as-data files (teaching-cases, workflows) whose length is authored prose.

## Consequences

- Every new file is bounded at 300 lines by CI; the allowlist can only shrink.
- The api-bundle seam gives Phase 3 a single place to add demo affordances.
- The react-hooks v6 rules run clean over the whole tree with 17 standing, individually justified directives (ledger in the phase doc) and zero TODO markers.
