# Teacher lecture workflow handoff — 27 September 2026

**Branch:** `ahmed/phase-3-teacher-lectures` · **Base:** Claude's Phase 4 at `ff1b3e5` · **PR:** pending.

## Done

Implemented the approved Explore/Lecture workflow in an isolated managed worktree. Lecture includes local preparation, saved notes/questions/answers, explicit visible-model capture, existing prepared demonstrations, reorder/duplicate/confirmed deletion, JSON backup/import copies, and a three-step sample. Rehearse/Teach use one model and playback bar; step navigation restores absolute setups with hidden answers. A question detour restores the paused scene and answer/notes visibility, while preserving the independent earlier Explore workspace. Click/type/local-voice navigation shares validated runtime actions. Glossary related-term clicks now retain the studied tooth.

The shell was extracted to keep the existing Studio allowlist from growing. No packages, solver, assets, backend endpoints, AGENTS or auditor-owned STATUS were changed. Phase 3.9 consolidates the approved bounded document/editor/runner/return/input work; the phase doc and product direction explain that scope decision.

## Verification

- Final focused regressions: 132 passing across 10 files.
- Default frontend: 2,341 pass, existing BVH oracle timeout plus five worker startup timeouts.
- Two-worker full frontend: 2,382 pass, same existing BVH timeout; no worker errors.
- Isolated unchanged BVH oracle: 3/3 pass in 24.25 s. Timeout/assertions unchanged.
- Fresh typecheck, lint, formatting, file limits and production static build pass. Python backend: 482 pass.
- Real browser access was rejected by this session's security policy, including a prohibition on alternate browser workarounds. Browser/DPR/screenshots, real speech recognition and projector checks are not verified. The demo script is an untimed rehearsal proposal.

The full frontend invocation is not green. Review the [phase verification](../phases/phase-3-demo-path/3.9-teacher-lectures.md#acceptance-and-verification) and [auditor inbox item](../reviews/from-builder/2026-09-27-teacher-lecture-workflow.md), then run the repository gate on the audit host. No merge is performed by the builder.

## Next and limits

Audit the unchanged Phase 4 dependency after PR #13, then this feature. Check the real layout at DPR 1 and 2, full prepared-case/braces/typed-command paths, and create → reopen → teach → pause → explore → return → backup/import. Confirm projector readability and microphone behavior on the actual device before presenting.

Notes autosave; model edits require explicit Capture. Static captures preserve displayed poses and validated appliance inputs, not computed responses or inferred animations. Imported models/workflow transfers, PDF/PPT import, private notes/audience window, cloud sync and new biology content remain excluded. Return points are in-session, and deletion recovery uses exported backups. Existing unrelated auditor follow-ups remain open; this work does not merge the proposal/onboarding PRs or amend the shared rulebook.
