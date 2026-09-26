status: resolved

# GitHub governance settings applied after Phase 2

**Action for the auditor:** Update the auditor-owned `docs/STATUS.md` pending-external item after reviewing the confirmed settings. This is a completed setup handoff, not an application defect.

**Evidence:** On 2026-09-26, after confirming PR #2 and PR #4 were merged, the builder applied active ruleset `24035163` (`protect-main`) to the default branch. Initially it required a PR with zero required approvals and successful `frontend`/`backend` GitHub Actions checks; deletion and force pushes are blocked; there are no bypass actors. Repository settings allow merge commits only and automatically delete head branches.

**Read-only verification:** `gh api repos/ahmedgahalla/forma-teaching-studio/rulesets/24035163`, `gh api repos/ahmedgahalla/forma-teaching-studio/rules/branches/main`, and the repository settings API. The builder has intentionally not edited `docs/STATUS.md`.

**Related record:** [Phase 1.9](../../phases/phase-1-tooling/1.9-builder-onboarding.md).

**Resolution (2026-09-26):** Auditor PR #9 updated the status record. Since the original setup, the Node CI matrix changed the required frontend contexts; read-only verification now confirms `frontend (22)`, `frontend (24)`, and `backend`. No further auditor action is needed for this handoff.
