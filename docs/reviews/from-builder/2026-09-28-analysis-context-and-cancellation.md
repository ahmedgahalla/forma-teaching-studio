# Analysis context and cancellation follow-ups

status: open

**From:** builder · **Scope:** evidence-led backend improvements under the owner's broader UI/backend goal.

Read-only source review and in-memory reproductions found three concrete gaps. No real AI provider, network request or browser was used in the reproductions.

1. **Lecture Analyze context:** the session decorator forwards the old case `analysisContext`. Static lecture steps therefore send no lesson; Reveal changes lecture session state while the old projector reads the prepared scenario's hidden-answer flag. Phase 3.15 now addresses this with a dedicated lecture projection, public question/current comparison and explicitly revealed answer only. Private notes stay excluded; Explore uses the original live scene projection. Verify its regressions in the current PR.
2. **Mechanics Analyze context (implemented in Phase 3.16):** the earlier wire/count projection omitted fixed supports, support stiffness and elastic endpoint/load-law data. Changing `fixedTeeth` from `[]` to `['11']` and support from `standard` to `firm` produced identical Analyze payloads while the editing lock stayed false. [Phase 3.16](../../phases/phase-3-demo-path/3.16-analysis-mechanics.md) adds matching bounded support, anchorage, elastic and expander facts with anonymous references, preserving hidden/stale-result rules. Its focused checks and all 17 actual frontend catalog contracts pass; audit and final gate are recorded in that phase.
3. **Provider cancellation:** `backend/main.py` and `backend/scene_analysis.py` use synchronous handlers and blocking OpenAI-compatible calls. Cancelling an in-memory ASGI request ended its caller while the mocked provider continued and completed. Frontend stale-result protection remains effective, but obsolete upstream calls keep consuming capacity. Next implementation should use cancellable async requests, a shared total deadline and disconnect handling, including cancellation before/during the repair retry, while preserving sanitized failures.

Provider cancellation remains open work. Keep schema/cancellation changes in separately numbered phases with focused client/server tests and the full gate. No merge or release is authorized by this review note alone; existing auditor governance remains in effect.

## Mechanics-fact scope implemented in Phase 3.16

Phase 3.16 adds the explicit support preset and existing `SUPPORT_PRESETS` translation/rotation coefficients, `fixedTeeth`, fixed-anchor positions, elastic endpoint/load-law inputs and expander settings. No mechanics means null support and empty arrays; no experiment is invented. Editing locks remain independent of mechanical anchorage. The revealed/current/synthetic result gate excludes stale, comparison and applied results.

Existing privacy tests prohibit appliance names. Use deterministic request-local anchor aliases (`tad-1`, etc.), rewrite matching endpoint references and omit elastic IDs. Explicitly copy allowed nested fields rather than spreading source objects. Mirror the client contract with strict server validation: finite bounded coordinates, existing tooth/anchor references, unique IDs, exact support-preset coefficients, existing load-law bounds, at most eight anchors/twelve elastics and counts matching lists. The provider instructions must distinguish configured load inputs from calculated forces and must not infer directions or outcomes from the new facts alone.

Test paired rigs that differ only in support/anchorage, independence from editing locks, exact constant/spring inputs, private-name exclusion and snapshot independence. Reject invalid nested fields/references/ranges/counts before calling the provider. Preserve hidden-answer and hidden-result behavior. This is a client/server schema correction; no new UI, solver, persistence or clinical model is required. Provider cancellation remains a separate subsequent slice.
