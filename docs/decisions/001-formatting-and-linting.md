# ADR 001 — Formatting and linting

**Date:** 2026-09-25 · **Status:** accepted · **Phase:** [1 — tooling](../phases/phase-1-tooling/README.md)

## Context

The codebase had no formatter or linter. Several files were effectively minified (globals.css: 80 KB in 64 lines; Studio.tsx lines up to ~4,900 characters), which made review, diffing and pair-work between two AI tools impractical. Two developers now share the repo through PRs, so style must be mechanical, not judgment.

## Decision

**Prettier** (exact-pinned) is the single source of formatting truth. Config choices, made to match the dominant existing hand style so the reformat changes layout, not idiom:

- `printWidth: 100` — the code is dense; 80 would explode line counts, 120 hurts side-by-side review.
- `singleQuote: true` — the existing style throughout.
- `arrowParens: "avoid"` — matches the existing `tooth => …` style.
- `endOfLine: "lf"` — the repo is LF; keeps Windows checkouts from flapping.
- Everything else stays at Prettier defaults (semicolons, trailing commas) to minimize config surface.

Ignored: build output (`out/`, `.next/`), generated files (`public/workers/`, `src/lib/teaching-case-audit.json`, `package-lock.json`, `next-env.d.ts`), binary asset folders, and `backend/.venv`.

**ESLint 9** (flat config, `eslint.config.mjs`) with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` + `eslint-config-prettier/flat` (Next 16 removed `next lint`; the ESLint CLI is the supported path per the bundled Next docs). Mechanical violations are fixed; anything needing real judgment gets a disable comment with a `TODO` explaining what to revisit.

The one-commit repo-wide reformat is recorded in `.git-blame-ignore-revs` so `git blame` (with `blame.ignoreRevsFile` configured) skips it.

## Consequences

- CI enforces `format:check` and `lint`; hand-formatting against Prettier is a CI failure, not a review comment.
- The reformat commit touches nearly every file — it was timed against an empty builder queue and must not be cherry-picked or reverted piecemeal.
- `git config blame.ignoreRevsFile .git-blame-ignore-revs` is a one-time local setup each developer should run.
