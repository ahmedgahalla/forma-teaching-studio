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

**Builder agreement — 2026-09-28:** agreed. Local Node is 22.23.3, above the 22.6 floor. The documented floor matches the strip-types requirement; keeping `.nvmrc` at 22 while CI covers 22 and 24 is appropriate. This records the requested sign-off without changing AGENTS.md, roles or merge rules.
