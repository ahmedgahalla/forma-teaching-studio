# Forma product direction — one coherent lecture workspace

Product direction and dated implementation notes for one coherent teacher workspace. The continuing design goals below are not a claim that every consolidation item has shipped. Each implementation note identifies its bounded scope and remaining acceptance work.

## First usability pass · 24 September 2026

Implemented a bounded first step: a pinned command bar, separate camera row, contextual suggestions, less idle lecture chrome, compact phone sheets, and everyday upper/lower appliance wording. Manual previews keep Apply/Discard accessible; lesson explanations expand when requested. See [verification](VERIFICATION.md) for the measured checks. This does not complete the broader consolidation below: intent-routing across editing and Analyze, clarification memory, collision performance, and educator-reviewed demonstration quality remain separate work.

## Lecture-ready opening · 26 September 2026

Phase 3.2 implements the opening-screen portion of this proposal in the current code. Tools and Commands start closed; the header keeps Library, Tools, Present and More. More holds secondary workspace actions, while View groups cameras, arches, comparison and presentation controls beside a directly available Fit button. One Undo/Redo pair and compact command feedback remain below the model; `/` opens and focuses Commands, and preview decisions remain independent. This supersedes the always-visible composer and camera row from the first usability pass. The broader consolidation, complete demo scripts and proposed biology illustration are not completed by this slice.

## Ready-made lecture and free exploration · 27 September 2026

[Phase 3.9](phases/phase-3-demo-path/3.9-teacher-lectures.md) implements the Explore/Lecture journey on `ahmed/phase-3-teacher-lectures`, based on Phase 4 at `ff1b3e5` and the PR #13 opening dependency. The owner's latest direction is a finished built-in sample, with lecture creation removed. **Explore** keeps spontaneous model work and existing tools. **Lecture** opens directly in Teach: predict, demonstrate translation, demonstrate tipping, recap. Rehearse uses the same four steps with notes exposed.

This is the consolidated first vertical slice of the earlier proposal. Its proposed 3.10–3.14 milestones are not a parallel unfinished roadmap: runner, return and input work are retained; authoring and persistence are deliberately removed. There is no Prepare mode, lecture library, editing, capture, import/export or lecture saving. Former browser lecture saves remain untouched because the runner does not access storage. The fixed sample is validated data with stable identifiers and canonical prepared-case scenes; opening it does not inherit an edited workspace.

Next/Previous restore defined starting states; one playback strip controls the current authored demonstration. The opening and recap are static. Explore this question preserves the exact paused lecture, including answer and notes visibility, and keeps the earlier standalone Explore workspace separate. Return points last only for the session. Notes opened in Teach are visible in the projected window, not private. Experiments never rewrite the sample; its two movements reuse the existing audited translation and tipping paths, without new biology or clinical prediction.

Phase 4's explicitly enabled hands-free voice, glossary, tooth study and visual improvements remain the interaction foundation. Clicking, typing and supported local voice commands share validated operations. Prepared playback and typed controls do not depend on the AI backend; browser speech recognition is not guaranteed offline.

This branch is implemented but not declared released: local verification records one existing full-suite BVH timeout (passing alone), and real browser access is blocked by security policy. [PR #14](https://github.com/ahmedgahalla/forma-teaching-studio/pull/14) is stacked; the current main-targeted CI trigger does not run on it. The four-step script totals an estimated **205 seconds (3 minutes 25 seconds), not yet measured**. No browser, DPR 1/2, microphone or projector verification is claimed. Lecture authoring, PDF/PowerPoint import, a separate audience window, arbitrary animation, cloud services and new biology content remain outside this scope.

## Research-backed lecture improvements · 27 September 2026

[Phase 3.15](phases/phase-3-demo-path/3.15-lecture-mechanics.md), stacked on PR #14, implements the owner's next approved scope: selected-tooth focus, fixed-camera movement comparison with exact return, fewer repeated lecture labels, a separate audience window, qualitative tissue diagrams and local fonts/favicon. This supersedes the earlier exclusion of audience projection and biology from 3.9; lecture creation remains excluded. Notes are private when only the audience window is presented, not when the whole desktop is mirrored.

Explore gains eight mechanics categories with 17 explicit variations using the existing solver, with prediction before calculation and one undoable load per setup. Research notes distinguish authored geometric paths, initial elastic responses and remodeling concepts; none is a patient-specific treatment forecast. The new feature remains subject to audit, applicable CI and real-device acceptance. Browser/DPR/projector verification is not claimed.

## Consistent lecture controls · 28 September 2026

[Phase 3.18](phases/phase-3-demo-path/3.18-lecture-controls.md) adds `lecture`, `open lecture`, `open sample lecture` and `start sample lecture` as local sample-entry commands. `explore` and `return to explore` leave the lecture for the original standalone workspace; `Explore this question` keeps its distinct temporary detour. Reopening the active sample preserves the current step, answers, return point, playback and Undo/Redo history. Legacy `start lecture` and `enter lecture mode` still mean the older Present layout; use `open lecture` for the finished sample.

Lecture now retains a small View menu with the five camera presets and roots visibility, plus a Fit button. Their commands share validated actions with typed and recognized local voice input. Fit uses the existing preset camera framing. These changes are implemented on the draft stack; browser layout and device acceptance remain unverified.

## Public audience annotations · 28 September 2026

The [3.19 audience-annotation follow-up](phases/phase-3-demo-path/3.19-audience-annotations.md) carries public tooth numbers, anatomy/study labels and the lecture pointer beside the existing audience video. Schematic tissue captions, revealed mechanics magnification, schematic arrows and display-only jaw separation retain their explanation. This remains a public-only projection: no presenter notes, editing-lock text or command controls are copied. Labels use the model's projected positions; actual video latency, popup playback and projector alignment still need device acceptance.

## Product promise

The owner's 28 September follow-up approves [crown/root movement trails](phases/phase-3-demo-path/3.20-crown-root-trails.md) for the demo. Further lecture features and content are deferred until the professor sees the demo, approves the direction and supplies their lectures/cases. The fixed sample remains available; no lecture creator is added.

A professor can freely explore a clear 3D mouth or open a finished lecture, ask students to predict a change, then demonstrate, reveal and compare while keeping the model central.

Free experimentation and guided demonstrations use the same model workspace. A case changes the starting arrangement and available authored demonstrations; it should not feel like opening a different application.

## Screen structure

- **Top:** Explore/Lecture, the current teaching setup or lecture, existing Explore Library and a compact menu. Rehearse/Teach and step navigation belong within Lecture.
- **Centre:** the dominant 3D model with one compact camera/focus toolbar. Selection stays visible and anatomy is easy to inspect.
- **Right:** one context panel. Lecture shows the question and optional notes/answer. Free exploration exposes relevant selection tools. Preview decisions remain directly accessible.
- **Below the model:** one playback bar, shown when a demonstration or edit exists. Avoid duplicate playback controls inside multiple panels.
- **Bottom:** compact command access and one Undo/Redo pair, with visible interpreted-action feedback. Hold-to-talk and explicitly enabled hands-free recognition use the same supported commands.

Keep the model visible when opening the library, anatomy layers, saved arrangements or history. On phones these tools become sheets; use the same names and actions.

## Lecture interaction

**Observe → predict → demonstrate → pause → explain → compare.**

1. Load a prepared setup or use the synthetic mouth.
2. Focus the relevant group; reveal roots or a labelled section when useful.
3. Ask the prepared question with its answer hidden.
4. Play, pause, scrub or slow the geometric illustration.
5. Reveal the explanation; narration remains an explicit choice.
6. Compare the original or another authored approach from its saved baseline.
7. Try a variation and restore the professor's setup in one action.

Buttons, typed instructions and speech invoke the same validated operations. Show why an unsupported or ambiguous request cannot run. Avoid making the AI conversation the main navigation system.

## Visual direction

Continue the restrained Midnight Lab palette: dark navy, clear anatomy, a limited teal accent, readable typography and generous spacing. Keep Clinical Studio available for brighter rooms. Use colour to communicate selection, preview or a warning. Reduce repeated badges and explanatory text in the model area; retain short, relevant limitations where they matter.

## Quality priorities

1. **Consolidate the existing interface.** One workspace, consistent terminology, one playback bar, one task panel, clear routes back to the professor's baseline.
2. **Keep interaction responsive.** Measure the actual shipped model; optimise costly geometry checks without weakening their meaning. Stop and cancel must stay understandable.
3. **Polish a complete ready-made lecture.** Start with the translation/tipping sample and its exploration round-trip. Use the existing crowding/space and anchorage examples when the teaching story needs them; improve questions, replay and explanations before expanding the catalogue.
4. **Improve teaching fidelity.** Review differentiated crowns, root visibility, appliance attachment and labels with an orthodontic educator. Draft authored paths remain illustrations and require review.
5. **Test a complete real lecture.** Watch a professor use the app with students and on the room's projector. Record where they hesitate, lose the model, misread a label or need repeated commands.

## Acceptance for the consolidation pass

- A new user can locate a setup and start its demonstration from the main screen.
- Exactly one active playback control set; no conflicting progress indicators.
- Selected teeth, current scene, pending preview and reset destination are always clear.
- A professor can pose a question, reveal roots, pause halfway and restore the starting setup without opening settings or changing workspaces.
- Free editing is fully reversible; returning to a lesson restores the saved stage.
- Desktop, projector and mobile controls remain readable and operable.
- No new top-level feature is added without a place in this lecture flow.

The current twelve-case library can remain available inside Library. Automatic treatment planning, biological forecasts and a larger catalogue are separate future work; they do not define this interface pass.

## Measured responsiveness follow-up

A read-only profile on the shipped GLB identified a collision-query hotspot: the six upper-anterior teeth moving buccally by 0.5 mm took 8,628 ms with the earlier implementation. An experimental query using cached bounding-volume trees for both meshes took 21 ms, plus 22 ms to build all 28 trees. The full nine-sample collision report matched for this scenario. **This optimisation is now applied in production**: `src/lib/analysis.ts` caches a `MeshBVH` per geometry and intersects with both trees, and `src/lib/analysis.bvh.test.ts` keeps the previous triangle algorithm as an independent regression oracle, covering crossing, baseline, transformed and real-GLB prepared-case geometry. These are local benchmark results, not a device-wide performance promise. _(Corrected 2026-09-25; this paragraph previously said the optimisation was unapplied — see lessons-learned #5.)_

## Claude atlas and demo lectures — 28 September follow-up

The owner subsequently requested proper demo lectures and adoption of Claude’s locally authored 3D model and UI. [Phase 3.21](phases/phase-3-demo-path/3.21-atlas-demo-integration.md) implements those requests on the existing teaching runtime: 28 supported teeth from the preserved 32-tooth atlas, source tissue materials, warm instrument-panel styling, camera rail, display disclosure, odontogram, tooth inspector and locally bundled fonts. The lecture picker offers translation/tipping, space closure/anchorage and periodontal tissue response. No lecture creator is restored. Professor-specific courses remain deferred until review and supplied material.

Atlas roots do not contain the branch profiles needed by the older socket overlays. Atlas scenes therefore use the separate qualitative biology vignettes; the legacy socket classroom explicitly uses its separate schematic model. These are educational illustrations, not clinical validation. Visual fidelity, browser/DPR acceptance and projector rehearsal remain pending.

## Single learning view - 29 September follow-up

The owner's later request supersedes the role-specific lecture layout above. [Phase 3.30](phases/phase-3-demo-path/3.30-learning-appliances.md) uses one model-focused walkthrough: short visible takeaways, Previous/Next, optional inspection/comparison and the existing playback bar. No Review notes/Present split or separate audience launch is exposed. Voice narration and AI explanation follow the same visible learning content. Explore this step retains free experimentation and a clear return path.

The featured case includes an optional TAD, passive elastic and calculated initial-response sequence alongside its bands, expander, brackets, wire and retention stages. Schematic appliance placement and authored progression remain educational illustrations requiring faculty review. Lecture authoring remains excluded; browser/projector acceptance is pending.

[Phase 3.31](phases/phase-3-demo-path/3.31-user-controlled-view.md) keeps the chosen camera during same-lecture navigation: the model changes, while the user controls the viewpoint. Opening a different lecture uses its prepared opening view; explicit camera and Fit controls stay available.
