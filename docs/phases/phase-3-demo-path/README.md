# Phase 3 — demo path

**Status:** mechanics-aware explanations implemented; automated checks passed; lecture browser acceptance pending · **Current branch:** `ahmed/phase-3-analysis-mechanics` · **Current PR:** [#16 (draft)](https://github.com/ahmedgahalla/forma-teaching-studio/pull/16) (stacked on [#15](https://github.com/ahmedgahalla/forma-teaching-studio/pull/15))

**Goal:** a professor can explore the central model freely or open a finished lecture with notes, questions and model demonstrations, then return from a spontaneous experiment without losing the lecture. Builds on [product direction](../../PRODUCT_DIRECTION.md).

## Current implementation

- [3.16 — Mechanics-aware scene explanations](3.16-analysis-mechanics.md): Analyze receives actual support, anchorage, elastic and expander inputs with strict validation and anonymous appliance references. Hidden results and read-only replies remain protected.

- [3.15 — Lecture focus, audience presentation and mechanics](3.15-lecture-mechanics.md): approved follow-up adds closer teaching focus, fixed-camera comparisons, reduced chrome, a public audience window, qualitative tissue explanations, local demo assets and eight mechanics categories/17 variations. No lecture creation is restored.

- [3.9 — Ready-made lecture and free exploration](3.9-teacher-lectures.md): Lecture opens the fixed four-step translation/tipping sample directly in Teach. Rehearse exposes notes; questions precede answers; navigation and playback are deterministic; a question detour preserves the paused lecture and independent Explore workspace. There is no lecture authoring, local lecture library, import/export or saving.
- [3.2 — Lecture-ready opening](3.2-lecture-ready-opening.md): collapsed editing and commands, grouped controls, full-width model and preserved preview decisions. Dependency: [PR #13](https://github.com/ahmedgahalla/forma-teaching-studio/pull/13).

The current branch starts from [Phase 4](../phase-4-voice-lecture-assistant/README.md) at `ff1b3e5` and retains its voice, glossary, tooth-study and presentation work. The stacked PR does not trigger the current main-targeted CI workflow; it is not represented as CI-green or merged.

## Scope decision and remaining acceptance

The owner's latest request supersedes the earlier teacher-authoring scope: provide our own finished sample and remove lecture creation. **3.9 remains the consolidated first vertical slice** of the [Explore/Lecture proposal](https://github.com/ahmedgahalla/forma-teaching-studio/pull/12), retaining its runner, return and input work. Proposed 3.10–3.14 are not duplicate outstanding milestones; editing and persistence are deliberately excluded. Former browser lecture saves are untouched because the revised feature does not access them.

The sample's four suggested allocations total **205 seconds (3 minutes 25 seconds), not yet measured**. The earlier [3.9 verification record](3.9-teacher-lectures.md#acceptance-and-verification) recorded 2,383 passing tests and a BVH timeout. The current [3.15 verification](3.15-lecture-mechanics.md#verification-and-acceptance) passes 2,545 frontend tests, 482 backend tests and the remaining automated local checks, with timing fixes and earlier failures documented. Real browser access is blocked by security policy; no browser, DPR 1/2, microphone or projector acceptance is claimed.

The owner subsequently authorized the presentation, local-asset, audience and biology improvements plus researched mechanics; those changes are recorded in 3.15. Educator review and real-device rehearsal remain outstanding. Authoring and arbitrary generated animation remain excluded.
