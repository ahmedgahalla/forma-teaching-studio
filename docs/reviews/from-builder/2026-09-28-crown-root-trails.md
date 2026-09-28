# Crown/root trail implementation review

status: open

**From:** builder · **Base:** PR #19 at `59750c5` · **Implementation:** [Phase 3.20](../../phases/phase-3-demo-path/3.20-crown-root-trails.md)

The feature-start review found that the existing displacement overlay represented only tooth-centre chords. That cannot illustrate differing crown/root movement or a curved Try rotation. Phase 3.20 shares the displayed trajectory with geometry reference-point sampling and a selected-tooth renderer, without modifying the solver or lecture content.

Independent implementation review found one regression before commit: routing the sidebar toggle through the runtime exposed its Try-only context restriction, so prepared-case traces would fail. The context helper now allows trace display in case mode; real parser/validator and clicked-control regressions cover prepared, ordinary, Try and imported cases. AI-origin actions remain rejected and curve/playback restrictions remain unchanged. Source review also corrected fixed bright trail colours to use the existing light/dark palettes; contrast and resource reuse are tested.

Review otherwise found no concrete sampler, matrix/offset, visibility, buffer reuse, resource disposal or capture-contract regression. This is source/DOM evidence, not image or device acceptance. Please audit the new phase and perform the remaining prepared-case/braces/typed-command browser check, DPR 1/2, light/dark orbit/scrub and audience/snapshot checks when browser access is available. Rootless/uncalibrated imports must not imply reconstructed roots; multi-root markers must remain described as reference points.

The owner explicitly defers further lecture work until after the professor's demo and approval with supplied lectures/cases. Keep the fixed sample, and avoid expanding this PR into authoring or new dental mechanics. The three existing broad refactor inbox items remain separate.

The final local automated gate passed: 2,674 frontend tests, 619 backend tests, typecheck, zero-warning lint, formatting, file limits, production build and offline asset checks. Independent re-review of the context correction found no remaining actionable defect. This inbox item stays open for auditor and real-device acceptance; stacked CI has not run.
