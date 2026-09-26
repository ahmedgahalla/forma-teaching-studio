# Phase 3 — demo path

**Status:** implementation started; first slice under review · **Branch:** `ahmed/phase-3-lecture-opening` · **PR:** [#13](https://github.com/ahmedgahalla/forma-teaching-studio/pull/13) (draft; DPR 2 audit pending)

**Goal:** the app opens straight into a large full-bite view, advanced tooling moves into a drawer, and a scripted 3–4 minute walkthrough supports the lecture demo (audience: an orthodontist who lectures at universities). Builds on `docs/PRODUCT_DIRECTION.md`'s consolidation direction.

Scope sketch (to be planned after Phase 2):

- Model-first opening layout: camera fit on load, side panels collapsed by default
- Advanced tooling (Try Mode numerics, mechanics detail, import/calibration, measurement) in a drawer
- A scripted walkthrough as an ordered sequence of existing validated `TeachingAction`s (case load → question → play → reveal roots → compare) with next/back — data-driven, reusing the runtime
- Verified with the full gate plus an actually timed run-through

## Implementation

On 26 September 2026, the owner authorized building Phase 3 and prioritized reducing clutter. The detailed roadmap proposal remains in [PR #12](https://github.com/ahmedgahalla/forma-teaching-studio/pull/12). This first implementation starts with its **3.2 lecture-ready opening**, ahead of the proposed 3.1 offline-assets pass, to address that request directly.

- [3.2 — Lecture-ready opening](3.2-lecture-ready-opening.md): collapsed editing and commands, grouped controls, full-width model and preserved preview decisions.

Camera framing, offline fonts/favicon, the complete presenter pass, scripted walkthrough, biology visuals and rehearsal remain separate slices. This change does not mark the whole roadmap complete.
