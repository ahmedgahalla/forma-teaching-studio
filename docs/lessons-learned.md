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
