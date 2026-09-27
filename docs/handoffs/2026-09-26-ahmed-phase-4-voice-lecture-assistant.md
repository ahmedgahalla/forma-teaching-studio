# Handoff — Phase 4.1 voice-led lecture control

**Branch:** `ahmed/phase-4-voice-lecture-assistant` · **Role:** builder · **Dependency:** draft PR #13, inherited from `ahmed/phase-3-lecture-opening` at `ed2164e`

## Done

Read STATUS, lessons, all open auditor inbox items, current Phase 3 docs, latest relevant handoff and architecture. Used orchestrator-provided branch/dependencies without git writes or installation. Implemented hands-free recognition, final wake gate, settings, HUD in both scenes, presenter keys, context-aware navigation, FDI pair normalization with backend parity and optional spoken confirmations. Hold-to-talk remains the default. Extracted controller context and browser services and arrangement parsing to respect file limits; import paths remain compatible.

See [4.1](../phases/phase-4-voice-lecture-assistant/4.1-hands-free-voice.md) for exact scope, files, evidence and gate results. [ADR 004](../decisions/004-hands-free-voice.md) supersedes the old prohibition on continuous listening. Guides and in-app shortcuts are updated. No STATUS/AGENTS changes, new packages, new actions, endpoints or viewer loop changes.

## Verification

Baseline inherited handoff: **1,594 frontend / 470 backend tests**. Final scoped suite: **1,793 frontend tests in 63 files / 482 backend tests**. Format, fresh typecheck, zero-warning lint, format check, file limits (276 files), and diff whitespace check all passed. No tests removed or timeouts weakened; no GLB timeout occurred.

**Full build gate blocked:** `npm run build` exits 1 in the unchanged esbuild worker prebuild because it cannot read ancestor directory `../../..` (`Access is denied`), then cannot resolve the worker entry. An absolute-path diagnostic failed the same way. The supplementary direct Next build compiled, typechecked and exported all 3 pages successfully; it does not replace worker generation. Auditor/orchestrator must rerun the complete build with normal host access. Backend pytest passes with one generated-cache permission warning.

Real browser, microphone, projector and DPR 1/2 checks are explicitly unperformed under this task's constraints. New [auditor inbox request](../reviews/from-builder/2026-09-26-phase-4-1-voice-review.md) lists the remaining manual gate.

## Next and open questions

The orchestrator reviews and commits; this builder has made no git state changes and opened no PR. Merge PR #13 dependency in the prescribed workflow before this feature. Coordinate Phase 4.2 separately; its TeachingAction/schema/context/dispatch/Viewer files were avoided. Phase 4.3 visual clarity remains planned.

Explicit limitation: paused recognition cannot hear a new spoken Stop during narration. Bare Stop works during playback while recognition runs; UI Stop/Escape/hold-to-talk interrupt speech. Supporting simultaneous speech output and always-audible Stop requires a separate audio design. No clinical review or validation is implied.

The pre-existing props/CSS/Try Mode inbox items and Node-policy sign-off remain separate from this scope. Lesson 13 records the discovered recursive-tooling issue: root checks had traversed the nested Phase 4.2 worktree. Two formatter-only JSON rewrites there were verified semantically unchanged and restored to their exact original blob bytes; the parallel builder's work was preserved. The orchestrator then removed that worktree and reverted the temporary tool-config exclusions; the full gate passed on the host. Local open-PR worktrees were checked before reserving lesson 13 (11 and 12 already exist on earlier branches).

## Phase 4.2 — Tooth study, 2026-09-27

Implemented the complete A–F slice on `f85ba7e`: authored anatomy for 28 teeth, strict local-only study actions, camera and direction labels, explanation card and View entry point, local name/view/explanation grammar, whole-request restoration and presenter navigation. Explanations go through adapter narration and the existing 4.1 speaker/HUD; Escape interruption and workflow-to-case request history are tested. Omitted side means the patient's right. Every content surface marks the synthetic anatomy as a teaching draft pending educator review.

The earlier `fbdc57a` partial implementation was inspected read-only and useful ideas reimplemented against 4.1; its probe test was ignored. No git mutations, installs, new dependencies, STATUS/AGENTS edits or backend schema changes. The orchestrator still owns review and commits. All modified allowlisted files shrank; the file-limit allowlist and BVH test timeout are unchanged.

See [4.2 implementation, file inventory and exact final gate](../phases/phase-4-voice-lecture-assistant/4.2-tooth-study.md) and [Tooth study guide](../TOOTH_STUDY.md). Scope review fixed close-then-explain context ambiguity by requiring close last, and stale study state on same-model case reset/variant/return. Whole scene restoration is covered by actual dispatch/snapshot/runtime tests. General anatomy remains pending educator review.

The automated suite passes **1,959 frontend tests in 71 files** (baseline 1,793/63), fresh typecheck and file limits pass, and backend remains **482 passing tests**. Root format/lint/format-check cannot scan `backend/.pytest_cache` in this sandbox; accessible-source alternatives pass. The normal build remains blocked in esbuild worker prebuild by ancestor-directory access. Direct Next compilation/static export passes as a supplementary check. The phase doc records exact commands. These environmental blocks are not passing full gates.

Next: orchestrator reviews and commits; rerun exact root format, lint, format-check and full build on the host, then auditor performs visual, projector, microphone and DPR 1/2 checks plus educator content review. No browser/device check was possible in this task. [Auditor inbox](../reviews/from-builder/2026-09-27-phase-4-2-tooth-study-review.md) lists acceptance scenarios. The pre-existing inbox items stay separate. Study is session-only; DOM labels/card/HUD are not included in the WebGL PNG export.

## Phase 4.3 — Visual clarity, 2026-09-27

Implemented A–E on `73d230a`: bottom captions sized from each viewport (revised below to overlay the full canvas), larger/centered dental framing, 520 ms interruptible camera transitions, ivory enamel and subdued tissue reflections, Clinical canvas separation, and live capped DPR changes. Camera completion participates in the render barrier. Exact restored pole poses remain unchanged on idle frames, and a same-geometry study rebuild retains its camera. The study explanation already occupies a separate grid region; no card refactor was necessary.

The orchestrator owns commits and review. No git mutations, installs, new dependencies, asset changes, STATUS/AGENTS edits or allowlist changes. See [4.3](../phases/phase-4-voice-lecture-assistant/4.3-visual-clarity.md) for files, decisions, exact gate and remaining limitations. Baseline was 1,959 frontend tests / 71 files and 482 backend tests. No tests removed or BVH timeout altered.

The sandbox still blocks exact root format/lint/format-check on `backend/.pytest_cache` and full build at the esbuild worker prebuild's ancestor access. Accessible-source checks and direct Next compilation are supplementary, not substitute passing gates. No browser/device check was possible. New case/workflow/study screenshot baselines, both themes and DPR 1/2, are required; the orchestrator will capture them. The [4.3 auditor inbox](../reviews/from-builder/2026-09-27-phase-4-3-visual-review.md) lists acceptance cases and host reruns.

The initial shortened-canvas design was superseded by the review revision below. Width aims at 78% when height permits; full-root views on wide/short canvases must remain narrower to avoid clipping. Clinical/projector readability and educator review remain unverified. Existing unrelated inbox work stays separate.

Initial 4.3 gate before review revision: **2,004 frontend tests / 77 files**, **482 backend tests**, fresh typecheck and file limits (318 files) pass. Viewer remains 1,273 content lines, WorkflowStudio 761. Scoped formatting/lint and direct Next static export pass. The exact sandbox-blocked gates above remain blocked; one earlier concurrent-build suite hit the unchanged BVH timeout before the final standalone full pass. The 65–80% width goal remains height-constrained on wide full-bite canvases: the centered illustrative default view is 58.88% width with crowns and 30.95% with roots, both 90% available height. See the phase doc for evidence and reasons.

## Phase 4.3 review revision - full canvas and keyboard targets

The orchestrator reported the initial host gate green (2,004 frontend / 482 backend tests, format, lint, limits and build), then required a full-size canvas. Removed the 22% canvas/label crop. A shared `VOICE_HUD_SAFE_AREA = 0.2` now drives the overlaid HUD CSS and asymmetric camera fit. Default/front full-model fits include actual visible gingiva, with top clearance; tooth study uses the same safe area and retains its separate explanation card. User orbit/zoom may cross under transient captions. Safe-area and real-GLB upper/lower-bound regressions replace reduced-canvas assumptions.

The global closest() crash was in Studio, not hold-to-talk. Extracted its existing handler to useWorkspaceKeys with an Element guard, and added Window/Document tests for both keyboard paths. No git mutations, installs, asset changes, AGENTS/STATUS edits or timeout changes. Exact revision gate results are in the updated 4.3 phase doc. Host/browser verification and new full-canvas baselines remain the orchestrator's next step.

Aspect-ratio resize also updates the asymmetric fitted target, preserving user pan and relative zoom; same-aspect resize preserves exact saved camera coordinates. Four regressions cover lecture/study narrow-to-wide visibility and pose preservation.

Final revision gate: **2,028 frontend tests / 78 files** (27.46 s, +24 from the reviewed implementation), **482 backend tests** (4.82 s, one cache warning), fresh typecheck and file limits (321 files) pass. Viewer shrinks from 1,273 to 1,261 lines; Studio 984 to 968; WorkflowStudio stays 761. Exact root format/lint/format-check remain sandbox-blocked by the pytest cache, and full build by esbuild ancestor access. Accessible-source formatting/lint and direct Next static export pass. No browser/device check was possible; host reruns and new full-canvas screenshots remain required.
