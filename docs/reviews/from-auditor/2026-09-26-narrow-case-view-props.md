status: open

# Narrow the case/ views' props from the api bundle

**Problem:** Every extracted case view (`Case*.tsx`, the inspector tabs, the dialog groups) takes the whole `CaseStudioApi`, so each formally depends on all workspace state and handlers. This was the deliberate Phase 2 extraction seam (ADR 003), not the end state.

**Location:** `src/components/case/*.tsx` (the `{ api }: { api: CaseStudioApi }` signatures); `src/components/case/api.ts`.

**Suggested fix:** Per view, replace `api` with an explicit props type listing only what it reads (start from the fields each file actually references — the Phase 2 extraction logs list them). One view per commit, gate after each. Good first candidates: `CaseTopbar`, `CaseStageDock`, the dialog groups.
