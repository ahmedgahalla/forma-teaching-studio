status: open

# Existing audit generator uses an API above the declared Node floor

While checking the new gum-binding generator for Phase 3.22, source review found `scripts/audit-teaching-cases.mjs` imports `module.registerHooks`. Node documents that API as added in 22.15, while AGENTS and package engines declare 22.6 as the supported floor. Current local Node 22.23 and the CI major-version matrix do not expose that mismatch.

**Source:** [official Node module API history](https://nodejs.org/download/release/v24.0.1/docs/api/module.html#moduleregisterhooksoptions).

**Requested follow-up:** replace the existing audit script's hook with an implementation supported at 22.6 and verify the exact floor. Do not silently raise the project policy. The new gum generator must avoid copying the incompatible API. This finding does not affect the browser runtime or the measured current-version verification gate; exact-floor execution was not run in this session.
