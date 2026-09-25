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
- **Status:** rule · **Count:** 1

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
