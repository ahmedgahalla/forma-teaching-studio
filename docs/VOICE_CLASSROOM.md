# Voice Classroom · v0.8

Version 0.8 connects this workspace to prepared lessons and a shared appliance palette. See [Guided lessons and free exploration](COMBINED_WORKSPACE.md) for `try this setup`, `return to source lesson`, `restore my workspace`, appliance commands and session-only return links.

Use the same command bar in your case workspace and every classroom. Familiar commands work without an API key. These examples operate on synthetic teaching geometry; movement amounts are illustrative inputs, not clinical recommendations.

## Version 0.7: Try Mode in the case

The case now opens in Try Mode. Tooth edits create a candidate preview, then need `apply preview` or `discard preview`. Selection, camera and visibility commands still act immediately. Workflows retain their guided-step and temporary-variation behavior.

```text
select upper front six
move selected segment posteriorly 0.5 mm
make the last movement smaller
apply preview
show after
save arrangement as example one
compare saved arrangement example one
compare with original
undo the last two changes
```

Run each line separately and review the preview before Apply. Spoken number words are normalized, so the example arrangement is named `example 1`. Original and saved comparisons are overlays, not restoration commands. Counted undo/redo restores complete recorded requests, including display changes, and refuses an unavailable count without partial execution.

Say `return to try mode` as a separate request to leave a workflow and return to the preserved case. New mechanics and objectives use **local English parsing only**; the optional AI endpoint cannot supply them. Missing amounts, gap rules or arch dimensions produce clarification without earlier actions taking effect. See [TRY_MODE.md](TRY_MODE.md) for exact lock, segment, gap, span, arch, revision, playback and saving commands.

## Speak, type and stop

1. Hold **Space** while focus is outside a text field or control, or hold the **Hold to talk** button.
2. Speak one English request. Release to run it. The heard text and current status appear below the bar.
3. Alternatively, type a request and press Enter or the arrow button.
4. Press **Stop** or **Escape** to cancel listening or a pending request, pause animation and stop narration. Use **Undo** to reverse already displayed changes.

The microphone only listens while you request capture. There is no always-listening mode. If microphone recognition is unavailable or permission is denied, use typed commands in the same bar.

## Start a demonstration

```text
start anatomy lesson
demonstrate palatal expansion slowly
demonstrate archwire expansion
start braces workflow
next step
previous step
play demonstration
pause demonstration
exit workflow
```

The appliance workflows each have seven authored steps. The anatomy lesson has four: anatomy and support tissues, translation, tipping, and comparison. Workflows open fresh synthetic models; **Back to my case** restores your case workspace.

To explain a specific appliance stage, first open its workflow, then use `install brackets`, `insert archwire`, `install expander`, `show forces`, `show movement`, or `show retention`. These change a classroom illustration; “activate expander” shows conceptual loading rather than a clinical activation schedule.

## Look inside a tooth

```text
show the root
show bone
show cutaway
show periodontal ligament
make the bone transparent
set bone opacity to 40 percent
make the bone opaque
demonstrate translation
demonstrate tipping
compare translation and tipping
```

`demonstrate translation` and `demonstrate tipping` select and play their examples. `compare translation and tipping` plays translation first, then tipping; each animation finishes before the next begins. `play demonstration` repeats the current movement example, so playing the tipping step stays on tipping.

“Transparent” is a fixed **25% opacity** display preset; “opaque” is 100%. Bone, the cutaway and the enlarged ligament are synthetic teaching layers. Supporting tissues remain stationary while tooth movement is illustrated. They do not reconstruct or predict patient anatomy, tissue deformation or remodelling. Imported STL cases cannot enable these layers; open an anatomy lesson to use its synthetic model.

**Saving a labelled cutaway:** PNG export captures only the WebGL scene. Tissue labels are HTML/DOM overlays and are omitted from that PNG. Take a browser or screen screenshot when you need the labelled view for a slide or handout.

## Combine instructions

```text
show upper arch, hide gums, and select molars
select upper incisors then move them buccally 0.5 mm
show roots and show bone and make the bone transparent
focus tooth 11 then rotate it 5 degrees around z
```

Use `and`, `then` or a semicolon to combine **up to eight actions**. Selection and display context advance in order: `it` refers to the active tooth and `them` to the selected group. After `show upper arch`, an unqualified group such as `molars` refers to the available upper molars. Use explicit tooth lists such as `teeth 11,12,21,22` instead of numeric ranges.

Each tooth movement needs its amount, unit and direction. `move it a little` is incomplete. Use `mm` for distances and `degrees` for angles. A single `rotate it 5 degrees` defaults to world Y; a group rotation without a world axis uses each tooth's long axis. Add `around x`, `around y` or `around z` to be explicit.

## Experiment, restore and explain

| Request                                      | Result                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `move 11 buccally 0.5 mm` during a workflow  | Creates a temporary variation of the displayed lesson frame.                                                                       |
| `return to the lesson`                       | Restores the current step's authored geometry. Going to the next step also resumes the authored story.                             |
| `undo that` / `redo`                         | Restores the whole command request, including selection and display changes.                                                       |
| `repeat that more slowly`                    | Replays the prior completed demonstration from its saved starting setup at half speed. It does not accumulate the same edit again. |
| `explain this step`                          | Reads the current lesson explanation aloud.                                                                                        |
| `explain the answer`                         | Reads the lesson's answer aloud.                                                                                                   |
| `half speed`, `normal speed`, `double speed` | Changes animation playback speed, not clinical treatment time.                                                                     |

Undo, redo and replay must be separate requests. Returning to the lesson or exiting a workflow must be the final action in a compound request. Narration starts only when you ask for it; it is not automatic after every action.

## Optional flexible interpretation

For unfamiliar wording in the earlier classroom vocabulary, configure the included [Python backend](../backend/README.md), keep the API key in its environment, and connect the service through **Settings**. The controller tries local commands first and can use the enabled service for those earlier actions, including camera and visibility requests while Try Mode is open. New Try mechanics remain local-only. A valid, current classroom plan runs automatically; tooth edits in Try Mode create previews that still require Apply. A clarification or failed validation makes no edits.

The service receives only your text and minimal classroom context. Meshes, case names and patient-ID fields stay outside that request. Avoid personal records in the text itself. Voice recognition uses the browser's speech service, which may send audio to its vendor; it is not OpenAI audio transcription or a realtime audio connection. Narration uses browser speech synthesis.

Live microphone hardware, browser speech recognition and live OpenAI calls have not been verified for this release. Automated tests use simulated recognition and mocked API responses. See [VERIFICATION.md](VERIFICATION.md) for the release's verified checks and limits.
