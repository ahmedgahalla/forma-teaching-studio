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
    mechanics/              MechanicsPanel, AppliancePalette + css/partials
    try/                    TryPanel, PreviewDecisionBar + css/partials + test
    shared/                 StudioTheme, StageBar, combined-workspace.css
  lib/                      logic by concern (see architecture/overview.md)
    classroom/              teaching-plan parsing/validation package (barrel: lib/classroom.ts)
    mechanics/              the pure solver package
    lessons.ts              scripted demonstrations (content as data)
    ...                     one module per concern; content files stay data-only
  workers/                  mechanics worker entry (esbuild → public/workers/)
```

Conventions:

- A feature folder owns its components, tests, and stylesheets; stylesheets over 300 lines are an `@import` index plus ordered partials in `<name>.styles/` so the cascade order is explicit.
- `lib/` packages (classroom/, mechanics/) keep a barrel at their old path so import sites stay stable.
- New files respect the 300-line limit (`npm run check:limits`); the allowlist in `scripts/check-file-limits.mjs` documents every standing exception.
- Component tests sit next to the component they test and move with it.
