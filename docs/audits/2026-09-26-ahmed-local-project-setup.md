# Audit — `ahmed/local-project-setup` (PR #3)

**Auditor:** Claude Code · **Date:** 2026-09-26 · **PR:** [#3](https://github.com/ahmedgahalla/forma-teaching-studio/pull/3) — "docs: establish the shared Forma project workflow"

## Scope

Docs-only PR: adds `docs/phases/phase-1-tooling/1.5-shared-project-workflow.md` (the shared pull/branch/PR workflow, dedicated checkout, environment notes for Ahmed's machine) and `docs/handoffs/2026-09-26-ahmed-local-project-setup.md`, and indexes the new sub-phase in `docs/phases/phase-1-tooling/README.md`. No application code changed.

## What the auditor did before review

The PR was opened against a stale base (`cac430b`, right after Phase 1 merged) and was several merges behind main (Phase 2 refactor, the Node version policy attempt, and this session's PR lifecycle/STATUS/handoff PRs). GitHub reported it `CONFLICTING`. Checked out the branch and merged main in locally: the only real conflict was `docs/phases/phase-1-tooling/README.md`, where both this branch (adding "1.5 — shared project workflow") and main (adding "1.6 — PR lifecycle delegation" from this session's own work) inserted a line after 1.4. Resolved by keeping both, ordered 1.5 then 1.6, and pushed the merge commit to `ahmed/local-project-setup`. This is mechanical (index-ordering only, no content judgment) and is why the PR now shows a "merge main" commit authored by the auditor.

Also hit and cleared a known local issue (lesson 6): the first `npm test` run locally showed one failing assertion in `teaching-case-audit.test.ts` (a stale hash) — a Windows working-copy artifact, not a real regression; force-refreshing `src/lib/teaching-cases.ts` (`rm` + `git checkout --`) cleared it and the full suite passed. Ahmed's own handoff for this PR independently reports hitting and fixing the same class of issue on his machine. `format:check` also flagged ~163 pre-existing files locally, none of which this PR touches — the same local CRLF drift, cross-checked against CI's Linux run rather than treated as a finding.

A second merge-from-main was needed before the actual merge: PR #5 (Node version policy) landed first — it introduced the Node 22/24 CI matrix, which the repo's branch-protection ruleset was updated to require by exact job name (`frontend (22)` / `frontend (24)`, plus `backend`). This branch's CI, still running the pre-matrix single `frontend` job, couldn't satisfy the new required checks until it merged main again to pick up the updated `.github/workflows/ci.yml`. This second merge was a clean auto-merge (no conflict) since PR #5's own phase doc had by then been renumbered 1.5 → 1.7 to leave 1.5 free for this PR — see lesson 10. See `docs/handoffs/2026-09-26-pr-lifecycle-session.md` and the PR #5 audit trail (comments on PR #5) for the full sequence.

## Review against AGENTS.md

- **File size / line length:** both new docs are well under any limit; `check:limits` reports 244 files OK.
- **Component boundaries / dead code / TS strictness / render-loop performance:** not applicable — no application code touched.
- **Content as data vs. logic:** not applicable.
- **Tests:** not applicable — no logic changed. The PR's own verification claims (in its handoff) are consistent with what the auditor reproduced.
- **Docs updated:** yes — the new sub-phase doc is indexed in the phase-1 README in the same PR, and a handoff note is included.
- **Accuracy of the workflow doc's technical claims:** spot-checked against AGENTS.md and current tooling — the pull/branch/push sequence, `pull.ff=only` / `fetch.prune=true` local config, `npm run setup`'s hook behavior, and the Node/Python version statements are all consistent with the current repo. No inaccurate or misleading instructions found.
- **Secrets:** the PR explicitly confirms `backend/.env` stays ignored and was not touched; nothing in the diff introduces a secret.
- **Scope creep:** none — exactly the three doc files declared.

## Verification gate

Run on the branch after merging main in (see above):

| Check                  | Result                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`             | 1,575 / 1,575 passing (after clearing the known local hash-drift artifact)                                                                                                                  |
| `npm run typecheck`    | clean                                                                                                                                                                                       |
| `npm run lint`         | clean, zero warnings                                                                                                                                                                        |
| `npm run format:check` | clean for both files this PR authored; ~163 pre-existing files flagged locally from Windows CRLF drift (lesson 6), none touched by this PR — CI's Linux run is the actual gate and is green |
| `npm run check:limits` | 244 files OK                                                                                                                                                                                |
| `npm run build`        | succeeds (static export)                                                                                                                                                                    |
| backend `pytest`       | 470 / 470 passing                                                                                                                                                                           |
| CI (GitHub)            | `backend`, `frontend (22)`, `frontend (24)` all pass on the pushed branch                                                                                                                   |
| Browser check          | not performed — docs-only PR, no screens affected                                                                                                                                           |

## Findings

**Blocking:** none.

**Should fix:** none.

**Suggestions:**

- The workflow doc bakes Ahmed's literal local machine path (`C:\Users\ahmed\Documents\Codex\Forma`) into checked-in documentation. Consistent with existing handoff-note precedent in this repo, but future onboarding docs meant for a third developer would read better with a generic placeholder path plus the concrete example as an aside.

## Merge decision

CI green (all three required checks) · zero Blocking findings · phase docs updated in the same PR → **merges**, per the standing merge rules. Merging with a merge commit (never squash/rebase) and deleting the branch after.
