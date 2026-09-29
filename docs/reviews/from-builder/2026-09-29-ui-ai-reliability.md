# UI and AI reliability: review and acceptance

status: open

Branch: `ahmed/phase-3-ui-ai-reliability`, based on PR #27 (`9763e73`).

## Findings addressed

The demo worktree has no local AI environment; the original project has an OpenRouter setup. The owner's provider choice is pending, so credentials have not been copied and no live success is claimed. The old settings conflated key presence with provider access. Explicit reconnect, accurate status and shared bounded request errors address the recoverable UI side.

Backend classification previously collapsed provider connection, invalid request/model and permission errors into generic failures, and newer spend/usage limit codes appeared temporarily retryable. Fixed messages and endpoint regression tests now cover these distinctions without returning upstream text.

Source-based design review identified competing lecture controls and cumbersome access to later case steps. Named validated navigation, primary question/reveal actions and grouped teaching aids address those findings. Active aid exits stay reachable when the group is collapsed. This is source/DOM evidence, not visual acceptance.

## Verification

The automated gate passes: **3,045 frontend tests in 169 files**, **659 backend tests**, TypeScript, ESLint with zero warnings, Prettier, file limits (555 files), production static build and offline demo-asset checks. Frontend coverage increased by 54 tests and backend coverage by 20; no tests were removed. The first full frontend run caught an old assertion that disabling AI left Analyze active. The updated tests verify automatic return to local commands and retain a separate disabled-analysis guard; the final full run passes.

Main was fetched and merged before the PR and was already up to date. This stacked PR targets PR #27; the current main-targeted CI does not run on this base, so local checks are not represented as CI-green.

## Auditor action

- Review saved opt-out, explicit reconnect, cancellation/configuration races, wrong-service responses, safe error mapping and local-command fallback.
- Run the complete CI/gate against the final head and dependencies. Verify prepared case, braces workflow and typed command at DPR 1 and 2, including dropdown navigation, question detours, active-aid exits and keyboard focus.
- Capture before/after 1600x900 and narrow-screen evidence. A previous automatic security review rejected local-browser inspection and workarounds; no browser evidence is claimed here.
- Keep draft pending these checks. Provider choice and usable private configuration are required before separately confirming a real command and explanation.

Broader case-prop, try-mode and CSS cleanup inbox items remain open. No AGENTS.md or STATUS.md edits are included.
