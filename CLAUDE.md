@AGENTS.md

# Audit procedure (Claude Code)

Standing procedure for "audit PR #N" or "audit branch X". Everything shared — standards, workflow, session protocols, verification gate — is in AGENTS.md; nothing shared lives only in this file.

1. **Run the session start protocol** (AGENTS.md). Address every `status: open` item in `docs/reviews/from-builder/` — fix or respond, then mark each `resolved` or `wontfix` with a reason.
2. **Check out the work.** Fetch the PR head or branch (`git fetch origin <branch>` + checkout, or the GitHub API equivalent). Never touch main directly.
3. **Review against AGENTS.md**, specifically:
   - file size (~300-line target) and line length (`npm run check:limits` on the diff's files)
   - component boundaries and single responsibility
   - duplicated or dead code
   - content kept as data, separate from logic
   - TypeScript strictness (no `any` escapes, no `@ts-ignore` without reason)
   - render-loop performance: allocations in RAF, missing disposal, geometry/material reuse; canvases have explicit CSS sizes
   - tests added for new logic; existing tests updated with behavior
   - docs updated: the relevant numbered phase doc (NOT STATUS.md — that's yours, after merge), PR template filled in
4. **Run the full verification gate** (AGENTS.md § Verification gate), plus a browser check of the affected screens against the baseline screenshots at DPR 1 and DPR 2.
5. **Write the review** to `docs/audits/YYYY-MM-DD-<branch>.md`, findings grouped as:
   - **Blocking** — must fix before merge
   - **Should fix** — soon, not necessarily this PR
   - **Suggestions** — improvements, optional
6. **Feed the learning loop:** every Blocking/Should-fix finding gets a root cause + prevention in `docs/lessons-learned.md` (increment an existing lesson's count or add a new one; promote per the rules there).
7. **Post a summary as a PR comment** (GitHub API or `gh` when available).
8. **Fix mechanical issues** (formatting, lint, dead code, obvious duplication) on a separate `naser/audit-<branch>` branch with its own PR, so the builder's history stays clean. **Design-level issues get reported only, never silently rewritten.**
9. **Merge decision.** Merge to main (merge commit, never squash/rebase) only when CI is green AND the audit has zero Blocking findings AND the PR updated its phase docs. Otherwise don't merge and report to Naser; Naser can override either way.
10. **After a merge:** delete the branch, update `docs/STATUS.md`, tag main if a phase completed (e.g. `v0.13-phase1`), then run the session end protocol (phase doc, inbox items, lessons, handoff note).

## PR lifecycle: standing delegation

Naser has delegated the full PR lifecycle to Claude Code via `gh` (installed and authenticated as `NaserShadid`, repo write access, no admin). Handle create, update, comment, audit, and merge per the merge rules above without asking Naser to open or merge a PR manually. `gh` is at `C:\Program Files\GitHub CLI\gh.exe` (not on this session's default PATH — call it by full path, or in bash via `gh` if it resolves). Still stop and report rather than acting when genuinely blocked — e.g. a merge rejected by branch protection for reasons outside the documented merge rules (misconfigured required status checks, missing admin rights), or anything else this procedure doesn't already resolve.
