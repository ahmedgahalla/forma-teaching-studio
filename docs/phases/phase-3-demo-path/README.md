# Phase 3 — demo path

**Status:** finished sample lecture implemented; local checks recorded; full-suite timeout and browser acceptance remain open · **Current branch:** `ahmed/phase-3-teacher-lectures` · **Current PR:** [#14](https://github.com/ahmedgahalla/forma-teaching-studio/pull/14) (draft; stacked on Phase 4)

**Goal:** a professor can explore the central model freely or open a finished lecture with notes, questions and model demonstrations, then return from a spontaneous experiment without losing the lecture. Builds on [product direction](../../PRODUCT_DIRECTION.md).

## Current implementation

- [3.9 — Ready-made lecture and free exploration](3.9-teacher-lectures.md): Lecture opens the fixed four-step translation/tipping sample directly in Teach. Rehearse exposes notes; questions precede answers; navigation and playback are deterministic; a question detour preserves the paused lecture and independent Explore workspace. There is no lecture authoring, local lecture library, import/export or saving.
- [3.2 — Lecture-ready opening](3.2-lecture-ready-opening.md): collapsed editing and commands, grouped controls, full-width model and preserved preview decisions. Dependency: [PR #13](https://github.com/ahmedgahalla/forma-teaching-studio/pull/13).

The current branch starts from [Phase 4](../phase-4-voice-lecture-assistant/README.md) at `ff1b3e5` and retains its voice, glossary, tooth-study and presentation work. The stacked PR does not trigger the current main-targeted CI workflow; it is not represented as CI-green or merged.

## Scope decision and remaining acceptance

The owner's latest request supersedes the earlier teacher-authoring scope: provide our own finished sample and remove lecture creation. **3.9 remains the consolidated first vertical slice** of the [Explore/Lecture proposal](https://github.com/ahmedgahalla/forma-teaching-studio/pull/12), retaining its runner, return and input work. Proposed 3.10–3.14 are not duplicate outstanding milestones; editing and persistence are deliberately excluded. Former browser lecture saves are untouched because the revised feature does not access them.

The sample's four suggested allocations total **205 seconds (3 minutes 25 seconds), not yet measured**. The full frontend run passes 2,383 tests with one unchanged BVH timeout; that oracle passes alone. Other local gates, including the final formatting check, pass. Real browser access is blocked by security policy; no browser, DPR 1/2, microphone or projector acceptance is claimed. See the [3.9 verification record](3.9-teacher-lectures.md#acceptance-and-verification) for focused results, intentional test removals and the full-suite timeout.

Further visual/playback polish, offline fonts/favicon, educator review and real-device rehearsal remain separate work. Authoring, a separate audience window, arbitrary animation and new biology content require their own scope decisions.
