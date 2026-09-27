# Forma product direction — one coherent lecture workspace

Product direction and dated implementation notes for one coherent teacher workspace. The continuing design goals below are not a claim that every consolidation item has shipped. Each implementation note identifies its bounded scope and remaining acceptance work.

## First usability pass · 24 September 2026

Implemented a bounded first step: a pinned command bar, separate camera row, contextual suggestions, less idle lecture chrome, compact phone sheets, and everyday upper/lower appliance wording. Manual previews keep Apply/Discard accessible; lesson explanations expand when requested. See [verification](VERIFICATION.md) for the measured checks. This does not complete the broader consolidation below: intent-routing across editing and Analyze, clarification memory, collision performance, and educator-reviewed demonstration quality remain separate work.

## Lecture-ready opening · 26 September 2026

Phase 3.2 implements the opening-screen portion of this proposal in the current code. Tools and Commands start closed; the header keeps Library, Tools, Present and More. More holds secondary workspace actions, while View groups cameras, arches, comparison and presentation controls beside a directly available Fit button. One Undo/Redo pair and compact command feedback remain below the model; `/` opens and focuses Commands, and preview decisions remain independent. This supersedes the always-visible composer and camera row from the first usability pass. The broader consolidation, complete demo scripts and proposed biology illustration are not completed by this slice.

## Teacher-created lectures · 27 September 2026

[Phase 3.9](phases/phase-3-demo-path/3.9-teacher-lectures.md) implements the first complete Explore/Lecture journey on `ahmed/phase-3-teacher-lectures`, based on Phase 4 at `ff1b3e5` and the PR #13 opening dependency. **Explore** keeps spontaneous model work and existing tools. **Lecture** contains the local lecture library and Prepare/Rehearse/Teach views. The teacher writes notes beforehand inside Forma, explicitly captures a displayed model setup or attaches an existing prepared case demonstration, and teaches the ordered steps using the shared model and runtime.

The proposed 3.10–3.14 document/editor/runner/return/input milestones are consolidated into this bounded 3.9 implementation; they are not a parallel unfinished roadmap. Notes and lecture edits autosave locally with visible storage status, and JSON export/import provides a backup copy. Model edits require explicit capture to replace a saved step. Delete actions are confirmed; recovery uses an earlier exported backup, with no trash or document deletion undo.

Next/Back restore defined starting states; Play controls the current authored demonstration. Explore this question preserves the paused lecture for return and keeps the earlier standalone Explore workspace separate. These return points last only for the session. Notes opened in Teach are visible in the projected window, not private. Static captures store the actual shown pose, including visible magnification; mechanics inputs are validated but calculated results and geometry are not persisted. Imported models and workflow transfers cannot be captured as lecture steps in this version.

Phase 4's explicitly enabled hands-free voice, glossary, tooth study and visual improvements remain the interaction foundation. Clicking, typing and supported local voice commands share validated operations. Prepared playback and typed controls do not depend on the AI backend; browser speech recognition is not guaranteed offline.

This branch is implemented but not declared released: the root full gate is in progress and real browser access is blocked by security policy. The three-step sample has a proposed, **untimed** 3–4 minute script. No browser, DPR 1/2, microphone or projector verification is claimed for this slice. PDF/PowerPoint import, a separate audience window, arbitrary animation, cloud services and new biology content remain outside it.

## Product promise

A professor can freely explore a clear 3D mouth or prepare their own lecture with notes and model steps, ask students to predict a change, then demonstrate, reveal and compare while keeping the model central.

Free experimentation and guided demonstrations use the same model workspace. A case changes the starting arrangement and available authored demonstrations; it should not feel like opening a different application.

## Screen structure

- **Top:** Explore/Lecture, the current teaching setup or lecture, Library and a compact menu. Prepare/Rehearse/Teach and step navigation belong within Lecture.
- **Centre:** the dominant 3D model with one compact camera/focus toolbar. Selection stays visible and anatomy is easy to inspect.
- **Right:** one context panel. Prepare shows the step editor; Teach shows the question and optional notes/answer. Free exploration exposes relevant selection tools. Preview decisions remain directly accessible.
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
3. **Polish a complete teacher-created lecture.** Start with the translation/tipping sample and its exploration round-trip. Use the existing crowding/space and anchorage examples when the teaching story needs them; improve questions, replay and explanations before expanding the catalogue.
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
