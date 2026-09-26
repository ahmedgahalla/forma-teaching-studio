# Architecture overview

A map for working in this codebase. Updated 2026-09-25 after the Phase 2 refactor; see [folder-structure.md](folder-structure.md) for the directory layout. Update both when structure changes — stale maps are worse than none.

## Frontend (Next.js 16, static export)

- `next.config.ts` sets `output: 'export'` — there is no server runtime. `npm run build` writes `out/`; `npm start` serves it with `scripts/serve.mjs` (a plain Node static server, _not_ `next start`). This Next.js version has breaking changes — read `node_modules/next/dist/docs/` before writing Next.js code (see AGENTS.md).
- Boot chain: `src/app/layout.tsx` (imports `globals.css` + `studio-theme.css`, wraps in `StudioThemeProvider`) → `src/app/page.tsx` → `<Studio />`.

Inside `src/components/Studio.tsx`:

```
Studio
└─ ModelBootstrap            loads /models/forma-teaching-v1.glb + .json; procedural fallback (lib/demo.ts)
   └─ TeachingProvider       TeachingController.tsx — the hub (see below)
      └─ TeachingScenes      both scenes stay mounted; inactive one is display:none / paused
         ├─ CaseStudio       main workspace (defined inside Studio.tsx)
         └─ WorkflowStudio   guided appliance/anatomy classrooms (WorkflowStudio.tsx)
```

## Key components (src/components)

| File                                                                                                                                             | Role                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Studio.tsx` + `case/`                                                                                                                           | CaseStudio is now an orchestrator (~1,000 lines): sixteen state hooks (`case/state.ts`), a typed `CaseStudioApi` bundle assembled per render, handler factories (`case/actions-*.ts`, `case/teaching-dispatch.ts`, `case/preflight.ts`) and ~20 view components. The adapter contract is unchanged.                                                                                                                           |
| `teaching/TeachingController.tsx` (+ `TeachingCommandBar.tsx`)                                                                                   | `TeachingProvider` + `TeachingCommandBar`. Owns the teaching runtime, push-to-talk, AI service config, `case`/`workflow` mode switching. Scenes register a `TeachingAdapter` via `useTeachingAdapter(mode, adapter)`. **All UI changes flow through `teaching.execute(actions)` / `runControl(text)`** — validated, applied, undoable as one request. Calls the backend (`/api/interpret-teaching`, `/api/analyze-teaching`). |
| `viewer/Viewer.tsx`                                                                                                                              | Owns the single Three.js scene (renderer, GTAO composer, OrbitControls, gizmo, picking). Scene built once per model; the RAF loop reads props via a ref, so prop changes don't rebuild the scene. Exposes `ViewerHandle` (`setView`, `fit`, `focus`, `snapshot`, `whenRendered`). Used by both studios.                                                                                                                       |
| `workflow/WorkflowStudio.tsx`                                                                                                                    | Guided workflows (braces, palatal expansion, archwire expansion) + anatomy lesson. State is one `WorkflowScene` (`lib/workflow-scene`); pure `applyWorkflowAction`.                                                                                                                                                                                                                                                           |
| `try/TryPanel.tsx`                                                                                                                               | Try Mode inspector (move/rotate/objectives, locks, saved arrangements). Emits `TryAction`s → `teaching.execute`.                                                                                                                                                                                                                                                                                                              |
| `mechanics/MechanicsPanel.tsx`                                                                                                                   | Appliance-mechanics experiment UI (brackets, wires, TADs, elastics, expander, solve). Emits `MechanicsAction[]`.                                                                                                                                                                                                                                                                                                              |
| `case/StudioExperience.tsx`                                                                                                                      | Presentation-only pieces for CaseStudio: case library cards, prepared-case panel, mobile dock.                                                                                                                                                                                                                                                                                                                                |
| `lecture/LectureConsole.tsx`                                                                                                                     | Lecture overlay (question/answer reveal, playback, variants) with its interaction test; `classroom-workspace.css` carries the pinned command bar / camera row styles added in `0b2e7db`.                                                                                                                                                                                                                                      |
| `shared/StageBar.tsx`, `try/PreviewDecisionBar.tsx`, `lecture/LectureViewTools.tsx`, `viewer/AnatomyPanel.tsx`, `mechanics/AppliancePalette.tsx` | Small presentational panels; the host wires callbacks to the runtime.                                                                                                                                                                                                                                                                                                                                                         |

Removed in Phase 2: `useSpeech.ts` and the dead speech controller; the legacy backend `/api/interpret` route.

## src/lib by concern

- **Language pipeline:** `commands.ts` (base dental grammar) → `lecture.ts` (`TeachingAction` union, single-action parse; also holds `LESSONS` content) → `classroom/` package behind the `classroom.ts` barrel (multi-clause local planner `parseTeachingPlan`, strict AI-output validation `validateTeachingPlan`, the context-advance simulator) → `classroom-language.ts` (wording normalization; `classroom-language.fixtures.json` is shared with the backend tests) → `mechanics-commands.ts` (mechanics clauses). `command-service.ts` validates the AI service config.
- **Runtime & voice:** `teaching-runtime.ts` (`createTeachingRuntime(host)` — local parse first, AI fallback, preflight → apply → settle, request-level undo/redo, narration); `push-to-talk.ts`; `speech.ts`; `scene-analysis.ts` (fact-only context for Analyze).
- **Geometry/model:** `model.ts` (core types, `applyDentalCommand`), `geometry.ts` (case save/load, STL import/export), `anatomy-assets.ts` (GLB+JSON loader), `demo.ts`/`demo-gingiva.ts` (procedural fallback), `planning.ts` (history reducer, checkpoints, session validation), `analysis.ts` (cached-BVH surface intersections, measurements — the optimization PRODUCT_DIRECTION.md § "Measured responsiveness follow-up" describes as unapplied **is applied**, with `analysis.bvh.test.ts` as the regression oracle), `try-mode.ts` (~35 KB Try state machine), `appliances.ts`, `attachments.ts`, `stage-export.ts` (STL/ZIP export), viewer helpers (`camera-fit`, `render-barrier`, …).
- **Mechanics engine:** `mechanics/` — pure bounded elastic solver (`solver.ts`, `beam.ts`, `math.ts`, `state.ts`, `validation.ts`, `types.ts`, `presets.ts`).
- **Content as data** (keep separate from logic): `teaching-cases.ts` (12 prepared cases), `workflows.ts` (workflow storyboards), `dental-arrangements.ts` (Class I/II/III poses), `lessons.ts` (the scripted demonstrations; `lecture.ts` re-exports), the anatomy lesson in `workflow-scene.ts`, `mechanics/presets.ts`. `teaching-case-audit.json` is **generated** — never hand-edit (see the audit script below).

## The mechanics worker

`src/workers/mechanics.worker.ts` (10 lines) wraps `solveMechanics`. It is **not** bundled by Next: `scripts/build-mechanics-worker.mjs` (runs automatically as `predev`/`prebuild`) esbuilds it to `public/workers/mechanics.js` (gitignored). `src/lib/mechanics-client.ts` spawns a fresh `Worker('/workers/mechanics.js?v=1')` per request (20 s timeout; AbortSignal terminates the worker so Stop really cancels).

## Backend (optional FastAPI, backend/)

Optional text-only AI interpreter — the app fully works without it; local deterministic parsing is always tried first. It turns natural-language classroom commands into validated JSON action plans via OpenAI-compatible structured outputs (config in `backend/.env`; see `backend/README.md`). No geometry, no storage, no auth.

- Endpoints: `GET /health`, `POST /api/interpret-teaching` (≤8 actions, server-side audit of the plan against the source text, one repair retry), `POST /api/analyze-teaching` (read-only scene explanation, in `scene_analysis.py` as a router); the legacy `POST /api/interpret` route was removed in Phase 2.1.
- `main.py` (~150 lines) keeps the app, `/health`, provider calls and the teaching route, re-exporting from `core.py`, `commands.py`, `teaching_schema.py`, `teaching_prompts.py`, `teaching_source.py` and `teaching_validation.py`; `mechanics.py` (text-intent validation, not physics), `classroom_language.py` (wording normalization, mirrored by frontend fixtures), `phone_bridge.py` (separate token-gated proxy app, port 8001).
- The frontend discovers the service via Settings (default `http://127.0.0.1:8000`), localStorage, or same-origin `/forma-runtime-config.json`. Both sides validate independently; the AI can never bypass local bounds.

## Model assets

- Runtime: `public/models/forma-teaching-v1.glb` (28 crowns + 28 roots + 2 gums, ~211k triangles, **units are millimetres**) + `.json` metadata sidecar (pivots, anatomical frames, calibration). Loaded by `lib/anatomy-assets.ts`; several vitest suites read these files directly.
- Source: `assets/anatomy/forma-teaching-v1.blend` + regeneration pipeline in `scripts/anatomy/` (Blender headless). Coordinate contract in `assets/anatomy/README.md`.
- `sample-models/` — synthetic STLs for exercising the import UI only.

## Commands

| Task                           | Command                                                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev server                     | `npm run dev` (127.0.0.1:3000; auto-builds the worker via `predev`)                                                                                                                                         |
| Build (static export → `out/`) | `npm run build`                                                                                                                                                                                             |
| Serve the build                | `npm start` (scripts/serve.mjs; `PORT`, `FORMA_HOST` env)                                                                                                                                                   |
| Frontend tests                 | `npm test` (vitest)                                                                                                                                                                                         |
| Typecheck                      | `npm run typecheck`                                                                                                                                                                                         |
| Lint / format check            | `npm run lint` / `npm run format:check`                                                                                                                                                                     |
| Regenerate teaching-case audit | `node --experimental-strip-types scripts/audit-teaching-cases.mjs` — **required whenever `src/lib/teaching-cases.ts`, the GLB or its JSON change**, or `teaching-case-audit.test.ts` fails on hash mismatch |
| Backend run                    | from `backend/`: create `.venv`, install `requirements.txt`, copy `.env.example` → `.env`, then `python -m uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env`                                   |
| Backend tests                  | from `backend/`: `.venv\Scripts\python.exe -m pytest -q` (providers mocked, no key needed)                                                                                                                  |

## Gotchas

- The `nextjs-agent-rules` block in AGENTS.md is auto-rewritten by `next dev`; commit it if it reappears rather than fighting it.
- `public/workers/mechanics.js` is generated and gitignored — never edit or commit it.
- `src/lib/teaching-case-audit.json` is generated; its test pins SHA-256 hashes of the GLB, its metadata **and** `teaching-cases.ts`. Regenerate via the audit script; review the diff, don't hand-tune it.
- Tests read real assets from `public/models/` — moving/renaming model files breaks tests and the loader contract (`anatomy-assets.ts` hardcodes the `v1` URLs).
- Backend tests monkeypatch `main` module names and env at call time — any `main.py` split must keep `main.app` and the patched names importable.
- `classroom-language.fixtures.json` is shared frontend/backend — wording rules must stay in step on both sides.
