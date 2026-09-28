# Professor guide · v0.12

Forma supports an interactive university lecture: observe an arrangement, ask students to predict, demonstrate, pause, explain and compare. Free geometric editing, authored demonstrations and initial elastic mechanics are three distinct ways to use the same workspace. Prepared cases and workflows are optional starting points.

## Start with the model

The case workspace opens with **Tools** and **Commands** closed so the model has the main area. The header keeps **Library**, **Tools**, **Present** and **More** available. Use More for Open case, Save case, Settings, theme, Guide, Selection and Layers. Tools opens the editing inspector, including numeric movement controls; Selection and Layers open a separate drawer. Close them when returning attention to the model.

Use **View** beside the model heading for camera presets, arch visibility, Before/After/Overlay comparison, Measure, Focus selection, Isolate selection, Lecture pointer and **Export 3D image** (PNG). **Fit model** remains available beside View without opening the menu. On phones and tablets, Model, Select, Layers and Tools also remain in the bottom dock.

For the Atlas mouth, **Open jaw / Close jaw** is in Explore's **Display** panel and Lecture's **View** menu. The same action accepts “open the jaw” or “close the mouth” through typing or speech and supports Undo. It rotates the lower arch around the authored hinge, carrying its gum, brackets and wires; measurements and mechanics remain in the original case coordinates. The existing jaw-separation slider is a separate display offset. Tooth study keeps its own focused presentation.

The row below the model keeps **Commands** and one **Undo/Redo** pair available. Open Commands to type or use Analyze, or press `/` outside an editable field to open and focus the input. **Hide commands** closes the composer while brief feedback remains visible; **Stop** appears there during speech capture, a running request or playback. Preview Apply/Discard decisions remain visible independently of both Commands and Tools.

## Build and discuss an appliance

Open **Tools → Appliances** in the synthetic free workspace. For a prepared case, first choose **Explore this arrangement**. Select teeth, install brackets, choose the visible wire material/size, connect the brackets and enter a small explicit activation. **Show what happens** calculates the initial elastic response. Installing hardware alone does not calculate movement.

Use **Predict before reveal** to hide the calculated response until students answer. Reveal it, show roots, and compare forces/moments and displacement. **Movement display** can exaggerate the picture up to 50×; the reported numbers remain unscaled. Arrows and arcs indicate force/moment direction, without a length scale.

Three families are available: bracket/archwire beam response, tooth/TAD elastic connections, and a contralateral upper-tooth expander with optional declared supporting-spring compliance. Changing a wire or load recalculates against the same unloaded reference. **Compare without the TAD** shows an alternative without destroying the original configuration. The result is an engineering illustration, not predicted treatment.

Save an **Experiment stage** to recall an appliance configuration. Every stage uses the same unloaded reference; stages do not accumulate biological tooth movement. The ordinary geometric timeline and authored case animation also express presentation progress, not elapsed clinical time. See the [README mechanics bounds](../README.md#declared-mechanics-bounds) and [conversational guide](CONVERSATIONAL_COMMANDS.md) for exact controls and commands.

## Point and speak

Hold Space outside an editable field, including when Commands is closed, or open Commands and hold the microphone button. Pointing to a model location can update “here” or “these teeth” without canceling capture. Release to submit once. Escape, Stop or loss of window focus discards unfinished speech; starting the microphone interrupts narration. Other manual scene edits cancel unfinished capture or stale requests.

Clear validated voice/text geometric movements execute immediately. Prefix a request with **preview** to inspect it before Apply; manual numeric tools retain their preview decision. **Undo** restores the whole request, including its scene/appliance changes. No recognition service or AI key is required for typed built-in commands.

## Lecturing hands-free

1. Open a prepared case or workflow and choose Present/Lecture mode if desired. Hold-to-talk remains the default; the visible **Hands-free** toggle beside Commands enables listening for this session. A presenter clicker's **B** or **.** button, or keyboard **M**, does the same.
2. Check the persistent red **Listening** pill on the model. The browser vendor's speech service receives audio while recognition is running. Activate this only when that is appropriate for the room; the wake word does not keep lecture audio on the device.
3. Say **“Forma, show the upper arch”**, then **“Forma, show the roots.”** Students see the interim caption, accepted request and confirmation. Non-wake final speech is discarded by Forma without storage, submission, logging or AI use. A bare **“Forma”** gives six seconds for the next utterance without repeating the name.
4. Ask students to predict, then say **“Forma, play.”** Use **“Forma, next step”** or PageDown/Right to advance; PageUp/Left or **“Forma, go back”** goes back. This follows the workflow step, active short lesson, or otherwise the case demonstration stage. Button focus does not disable the clicker.
5. Say **“Forma, explain this step”** to narrate and caption the current explanation. Recognition pauses during speech output. Bare **“stop”** stops a playing demonstration while listening; during narration use **Stop**, **Escape**, or hold the microphone button to interrupt before speaking. Optional **Spoken replies** in Settings gives short voice confirmations and is off by default.
6. Say **“Forma, stop listening”**, click Listening, or press M/B/. to turn the microphone off. Window blur leaves a visible tab listening. Hiding the tab pauses recognition and releases the microphone session; an already enabled session resumes on return when no narration/hold-capture pause remains. The pill shows a paused state while another pause reason remains. Navigation/pagehide, mode/language changes and unrecoverable recognition errors turn it off. It never restarts from a saved preference or page reload.

Settings offers a voice mode preference and English **en-US/en-GB** recognition. In hold mode Space retains its usual behavior when hands-free is off; the hold button remains available for interruption. Presenter shortcuts ignore editable fields, open dialogs and menus. Keep typed commands and Stop available while rehearsing; real microphone, projector and DPR checks remain required on the actual device. Details: [Voice Classroom](VOICE_CLASSROOM.md#hands-free-lecture-listening).

## Tooth study

Teaching draft — pending educator review · synthetic model

Select one tooth and choose **View → Study this tooth**, or say **“Forma, show the upper right first molar.”** The tooth opens with its roots, direction labels and an explanation card beside the model. Say **“view it from the mesial”**, **“explain this tooth”**, then **“back to the full mouth”**. Next/Back and presenter keys cycle its six sides while study is open, unless a short lesson is active. Closing an ordinary tooth study restores the exact prior view and selection; Undo/Redo restores the whole request.

Names use the patient's side. An omitted side means **right**: “upper first molar” opens **16**. “How many roots does it have” reads the authored explanation; root counts describe Forma's synthetic model, not every real tooth. Explanations use the existing voice captions and Stop/Escape interruption. See [Tooth study](TOOTH_STUDY.md) for names, aliases, camera orientation and review limits.

## Ask Forma to explain

Say **“Forma, what is the cusp of Carabelli?”** to open tooth 16 from its palatal side and hear the authored definition. **“Forma, what is torque?”** and **“Forma, explain tipping”** open the matching prepared movement example, paused at the start. The definition card sits beside the model, with related terms as buttons and the review status. The same narration appears in the large student captions. Choosing a related term requests its definition and any authored view.

Use **“what is…”**, **“what's…”**, **“what are…”**, **“define…”**, **“explain…”**, **“tell me about…”**, or **“show me…”** with a glossary term. Existing commands such as **“show roots”** keep their normal meaning. Unknown glossary questions offer example terms locally. Say **“Forma, close the definition”** or **“Forma, hide that”**, or use the card's close button. Closing the definition leaves its model view available; **Undo** restores the complete explanation request, including its visual changes.

Definitions and their model instructions are authored data and work offline without the AI service. Type these requests in Commands without a wake phrase when speech recognition is unavailable; browser recognition may require a connection and sends audio to the browser vendor while listening. If speech output cannot start or fails, the narration continues as readable caption chunks with the secondary note **“Speech unavailable — showing text”**. Stop, Escape or starting hold-to-talk interrupts the caption sequence as well as speech.

All glossary entries are **Teaching draft — pending educator review**. They explain terminology and synthetic illustrations, without clinical advice, force prescriptions or treatment recommendations. The in-app **Guide** and **Library** list Ask Forma examples. See [Teaching glossary](GLOSSARY.md) for content and review limits.

## Lead a tooth anatomy tour

From the free workspace, say **“Forma, start the tooth anatomy tour”** or **“Forma, start the tooth tour”**, or select it under **Library → Short guided lessons**. It starts immediately at tooth 11's labial surface and preserves your tooth movements. If a prepared case or workflow is active, return to the free workspace first.

The ten steps visit 11 labial and palatal, 13 labial, 14 mesial, 16 occlusal, palatal and buccal, 46 occlusal and buccal, then the full mouth. Say **“Forma, next”** or use PageDown/Right on the clicker to advance. **“Forma, previous”** or PageUp/Left restores the preceding setup; **“Forma, explain this step”** narrates the caption shown in the lesson ribbon. During a lesson, Next/Back follows its steps; **“next side”** still turns the isolated tooth.

The last step returns to the full mouth and keeps the final ribbon caption available for **“explain this step”**. Say **“Forma, end the tooth tour”**, close the lesson ribbon, or use **“back to the full mouth”** while studying a tooth to end the tour. These exits show the full mouth, and Undo can restore the tour. The tour is a **Teaching draft — pending educator review**; root counts and displayed morphology describe this synthetic model.

## A short lecture

1. Open **Library**, choose a prepared case and choose **Present** to enter Lecture mode.
2. Keep the question visible and the answer hidden while students predict what will move.
3. Play, pause at 50%, scrub to a chosen progress, or change presentation speed. These percentages describe the animation, not treatment time.
4. Reveal the explanation visually. **Explain aloud** is separate and only speaks when requested.
5. Show roots with a command or Layers; use **View → Overlay** for the original arrangement. Select a group and use **Focus selection** or **Isolate selection** in View to make a detail easier to see. **Show full arch** restores context.
6. Use **View → Lecture pointer** to point on the model without orbiting or changing teeth. **Exit pointer** or Escape restores orbit interaction. The pointer is a screen graphic; it does not create a landmark or measurement.
7. Choose an authored alternative to restart from that case's baseline, or **Try this arrangement** for a free geometric variation. **Return to prepared case** restores the saved stage.

On wide displays the console sits beside the model; narrower displays stack it underneath. Answer text and controls may scroll. The case and command controls remain available; **Exit present** leaves the case's Lecture mode. In appliance/anatomy workflows, use their Lecture mode button. Restart there restores the current lesson step; Next step advances the authored sequence.

## Useful typed commands

Open **Commands** or press `/`. Run lines separately, or combine supported actions with “and” or “then”.

```text
show upper jaw and hide gums
select upper front six
show roots
left view
play demonstration
pause halfway
reveal answer
hide answer
explain this step
compare with original
undo that
```

`reveal answer` and `hide answer` control a prepared case or workflow's stored explanation. A free workspace without one asks you to choose a teaching example. They do not ask AI to invent an answer. `explain this step` requests narration. Camera, display and answer changes submitted as one request undo together.

For a reviewed geometric edit, select a group and say `preview move selected teeth buccally 0.5 mm`, then Apply or Discard. Playback illustrates the proposed or last applied geometric change. Roots stay linked to crowns; brackets remain attached. Isolation hides surrounding anatomy and whole-arch display appliances; turn it off when inspecting a complete appliance.

## What the model means

The revised Blender model has 28 differentiated permanent crowns, connected root objects with explicit branches, and gingiva. It omits third molars and does not include a primary or mixed-dentition pack. Dental Class I, Class II divisions 1/2 and Class III arrangements illustrate tooth relationships, not skeletal diagnoses. Their approximate molar guides, assumptions and initial surface-crossing checks are exposed for review. Selected enamel stays natural with a soft surface glow; labels are decluttered.

Prepared cases and appliance workflows remain authored illustrations. The separate mechanics module calculates an initial elastic response under declared virtual-support and material assumptions. It does not calculate bone remodeling, tissue adaptation, clinical timing or patient outcome. Displayed support tissue is schematic; sampled crown checks do not establish root/bone clearance. Draft morphology, numerical examples and explanations still need orthodontic educator review before curriculum use.

Voice offers default hold-to-talk and explicitly enabled hands-free capture where browser support permits. Actual English microphone capture on a real device is a separate manual acceptance check; typed commands do not depend on it.
