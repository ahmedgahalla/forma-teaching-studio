status: open

# Dedupe near-identical CSS blocks across the partials

**Problem:** Un-minifying and splitting the stylesheets made repeated selector blocks visible — sibling patterns duplicated across the `.braces-studio` / `.teaching-studio` scopes and between global partials and feature stylesheets. Dead rules were removed in Phase 2.1; duplicates were deliberately left untouched to keep that slice behavior-safe.

**Location:** `src/app/styles/*` and the feature `*.styles/` folders (compare e.g. the button/badge blocks repeated per scope).

**Suggested fix:** A small dedicated PR: merge identical declarations under grouped selectors or a shared scope, one partial at a time, with the six-screen browser check (DPR 1 + 2) after each partial. No cascade reordering — same discipline as Phase 2.3.
