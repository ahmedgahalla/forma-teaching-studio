# Ready-made lecture handoff — 27 September 2026

**Branch:** `ahmed/phase-3-teacher-lectures` · **Base:** Claude's unchanged Phase 4 at `ff1b3e5` · **PR:** [#14](https://github.com/ahmedgahalla/forma-teaching-studio/pull/14) (draft; stacked on Phase 4).

## Done

The owner's latest request supersedes custom lecture authoring. Lecture now directly opens a complete sample, **Translation vs tipping: follow the crown and root**, in Teach. Four steps cover prediction, translation, tipping and recap; all have authored notes/questions/answers, and the two demonstrations reuse existing case trajectories. The suggested 205-second walkthrough has not been timed.

Removed the create/library/editor/import/export/save journey and its newly orphaned persistence/capture code. Existing browser saves are untouched: the sample does not read or write lecture storage. Rehearse exposes notes; Teach collapses them; answers are hidden on each newly loaded step. Notes displayed in this single window are public. Repeated Lecture clicks preserve the current step. Opening afresh starts the canonical sample regardless of the preceding Explore model.

One model and one current-demonstration playback strip remain. Explore this question and Return to lecture restore the paused model, camera, layers, frame and answer/notes visibility; leaving Lecture restores the separate earlier Explore workspace. Clicks, typing and recognized local speech share runtime actions. Exact visible labels and explicit exit phrases resolve locally. Removed preparation commands cannot resurrect an editor. Attachment edits require exploration, and replay preflight correctly uses its saved starting session.

The earlier glossary correction remains: related-term clicks retain the studied tooth. No solver, packages, assets, backend endpoints, AGENTS or auditor-owned STATUS were changed.

## Verification

Final results are recorded in the [Phase 3.9 verification record](../phases/phase-3-demo-path/3.9-teacher-lectures.md#acceptance-and-verification). The full frontend run passed 2,383 tests with one unchanged BVH oracle timeout across 99 files in 101.47 seconds. The unchanged oracle then passed alone, 3/3 in 21.63 seconds. Fresh typecheck, zero-warning lint, file limits (380 files), production static build and 482 backend tests passed. Final formatting check passed. Do not call the complete gate green while that run or browser acceptance is failing/unverified.

The browser security policy rejected preview access and prohibited alternate-browser workarounds. Source, DOM and runtime tests do not establish browser/DPR, actual speech recognition or projector readability. These checks remain with the auditor.

## Next and review dependency

Audit PR #13 and Phase 4 first, then this feature. PR #14 targets Phase 4 to isolate the feature diff; CI only triggers for PRs targeting main, so this stacked draft has no CI run. After dependency integration, retarget to main and require green Node 22/24 frontend and Python backend checks. The builder has not merged anything.

Run the four-step sample on actual screens at DPR 1 and 2, then prepared-case, braces-workflow and typed-command regressions in Explore. Check notes, hidden answers, one playback bar, repeated navigation, question detour and exact return. See the [open auditor item](../reviews/from-builder/2026-09-27-teacher-lecture-workflow.md).

The worktree production preview remains on `http://127.0.0.1:3012`, served from `out/` on loopback (process session 52502). Rebuilding updates its files. Server startup was confirmed previously; no browser or HTTP inspection is claimed. The original checkout and port 3011 remain untouched.

## Suggested next product work

Prioritize clearer model focus and fewer repeated headings/counters, then an authored same-camera translation/tipping comparison. A separate audience window could make notes private if the teacher presents on a second screen. Biology visuals require a distinct educator-reviewed scope; offline fonts/favicon and an actual device rehearsal remain separate known improvements. No additional feature was built merely because it is suggested here.
