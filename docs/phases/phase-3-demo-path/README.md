# Phase 3 — demo path

**Status:** UI and AI reliability implemented; automated checks pass, with provider configuration and browser acceptance pending. **Current branch:** `ahmed/phase-3-ui-ai-reliability`. **PR:** pending (draft). **Base:** [#27 (draft)](https://github.com/ahmedgahalla/forma-teaching-studio/pull/27).

**Goal:** a professor can explore the central model freely or open a finished lecture with notes, questions and model demonstrations, then return from a spontaneous experiment without losing the lecture. Builds on [product direction](../../PRODUCT_DIRECTION.md).

## Current implementation

- [3.28 - Clearer UI and AI reliability](3.28-ui-ai-reliability.md): named lecture steps, grouped teaching aids and explicit AI reconnection with safe provider errors. Live provider and browser acceptance remain pending.

- [3.27 - Case lecture and wire verification](3.27-case-journey.md): one continuous fourteen-step case, with a separate wire-response experiment, exact initial/finished comparison and the zero-activation reset fix. Depends on PR #26; faculty and browser acceptance remain pending.

- [3.26 — Claude jaw opening and selection glow](3.26-jaw-and-selection-glow.md): authored lower-jaw hinge across teeth, gingiva and appliances, local button/text/voice control, preserved canonical measurements and natural-enamel selection glow.

- [3.25 — Local AI startup and professor pitch](3.25-ai-and-pitch.md): opt-in backend/frontend startup, bounded same-origin gateway, and a 3:45 narrated feature overview using labelled illustrations of the bundled model.

- [3.24 — Nael Teaching Studio](3.24-nael-branding.md): the owner-requested display name and N favicon, preserving existing voice commands and saved-state compatibility.

- [3.23 — Claude tooth diagram](3.23-atlas-tooth-diagram.md): replaces approximate icons with Claude's original crown/root drawings and proportional two-arch chart, preserving selection and missing-tooth spaces.

- [3.22 — Following gingiva and bracket placement](3.22-gums-and-bracket-placement.md): refreshes the released Claude geometry, follows displayed tooth movement with gingiva and provides surface-projected bracket position and in-plane angle controls that affect engaged-wire bending.

- [3.21 — Claude atlas and demo lectures](3.21-atlas-demo-integration.md): integrates the owner-selected Claude anatomy and visual language, with three finished lectures. This later explicit request supersedes the temporary lecture-content deferral in 3.20; professor-supplied courses and lecture authoring remain deferred.

- [3.20 — Crown and root movement trails](3.20-crown-root-trails.md): selected-tooth reference points and deterministic paths share the displayed playback source. Its lecture-content deferral was subsequently reopened for the ready-made demos in 3.21; professor-specific courses remain deferred.

- [3.19 — Public model annotations in the audience view](3.19-audience-annotations.md): tooth numbers, tissue/surface labels, schematic captions and the lecture pointer accompany the shared model. Public mechanics scale and display qualifications remain visible during question detours; notes stay private.

- [3.18 — Consistent lecture entry and view controls](3.18-lecture-controls.md): local text/voice sample entry, return to Explore, and compact camera/roots/Fit controls in Lecture. Reopening the active sample preserves its current work and history.

- [3.17 — Cancel obsolete AI requests](3.17-ai-cancellation.md): async provider operations, shared deadlines and disconnect cleanup for commands, explanations and the authenticated phone bridge.

- [3.16 — Mechanics-aware scene explanations](3.16-analysis-mechanics.md): Analyze receives actual support, anchorage, elastic and expander inputs with strict validation and anonymous appliance references. Hidden results and read-only replies remain protected.

- [3.15 — Lecture focus, audience presentation and mechanics](3.15-lecture-mechanics.md): approved follow-up adds closer teaching focus, fixed-camera comparisons, reduced chrome, a public audience window, qualitative tissue explanations, local demo assets and eight mechanics categories/17 variations. No lecture creation is restored.

- [3.9 — Ready-made lecture and free exploration](3.9-teacher-lectures.md): Lecture opens the fixed four-step translation/tipping sample directly in Teach. Rehearse exposes notes; questions precede answers; navigation and playback are deterministic; a question detour preserves the paused lecture and independent Explore workspace. There is no lecture authoring, local lecture library, import/export or saving.
- [3.2 — Lecture-ready opening](3.2-lecture-ready-opening.md): collapsed editing and commands, grouped controls, full-width model and preserved preview decisions. Dependency: [PR #13](https://github.com/ahmedgahalla/forma-teaching-studio/pull/13).

The current branch follows draft PR #27 at `9763e73` and retains the earlier [Phase 4](../phase-4-voice-lecture-assistant/README.md) voice, glossary, tooth-study and presentation work. The stacked PR does not trigger the current main-targeted CI workflow; it is not represented as CI-green or merged.

## Scope decision and remaining acceptance

See [acceptance evidence and rehearsal](3.19-acceptance.md) for the requirement-by-requirement source/test evidence, PR dependency order and unrun device/educator checks. Automated correctness and presentation acceptance are tracked separately.

The owner's latest request supersedes the earlier teacher-authoring scope: provide our own finished sample and remove lecture creation. **3.9 remains the consolidated first vertical slice** of the [Explore/Lecture proposal](https://github.com/ahmedgahalla/forma-teaching-studio/pull/12), retaining its runner, return and input work. Proposed 3.10–3.14 are not duplicate outstanding milestones; editing and persistence are deliberately excluded. Former browser lecture saves are untouched because the revised feature does not access them.

The original sample's four suggested allocations total **205 seconds (3 minutes 25 seconds), not yet measured**; the new anchorage and biology lectures each suggest 4–5 minutes. The earlier [3.9 verification record](3.9-teacher-lectures.md#acceptance-and-verification) recorded 2,383 passing tests and a BVH timeout; [3.15](3.15-lecture-mechanics.md#verification-and-acceptance) records the later timing fixes and full passing run. The current [3.28 verification](3.28-ui-ai-reliability.md#verification) passes 3,045 frontend tests, 659 backend tests and the remaining automated local checks. Real browser access is blocked by security policy; no browser, DPR 1/2, microphone or projector acceptance is claimed.

The owner subsequently authorized the presentation, local-asset, audience and biology improvements plus researched mechanics; those changes are recorded in 3.15. Educator review and real-device rehearsal remain outstanding. Authoring and arbitrary generated animation remain excluded.
