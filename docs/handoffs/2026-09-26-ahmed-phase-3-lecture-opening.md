# Handoff — Phase 3.2 lecture-ready opening

**Branch:** `ahmed/phase-3-lecture-opening` · **PR:** pending · **Role:** builder

## Done

Ran the session-start protocol from main `dfd377f`, verified Node 22.23.3/Python 3.13.3 and synced dependencies, read status/lessons/inbox/architecture/current phase/latest handoff. Owner authorized building Phase 3 and prioritized clutter; implemented proposal #12's 3.2 before its offline-assets slice.

Opening editing/commands closed; nine visible desktop controls instead of sixty; canvas +82.8% area. Full implementation/evidence in [3.2](../phases/phase-3-demo-path/3.2-lecture-ready-opening.md). Preserved previews, whole-request history, command feedback and restore routes. Narrowed touched leaf-view props. Updated user guides and recorded the state/feedback lesson. No STATUS or AGENTS edits and no main push/merge.

## Verification

- `npm test`: 1,594 passing, 54 files. First run hit the existing 30s GLB oracle timeout under concurrent checks; isolated rerun and subsequent full suite passed without weakening it.
- Backend pytest: 470 passing.
- Final `typecheck`, zero-warning `lint`, `format:check`, `check:limits` (251 files), production `build` and `git diff --check`: passed.
- Production browser checked all six baseline screen types, case/workflow transfer and restore, typed commands, previews, disclosures, both themes and responsive layouts. DPR 1 CSS/buffer sizes verified.
- **Outstanding gate item:** DPR 2 browser/device check. The current in-app browser exposes no device-scale override; the attempted zoom shortcut left DPR at 1. See the phase doc. Actual speech device and projector rehearsal are not claimed.

## Next / auditor action

Audit this PR, including the outstanding DPR 2 check, then merge only if CI and the audit gate pass. The builder does not merge. New auditor inbox: [opening review](../reviews/from-builder/2026-09-26-phase-3-opening-review.md).

PR #12 remains the detailed proposal. Both PRs touch the phase README; if #12 merges first, combine this implementation index/status with its full proposal, do not discard the proposal. This implementation is based on main and has no unmerged-code dependency. PR #11 remains the independent onboarding PR.

The complete Phase 3 roadmap is not done. Offline fonts/favicon, dedicated framing, final presenter/playback pass, timed script and biology visuals remain separate slices. The prop-narrowing, broad CSS cleanup and try-mode split inbox items remain open beyond this overlap. Demo-case/biology teaching review decisions still belong to the owners and orthodontic educator.
