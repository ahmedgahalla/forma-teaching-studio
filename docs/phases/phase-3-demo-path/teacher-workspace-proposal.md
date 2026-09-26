# Teacher workspace proposal — Explore and Lecture

**Status:** proposed, planning only · **Phase:** 3 · **PR:** [#12](https://github.com/ahmedgahalla/forma-teaching-studio/pull/12) · **Date:** 2026-09-26

## Agreed brief and proposed defaults

The teacher needs two clear ways to use Forma: freely explore possibilities, or teach a prepared lecture with notes and ordered 3D demonstrations. The model is the main teaching surface. Clicking, typing and voice should control the same supported operations.

The owner confirmed that lectures and notes will be created beforehand **inside Forma**. Importing PowerPoint/PDF files is therefore outside the first version. The choice of one screen versus a separate audience screen is not decided. Recommend a complete single-screen experience first; a separate audience window can follow if wanted. These defaults are proposals, not implicit approval to build.

## One workspace, two experiences

Keep a compact **Explore | Lecture** switch, the current setup or lecture title, and a Library entry at the top. The same model area, camera controls, context panel and command surface serve both experiences. Prepare and Teach are stages inside Lecture, not additional top-level modes.

| Explore                                                                | Lecture                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Start with the synthetic mouth, a prepared setup or a saved workspace. | Open a saved lecture or create one inside Forma.                            |
| Ask spontaneous questions and change the model freely.                 | Prepare notes and model steps, rehearse, then teach in order.               |
| Select a tooth or group to see a few relevant actions.                 | See the current step title, optional question and one active demonstration. |
| Compare, undo and restore the starting arrangement.                    | Go Back/Next, demonstrate, reveal and temporarily explore a question.       |

First visit: open a paused full-bite model in Explore, with a clearly visible Lecture switch. Entering Lecture opens the compact lecture library, not editing tools. Returning teachers choose their lecture and press Teach. Do not automatically start animation, narration or microphone capture.

The model should occupy roughly 80% of the usable teaching view when a note card is open, and more when collapsed. Verify the actual teeth are large and readable; increased canvas area alone is insufficient. Keep Fit directly reachable, with other camera/arch choices grouped under View. Root close-ups must remain unclipped on laptop and projector layouts.

## Explore: spontaneous teaching

1. Choose a starting setup and orient the model.
2. Click one tooth or a group. Show a small contextual set such as Move, Rotate, Roots and Compare; put precise amounts, locks and mechanics in Tools.
3. Use a supported typed or spoken instruction for the same operation. Display its interpretation and result near the model.
4. Play an attached authored demonstration, or preview a bounded edit. Keep Apply/Discard visible when a preview exists.
5. Undo, compare with the baseline, or restore the setup. Saving a workspace remains available in the menu.

Retain the existing prepared cases and appliance workflows in Library. Avoid adding a permanent panel for every capability. Imports, exports, numerical mechanics, calibration, measurements and advanced selection remain reachable through grouped tools.

## Prepare a lecture beforehand

**Lecture → New lecture → add steps → rehearse → save.**

Start with a title and a short ordered list of steps. The editor shows a narrow step list, a large model and one note/settings panel for the selected step. Add, rename, duplicate, reorder and delete steps; deleting a step should be undoable. No slide-layout designer is needed.

Each step contains:

- A title and simple formatted notes written by the teacher.
- An optional student question and a separately hidden explanation.
- A saved model setup: tooth arrangement, selection, visible anatomy/appliances and camera.
- Optionally, an existing authored demonstration and variant with its recorded starting point.

The basic interaction is **arrange the model → write the note → Save model to step**. The teacher can arrange it through clicks, typing or supported voice commands. Reopening the step shows its saved setup; changing a note does not move teeth. Replacing a saved setup is explicit, and pending previews must be resolved before capture.

A static saved scene and an animation are different. The first version supports saved views plus existing authored demonstrations. It must not invent an animation between two snapshots or infer tooth movement from prose. Custom multi-action animation authoring and automatic notes-to-demonstration generation are later decisions.

The initial lecture builder uses Forma's synthetic model. Attaching a demonstration previews and explicitly adopts its compatible model and authored starting arrangement; it cannot silently combine an arbitrary captured pose with a different demonstration baseline. Save and Teach use that same prepared starting state. Imported/custom-model lecture captures are outside this first version; existing import tools remain available in Explore.

Save lectures locally with a versioned document format, stable step identities, recovery of drafts and explicit file export/import for backup or another computer. Notes, setups and references to demonstrations must survive reopening. Validate loaded documents and report missing/incompatible demonstrations without silently substituting a different one. No account or cloud service is required.

## Teach: notes and model stay together

Teach opens the first step paused. The model dominates; the screen keeps the step title, Back/Next and one playback strip only when the step has a demonstration. Notes and the step list are collapsed by default. A small command entry and microphone remain reachable without a full chat panel.

For each step:

1. Show the saved model setup and, if authored, the student question. The explanation starts hidden.
2. The teacher speaks using their prepared notes. Opening notes does not replace the model.
3. Press Demonstrate to play the linked example. Pause, scrub, change speed or replay through the same strip.
4. Reveal the explanation deliberately; compare with the saved starting arrangement if relevant.
5. Press Next to load the next step's prepared state. Back or jumping to a step restores that step's defined start; it never reapplies motion cumulatively.

**Next changes the lecture step; Play controls the current demonstration.** Keep those purposes distinct. The first version connects notes and the model through their shared step. Ordinary scrolling or reading aloud never moves the model. Clickable actions inside notes and tooth-linked note annotations are possible later extensions with their own authoring and validation work; they are not included in the initial editor. Automatic understanding of arbitrary notes is also outside the first version.

Rehearse uses the same runner as Teach. It should expose missing setups or unavailable demonstrations before a live session. The original Phase 3 two-case, 3–4 minute script becomes a sample teacher-created lecture and an end-to-end acceptance exercise.

## Explore a student's question and return

Keep an **Explore this** control during a lecture. It pauses the demonstration and captures the exact live lecture state: lecture/step identity, arrangement, camera, anatomy, selection, playback progress and question/reveal state. Exploration then uses a temporary copy.

Show a persistent, compact **Return to lecture — [step title]** action. Returning restores the captured live moment, paused, without modifying the saved lecture or losing the teacher's earlier standalone Explore workspace. This differs from Restart step, which restores the authored beginning.

Live experiments do not silently rewrite notes or saved steps. In Prepare, a teacher may explicitly capture an experiment into a step. Saving a reusable alternative during a live lecture can follow later if educators need it.

Keep authored lecture content, live teaching progress and temporary exploration separate. Before switching steps/experiences, stop playback, unfinished speech and pending command requests so delayed results cannot alter the new step. A pending edit requires Apply/Discard or staying where the teacher is; never discard it silently.

## Clicking, typing and voice

Use one validated action path for supported teaching operations. The target is equivalent resulting state and undo behaviour, not three separate engines. The current app has much of this foundation, but parity is incomplete and must be verified operation by operation.

| Intention                  | Click                    | Type or say, proposed wording                  |
| -------------------------- | ------------------------ | ---------------------------------------------- |
| Inspect a tooth            | Select it, then Focus    | “Focus tooth 11.”                              |
| Reveal anatomy             | Roots                    | “Show roots.”                                  |
| Try a movement             | Move, amount, Preview    | “Preview move selected teeth buccally 0.5 mm.” |
| Run the example            | Demonstrate / Pause      | “Play the demonstration.” / “Pause.”           |
| Progress through a lecture | Next / Back              | “Next step.” / “Previous step.”                |
| Discuss the answer         | Reveal explanation       | “Reveal the answer.”                           |
| Recover                    | Undo / Return to lecture | “Undo.” / “Return to lecture.”                 |

These are target equivalents; not every phrase or custom-lecture action exists today. Add missing bounded lecture actions and share their validation, history and cancellation behaviour. File operations and editing prose can remain ordinary UI operations.

Use hold-to-talk initially. Ordinary lecturing must not trigger commands. Show listening state, transcript, interpreted target/action and a reachable Stop. If the target or movement amount is unclear, ask for the missing detail instead of guessing. Keep keyboard shortcuts inactive while editing notes or typing.

Built-in typed/clicked operations and saved demonstrations must work without the AI backend. Optional AI interprets unfamiliar wording within supported actions; it does not author unreviewed tooth trajectories. Existing speech capture uses browser recognition, so offline voice is **not guaranteed**. Make voice readiness/failure visible and keep typing available. English is the current implementation baseline; other lecture languages need an explicit decision and testing. Voice dictation of lecture notes is a separate feature.

## One screen and optional audience display

On one shared screen, the teacher and students see the same Forma window. Notes stay collapsed until requested; opened notes are visible to students. Hidden answers remain hidden until Reveal. Calling them private presenter notes would be incorrect.

An optional later audience window would show only the model, step title, student question and deliberately revealed content on the projector. The laptop could then show private notes and controls. It needs explicit display selection, reliable scene/progress synchronization and reconnect behaviour; it is separate work, not assumed in this proposal.

## Existing foundation and new work

Reuse the model viewer, validated teaching runtime, built-in cases, workflow step content, question/reveal controls, comparisons and current transfer/restore concepts. `lessons.ts` already has command/caption sequences; `workflows.ts` has richer built-in teaching steps. Existing case-file persistence includes current scene/presentation settings, but is not a saved teacher-authored lecture.

Build a small lecture-document model and editor, reliable scene capture, a shared custom-step runner, durable saving and exact lecture/exploration return. A workflow transfer currently copies a shown frame, not its complete authored motion; do not treat it as a lecture serialization format. Preserve one active playback surface rather than adding a third timeline.

## Delivery order

These are proposed PR-sized slices, not authorization to start them. Existing 3.1–3.8 numbers remain reserved by the original proposal; 3.2 is implemented separately. Open PRs were checked before proposing 3.9–3.14. Detailed numbered child docs accompany their implementation PRs.

| Order / phase                                                   | Scope                                                                                                                  | Acceptance                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1 — **3.9 Two teaching experiences**                            | Explore/Lecture navigation and entry points, sharing the model workspace.                                              | Switching does not reset the standalone Explore setup; existing cases/workflows stay reachable.                                 |
| 2 — **3.10 Lecture documents**                                  | Typed step data, scene capture/validation, local save/reopen and backup.                                               | Three distinct setups with notes survive export/reopen; malformed documents cannot corrupt the current session.                 |
| 3 — **3.11 Prepare editor**                                     | Create/duplicate/reorder/remove steps, edit notes/questions, capture setup, attach an existing demonstration.          | Prepare a three-step lecture entirely in Forma; preview decisions remain visible; deletion is recoverable.                      |
| 4 — **3.4 Playback consolidation**                              | One controller surface serving case, workflow and lecture contexts.                                                    | No duplicate active timelines; play/pause/scrub/restart preserve existing behaviour.                                            |
| 5 — **3.12 Teach and rehearse**                                 | Restore saved steps, show questions, reveal explanations and run linked demonstrations.                                | Repeated Back/Next/jump/replay produces identical states with answers initially hidden.                                         |
| 6 — **3.13 Explore and return**                                 | Capture the live lecture moment, temporary exploration and exact restoration.                                          | Change teeth, camera and anatomy midway, then return to the paused moment without editing the saved lesson.                     |
| 7 — **3.14 Teaching input parity**                              | Missing bounded actions for custom lectures plus shared click/type/voice feedback and cancellation.                    | A supported action matrix produces equivalent results; stale speech/AI cannot affect another step.                              |
| 8 — **3.3 Framing**, then **3.5 Presenter display**             | Separate PRs for anatomy scale and minimal Teach chrome.                                                               | Readable large anatomy, no clipping, one context panel and reachable commands/exit at DPR 1/2.                                  |
| 9 — **3.6 Sample lecture**, then **3.7 Biology**                | Separate PRs for the reference lesson and reviewed conceptual tissue explanation.                                      | The same notes-linked 3–4 minute sequence demonstrates both prepared teaching and an exploration round-trip.                    |
| Before release — **3.1 Offline assets**, then **3.8 Rehearsal** | Separate original slices for fonts/icon and real-device evidence; asset work can proceed independently after approval. | Saved lecture and built-in controls work offline; three uninterrupted demo runs and projector/display checks recorded honestly. |

Prioritize a complete three-step lecture over a large template catalogue. Keep existing advanced capabilities accessible while simplifying the surface. Refactor case props and duplicated CSS only where these changes touch them; the broad Try Mode split stays separate.

Use the repository verification gate for each implementation PR. Add behavioural coverage for save/reopen, reordering, capture with a preview, identical replay, question hiding, late-command cancellation and exploration restoration. Browser checks must exercise prepared cases, braces, typing, voice where supported, and DPR 1/2. Actual microphone/offline/projector behaviour requires device testing; unit tests alone do not establish it.

## Decisions for review

- Approve the two experiences and Prepare → Rehearse → Teach flow. The in-Forma authoring requirement is confirmed; rich document import is not needed initially.
- Decide whether the first release needs a separate audience window. The recommendation is one functional shared-screen flow first, with notes hidden until opened.
- Confirm the spoken/typed teaching language. Current support starts with English; Arabic or multilingual use needs specific command and speech work.
- Keep the original proposal's case and biology-review decisions open. The lecture builder must not imply educator review has already occurred.

The implementation request is paused at the planning boundary for this revised design. No application code is changed by this proposal.
