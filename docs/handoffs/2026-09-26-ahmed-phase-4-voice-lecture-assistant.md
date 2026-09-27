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

## Phase 4.4 — Explain by voice, 2026-09-27

Implemented A–D/D2 on `24231c7`: forty authored glossary entries, deterministic question grammar, validated visual-plus-definition requests, side/below-model definition card and related buttons, shared narration, full-scene Undo/Redo, ten-step tooth anatomy tour, Guide/Library discovery and timed normal-caption fallback when speech output is unavailable. Every content entry remains a teaching draft pending educator review. Optional Analyze is unchanged; authored glossary requests never need the AI service.

See [4.4](../phases/phase-4-voice-lecture-assistant/4.4-explain-by-voice.md) for the exact gate, files, deliberate test changes, and limitations; [Glossary](../GLOSSARY.md) describes content sources. No git mutations, installs, new packages, asset changes, STATUS/AGENTS edits, allowlist additions or BVH timeout changes. The orchestrator reviews and commits. Allowlisted files remain at or below the supplied HEAD lengths.

The final tour step returns to the full mouth while keeping its ribbon available for “explain this step”; close/end/back to full mouth ends the lesson. Unknown “show me” wording keeps its existing interpreter behavior unless it matches a glossary term; unknown explanation questions clarify locally. Definition close preserves the accompanying visual.

Final gate: **2,193 frontend tests / 88 files** (25.42 s), up from 2,028/78; **482 backend tests**, unchanged. Fresh typecheck and file limits (348 files) pass. Root format/lint/format-check remain blocked on the inaccessible pytest cache; full build remains blocked in esbuild worker prebuild. Accessible-source formatting/lint and direct Next compilation/static export pass as supplementary evidence. Five old speech-failure rejection tests were replaced by caption fallback tests; no BVH timeout changed. Lesson 16 records sequential preflight for authored compound requests.

Next: rerun sandbox-blocked root format/lint/format-check and esbuild prebuild on the host; audit prepared cases, braces workflow, glossary/tour, typed commands, speech fallback, both themes, projector and DPR 1/2. No browser/device check was possible. [Auditor inbox](../reviews/from-builder/2026-09-27-phase-4-4-explanation-review.md) records those acceptance items. The pre-existing props/CSS/Try Mode/Node-policy inbox items remain separate.

## Phase 4.5 — Audit fixes, 2026-09-27

Addressed all eleven audit findings on supplied HEAD `9c6592f`: normal grammar precedes glossary fallback; definition dismissal preserves workspace; generic surface definitions retain the studied tooth; synthetic prepared-case capability preflight works from imports; exploration captures the pre-study mouth; study cameras preserve world-up and manual orbit; chained focus/snapshots read tween destinations; label clamping reserves the review caption; silence does not accumulate restart backoff; mishearing aliases are local-only and silent when rejected; hidden tabs pause microphone recognition.

Regressions were run before production fixes to reproduce each finding. The exploration choice is to close tooth study and preserve its prior mouth/camera for prepared-case return, including React's batched-state case. [4.5](../phases/phase-4-voice-lecture-assistant/4.5-audit-fixes.md) records causes, individual tests and the exact gate. Voice/Professor/Tooth Study guides, Settings and ADR 004 are aligned. Lessons 14/16 were incremented and 17–19 added after checking the parallel phase's reservations. Phase 4 builder inbox entries mark the automated audit fixes addressed while retaining open manual/educator acceptance.

No git state changes, installs, dependencies, AGENTS/STATUS edits, allowlist additions or BVH timeout changes. The installed npm lockfile versions and backend pinned requirements match. The orchestrator reviews and commits. Browser inventory is empty, and opening an in-app browser reports “Browser is not available: iab”; microphone/projector/DPR 1/2 checks require the host.

Final counts: **2,258 frontend tests / 90 files** (+65 tests, +2 files from 2,193/88), all passing with `npm test -- --maxWorkers=2` (51.61 s); **482 backend tests** passing (8.47 s, one cache-permission warning). Exact default `npm test` ran twice and each reported 2,257 passing plus the unchanged real-GLB BVH oracle exceeding 30 seconds; its isolated suite passes 3/3 in 17.99 s. No test/configuration timeout changed, and timing alone is not a proven root cause.

Fresh typecheck and limits (352 files) pass. Exact root format (exit 2), lint and format-check (exit 1) remain blocked by pytest-cache enumeration; full build (exit 1) remains blocked in esbuild worker prebuild by ancestor access. Scoped source/docs formatting, scoped ESLint (zero warnings), direct Next compilation/static export and `git diff --check` pass. Allowlisted files did not grow. Next: host reruns of default tests and blocked gates, then browser/device/educator acceptance. Independent review also added and fixed a regression ensuring accepted aliases cancel stale Analyze work while rejected aliases remain no-ops.
