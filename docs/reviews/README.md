# Cross-review inbox

Asynchronous findings between the two AI tools. One file per finding, named `YYYY-MM-DD-short-title.md`.

- `from-builder/` — the builder tool's periodic codebase analyses, for the auditor (Claude Code) to address. The builder writes here at the start of a new feature, or when asked.
- `from-auditor/` — the auditor's notes for the builder to address.

Each file starts with a status line and covers the problem, the location, and a suggested fix:

```markdown
status: open <!-- open | resolved | wontfix -->

# Short title

**Problem:** …
**Location:** `src/…` (line refs)
**Suggested fix:** …

<!-- On resolution, the addressee appends: -->

**Resolution (YYYY-MM-DD):** what was done, or why wontfix.
```

Protocol: each tool checks its inbox during the session start protocol (AGENTS.md). The auditor addresses every `open` item in `from-builder/` at the start of each audit session and marks it `resolved` or `wontfix` with a reason. Findings here feed `docs/lessons-learned.md` like audit findings do.
