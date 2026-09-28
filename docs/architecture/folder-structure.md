# Folder structure

The feature organization of `src/` after Phase 2 (2026-09-25). AGENTS.md § repository layout points here; update both when structure changes.

```
src/
  app/                      Next.js entry
    layout.tsx, page.tsx
    globals.css             @import index (order = cascade)
    styles/                 20 ordered partials of the global stylesheet
  components/
    Studio.tsx              CaseStudio orchestrator: state hooks, derived values,
                            api assembly, root layout (allowlist-justified size)
    case/                   the case workspace feature
      api.ts                CaseStudioApi + CaseRefs contracts
      state.ts              16 feature hooks owning all workspace state
      constants.ts, types.ts, ui.tsx
      actions-*.ts          handler factories (workspace, try, io, edit, lesson,
                            classroom, mechanics, export)
      teaching-dispatch.ts, teaching-load-kinds.ts, preflight.ts
      Case*.tsx             view components (topbar, sidebar, main + its five
                            children, inspector + five tabs, dialogs + three groups)
      StudioExperience.tsx  case library + scenario presentation
      *.css + *.styles/     the feature's stylesheets (index + ordered partials)
    viewer/                 Viewer (Three.js scene), ModelBootstrap, AnatomyPanel + css
    teaching/               TeachingController (runtime host), TeachingCommandBar + tests
    workflow/               WorkflowStudio
    lecture/                LectureConsole, LectureViewTools + css/partials + tests
    lecture-builder/        fixed sample runner, notes/questions, comparison and tissue diagrams
    lecture-audience/       public-only canvas projection popup, portal and lifecycle tests
    mechanics/              MechanicsPanel, AppliancePalette + css/partials
    try/                    TryPanel, PreviewDecisionBar + css/partials + test
    shared/                 StudioTheme, StageBar, combined-workspace.css
  lib/                      logic by concern (see architecture/overview.md)
    classroom/              teaching-plan parsing/validation package (barrel: lib/classroom.ts)
    mechanics/              the pure solver package
    mechanics-examples/     validated force-system recipes and primary-model regression tests
    lecture-documents/      fixed sample data and bounded scene/document validation
    teaching-biology.ts     qualitative tissue content and research references
    lessons.ts              scripted demonstrations (content as data)
    ...                     one module per concern; content files stay data-only
  workers/                  mechanics worker entry (esbuild → public/workers/)
```

Conventions:

- `lecture-builder/LectureViewControls.tsx` owns the compact lecture camera/roots/Fit disclosure; `lib/classroom/presentation.ts` owns local lecture command validation, with the fixed sample identifier shared through `lecture-documents/constants.ts`.

- `backend/ai_request.py` ties async AI work to a consumed request, disconnect and total deadline; command, explanation and authenticated phone-bridge teaching routes share it.

- `backend/scene_analysis_appliances.py` holds strict appliance facts/reference validation for the read-only scene explanation route; the endpoint and provider instructions remain in `scene_analysis.py`.

- `public/fonts/` owns locally served variable fonts and their license/source records; `public/audience.css` styles the projection window and `public/favicon.svg` supplies the icon. `scripts/check-demo.mjs` checks the corresponding exported assets.

- A feature folder owns its components, tests, and stylesheets; stylesheets over 300 lines are an `@import` index plus ordered partials in `<name>.styles/` so the cascade order is explicit.
- `lib/` packages (classroom/, mechanics/) keep a barrel at their old path so import sites stay stable.
- New files respect the 300-line limit (`npm run check:limits`); the allowlist in `scripts/check-file-limits.mjs` documents every standing exception.
- Component tests sit next to the component they test and move with it.
