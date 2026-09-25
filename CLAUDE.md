@AGENTS.md

# Audit procedure (Claude Code)

Standing procedure for "audit PR #N" or "audit branch X". Everything else — standards, workflow, architecture, verification gate — is in AGENTS.md and docs/architecture/overview.md; nothing shared lives only in this file.

1. **Check out the work.** Fetch the PR head or branch (`git fetch origin <branch>` + checkout, or the GitHub API equivalent). Never touch main directly.
2. **Review against AGENTS.md**, specifically:
   - file size (~300-line target) and line length
   - component boundaries and single responsibility
   - duplicated or dead code
   - content kept as data, separate from logic
   - TypeScript strictness (no `any` escapes, no `@ts-ignore` without reason)
   - render-loop performance: allocations in RAF, missing disposal, geometry/material reuse
   - tests added for new logic; existing tests updated with behavior
   - docs updated: STATUS.md, the relevant numbered phase doc, PR template filled in
3. **Run the full verification gate** (AGENTS.md § Verification gate), plus a browser check of the affected screens against the baseline screenshots.
4. **Write the review** to `docs/audits/YYYY-MM-DD-<branch>.md`, findings grouped as:
   - **Blocking** — must fix before merge
   - **Should fix** — soon, not necessarily this PR
   - **Suggestions** — improvements, optional
5. **Post a summary as a PR comment** (GitHub API or `gh` when available).
6. **Fix mechanical issues** (formatting, lint, dead code, obvious duplication) on a separate `naser/audit-<branch>` branch with its own PR, so the builder's history stays clean. **Design-level issues get reported only, never silently rewritten.**
