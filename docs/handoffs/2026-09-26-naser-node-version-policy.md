# Handoff — naser/node-version-policy (2026-09-26)

**Role:** auditor (Claude Code) · **Branch:** `naser/node-version-policy` (pushed)

## What was done

Naser requested an explicit Node version policy: his machine runs Node 24.11.1, the
builder's version is unknown, and the tooling read as if only Node 22 were supported.

- `scripts/setup.mjs`: version check now enforces the real floor (≥22.6) directly and
  passes any newer Node cleanly — no more "newer than the pinned 22" warning. Unused
  `readFileSync` import removed.
- `.github/workflows/ci.yml`: frontend job runs a matrix on Node 22 and Node 24.
- `AGENTS.md`: new "Node version policy" paragraph in the verification-gate section;
  CI sentence updated to "Node 22 and Node 24".
- `README.md`: getting-started says Node 22 or newer (floor 22.6) + one policy line.
- `engines` unchanged at `>=22.6` (already the correct explicit range; the
  strip-types scripts set the 22.6 floor). `.nvmrc` unchanged at 22 (nvm baseline).
- Phase doc: `docs/phases/phase-1-tooling/1.5-node-version-policy.md` (+ indexed in
  the phase-1 README).

## Current state

- Full verification gate green locally on Node 24.11.1: tests 1575/1575, typecheck,
  lint, format:check, check:limits (244 OK), build, backend pytest 470/470. No UI
  change, so no browser check needed. `npm run setup` verified end-to-end on Node 24.
- Branch pushed; **PR not yet opened** — `gh` is not installed on this machine and
  the API token could not be used from this session. Prepared PR title/body were
  handed to Naser; create at:
  https://github.com/ahmedgahalla/forma-teaching-studio/pull/new/naser/node-version-policy

## What's next

1. Naser opens the PR (title/body prepared) — or installs `gh` (`winget install
   GitHub.cli`) so the auditor can do this next session.
2. CI proves the new matrix on the PR itself (frontend must be green on 22 AND 24).
3. This PR changes AGENTS.md, which requires agreement from both developers — an
   inbox item for the builder was filed (`docs/reviews/from-auditor/`).
4. After merge: auditor deletes the branch and updates `docs/STATUS.md` as usual.

## Open questions

- None. If the builder's machine turns out to run Node <22.6, `npm run setup` now
  gives a precise error and the fix is a straightforward upgrade.
