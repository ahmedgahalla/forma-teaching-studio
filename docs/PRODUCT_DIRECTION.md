# Forma product direction — one coherent lecture workspace

Proposed next design pass, following the request to make Forma excellent without spreading the experience across too many places. This is a proposal, not a claim that the consolidation has shipped.

## First usability pass · 24 September 2026

Implemented a bounded first step: a pinned command bar, separate camera row, contextual suggestions, less idle lecture chrome, compact phone sheets, and everyday upper/lower appliance wording. Manual previews keep Apply/Discard accessible; lesson explanations expand when requested. See [verification](VERIFICATION.md) for the measured checks. This does not complete the broader consolidation below: intent-routing across editing and Analyze, clarification memory, collision performance, and educator-reviewed demonstration quality remain separate work.

## Product promise

A professor can select a teaching setup, demonstrate a concept on a clear 3D mouth, ask students to predict a change, then reveal and compare the result without leaving the workspace.

Free experimentation and guided demonstrations use the same model workspace. A case changes the starting arrangement and available authored demonstrations; it should not feel like opening a different application.

## Screen structure

- **Top:** current teaching setup, Library, Undo/Redo, Lecture view, and a compact menu for saving, importing, exporting and settings.
- **Centre:** the dominant 3D model with one compact camera/focus toolbar. Selection stays visible and anatomy is easy to inspect.
- **Right:** one context panel. With a selection, show its movement controls. During a guided demonstration, show the question and explanation. During a preview, show the proposed change, conflicts, Apply and Cancel.
- **Below the model:** one playback bar, shown when a demonstration or edit exists. Avoid duplicate playback controls inside multiple panels.
- **Bottom:** one command bar for typed and optional hold-to-talk instructions, with a short interpreted-action caption.

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
3. **Polish three complete demonstrations.** Translation versus tipping; crowding/space use; anchorage comparison. Improve starting views, anatomy, questions, replay and explanations before expanding the catalogue.
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

A read-only profile on the shipped GLB identified a collision-query hotspot: the six upper-anterior teeth moving buccally by 0.5 mm took 8,628 ms with the current implementation. An experimental query using cached bounding-volume trees for both meshes took 21 ms, plus 22 ms to build all 28 trees. The full nine-sample collision report matched for this scenario. This optimisation has **not** been applied to production; it needs regression coverage for crossing, baseline, transformed and imported geometry before release. These are local benchmark results, not a device-wide performance promise.
