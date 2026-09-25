# ADR 002 — Builder/auditor workflow

**Date:** 2026-09-25 · **Status:** accepted · **Phase:** [1 — tooling](../phases/phase-1-tooling/README.md)

## Context

Two developers build this repo through two different AI tools: ChatGPT Astra builds features (`ahmed/...` branches), Claude Code audits and optimizes (`naser/...` branches). The tools don't share context except through the repo, sessions are stateless, and main must stay demo-safe at all times. The only instruction a developer gives a tool is the task itself, so the workflow must be self-executing from the repo's own docs.

## Decision

**Single rulebook.** AGENTS.md is the complete shared context, written as mandatory steps, and is the file both tools obey. CLAUDE.md holds only the auditor's audit procedure. Changes to AGENTS.md require a PR agreed by both developers. Shared content stays outside the auto-generated Next.js block, which `next dev` rewrites.

**Roles.** The builder builds features, follows AGENTS.md, updates its own phase docs and the PR template, checks `docs/reviews/from-auditor/`, writes periodic analyses to `docs/reviews/from-builder/`, and never touches `docs/STATUS.md`. The auditor reviews every builder PR against AGENTS.md, runs the verification gate and a browser check, writes reports to `docs/audits/`, fixes mechanical issues on separate `naser/audit-<branch>` PRs, reports design issues without rewriting them, addresses the `from-builder/` inbox each audit session, owns STATUS.md, and does not build features unless asked.

**Merge authority.** The auditor (Claude Code) merges a PR to main only when: CI is green, the audit report has zero Blocking findings, and the PR updated its phase docs. Any failed condition → no merge, report to Naser; Naser can override either way. Hard rule regardless: nothing is pushed directly to main by anyone or any tool, and main is never force-pushed. Merge method is always a merge commit — never squash or rebase, which would rewrite hashes and break `.git-blame-ignore-revs`. After each merge: delete the branch, update STATUS.md, tag main when a phase completes (e.g. `v0.13-phase1`). Phase 2 merges only after Phase 1, and only after updating from main.

**STATUS.md ownership.** Only the auditor edits `docs/STATUS.md`, after merges — a single-writer rule that prevents recurring merge conflicts on the one file every PR would otherwise touch. Builder PRs update only their own numbered phase/sub-phase docs.

**Session protocols.** Every session starts with: pull main, read STATUS.md, lessons-learned, the role's inbox, the current phase doc and the latest handoff, then a 3–5-line summary. Every session ends with: phase doc updated, inbox items written, lessons recorded, and a handoff note in `docs/handoffs/`.

**Cross-review inbox.** `docs/reviews/from-builder/` and `from-auditor/`, one file per finding with a `status: open|resolved|wontfix` line. The auditor resolves or answers every open builder finding at the start of each audit session.

**Learning loop.** `docs/lessons-learned.md` records mistake → root cause → prevention → status → count. Second occurrence promotes a lesson to an AGENTS.md rule; mechanically checkable lessons are automated at any count (ESLint/CI/test). Automation > rules > notes. Seeded with: stale generated files (automated via the audit-hash test), monolithic files (automated via `check:limits`), minified-style code (automated via `format:check`), DPR canvas sizing (rule: explicit CSS size + DPR 1/2 checks), stale docs (rule: same-PR updates), line endings (automated via `.gitattributes`).

**Governance.** Branches are small and short-lived; merge main into the branch before opening a PR; builders test unmerged work on their own branch and note cross-branch dependencies in the PR. Secrets live only in local, gitignored `.env` files; the repo and its history were scanned clean on 2026-09-25 and CI uses no secrets. Environments are pinned: Node 22 (`.nvmrc`, `engines`), Python 3.13 (backend), and CI uses the same versions.

**No private state.** All project context lives in the repo docs. No tool keeps project state in personal memory or machine-local notes; any session on any machine reconstructs full context from STATUS.md, the phase docs, the inbox, lessons-learned, and the handoffs.

## Consequences

- Reviews, decisions and lessons survive tool sessions and machine changes; either tool can pick up cold.
- Merge speed depends on the auditor completing audits; Naser remains the override for both directions.
- The merge-commit-only rule keeps history append-only; GitHub's repo settings should disable squash/rebase merge to make it mechanical (manual step for Naser).
