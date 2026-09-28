# Analysis context and cancellation follow-ups

status: open

**From:** builder · **Scope:** evidence-led backend improvements under the owner's broader UI/backend goal.

Read-only source review and in-memory reproductions found three concrete gaps. No real AI provider, network request or browser was used in the reproductions.

1. **Lecture Analyze context:** the session decorator forwards the old case `analysisContext`. Static lecture steps therefore send no lesson; Reveal changes lecture session state while the old projector reads the prepared scenario's hidden-answer flag. Phase 3.15 now addresses this with a dedicated lecture projection, public question/current comparison and explicitly revealed answer only. Private notes stay excluded; Explore uses the original live scene projection. Verify its regressions in the current PR.
2. **Mechanics Analyze context:** `src/lib/scene-analysis.ts` projects wires and appliance counts, but omits fixed supports, support stiffness and elastic endpoint/load-law data. `backend/scene_analysis.py` has no matching fields. Changing `fixedTeeth` from `[]` to `['11']` and support from `standard` to `firm` produced identical Analyze payloads; the separate geometric editing lock stayed false. Next implementation should add explicit bounded mechanical facts to both schemas, distinguish anchorage from edit locks and preserve hidden/stale-result rules.
3. **Provider cancellation:** `backend/main.py` and `backend/scene_analysis.py` use synchronous handlers and blocking OpenAI-compatible calls. Cancelling an in-memory ASGI request ended its caller while the mocked provider continued and completed. Frontend stale-result protection remains effective, but obsolete upstream calls keep consuming capacity. Next implementation should use cancellable async requests, a shared total deadline and disconnect handling, including cancellation before/during the repair retry, while preserving sanitized failures.

The last two items remain open work, not claims of completed backend improvements. Keep their schema/cancellation changes in separately numbered phases with focused client/server tests and the full gate. No merge or release is authorized by this review note alone; existing auditor governance remains in effect.

## Build-ready scope for mechanics facts

The next free Phase 3 number is 3.16. Add explicit support preset and its existing `SUPPORT_PRESETS` translation/rotation coefficients, `fixedTeeth`, fixed-anchor positions and elastic endpoint/load-law inputs to the existing analysis projection. No mechanics means null support and empty arrays; do not invent an experiment. Keep editing locks independent of mechanical anchorage. Preserve the existing revealed/current/synthetic result gate and exclude stale, comparison and applied results.

Existing privacy tests prohibit appliance names. Use deterministic request-local anchor aliases (`tad-1`, etc.), rewrite matching endpoint references and omit elastic IDs. Explicitly copy allowed nested fields rather than spreading source objects. Mirror the client contract with strict server validation: finite bounded coordinates, existing tooth/anchor references, unique IDs, exact support-preset coefficients, existing load-law bounds, at most eight anchors/twelve elastics and counts matching lists. The provider instructions must distinguish configured load inputs from calculated forces and must not infer directions or outcomes from the new facts alone.

Test paired rigs that differ only in support/anchorage, independence from editing locks, exact constant/spring inputs, private-name exclusion and snapshot independence. Reject invalid nested fields/references/ranges/counts before calling the provider. Preserve hidden-answer and hidden-result behavior. This is a client/server schema correction; no new UI, solver, persistence or clinical model is required. Provider cancellation remains a separate subsequent slice.
