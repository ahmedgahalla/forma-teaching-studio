# Review request — mechanics-aware explanations

status: open

**Branch:** `ahmed/phase-3-analysis-mechanics` · **Phase:** [3.16](../../phases/phase-3-demo-path/3.16-analysis-mechanics.md) · **Base:** draft PR #15 · **PR:** [#16 (draft)](https://github.com/ahmedgahalla/forma-teaching-studio/pull/16)

Please review the explicit frontend/server mechanics-fact contract, especially private-name exclusion, consistent anonymous anchor references, separation of mechanical supports from editing locks and preservation of current/revealed result gating. The provider prompt distinguishes configured loads from calculated outcomes and identifies the missing geometry.

Frontend and backend must be updated together because new fields are required. The cross-language check passed all 17 actual frontend catalog configurations from the shipped model. The full local automated gate passed (2,551 frontend and 592 backend tests); details are in the phase doc. No provider calls, solver changes or UI changes were made. Browser inspection remains blocked by session policy; no real-device acceptance is claimed. Do not merge the stacked PR until the existing CI/audit/phase-document requirements are met.
