<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- Everything below this line is the project's shared rulebook. It must stay
     OUTSIDE the auto-generated block above: `next dev` rewrites that block and
     would silently delete anything placed inside it. -->

This file is the complete shared context for every AI tool working in this repo. The only instruction a developer gives is the task itself ("build X", "audit PR #N"); every rule below is a step you perform on your own, not reference material. If a rule here conflicts with your own tool-specific instructions, this file wins for anything shared.

## Session start protocol — run before any work, every session

1. `git pull` on main. Note which branch you are on; never work directly on main.
2. Read, in order:
   - `docs/STATUS.md` — current state
   - `docs/lessons-learned.md` — mistakes already made; do not repeat them
   - your inbox: `docs/reviews/from-auditor/` if you are the builder, `docs/reviews/from-builder/` if you are the auditor — every file with `status: open`
   - the current phase doc under `docs/phases/`
   - the latest handoff note in `docs/handoffs/`
3. Before starting the task, summarize in 3–5 lines: the current phase, open inbox items, and the lessons relevant to this task.

## Session end protocol — run before finishing any task

1. Update the phase or sub-phase doc for what you did.
2. Write inbox items (`docs/reviews/`) if the other role needs to act on something.
3. Record new lessons in `docs/lessons-learned.md` (see the learning loop below).
4. Write a handoff note to `docs/handoffs/YYYY-MM-DD-<branch>.md`: what was done, the current state, what's next, open questions.

## Project purpose

Forma Teaching Studio is a local-first 3D orthodontic lecture tool: build an appliance on a synthetic 28-tooth model, ask students to predict, then demonstrate, reveal and compare. It is an education prototype, **not for clinical use** — never imply clinical validation.

**Current goal: prepare a demo for an orthodontist who lectures at universities. Presentable beats feature-complete.**

## Product priority

Forma is primarily a professor-controlled university lecture tool. Prioritize visible anatomy, readable projected controls, questions before answers, deterministic replay, and quick comparison. Keep Try Mode available for free exploration and guided examples optional. The AI interprets bounded commands; geometry and authored demonstrations determine the displayed change. Synthetic anatomy and illustrative movement are not patient-specific predictions. Never imply clinical review has occurred when it has not.

Keep the experience cohesive: one central model workspace, one active playback bar and one context-sensitive task panel. Prefer a focused library or advanced-tool drawer over adding a new top-level mode. Reduce duplicate controls and keep the professor's current setup and return path clear. See `docs/PRODUCT_DIRECTION.md` for the proposed consolidation pass; it is not a statement of shipped functionality.

## Architecture

Read [docs/architecture/overview.md](docs/architecture/overview.md) before touching unfamiliar code. Short version: Next.js 16 static export (`out/`, served by `scripts/serve.mjs`) + Three.js viewer; all UI changes flow through the teaching runtime (`TeachingProvider` → validated `TeachingAction`s, undoable as whole requests); a bounded mechanics solver runs in a web worker; an optional FastAPI backend (`backend/`) interprets natural-language commands with independent server- and client-side validation; the model asset is a Blender-exported GLB + JSON metadata contract in `public/models/`.

## Repository layout

- `src/app/` — Next.js entry (layout, page, global CSS)
- `src/components/` — React components with co-located `*.css` and `*.test.ts(x)`
- `src/lib/` — parsing, runtime, geometry, persistence; `src/lib/mechanics/` is the pure solver
- `src/workers/` — the mechanics worker entry (esbuild-bundled to `public/workers/`, gitignored)
- `backend/` — optional FastAPI AI interpreter + pytest suite (Python 3.13)
- `scripts/` — build/serve/audit/asset-generation scripts
- `public/models/` — the runtime GLB + metadata (tests read these; file names are a loader contract)
- `assets/anatomy/` — editable Blender source and verification renders
- `docs/` — guides, records, and the docs structure described below

## Code standards — apply to every change you make

- Component-based, single responsibility. Files around **300 lines max**, normal line lengths. CI enforces limits (`npm run check:limits`); existing oversized files are allowlisted in `scripts/check-file-limits.mjs` until Phase 2 splits them — do not add new ones.
- No duplicated or dead code. Delete what's unused.
- **Case and lesson content stays as data**, separate from logic (the `teaching-cases.ts` / `workflows.ts` pattern).
- TypeScript strict; keep `npm run typecheck` clean. Python follows the existing typed-Pydantic style in `backend/`.
- Formatting is Prettier's, linting is ESLint's; run `npm run format` before committing, never hand-format against it.
- Performance by default: reuse geometry and materials, dispose Three.js resources on teardown, **no allocations in the render loop** (follow Viewer.tsx's ref-based RAF pattern). Canvases get an explicit CSS size; visual checks run at both DPR 1 and DPR 2.
- New logic gets tests next to it (`*.test.ts`). Changed behavior gets its tests updated in the same PR.
- Regenerate generated files with their scripts, never by hand: `src/lib/teaching-case-audit.json` via `node --experimental-strip-types scripts/audit-teaching-cases.mjs` whenever `teaching-cases.ts`, the GLB or its metadata change (the audit test fails CI when stale).

## Branches and governance

- **Nothing is ever pushed directly to main, by anyone or any tool. Every change goes through a PR. Never force-push main.**
- Branch names: builder `ahmed/...`, auditor `naser/...`.
- Keep branches small and short-lived; no long-lived feature branches. **Merge main into your branch before opening a PR.**
- Test unmerged work on your own branch locally. If you need another branch's unmerged work, pull that branch into yours and note the dependency in the PR.
- Changes to this file (AGENTS.md) require a PR agreed by both developers.
- Secrets: API keys live only in local, gitignored `.env` files (e.g. `backend/.env`). Never commit a key, never put one in frontend code or `NEXT_PUBLIC_*`, never echo one into a doc, log, or CI file. CI needs no secrets.

## Team workflow and roles

**The cycle: build → PR → CI → audit → fixes → auditor merges.**

**Builder — ChatGPT Astra, on `ahmed/...` branches.** You build features. You follow every rule in this file, run the session start/end protocols, and check `docs/reviews/from-auditor/` for items addressed to you. Each PR updates its own numbered phase or sub-phase doc and fills in the PR template. **You do not touch `docs/STATUS.md`** — the auditor owns it (this prevents constant merge conflicts). You run a periodic codebase analysis (at the start of a new feature, or when asked) and write findings to `docs/reviews/from-builder/`. You never push to main.

**Auditor — Claude Code, on `naser/...` branches.** You review every builder PR against this file (procedure in CLAUDE.md), run the verification gate plus a browser check, write the review to `docs/audits/YYYY-MM-DD-<branch>.md` (Blocking / Should fix / Suggestions) and post a summary on the PR. You fix mechanical issues on a separate `naser/audit-<branch>` branch with its own PR; design-level issues are reported, never silently rewritten. You address every open item in `docs/reviews/from-builder/` at the start of each audit session, marking each resolved or wontfix with a reason. You own `docs/STATUS.md` and update it after each merge. You do not build features unless asked.

**Merge rules.** The auditor merges a PR to main only when ALL of these hold:

1. CI is green.
2. The audit report has zero Blocking findings.
3. The PR updated its phase docs.

If any condition fails: do not merge, report to Naser. Naser can override either way. Merge method is always **"Create a merge commit"** — never squash, never rebase (either would break `.git-blame-ignore-revs`). Phase 2 merges only after Phase 1, and only once it's been updated from main.

**After every merge:** delete the branch, update `docs/STATUS.md`, and tag main when a phase completes (e.g. `v0.13-phase1`).

## Documentation rules

- `docs/STATUS.md` — the single current-state summary (Done / In progress / Next). **Auditor-owned; updated after each merge.** Builder PRs never edit it.
- `docs/phases/` — numbered phase docs, indexed by `docs/phases/README.md`. Phase 1 = tooling, Phase 2 = refactor, Phase 3 = demo path. Each phase is a folder (`phase-N-name/`) with a `README.md` (goal, scope, branch, PR, outcome) and numbered sub-phase docs (`N.M-topic.md`): what was done, files touched, decisions, what was skipped and why, before/after evidence. **Every future feature — including builder work — gets its own numbered phase or sub-phase doc. Update it in the same PR.**
- `docs/decisions/` — ADRs, numbered `NNN-short-title.md`, for choices that constrain future work.
- `docs/audits/` — the auditor's PR review reports.
- `docs/reviews/` — the cross-review inbox (see its README): `from-builder/` and `from-auditor/`, one file per finding, `YYYY-MM-DD-short-title.md`, each with a `status: open | resolved | wontfix` line.
- `docs/handoffs/` — session handoff notes, `YYYY-MM-DD-<branch>.md`.
- `docs/lessons-learned.md` — the learning loop (below).
- Existing guides in `docs/` keep their names and locations — don't move or rename them.
- **Docs are updated in the same PR as the change they describe.** Stale docs are a defect (see lessons-learned). All project context lives in this repo — no tool keeps private project state outside it.

## Learning loop

Both tools read `docs/lessons-learned.md` at session start. Every audit feeds it: each Blocking or Should-fix finding gets a root cause and a prevention; if it matches an existing lesson, increment that lesson's count, otherwise add a new entry. The same applies to findings in `docs/reviews/from-builder/`. Each entry records: the mistake (with a link), root cause, prevention, status (`noted` / `rule` / `automated`), and occurrence count. Promotion: on the second occurrence, promote to a rule in this file; if mechanically checkable, automate it at any count (ESLint rule, CI check, or test). Prefer automation over rules, and rules over notes.

## Verification gate — run after every slice of work and before every PR

1. `npm test` — passing (the count may drop only for deliberately removed dead code; list removals in the phase doc)
2. `npm run typecheck` — clean
3. `npm run lint` — clean (zero warnings)
4. `npm run format:check` — clean
5. `npm run check:limits` — clean
6. `npm run build` — succeeds
7. `backend/`: `.venv\Scripts\python.exe -m pytest -q` — passing (Python 3.13)
8. A real browser check of the affected screens against the baseline screenshots: same visuals, same behavior. For UI changes, actually click through a prepared case, the braces workflow, and a typed command, and check canvases at DPR 1 and DPR 2.

**A PR cannot merge unless CI is green** (`.github/workflows/ci.yml` runs 1–7 on Node 22 / Python 3.13, matching `.nvmrc` and `engines`). Report results honestly — a failing check is reported as failing, never skipped silently.
