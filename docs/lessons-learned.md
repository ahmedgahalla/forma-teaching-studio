# Lessons learned

Both tools read this at session start (AGENTS.md § session start protocol). Every audit feeds it: each Blocking or Should-fix finding gets a root cause and a prevention here — increment an existing lesson's count on a repeat, otherwise add an entry. Findings in `docs/reviews/from-builder/` feed it the same way.

**Promotion rules:** on the second occurrence, promote the lesson to a rule in AGENTS.md. If it's mechanically checkable, automate it at any count (ESLint rule, CI check, or test). Prefer automation over rules, and rules over notes.

Entry format: mistake (with link) · root cause · prevention · status (`noted` → `rule` → `automated`) · count.

---

## 1. Stale generated files

- **Mistake:** `src/lib/teaching-case-audit.json` was committed without rerunning its script after `teaching-cases.ts` changed, so the audit test failed on main (found 2026-09-24; the hash was stale from commit `7fc4d2b`).
- **Root cause:** the generated file's regeneration step isn't part of anyone's edit workflow; nothing reminded the committer.
- **Prevention:** `teaching-case-audit.test.ts` pins the source/asset hashes and runs in CI via `npm test` — a stale audit now fails every PR. Regeneration command documented in AGENTS.md and `docs/architecture/overview.md`. Ordering rule: regenerate AFTER any formatting pass over `teaching-cases.ts`, never before — regeneration is the last step before commit.
- **Status:** automated · **Count:** 3 (stale on main; stale after the Phase 1 reformat; stale again in Phase 2.1 when a Prettier pass ran after regeneration — every one caught by the hash test)

## 2. Monolithic files

- **Mistake:** `Studio.tsx` grew to ~5,100 lines / 139 KB with ~70 useState hooks; `globals.css`, `classroom.ts`, `main.py` similar (see `scripts/check-file-limits.mjs` allowlist for the full list).
- **Root cause:** no size limit existed, and each feature added to the file that already had the context.
- **Prevention:** `npm run check:limits` fails CI for any non-allowlisted file over 300 lines or any 500+-char line. The allowlist shrinks in Phase 2 and must not grow.
- **Status:** automated · **Count:** 1

## 3. Minified-style code

- **Mistake:** `globals.css` was 80 KB in 64 lines (lines up to 23,000 chars); several TS files had ~5,000-char lines — undiffable and unreviewable.
- **Root cause:** no formatter; code was written/generated in a compressed style and never expanded.
- **Prevention:** Prettier is the formatting source of truth; `npm run format:check` fails CI on any unformatted file.
- **Status:** automated · **Count:** 1

## 4. DPR canvas sizing bugs

- **Mistake class:** canvases sized only by their device-pixel buffer render wrong (blurry or clipped) at non-1 devicePixelRatio; a projector or a scaled laptop display is exactly the demo environment.
- **Root cause:** the CSS size and the drawing-buffer size are separate; testing only at DPR 1 hides the mismatch.
- **Prevention:** canvases get an explicit CSS size (AGENTS.md code standards), and browser checks run at both DPR 1 and DPR 2 (verification gate step 8; auditor procedure).
- **Status:** rule · **Count:** 2 (initial canvas sizing; [Phase 4.3](phases/phase-4-voice-lecture-assistant/4.3-visual-clarity.md) found a ratio set only at renderer creation)

- **4.3 prevention:** observe the raw display resolution, re-arm after every change and update both renderer/composer ratios with teardown cleanup. Listener tests automate the lifecycle; real DPR 1/2 and monitor-move checks remain required.

## 5. Stale docs

- **Mistake:** `docs/PRODUCT_DIRECTION.md` § "Measured responsiveness follow-up" still says the cached-BVH collision optimization "has **not** been applied to production" — it is applied in `src/lib/analysis.ts` (WeakMap-cached `MeshBVH`, with `analysis.bvh.test.ts` as the regression oracle since commit `580bc8c`).
- **Root cause:** the code changed in a different PR than the doc that described its status; no rule tied them together.
- **Prevention:** docs are updated in the same PR as the change they describe (AGENTS.md documentation rules); the auditor checks this on every PR. The stale paragraph itself was corrected by the auditor on 2026-09-25 (Phase 1), with a correction note left in place.
- **Status:** rule · **Count:** 1

## 6. Line-ending drift

- **Mistake:** on Windows, `core.autocrlf` was converting working copies to CRLF while Prettier writes LF, making `format:check` unreliable and diffs noisy. Second occurrence (2026-09-25): the teaching-case audit pinned a SHA-256 of `public/models/forma-teaching-v1.json` computed from a stale CRLF working copy — the blob is LF, so the audit test passed on Windows and failed on CI's Linux checkout.
- **Root cause:** no `.gitattributes`; line-ending policy was left to each machine's git config. And adding `.gitattributes` does not re-smudge already-checked-out files — git leaves "clean" working copies alone until the file is recreated.
- **Prevention:** `.gitattributes` with `* text=auto eol=lf` plus binary rules; `format:check` in CI confirms LF end to end. When hashing tracked files (the audit script), the working copy must match the blob: after changing eol attributes, force-refresh (`rm <file> && git checkout -- <file>`) before regenerating pinned hashes; CI's Linux run is the cross-check.
- **Status:** automated · **Count:** 2

## 7. Manual setup steps get skipped

- **Mistake:** environment setup (venv creation, pip installs, `blame.ignoreRevsFile`, dependency re-installs after pulls) lived only as instructions in READMEs; steps got skipped, producing "works on my machine" drift between the two developers.
- **Root cause:** humans and tools follow the shortest path; anything not automated silently decays.
- **Prevention:** `npm run setup` is the single entry point (version checks, npm ci, venv + requirements, git config), and `.githooks/` post-merge/post-checkout hooks re-sync dependencies only when the lockfiles actually changed, enabled automatically by the npm `prepare` script. The session start protocol verifies sync.
- **Status:** automated · **Count:** 1

## 8. Incomplete lockfile after piecemeal installs

- **Mistake:** `npm ci` failed twice from a lockfile missing transitive entries — first locally (missing `@emnapi/core`), then on CI's Linux runner (missing `@emnapi/runtime` for Linux) even after a Windows-side `npm install` "repair", because platform-conditional optional dependencies only fully record on a clean regeneration.
- **Root cause:** incremental `npm i <pkg>` calls merged into an existing lock instead of resolving the full cross-platform tree.
- **Prevention:** when `npm ci` reports missing lock entries, regenerate wholesale (delete `package-lock.json` + `node_modules`, run `npm install`) rather than patching; CI's `npm ci` on Linux is the enforcement.
- **Status:** automated · **Count:** 2

## 9a. Required status checks named for the wrong CI shape

- **Mistake:** the repo owner enabled a branch-protection ruleset on `main` (`protect-main`, applied 2026-09-26) requiring status checks literally named `frontend` and `backend`. The Node version policy PR (#5) split the frontend job into a `[22, 24]` matrix in the same PR, so the reported check-run names became `frontend (22)` and `frontend (24)` — the required `frontend` context never posts, and GitHub reports the PR as "not mergeable: the base branch policy prohibits the merge" even though every actual check is green. This blocks not just PR #5 but every future PR, since the required context can never be satisfied under the new CI shape.
- **Root cause:** required status check names were set from the single-job CI config; nothing tied them to the workflow file, and a matrix strategy silently renames GitHub Actions check-run contexts to `<job> (<matrix-value>)`.
- **Prevention:** whenever a CI job gains/loses a matrix dimension or is renamed, update branch-protection required status checks in the same change (or immediately after, since only repo admins can edit rulesets). Before relying on a merge, verify actual check-run names on the PR head commit (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[].name'`) against the ruleset's `required_status_checks` (`gh api repos/<owner>/<repo>/rules/branches/main`), not just `gh pr checks`.
- **Status:** noted · **Count:** 1

## 9. Incremental typecheck false greens

- **Mistake:** during the Phase 2.4 classroom split, `npm run typecheck` reported clean while `tsc` with a fresh state found real missing-import errors; the broken state was even committed (fixed in the next commit). The full test suite caught it, but only after a misleading gate.
- **Root cause:** `tsc --incremental` reused a stale `tsconfig.tsbuildinfo` across large file moves and skipped re-checking affected modules.
- **Prevention:** the `typecheck` script now runs `tsc --noEmit --incremental false`, so local runs match CI's fresh-checkout behavior.
- **Status:** automated · **Count:** 1

## 10. Concurrent PRs claim the same next phase-doc number

- **Mistake:** PR #3 (`ahmed/local-project-setup`) and PR #5 (`naser/node-version-policy`) were both opened around the same time, each adding a new sub-phase doc numbered `1.5`, and each based on a main that predated the other's PR — so neither branch's diff showed the collision until an auditor session merged main into both and hit the same `docs/phases/phase-1-tooling/README.md` conflict twice (once against each other, once against a same-session doc that had already claimed `1.6`). Resolving it correctly required deciding which PR keeps `1.5` (the one merging first) and renumbering the other's file, heading, README index entry, and every cross-reference (handoff notes, etc.) on its branch before merge.
- **Root cause:** phase/sub-phase numbers are picked by each branch independently from its own base, with no reservation mechanism; two branches open at once will pick the same next number whenever neither has seen the other's doc yet.
- **Prevention:** no automation yet — sub-phase numbers aren't mechanically checkable across branches the way file limits or formatting are. When auditing a PR that adds a numbered phase/sub-phase doc, check `docs/phases/<phase>/README.md` on main _and_ grep open PRs' diffs for the same number before merging, not just the PR's own diff against its (possibly stale) base. Renumbering is mechanical once caught: rename the file, fix its own heading, the phase README line, and grep the repo for every reference to the old path/number.
- **Status:** noted · **Count:** 1

## 11. Collapsing UI without preserving active feedback

- **Mistake caught during implementation:** the first [Phase 3.2](phases/phase-3-demo-path/3.2-lecture-ready-opening.md) command disclosure hid local case errors when expanded; separate `toolsOpen` and active-panel states also disagreed after a mobile preview closed the sheet.
- **Root cause:** visual hiding was changed without treating command feedback and panel selection as shared interaction state. A persistent error could also obscure live voice feedback when combined into one label.
- **Prevention:** keep local alerts independent of live command status, preserve the mounted input, and derive tools visibility from the active panel. Interaction regressions now cover open/closed alerts, voice status plus Stop, draft preservation and panel consistency; browser checks cover effective viewer tools and preview decisions.
- **Status:** automated · **Count:** 1

## 13. Recursive tooling crosses into a parallel worktree

- **Mistake:** during [Phase 4.1](phases/phase-4-voice-lecture-assistant/4.1-hands-free-voice.md), broad Prettier and Vitest discovery traversed the orchestrator's nested `.claude/worktrees/` checkout. Targeted tests included duplicate baseline files; formatting also rewrote two generated JSON files there. The JSON changes were checked against the original parsed content and restored byte-for-byte from their own HEAD, leaving the parallel builder's work intact.
- **Root cause:** the orchestrator created the parallel worktree inside the project directory (`.claude/worktrees/`), and every root tool (Prettier, ESLint, Vitest, TypeScript) assumes one checkout under the project root. Separately, the Python cache's denied directory access stopped Prettier inside the builder's sandbox only; the same gate passed on the host.
- **Prevention:** create parallel worktrees outside the project directory. The orchestrator removed the nested worktree and reverted the temporary tool-config exclusions the builder had added, so root tooling configuration is unchanged. Before running recursive tools, check `git worktree list` for worktrees under the project root.
- **Status:** noted · **Count:** 1
- **Numbering:** 13 was chosen after checking the local open-PR worktrees: Phase 3.2 reserves 11 and the Phase 3 proposal reserves 12. Preserve those entries when merging; recheck later concurrent reservations per lesson 10.

## 14. Camera framing and completion need image-space evidence

- **Mistake:** [Phase 4.3 review](reviews/from-builder/2026-09-27-phase-4-3-visual-review.md) found that fitting empty corners of a world bounding box left actual crowns small and low. Integration review also caught exact restored pole cameras drifting under later OrbitControls updates and a fresh study gate overriding a same-geometry saved orbit.
- **Root cause:** bounds containment was treated as sufficient visual framing; assigning a camera was treated as completion without accounting for downstream control updates and fresh presentation state. The review revision also found that avoiding HUD overlap by shrinking the canvas permanently removed 22% of its usable area.
- **Prevention:** project actual shipped-model vertices to test occupancy, centering and roots/gingiva visibility. Keep the full canvas and share an overlay safe-area value between CSS and asymmetric camera framing. Hold exact programmatic poses until user interaction, defer settlement until the final transition frame, and record restored study state before automatic framing. Pure/DOM regressions cover these paths; projector baseline acceptance remains separate. AGENTS promotion is deferred under this revision's explicit no-AGENTS-edit instruction.
- **Status:** automated · **Count:** 4 (two earlier framing/restoration findings; Phase 4.5 findings 4 and 5)
- **4.5 root causes and prevention:** [Audit fixes](phases/phase-4-voice-lecture-assistant/4.5-audit-fixes.md) found tooth-study pole views changing camera up after OrbitControls had fixed its orbit frame, and focus/snapshot code reading an interpolated pose as intended state. Keep world +Y up, tilt pole directions, restore up and lookAt on cancellation, and read the active tween destination for chained commands and snapshots. Direction/projection, cancellation and destination regressions automate both protections. AGENTS promotion remains deferred under the explicit no-edit constraint.

## 15. Global keyboard targets are not always Elements

- **Mistake:** the [4.3 review revision](phases/phase-4-voice-lecture-assistant/4.3-visual-clarity.md) reproduced a `closest is not a function` exception in Studio when a keyboard event targeted Window/Document. Hold-to-talk and presenter handling already guarded their targets.
- **Root cause:** a TypeScript HTMLElement cast was treated as a runtime guarantee for a global event target.
- **Prevention:** check `event.target instanceof Element` before DOM traversal. The extracted workspace hook and hold-to-talk tests dispatch real Window/Document events and retain editable-field, composition, active-state and cleanup checks.
- **Status:** automated · **Count:** 1

## 16. Authored compound requests need sequential preflight

- **Mistake caught during implementation:** the initial [4.4](phases/phase-4-voice-lecture-assistant/4.4-explain-by-voice.md) glossary integration attempted to load a prepared case and choose a variant in one request, while the existing case preflight kept validating against the original case. Final review also caught a definition restore binding to the outgoing model rather than the snapshot's model.
- **Root cause:** the prior single-case-command rule made an immutable source scenario sufficient. Adding an authored exception changed that assumption; state-setter fixtures also did not emulate React's batched model identity changes.
- **Prevention:** permit only exact authored visual sequences across that boundary, advance the private preflight scenario after load, and restore model-bound presentation using the snapshot's model. Integrity tests validate every visual, an actual dispatch/runtime regression covers the paused torque request and Undo/Redo, and a React hook regression covers definitions across batched model restoration.
- **Status:** automated · **Count:** 2
- **4.5 recurrence:** loading an authored synthetic case advanced its scenario but retained the imported source model's capability flags/IDs, rejecting later PDL/bone actions. Advance model identity, synthetic capability and available IDs together; imported-case plan/preflight regressions now verify the full sequence. AGENTS promotion is deferred by the explicit no-edit constraint.

## 17. Fallback grammar must preserve existing grammar ownership

- **Mistake:** [Phase 4.5 finding 1](phases/phase-4-voice-lecture-assistant/4.5-audit-fixes.md) found the glossary swallowing mechanics explanations, including the Inspector's own command.
- **Root cause:** a broad question parser ran first and guarded only one of several existing grammars.
- **Prevention:** invoke glossary fallback only after the normal planner reports an unrecognized command. Preserve recognized grammar clarifications and test precedence across mechanics, case, arrangement, workspace, Try Mode, lesson/workflow narration and tooth study, with and without required context.
- **Status:** automated · **Count:** 1

## 18. Recognition silence is not an immediate service failure

- **Mistake:** [Phase 4.5 finding 2](phases/phase-4-voice-lecture-assistant/4.5-audit-fixes.md) found quiet classrooms accumulating four-second microphone restart gaps.
- **Root cause:** no-speech restarted through the error path, which detached the end callback that alone reset attempts after a long session.
- **Prevention:** reset attempts for normal no-speech/aborted ends and evaluate session duration in the shared restart path. Fake-clock regressions distinguish ordinary silence, long sessions and immediate repeated failures.
- **Status:** automated · **Count:** 1

## 19. Dismissal actions must preserve the active workspace

- **Mistake:** [Phase 4.5 finding 3](phases/phase-4-voice-lecture-assistant/4.5-audit-fixes.md) found “hide that” and “close the definition” switching a workflow to the case workspace.
- **Root cause:** the glossary claimed dismissal without an open definition, and all glossary actions were routed as case-opening actions.
- **Prevention:** require open glossary context to parse its close phrases, and preserve current mode for `id: null`. Workflow-mode regression tests cover both grammar ownership and action routing.
- **Status:** automated · **Count:** 1

Numbers 17–19 were checked against the current lessons and the parallel Phase 3 proposal's reserved lesson 12 before being assigned.

## 20. A saved pose needs its original model reference

- **Mistake caught during implementation:** [Phase 3.9 integration review](reviews/from-builder/2026-09-27-teacher-lecture-workflow.md) found static prepared-case captures losing source identity after playback was detached, and mechanics captures changing transforms without rebuilding their reference teeth.
- **Root cause:** visible transforms were treated as self-contained despite depending on registered model origins, tooth presence and reference frames. Rendered mechanics can also be magnified relative to their numerical result.
- **Prevention:** persist a bounded source descriptor alongside the visible pose; retain it through restore/recapture; reconstruct mechanics reference metadata together and save calculated views as explicit static poses. Bridge regressions cover omitted teeth, source origins, magnified shown poses, repeated restoration and mechanics revalidation. Runtime tests cover the independent paused lecture and original Explore return points, including answer/notes visibility.
- **Status:** automated · **Count:** 1

**Sample-only scope update (27 September 2026):** user-requested removal of authoring also removes capture/recapture and its tests. The source-descriptor lesson remains relevant to fixed sample restoration; current coverage verifies absolute poses, source validation and return snapshots. No current capture feature is claimed.

## 21. A clickable shortcut must use the same contextual planner

- **Mistake:** the same [integration review](reviews/from-builder/2026-09-27-teacher-lecture-workflow.md) reproduced a related glossary click switching tooth 46 to tooth 16, while typing the same request retained tooth 46.
- **Root cause:** the button called a context-free authored-action helper rather than the current-study planner already used by text and voice.
- **Prevention:** route shortcuts through the context-aware helper and compare actual clicked actions with the parsed request in a component regression. The new lecture navigation likewise has click, text and local-speech runtime parity tests.
- **Status:** automated · **Count:** 4

- **Sample-lecture recurrence:** the visible “Explore this question” button text was absent from local command aliases. Test exact labels through the parser as well as their button actions; the retired preparation phrase is rejected locally. This is automated rather than an unapproved AGENTS amendment.
- **Sample-entry recurrence:** the [3.18 review](reviews/from-builder/2026-09-28-lecture-control-gaps.md) found the Lecture button had no matching local opening command. Test entry from both case and workflow modes, destination preview rejection, AI preference and whole-request Undo/Redo through the actual provider routing boundary.
- **Trace-display recurrence:** the [3.20 review](reviews/from-builder/2026-09-28-crown-root-trails.md) caught a runtime-routed toggle still rejected outside Try Mode. Button/parser action equality alone missed the validator restriction. Exercise real plan validation in every visible control context, including prepared and ordinary cases; preserve local-only authority.

## 22. Replay preflight uses the saved request start

- **Mistake:** [Phase 3.9 review](reviews/from-builder/2026-09-27-teacher-lecture-workflow.md) found repeating Next on the last lecture step rejected as out of bounds, even though replay restores the previous request's starting state.
- **Root cause:** the lecture adapter discarded the runtime's `from` snapshot and checked current navigation state.
- **Prevention:** derive lecture/session/return context from the supplied snapshot during replay preflight. Regression tests repeat final-step navigation and a question detour, then verify the restored frame.
- **Status:** automated · **Count:** 1

## 23. Read-only lecture guards include model metadata edits

- **Mistake:** the same [review](reviews/from-builder/2026-09-27-teacher-lecture-workflow.md) found attachment commands editing a lecture model without entering the question exploration.
- **Root cause:** the guard covered tooth movement and scenario changes but omitted the separate attachment action kind.
- **Prevention:** guard attachment edits through the same runtime boundary as movements; regression tests prove rejection during teaching and allowance after explicit exploration.
- **Status:** automated · **Count:** 1

## 24. Observe canvas replacement without observing the render loop

- **Mistake caught during implementation:** [Phase 3.15 integration review](reviews/from-builder/2026-09-27-lecture-mechanics-audit.md) found the first audience-window observer subscribed to every descendant of the viewport, including labels rewritten during rendering.
- **Root cause:** canvas replacement was treated as arbitrary subtree mutation, despite the canvas and its host having stable direct-parent boundaries.
- **Prevention:** observe only the viewport's direct children and the current canvas host's direct children. Preserve model-replacement recovery while avoiding label/text updates; the audience lifecycle regression covers replacement and ignores label-only mutations.
- **Status:** automated · **Count:** 1

## 25. A mechanics configuration is not proof of a displayed mechanics result

- **Mistake caught during implementation:** [Phase 3.15 review](reviews/from-builder/2026-09-27-lecture-mechanics-audit.md) found example loading permitted during a partial geometric replay after an earlier experiment, jumping to its unseen endpoint.
- **Root cause:** the guard checked for a mechanics object, although geometric Apply retains a rebased configuration with `result: null` and the viewer then displays geometric replay.
- **Prevention:** use the same visible-source distinction as the viewer: only an actual mechanics result can reuse its unloaded reference while partway through playback. Regression coverage checks a truthy configuration without a result and preserves valid mechanical-response comparison.
- **Status:** automated · **Count:** 1

## 26. Heavy independent regression scenarios need distinct test boundaries

- **Mistake:** the existing actual-GLB BVH oracle repeatedly exceeded its aggregate 30-second limit while running three independent poses, although isolated runs could pass.
- **Root cause:** reference occlusion, crowding and deepbite shared one timeout and one failure label; normal machine load changed whether their combined duration passed.
- **Prevention:** [Phase 3.15](phases/phase-3-demo-path/3.15-lecture-mechanics.md) gives each existing pose a named case with its own fresh asset and unchanged 30-second limit. Keep the reference algorithm, exact results, deepbite crossing assertion and geometry/cache immutability checks. Do not remove assertions or change production behavior to satisfy timing.
- **Status:** automated · **Count:** 1

## 27. Lecture explanations must follow the displayed lecture state

- **Mistake:** [backend integration review](reviews/from-builder/2026-09-28-analysis-context-and-cancellation.md) found Analyze forwarding an old prepared-case context during the fixed lecture, losing static steps and misreporting revealed answers as hidden.
- **Root cause:** the session decorator updated command/narration context but inherited the separate analysis projection unchanged.
- **Prevention:** project current lecture title, question, comparison and revealed answer at the same session boundary; exclude notes and hidden answers, and preserve live scene context during Explore. Add static-step, reveal/hide and comparison regressions.
- **Status:** automated · **Count:** 1

## 28. Mechanics facts must distinguish anchorage from editing locks

- **Mistake:** the same [review](reviews/from-builder/2026-09-28-analysis-context-and-cancellation.md) found fixed supports and support stiffness changes generating identical Analyze facts.
- **Root cause:** the explanation payload reduced mechanics to wires/counts and geometric editing locks, omitting the configured load/support system.
- **Prevention:** [Phase 3.16](phases/phase-3-demo-path/3.16-analysis-mechanics.md) adds bounded matching client/server support, fixed-tooth, elastic and expander facts. Paired rigs and strict-reference tests distinguish supports from edit locks; private appliance names are replaced with consistent request-local aliases. Hidden-result exclusions remain tested.
- **Status:** automated · **Count:** 1

## 29. Frontend cancellation must reach the provider request

- **Mistake:** the same [review](reviews/from-builder/2026-09-28-analysis-context-and-cancellation.md) reproduced an aborted ASGI caller while the synchronous provider call continued.
- **Root cause:** browser cancellation and stale-result protection do not cancel a blocking SDK call running in a server worker thread.
- **Prevention:** [Phase 3.17](phases/phase-3-demo-path/3.17-ai-cancellation.md) uses async provider operations with a shared deadline across initial/repair calls and one post-body disconnect receiver. Tests exercise cancellation and awaited cleanup at both stages, observed completion/disconnect races and the authenticated phone bridge, preserving sanitized failures.
- **Status:** automated · **Count:** 1

## 30. Runtime journey fixtures should match loaded-model ownership

- **Mistake:** [Phase 3.15](phases/phase-3-demo-path/3.15-lecture-mechanics.md) comparison journeys exceeded their test timeout while repeatedly rebuilding all procedural crowns, roots and gums. An anatomy immutability assertion also spent its budget converting large buffers into arrays for deep equality.
- **Root cause:** the tests paid for fallback geometry generation on every step instead of matching the app's loaded canonical model, and used expensive scalar comparisons for unchanged binary geometry.
- **Prevention:** reuse canonical geometry with fresh per-load metadata in runtime fixtures, dispose it at suite teardown, and compare independent complete byte snapshots for geometry immutability. Preserve all journey actions, pose assertions and timeouts; retain separate geometry-generation coverage.
- **Status:** automated · **Count:** 1

## 31. A simplified lecture must retain its essential view controls

- **Mistake:** the [3.18 requirements check](reviews/from-builder/2026-09-28-lecture-control-gaps.md) found Lecture replaced the Explore heading and hid its toolbars, leaving no clickable camera, roots or Fit controls. Review of the replacement disclosure also found inherited viewport sizing could clip it inside the narrower model column.
- **Root cause:** each hidden toolbar was considered independently, and a shared menu's anchoring assumed the original toolbar layout.
- **Prevention:** mount the real lecture heading across teaching/rehearsal, static/demonstration and comparison states; verify essential controls remain and Explore keeps its own toolbar. Anchor the new popup to the complete heading and bound its width to that column. DOM/action-parity and CSS-contract regressions cover the correction; actual pixel layout still requires browser acceptance.
- **Status:** automated · **Count:** 1

## 32. An adapter no-op can still change request history

- **Mistake caught during implementation:** the same [3.18 review](reviews/from-builder/2026-09-28-lecture-control-gaps.md) found repeated lecture entry returned early in the session adapter but still paused playback, added an Undo entry and cleared Redo in the surrounding runtime.
- **Root cause:** idempotence was checked against the final scene snapshot without checking the earlier request lifecycle and history effects.
- **Prevention:** recognize only validated, exact same-document opening requests before interruption. Keep compound, malformed and different-document requests on the normal path. Runtime regressions cover active playback, existing Undo/Redo entries, recognized speech and AI preference, alongside normal cancellation and replay tests.
- **Status:** automated · **Count:** 1

## 33. A canvas stream omits meaningful public overlays

- **Mistake:** the [audience requirements review](reviews/from-builder/2026-09-28-lecture-control-gaps.md) found tooth numbers, tissue/surface labels and the lecture pointer absent from the audience video. Mechanics magnification and schematic-arrow captions were also omitted during question exploration.
- **Root cause:** the WebGL canvas was treated as the complete public model view, although these cues were rendered in adjacent DOM. Generic nonclinical text does not explain an exaggerated display scale.
- **Prevention:** [Phase 3.19](phases/phase-3-demo-path/3.19-audience-annotations.md) commits explicit public label coordinates only after a successful frame, using storage separate from pending geometry, and forwards display captions behind the existing reveal guards. Tests cover private-field exclusion, hidden results, source/presenter placement parity, reuse, pointer hiding and video-coordinate mapping. Real captured motion/alignment remains a device acceptance requirement.
- **Status:** automated · **Count:** 1

## 34. Canvas replacement can include a temporarily empty host

- **Mistake caught during implementation:** the same [3.19 review](reviews/from-builder/2026-09-28-lecture-control-gaps.md) found the connection retargeted its observer only after finding a canvas. A replacement host inserted empty could later receive a canvas without triggering the observer on the old host.
- **Root cause:** the replacement was assumed to be atomic across parent and child insertion.
- **Prevention:** recognize the explicit replacement viewer host and observe its direct children while it is empty. A lifecycle regression inserts the host and canvas in separate steps, while the existing label-mutation regression prevents reintroducing subtree observation.
- **Status:** automated · **Count:** 1

## 35. Anatomy replacement requires a capability and persistence audit

- **Mistake caught during integration:** the new atlas has connected multi-root trunks, baked material channels and fitted arch positions; the prior generic assumptions would invent sleeves across furcations, erase appearance on save/load and reapply an obsolete arch correction. See [3.21 analysis](reviews/from-builder/2026-09-28-atlas-integration.md).
- **Root cause:** model compatibility was broader than matching tooth IDs and vertex coordinates; root profiles, material programs and registration were implicit asset contracts.
- **Prevention:** identify the source asset, preserve every required channel, recalculate actual crown pivots/attachments, gate unsupported tissue overlays and regenerate the real geometry audit. Pin source hashes and test saved round trips, workflow transfer identity, clone shader hooks and capability boundaries. Transfers must validate against the actual selected canonical model, including a separate schematic classroom.
- **Status:** automated · **Count:** 1

## 36. Authored lecture instructions must match the active model's capabilities

- **Mistake caught during integration:** the first biology draft requested a bone/ligament cutaway on the new atlas after those overlays had correctly been disabled. See [3.21 review](reviews/from-builder/2026-09-28-atlas-integration.md).
- **Root cause:** content inherited an older scene recipe while the visual anatomy contract changed independently.
- **Prevention:** use the supported separate biology vignette, revise the exact presenter/student prompts, and assert every scene's anatomy flags and authored biology selection in the catalog tests. Apply the same boundary to glossary visual recipes and advance model capabilities during compound-request preflight.
- **Status:** automated · **Count:** 1

## 37. Adapted controls need tests through the existing interaction boundaries

- **Mistake caught during integration:** [3.21 review](reviews/from-builder/2026-09-28-atlas-integration.md) found an explicit lower-arch shortcut overwritten by the existing camera helper's selected-tooth fallback. New control selectors also needed to participate in the shared keyboard-overlay and voice-interaction rules.
- **Root cause:** isolated button tests replaced the real camera action and omitted the parent capture/global shortcut boundaries, so correct local callback arguments did not establish correct final behavior.
- **Prevention:** exercise explicit arch views through the real camera action, register new disclosures with the shared overlay detector, and cover new reference controls against the existing scene-interaction classifier. Preserve genuine workspace-change cancellation.
- **Status:** automated · **Count:** 1

## 38. Recalculation must consider the proposed activation

- **Mistake caught during integration:** [3.22 review](reviews/from-builder/2026-09-28-gums-and-bracket-placement.md) reproduced a neutral bracket reset followed by an invalid passive solve, rolling back the whole request. The editor also rounded unchanged coordinates during an angle-only edit.
- **Repeat:** [3.27 wire audit](reviews/from-builder/2026-09-29-case-journey.md) reproduced the same rollback when resetting wire width to zero. Actual-Atlas DOM/runtime regression coverage now protects both editors. Shared-rule promotion is proposed in that inbox item for the required joint AGENTS.md review.
- **Root cause:** the editor decided to recalculate from the old result and rebuilt all values from formatted text, rather than evaluating the proposed configuration and preserving untouched committed fields.
- **Prevention:** share activation eligibility with the state machine, evaluate the proposed configuration against immutable reference slots, and append Solve only when activation remains. Apply this to every activation editor, including wire width/twist, and keep exact untouched fields. DOM tests use a real solved bracket-only experiment and cover reset, remaining independent activations and precision.
- **Status:** automated · **Count:** 2

## 39. Deformation needs one consistent rest frame

- **Mistake caught during integration:** [3.22 review](reviews/from-builder/2026-09-28-gums-and-bracket-placement.md) found Class I/II/III gum margins receiving the existing rigid arch shift twice after tooth following was added.
- **Root cause:** static gum positioning and tooth movement encoded the same arrangement offset in different places. A new follower treated both as independent motion.
- **Prevention:** place rigid arrangement registration in matching rest origins and retain individual movement in poses. Assert world-pose equivalence for all arrangements, unchanged baseline gum buffers, local following, exact reset and saved mechanics-reference compatibility.
- **Status:** automated · **Count:** 1

## 40. Loaded geometry does not retain derived runtime bounds

- **Mistake caught during integration:** the [3.22 saved-case regression](reviews/from-builder/2026-09-28-gums-and-bracket-placement.md) reproduced a missing-bounds crash when following freshly decoded atlas gingiva.
- **Root cause:** the new deformation path assumed the asset adapter's derived bounding boxes also existed after JSON restoration, which reconstructs geometry attributes without those caches.
- **Prevention:** compute missing bounds in the consuming geometry routine and test the actual save/load path with bounds explicitly absent. Preserve source attributes while rebuilding derived state.
- **Status:** automated · **Count:** 1

## 41. Major-version coverage does not verify a minor-version floor

- **Mistake found during source review:** the [existing audit generator](reviews/from-builder/2026-09-28-audit-generator-node-floor.md) uses `registerHooks`, added in Node 22.15, although the declared minimum is 22.6.
- **Root cause:** copying a working script on a recent Node 22 release does not establish compatibility with the minimum supported minor release; the CI matrix selects current major releases.
- **Prevention:** check API introduction versions for new maintenance scripts and verify the exact declared floor when changing runtime-dependent tooling. The existing generator has a separate auditor follow-up.
- **Status:** noted · **Count:** 1

## 42. Component replacements must account for later responsive overrides

- **Mistake caught during review:** [3.23 source review](reviews/from-builder/2026-09-28-atlas-tooth-diagram.md) found the old workspace stylesheet's narrow-screen chart padding overrode the new component's mobile spacing.
- **Repeat:** [3.29 layout review](reviews/from-builder/2026-09-29-chart-lecture-clarity.md) found the voice viewport minimum exceeded the space allocated by its parent stage, while visible overflow let it paint into the following chart. The parent now owns the minimum and the child fits it; scrolling preserves separate sibling space. A shared-rule promotion is proposed in the inbox for joint agreement.
- **Root cause:** the parent stylesheet imports the component stylesheet first, then adds responsive rules targeting the same component.
- **Prevention:** search all selectors for a replaced component and check their import/source order at each affected breakpoint. Keep the chart's spacing in its own stylesheet and remove its obsolete parent override. Browser acceptance remains necessary for final appearance.
- **Status:** noted · **Count:** 2

## 43. Windows environment casing must survive configuration merging

- **Mistake caught during review:** [3.25 launcher review](reviews/from-builder/2026-09-28-ai-pitch-acceptance.md) found that a mixed-case inherited provider variable could fail to override private file settings and escape an uppercase-only frontend environment filter.
- **Root cause:** spreading Windows `process.env` into a plain object discards its case-insensitive lookup semantics; a case-sensitive prefix check also misses differently cased secrets.
- **Prevention:** canonicalize provider variable names when merging Windows settings, with inherited values taking precedence, and filter frontend provider variables case-insensitively. Test mixed-case inherited configuration and the child environments with dummy values.
- **Status:** automated · **Count:** 1

## 45. Backend reachability is not provider verification

- **Mistake found during diagnosis:** [3.28 review](reviews/from-builder/2026-09-29-ui-ai-reliability.md) found the demo checkout lacked private AI configuration, while Settings described key presence as a connected service and the footer implied interpretation was available.
- **Root cause:** repository files travel across worktrees but ignored environment files do not; a successful health response only confirms local reachability and configuration, not model access, credentials or credits.
- **Prevention:** inspect only configuration presence/provider classification in the actual serving checkout, preserve the owner's provider choice, offer explicit reconnection and distinguish configured status from a successful provider request. Connection and safe-error tests cover missing keys, wrong services, cancellation and billing/configuration failures. Copy private settings only with authorization; do not claim live acceptance from a health-only check.
- **Status:** automated (connection/error boundaries); live acceptance remains manual. **Count:** 1

## 46. Machine-read startup logs must disable terminal colour

- **Mistake found during live setup:** [3.28 startup review](reviews/from-builder/2026-09-29-ui-ai-reliability.md) found Uvicorn had bound successfully but the launcher timed out because ANSI codes interrupted its exact readiness string.
- **Root cause:** Uvicorn auto-detects colour from stdout; the Windows ignored stdout handle produced coloured stderr even though stderr was piped. The mocked readiness tests supplied only plain output.
- **Prevention:** explicitly request `--no-use-colors` for the launcher-owned Uvicorn process. Cover the coloured/plain output contract and preserve readiness based on the successful bind rather than merely application startup. Do not print captured backend stderr to diagnose it; use fixed event flags.
- **Status:** automated. **Count:** 1

## 47. Freeze source and tests before the final combined gate

- **Mistake caught during verification:** the first full [3.29 run](phases/phase-3-demo-path/3.29-chart-hover-lecture-clarity.md) loaded the old lecture clarification with the updated test expectation while the final copy correction was being saved. Four assertions failed despite the fresh focused run passing.
- **Root cause:** the combined gate started before all parallel review follow-ups were frozen, allowing the test runner to see two source revisions.
- **Prevention:** collect a final file-freeze acknowledgement from every contributor before the gate. Any subsequent code/test edit requires the affected tests and final acceptance run to use the same frozen revision. Do not classify a mixed-revision run as passing.
- **Status:** noted. **Count:** 1
