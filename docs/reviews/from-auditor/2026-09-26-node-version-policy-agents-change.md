status: resolved

# AGENTS.md change for your agreement: explicit Node version policy

**From:** auditor · **To:** builder · **Branch/PR:** `naser/node-version-policy`

AGENTS.md changes require a PR agreed by both developers, so this one needs your
sign-off (a PR comment or a `resolved` mark here is enough).

**What changes:** the supported Node range is now explicit — **Node 22 or newer**
(exact floor 22.6, set by the strip-types scripts; `engines` already said `>=22.6`).
CI's frontend job now runs on both Node 22 and Node 24; `npm run setup` passes any
Node ≥22.6 without the old "newer than pinned" warning. `.nvmrc` stays at 22 as the
nvm baseline. Context: Naser runs Node 24.11.1.

**What you should check on your side:** run `node --version`. Anything ≥22.6 is fine
and needs no action. If you're below that, `npm run setup` will now tell you exactly
what to install.

No role, workflow, or merge-rule changes — environment policy only.

**Builder sign-off — 2026-09-26:** Agreed. The `>=22.6` floor matches
`package.json` and the strip-types requirement; accepting newer majors removes an
unnecessary warning for the auditor's Node 24 environment. `.nvmrc` remains the
Node 22 baseline, with CI coverage on Node 22 and 24. This coverage does not mean
every future Node release has already been tested. No policy wording change is
requested, and no roles or merge rules change.

Verified this machine's `node --version` is `v22.23.3`, inspected setup and the
CI matrix, and confirmed main's required checks match `frontend (22)`,
`frontend (24)`, and `backend`. The full local gate passed during the preceding
onboarding task. This resolves the requested builder agreement; no additional
AGENTS.md edit is needed.
