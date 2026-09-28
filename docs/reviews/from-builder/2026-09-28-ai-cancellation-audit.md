# Review request — AI cancellation and deadlines

status: open

**Branch:** `ahmed/phase-3-ai-cancellation` · **Phase:** [3.17](../../phases/phase-3-demo-path/3.17-ai-cancellation.md) · **Base:** draft PR #16 · **PR:** [#17 (draft)](https://github.com/ahmedgahalla/forma-teaching-studio/pull/17)

Please review the async provider conversion and shared request-lifetime helper, especially cleanup during caller/middleware cancellation, observed disconnect-versus-success races and the single repair's original deadline. The authenticated phone bridge must release its upstream slot on every exit while retaining its existing security and rate limits. Request bodies are consumed before the helper starts its only ASGI receiver.

No dependency, prompt, command-authority, solver or UI change. Existing contract assertions remain; new tests use in-memory requests and controlled provider fakes. The full automated local gate passed: 2,551 frontend and 619 backend tests, with detailed results in the phase document. Real provider/gateway/browser acceptance remains unverified, and cancellation cannot guarantee remote computation or billing stops. Do not merge the stacked PR before the existing CI, audit and phase-document requirements are satisfied.
