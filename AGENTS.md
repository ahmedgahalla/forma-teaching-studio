<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Product priority

Forma is primarily a professor-controlled university lecture tool. Prioritize visible anatomy, readable projected controls, questions before answers, deterministic replay, and quick comparison. Keep Try Mode available for free exploration and guided examples optional. The AI interprets bounded commands; geometry and authored demonstrations determine the displayed change. Synthetic anatomy and illustrative movement are not patient-specific predictions. Never imply clinical review has occurred when it has not.

Keep the experience cohesive: one central model workspace, one active playback bar and one context-sensitive task panel. Prefer a focused library or advanced-tool drawer over adding a new top-level mode. Reduce duplicate controls and keep the professor’s current setup and return path clear. See `docs/PRODUCT_DIRECTION.md` for the proposed consolidation pass; it is not a statement of shipped functionality.

## Project purpose

Forma Teaching Studio is a local-first 3D orthodontic lecture tool: build an appliance on a synthetic 28-tooth model, ask students to predict, then demonstrate, reveal and compare. It is an education prototype, **not for clinical use** — never imply clinical validation.

**Current goal: prepare a demo for an orthodontist who lectures at universities. Presentable beats feature-complete.**

## Architecture

The full architecture map lives in [docs/architecture/overview.md](docs/architecture/overview.md) — read it before touching unfamiliar code. Short version: Next.js 16 static export (`out/`, served by `scripts/serve.mjs`) + Three.js viewer; all UI changes flow through the teaching runtime (`TeachingProvider` → validated `TeachingAction`s, undoable as whole requests); a bounded mechanics solver runs in a web worker; an optional FastAPI backend (`backend/`) interprets natural-language commands with independent server- and client-side validation; the model asset is a Blender-exported GLB + JSON metadata contract in `public/models/`.

## Repository layout

- `src/app/` — Next.js entry (layout, page, global CSS)
- `src/components/` — React components with their co-located `*.css` and `*.test.ts(x)`
- `src/lib/` — parsing, runtime, geometry, persistence; `src/lib/mechanics/` is the pure solver
- `src/workers/` — the mechanics worker entry (esbuild-bundled to `public/workers/`, gitignored)
- `backend/` — optional FastAPI AI interpreter + pytest suite
- `scripts/` — build/serve/audit/asset-generation scripts (`scripts/anatomy/` regenerates the Blender asset)
- `public/models/` — the runtime GLB + metadata (tests read these; file names are a loader contract)
- `assets/anatomy/` — editable Blender source and verification renders
- `docs/` — guides, verification records, and the docs structure described below

## Code standards

- Component-based, single responsibility. Files around **300 lines max**, normal line lengths — no multi-thousand-character lines. Legacy files violate this; don't make them worse, split what you touch when practical.
- No duplicated or dead code. Delete what's unused.
- **Case and lesson content stays as data**, separate from logic (the `teaching-cases.ts` / `workflows.ts` pattern).
- TypeScript strict; keep `npm run typecheck` clean. Python code follows the existing typed-Pydantic style in `backend/`.
- Formatting is Prettier's (`npm run format:check`); linting is ESLint's (`npm run lint`). Both must pass. Don't hand-format against Prettier.
- Performance by default: reuse geometry and materials, dispose Three.js resources on teardown, **no allocations in the render loop** (follow Viewer.tsx's ref-based RAF pattern).
- New logic gets tests next to it (`*.test.ts`). Changed behavior gets its tests updated in the same PR.

## Collaboration and branches

Two developers, two AI tools, one repo:

- **main must always be working and demo-safe.** Never push to main. Never force-push main. All work goes through a PR.
- Branches: the builder uses `ahmed/...`, the auditor uses `naser/...`. Always `git pull` before starting.
- **A PR cannot merge unless CI is green** (`.github/workflows/ci.yml`: typecheck, lint, format check, frontend tests, build, backend pytest). A human (Naser) reviews and merges every PR; no AI merges.
- Repo-wide mechanical changes (formatting, lint sweeps) must be timed for when the other developer has nothing unpushed.

## Team workflow and roles

**Builder — ChatGPT Astra, on `ahmed/...` branches.** Builds features. Follows every rule in this file. Updates `docs/STATUS.md` and the relevant numbered phase doc in the same PR. Fills in the PR template. Never pushes to main.

**Auditor — Claude Code, on `naser/...` branches.** Reviews every builder PR against this file: file size and line length, component boundaries, duplicated or dead code, content-vs-logic separation, TypeScript strictness, render-loop performance (allocations, disposal, geometry reuse), tests for new logic, docs updated. Runs the verification gate plus a browser check of the affected screens. Writes the review to `docs/audits/YYYY-MM-DD-<branch>.md` (findings grouped Blocking / Should fix / Suggestions) and posts a summary on the PR. Fixes mechanical issues on a separate `naser/audit-<branch>` branch with its own PR; design-level issues are reported, never silently rewritten. Does not build features unless asked.

**The cycle: build → PR → CI → audit → fixes → human review and merge.** Missing docs or a failing CI check block the merge.

## Documentation rules

- `docs/STATUS.md` — the single current-state summary (Done / In progress / Next). Update it in the same PR as the work.
- `docs/phases/` — numbered phase docs, indexed by `docs/phases/README.md`. Phase 1 = tooling, Phase 2 = refactor, Phase 3 = demo path. Each phase is a folder (`phase-N-name/`) with a `README.md` (goal, scope, branch, PR, outcome) and numbered sub-phase docs (`N.M-topic.md`) covering: what was done, files touched, decisions, what was skipped and why, before/after evidence. **Every future feature — including builder work — gets its own numbered phase or sub-phase doc here.**
- `docs/decisions/` — ADRs, numbered `NNN-short-title.md`, for choices that constrain future work.
- `docs/audits/` — the auditor's PR review reports.
- Existing guides in `docs/` keep their current names and locations; links point at them from README.md and each other. Don't move or rename them.
- Stale docs are worse than none: if your change invalidates a doc, fix the doc in the same PR.

## Verification gate

Run after every slice of work and before every PR:

1. `npm test` — passing (the count may drop only for deliberately removed dead code; list removals in the phase doc)
2. `npm run typecheck` — clean
3. `npm run lint` — clean
4. `npm run format:check` — clean
5. `npm run build` — succeeds
6. `backend/`: `.venv\Scripts\python.exe -m pytest -q` — passing
7. A real browser check of the affected screens against the baseline screenshots: same visuals, same behavior. For UI changes, actually click through a prepared case, the braces workflow, and a typed command.

Report results honestly — a failing check is reported as failing, never skipped silently.
