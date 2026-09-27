# Phase 3 — demo path

**Status:** teacher-created lecture slice implemented; automated results recorded; browser acceptance blocked · **Current branch:** `ahmed/phase-3-teacher-lectures` · **Current PR:** [#14](https://github.com/ahmedgahalla/forma-teaching-studio/pull/14) (draft; stacked on Phase 4)

**Goal:** a professor can explore the central model freely or prepare a lecture inside Forma, teach alongside saved notes and model steps, and return from a spontaneous experiment without losing the lecture. A rehearsed 3–4 minute walkthrough should demonstrate the complete journey to an orthodontist who lectures at universities. Builds on [product direction](../../PRODUCT_DIRECTION.md).

## Current implementation

- [3.9 — Teacher-created lectures](3.9-teacher-lectures.md): Explore/Lecture entry points; Prepare/Rehearse/Teach; saved notes and explicit model capture; prepared-case demonstrations; deterministic navigation; local saving and JSON backups; temporary exploration with a paused return.
- [3.2 — Lecture-ready opening](3.2-lecture-ready-opening.md): collapsed editing and commands, grouped controls, full-width model and preserved preview decisions. Dependency: [PR #13](https://github.com/ahmedgahalla/forma-teaching-studio/pull/13).

The current branch starts from [Phase 4](../phase-4-voice-lecture-assistant/README.md) at `ff1b3e5` and retains its voice, glossary, tooth-study and presentation work. Phase 4 alone did not provide teacher-authored lecture documents; 3.9 adds that workflow.

## Relationship to the proposal

The owner first authorized Phase 3 clutter reduction on 26 September 2026, producing 3.2 ahead of offline assets. The later approved bounded teacher-workspace implementation follows the Explore/Lecture proposal in [PR #12](https://github.com/ahmedgahalla/forma-teaching-studio/pull/12).

**3.9 is the consolidated first vertical slice:** the proposal's navigation plus proposed 3.10–3.14 document, editor, runner, return and input deliverables are recorded together in its implementation document. Do not treat those proposed numbers as duplicate outstanding features. Some proposed capabilities remain explicitly excluded: PDF/PowerPoint import, dual-screen presentation, arbitrary animation, cloud services and new biology content.

Phase 4 has already advanced camera framing and visual clarity. Wider playback/presenter consolidation, offline fonts/favicon, educator-reviewed biology and real-device rehearsal remain separate work. The sample's proposed 3–4 minute script is **untimed**. Local automated results are recorded, including the full-suite timing failure and passing isolated oracle; browser access is blocked by security policy, so this slice does not claim browser, DPR 1/2, microphone or projector acceptance. See the [3.9 verification record](3.9-teacher-lectures.md#acceptance-and-verification) for the scoped evidence and remaining checks.
