# Phase 1 — tooling

**Status:** in review · **Branch:** `naser/phase-1-tooling` · **PR:** #1 (see repo) · **Owner:** auditor (Claude Code)

**Goal:** give two developers working through two different AI tools a shared, self-enforcing foundation — one rulebook, mechanical formatting and linting, CI as the merge gate, a docs system that carries all project context, and automated environment setup — with zero behavior change to the app.

## Sub-phases

- [1.1 — rulebook and CI](1.1-rulebook-and-ci.md): AGENTS.md as the self-executing shared rulebook (session protocols, roles, merge rules, governance), CLAUDE.md audit procedure, architecture overview doc, CI workflow, PR template, reviews inbox, lessons-learned, environment pinning, secrets audit
- [1.2 — formatting and linting](1.2-formatting-and-linting.md): Prettier + repo-wide reformat (+blame-ignore), ESLint 9 flat config, line-ending normalization, file-limit CI check
- [1.3 — test fix and docs](1.3-test-fix-and-docs.md): stale teaching-case audit regenerated (suite fully green), STATUS.md + numbered phases + ADRs 001–002, no-private-state migration
- [1.4 — setup automation](1.4-setup-automation.md): `npm run setup`, self-enabling git hooks for dependency sync, README getting-started
- [1.5 — Node version policy](1.5-node-version-policy.md) (post-merge follow-up): explicit Node ≥22.6 supported range, setup check accepts newer majors, CI matrix on Node 22 + 24, policy documented in AGENTS.md and README

## Outcome — verification gate on the final branch state (2026-09-25)

| Check                  | Result                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`             | 1,599 / 1,599 passing (51 files) — first fully green suite (main had 1 failing)                                                                                                                                                                  |
| `npm run typecheck`    | clean                                                                                                                                                                                                                                            |
| `npm run lint`         | clean, `--max-warnings 0`                                                                                                                                                                                                                        |
| `npm run format:check` | clean                                                                                                                                                                                                                                            |
| `npm run check:limits` | 151 files OK                                                                                                                                                                                                                                     |
| `npm run build`        | clean static export                                                                                                                                                                                                                              |
| backend `pytest`       | 531 / 531 passing                                                                                                                                                                                                                                |
| Browser check          | all six baseline screens match `docs/baselines/2026-09-25-main-0b2e7db/` at 1600×900 (only playback-timing differences); DPR 2 verified crisp; clicked through a prepared case, the braces workflow, and typed commands (bracket + wire install) |

## Notes

- The repo-wide reformat commit (`206297e`) and this branch must merge with a **merge commit** (never squash/rebase) so `.git-blame-ignore-revs` keeps working.
- Timed against an empty builder queue: main's `0b2e7db` was pulled before branching and nothing was unpushed on the builder side.
- Discovered along the way: `package-lock.json` was out of sync after the tooling installs (npm ci failed); repaired with `npm install` — CI's `npm ci` step guards this permanently.
