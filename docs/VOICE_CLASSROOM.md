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

Hold-to-talk remains the default. If microphone recognition is unavailable or permission is denied, use typed commands in the same bar.

## Hands-free lecture listening

Choose **Hands-free** beside the command dock, or press **M**, **B** or **.** outside editable fields, dialogs and menus. A red **Listening** pill remains on the model while enabled. Activation is explicit every page session; saving a hands-free preference in Settings never starts the microphone automatically. Window blur keeps this mode running while the tab remains visible; it discards unfinished hold-to-talk capture. Hiding the tab pauses recognition and releases its microphone session. An enabled session resumes when the tab is visible again and narration/hold capture no longer needs it paused; the pill shows a paused state while another pause reason remains.

```text
Forma, show the upper arch
Forma, show the roots
Forma, play
Forma, next step
Forma, explain this step
Forma, stop listening
```

Begin a final utterance with **Forma** or **for ma**, optionally preceded by **hey**, **okay** or **ok**. Saying only one of these full wake phrases arms one follow-up utterance for six seconds. Interim captions appear only for full wake phrases and their armed follow-ups; they do not execute anything. Ordinary classroom speech is silently discarded without captions, submission, storage, logging or AI requests. The student HUD shows an accepted request and its result or clarification, then fades completed feedback after about four seconds.

Recognizer mishearings **former**, **forma's** and **fauna** work only for locally understood final commands: **“former, show the roots”** works locally. They never invoke the AI interpreter or Analyze, and their interim text is never captioned. Unrecognized alias speech, such as **“Former guidelines treated this differently”**, is silently ignored without a HUD error. A bare alias such as **“Former.”** never arms a follow-up.

**Privacy:** while recognition is running, the browser vendor's speech service receives audio, including ordinary lecture speech. The wake gate filters recognized text locally; it cannot prevent that audio transmission. This is not offline recognition or an OpenAI audio connection. Turn hands-free off before private discussion. See [ADR 004](decisions/004-hands-free-voice.md).

Bare **stop** or **cancel** works without Forma during a playing demonstration when recognition is running. Recognition pauses while Forma speaks so it cannot hear itself; the HUD displays the narration and a paused indicator. During that pause a spoken Stop cannot be heard: use **Stop**, **Escape** or the **Hold to talk** button to interrupt, then give the next instruction. Hold Space also interrupts in the default hold mode. Pausing clears any armed follow-up.

Ordinary silence and aborted sessions restart after 250 ms. Sessions lasting at least 2.5 seconds reset restart attempts; only immediate failures accumulate bounded backoff up to four seconds. Permission denial, speech-service denial, an unavailable microphone, initialization/start failure or three network errors turn hands-free off with a message. Page navigation/pagehide, closing the workspace, and changing voice mode or language also turn it off. Correct the problem and explicitly enable it again; returning to a visible tab resumes only a session that was already enabled.

In **Settings → Lecture voice**, choose the voice mode preference, **en-US** (default) or **en-GB**, and optional **Spoken replies** (off by default). Preferences are saved in this browser. Spoken replies give a short confirmation or clarification only after voice requests; explicit “explain” narration remains available regardless of that setting.

If speech synthesis is unavailable or fails, requested narration continues in the normal large caption area, advancing through readable chunks with **“Speech unavailable — showing text”** as a secondary note. It does not replace the explanation with a truncated red error. Stop, Escape and hold-to-talk interruption still cancel the narration sequence.

## Presenter clicker and navigation

**PageDown / Right** advances; **PageUp / Left** goes back. In a workflow classroom this changes the authored workflow step. In the case workspace an active short lesson takes priority; otherwise it changes the prepared-case/demonstration stage. Keys continue working after clicking a plain button such as Next step. Editable fields, visible dialogs and open menus retain their own keys. **M / B / .** toggles hands-free; **Space** retains hold-to-talk in hold mode.

Say **next**, **next step**, **go on**, **continue**, or **go to the next step** for the same forward mapping. **Back**, **previous**, **go back**, and **previous step** use the same reverse mapping. Spoken FDI pairs are accepted: “tooth one six”, “tooth four one”, or “teeth one one and two one”. Ordinary movement quantities keep their existing normalization.

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

## Tooth study and explanations

Teaching draft — pending educator review · synthetic model

Prefix these phrases with “Forma” in hands-free mode; typed commands need no wake phrase:

```text
show tooth 16
study tooth 16
show me the upper right first molar
show the lower left canine
show the upper first molar
tooth one six
view it from the mesial
view from the distal
view from the buccal
view from the labial
view from the cheek side
view from the lingual
view from the tongue side
view from the palatal
view from the occlusal
view from the biting surface
view from the incisal
view from the top
view from the apical
view from the root tip
turn it
next side
explain this tooth
tell me about this tooth
how many roots does it have
what is this tooth
back to the full mouth
close tooth view
exit tooth study
show all teeth
```

Upper/maxillary and lower/mandibular are interchangeable, as are canine/cuspid/eye tooth, premolar/bicuspid, and first molar/six-year molar. Names use the patient's side; an omitted side defaults to right (upper 1x, lower 4x). An omitted arch uses the selected arch or asks for clarification. “Upper first molar” therefore opens 16.

While study is open without a short lesson, **next/back** and presenter keys cycle tooth sides, and tooth-explanation requests use that tooth. An active lesson takes priority for Next/Back; **next side** still turns the tooth. Otherwise a single selected tooth is opened and explained; an ambiguous selection asks for clarification. “Show all teeth” closes an active study and retains its ordinary full-arch meaning outside one. **Focus**, **select**, **zoom to** and **show roots** retain their previous meanings. An empty free workspace now clarifies that there is nothing to step through, without calling AI.

The six buttons and Explain aloud use the same validated, undoable local actions as speech. Tooth-study context/actions never enter the AI interpreter schema. The card and labels are authored teaching drafts; explanations use browser narration with HUD captions and Stop/Escape interruption. Full instructions and limitations: [Tooth study](TOOTH_STUDY.md).

## Ask Forma: teaching glossary

```text
Forma, what is the cusp of Carabelli?
Forma, what's torque?
Forma, what are mamelons?
Forma, define overjet
Forma, explain tipping
Forma, tell me about the cingulum
Forma, show me the oblique ridge
Forma, close the definition
Forma, hide that
```

Run each explanation as a separate request. The glossary speaks and captions an authored definition and shows a large definition card beside the model. Related-term buttons request another definition. Where a visual is authored, it appears first: Carabelli opens tooth 16 from the palatal side; torque and tipping select the matching prepared movement variant, paused at the start. The complete visual-plus-definition request undoes together. Closing the card leaves the displayed model available.

Existing local grammars and their clarifications retain precedence, including **explain that movement**, **explain the result**, **explain this tooth**, **explain this step** and **explain the answer**. Unknown glossary questions return a local clarification with example terms only after those grammars decline the request. **Hide that** and **close the definition** close a currently open definition and otherwise retain existing handling; closing never changes workspaces. Glossary actions and context are excluded from optional AI interpretation; Analyze remains a separate optional feature.

During tooth study, **show me the distal surface**, **show me the occlusal surface** and **show me the apex** turn the tooth already being studied and add its generic definition. Outside study, glossary visuals use their authored representative tooth. PDL and alveolar-bone explanations can load their synthetic prepared case from an imported case before showing the supporting anatomy.

The authored lookup and model instructions work offline without the AI service. Typed commands need no wake phrase, microphone or speech-recognition service. Browser recognition remains subject to its service and connection requirements; it is not an offline wake-word system. Speech-output failure uses the caption fallback described above. Every entry is **Teaching draft — pending educator review**, with no clinical advice or treatment recommendations. See [Teaching glossary](GLOSSARY.md).

## Tooth anatomy tour

```text
Forma, start the tooth anatomy tour
Forma, start the tooth tour
Forma, next
Forma, previous
Forma, explain this step
Forma, next side
Forma, restart lesson
Forma, end the tooth tour
```

Either start phrase begins the same ten-step tour from the free workspace, immediately showing tooth 11 labially. It visits incisors, a canine, a premolar and upper/lower first molars through tooth-study views, then returns to the full mouth. Existing tooth movements are preserved. The Library's short guided lessons list provides the same entry point; the Guide and Library also list Ask Forma phrases.

The lesson ribbon shows the current caption. **Next/previous** and presenter PageDown/Right or PageUp/Left follow lesson steps, taking priority over ordinary tooth-side cycling. Use **next side** to turn the tooth without advancing the lesson, and **explain this step** to narrate its authored caption. Previous and Restart restore the saved setup, including the tooth-study view.

The final step shows the full mouth and leaves its ribbon caption available for narration. **End the tooth tour** or the ribbon's close button ends the lesson; **back to the full mouth** while a tour tooth is open also ends it. Closing returns to the full mouth and remains undoable as one request. Tour captions are **Teaching draft — pending educator review** and describe synthetic anatomy; browser, projector and educator acceptance remain outstanding.

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

Undo, redo and replay must be separate requests. Returning to the lesson or exiting a workflow must be the final action in a compound request. Authored narration starts when requested; optional Spoken replies adds short voice confirmations when enabled in Settings.

## Optional flexible interpretation

For unfamiliar wording in the earlier classroom vocabulary, configure the included [Python backend](../backend/README.md), keep the API key in its environment, and connect the service through **Settings**. The controller tries local commands first and can use the enabled service for those earlier actions, including camera and visibility requests while Try Mode is open. New Try mechanics remain local-only. A valid, current classroom plan runs automatically; tooth edits in Try Mode create previews that still require Apply. A clarification or failed validation makes no edits.

The service receives only your text and minimal classroom context. Meshes, case names and patient-ID fields stay outside that request. Avoid personal records in the text itself. Voice recognition uses the browser's speech service, which may send audio to its vendor; it is not OpenAI audio transcription or a realtime audio connection. Narration uses browser speech synthesis.

Live microphone hardware, browser speech recognition and live OpenAI calls have not been verified for this release. Automated tests use simulated recognition and mocked API responses. See [VERIFICATION.md](VERIFICATION.md) for the release's verified checks and limits.
