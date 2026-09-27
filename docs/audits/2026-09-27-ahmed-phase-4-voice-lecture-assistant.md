# Audit — `ahmed/phase-4-voice-lecture-assistant` (Phase 4, local branch)

**Auditor:** Claude Code · **Date:** 2026-09-27 · **PR:** none yet (local branch, not pushed) · **Builder:** Codex (`gpt-6-astra`, reasoning `ultra`)

## Scope

Phase 4 turns Forma into a voice-led lecture assistant, built on draft PR [#13](https://github.com/ahmedgahalla/forma-teaching-studio/pull/13) (`ahmed/phase-3-lecture-opening` @ `ed2164e`):

| Commit    | Sub-phase                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `bb08fb9` | [4.1 hands-free voice](../phases/phase-4-voice-lecture-assistant/4.1-hands-free-voice.md) (+ `f85ba7e` test update) |
| `73d230a` | [4.2 tooth study](../phases/phase-4-voice-lecture-assistant/4.2-tooth-study.md)                                     |
| `24231c7` | [4.3 visual clarity](../phases/phase-4-voice-lecture-assistant/4.3-visual-clarity.md)                               |
| `9c6592f` | [4.4 explain by voice](../phases/phase-4-voice-lecture-assistant/4.4-explain-by-voice.md)                           |
| `e9215f6` | [4.5 audit fixes](../phases/phase-4-voice-lecture-assistant/4.5-audit-fixes.md)                                     |

## Process

Each slice was specified by the auditor, implemented by the builder, then reviewed by the auditor: diff review, the full verification gate rerun on the host (the builder's sandbox blocks Prettier's traversal of `backend/.pytest_cache` and the esbuild prebuild), and a browser check with simulated speech (a patched `SpeechRecognition` injecting final results). Browser checks used the in-app browser and a headless Chrome driven over CDP at 1600×900, DPR 1 and DPR 2.

Review changes made during the slices (recorded in the phase docs):

- 4.1: the builder's tool-config exclusions for an orchestrator worktree nested under `.claude/worktrees/` were reverted after the worktree was removed ([lesson 13](../lessons-learned.md)). Hands-free interim captions were restricted to speech addressed to Forma.
- 4.3: one revision round replaced a permanently shortened canvas (bottom 22% reserved for captions) with a full-height canvas and safe-area framing.

After 4.4 the auditor ran a four-lens review (voice pipeline, TeachingAction integrity, viewer/rendering, safety/content) with one adversarial verifier per Blocking/Should-fix finding. Nothing was refuted; all findings were fixed in 4.5 with regression tests.

## Findings

### Blocking

1. **Glossary grammar swallowed existing commands** (`src/lib/glossary/parser.ts`): "explain that movement" returned a glossary clarification, breaking the Inspector Explain button. **Resolved in 4.5.**

### Should fix

2. Hands-free restart backoff grew during classroom silence (`no-speech` bypassed the session reset), leaving recognition deaf about a third of the time after a quiet minute. **Resolved.**
3. "hide that" / "close the definition" in the workflow classroom switched to the case workspace. **Resolved.**
4. Occlusal/apical tooth-study views set `camera.up` to the buccal axis, breaking manual orbit afterwards. **Resolved.**
5. `focus()` and camera snapshots read the mid-transition pose ("front view and focus on tooth 11" framed along the old direction). **Resolved.**

### Suggestions (all addressed in 4.5)

6. Mishearing wake aliases ("former", "forma's", "fauna") let ordinary speech through; now local-only, never captioned or sent to the AI.
7. "show me the distal surface" during a study jumped to another tooth.
8. Exploring from inside a tooth study restored the study display onto the full mouth on return.
9. PDL/alveolar-bone definitions were refused while an imported case was loaded.
10. Top-clamped study labels covered the teaching-draft disclaimer.
11. Hands-free kept running while the tab was hidden; it now pauses and resumes on return.

Lessons for findings 1–5 are recorded in [lessons-learned](../lessons-learned.md) by the 4.5 builder change.

## Verification gate (host, after `e9215f6`)

| Step                                        | Result                                  |
| ------------------------------------------- | --------------------------------------- |
| `npm test`                                  | 2,258 passed (90 files); baseline 1,594 |
| `npm run typecheck`                         | clean                                   |
| `npm run lint`                              | clean, zero warnings                    |
| `npm run format:check`                      | clean                                   |
| `npm run check:limits`                      | 352 files OK; no allowlisted file grew  |
| `npm run build`                             | succeeds                                |
| backend `pytest -q`                         | 482 passed                              |
| Browser check (simulated speech, DPR 1 + 2) | passed — see below                      |

Browser check covered: hands-free on/off (`M`), wake phrase and bare-wake follow-up, non-wake speech ignored, prepared case load/play/bare "stop", narration captions, braces workflow next/PageDown, tooth study (open, side views, clicker cycling, explain, close, undo), glossary definitions and unknown terms, the tooth anatomy tour, both themes, and canvas sizing at DPR 2 (buffer 3132×1372 for a 1566×686 CSS canvas). New baselines: [`docs/baselines/2026-09-27-ahmed-phase-4-voice-lecture-assistant-e9215f6/`](../baselines/2026-09-27-ahmed-phase-4-voice-lecture-assistant-e9215f6/).

## Not verified (must be done on real hardware before a lecture)

- A real microphone in a lecture hall (recognition accuracy, wake-phrase reliability, echo from speakers), a projector at distance, and a physical DPR-2 display move. Browser speech recognition uses the browser vendor's online service; offline voice is not available.
- Educator review of all authored content (tooth anatomy, glossary, tour captions); every surface is labelled "Teaching draft — pending educator review · synthetic model".

## Merge decision

Not merged and not pushed. The branch depends on draft PR #13; open a PR for Phase 4 after #13 merges (merge main into the branch first, per AGENTS.md). `docs/STATUS.md` is updated by the auditor after that merge.
