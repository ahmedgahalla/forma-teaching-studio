# Professor guide · v0.12

Forma supports an interactive university lecture: observe an arrangement, ask students to predict, demonstrate, pause, explain and compare. Free geometric editing, authored demonstrations and initial elastic mechanics are three distinct ways to use the same workspace. Prepared cases and workflows are optional starting points.

## Build and discuss an appliance

Open **Appliances** in the synthetic free workspace. For a prepared case, first choose **Explore this arrangement**. Select teeth, install brackets, choose the visible wire material/size, connect the brackets and enter a small explicit activation. **Show what happens** calculates the initial elastic response. Installing hardware alone does not calculate movement.

Use **Predict before reveal** to hide the calculated response until students answer. Reveal it, show roots, and compare forces/moments and displacement. **Movement display** can exaggerate the picture up to 50×; the reported numbers remain unscaled. Arrows and arcs indicate force/moment direction, without a length scale.

Three families are available: bracket/archwire beam response, tooth/TAD elastic connections, and a contralateral upper-tooth expander with optional declared supporting-spring compliance. Changing a wire or load recalculates against the same unloaded reference. **Compare without the TAD** shows an alternative without destroying the original configuration. The result is an engineering illustration, not predicted treatment.

Save an **Experiment stage** to recall an appliance configuration. Every stage uses the same unloaded reference; stages do not accumulate biological tooth movement. The ordinary geometric timeline and authored case animation also express presentation progress, not elapsed clinical time. See the [README mechanics bounds](../README.md#declared-mechanics-bounds) and [conversational guide](CONVERSATIONAL_COMMANDS.md) for exact controls and commands.

## Point and speak

Hold Space outside an editable field, or hold the microphone button. Pointing to a model location can update “here” or “these teeth” without canceling capture. Release to submit once. Escape, Stop or loss of window focus discards unfinished speech; starting the microphone interrupts narration. Other manual scene edits cancel unfinished capture or stale requests.

Clear validated voice/text geometric movements execute immediately. Prefix a request with **preview** to inspect it before Apply; manual numeric tools retain their preview decision. **Undo** restores the whole request, including its scene/appliance changes. No recognition service or AI key is required for typed built-in commands.

## A short lecture

1. Open **Teaching library**, choose a prepared case and enter **Lecture mode**.
2. Keep the question visible and the answer hidden while students predict what will move.
3. Play, pause at 50%, scrub to a chosen progress, or change presentation speed. These percentages describe the animation, not treatment time.
4. Reveal the explanation visually. **Explain aloud** is separate and only speaks when requested.
5. Show roots or an original overlay. Select a group and use **Focus selection** or **Isolate selection** to make a detail easier to see. **Show full arch** restores context.
6. Use **Lecture pointer** to point on the model without orbiting or changing teeth. **Exit pointer** or Escape restores orbit interaction. The pointer is a screen graphic; it does not create a landmark or measurement.
7. Choose an authored alternative to restart from that case's baseline, or **Try this arrangement** for a free geometric variation. **Return to prepared case** restores the saved stage.

On wide displays the console sits beside the model; narrower displays stack it underneath. Answer text and controls may scroll. The case and command controls remain available. In appliance/anatomy workflows, use the same Lecture mode button. Restart there restores the current lesson step; Next step advances the authored sequence.

## Useful typed commands

Run lines separately, or combine supported actions with “and” or “then”.

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

The revised Blender model has 28 differentiated permanent crowns, connected root objects with explicit branches, and gingiva. It omits third molars and does not include a primary or mixed-dentition pack. Dental Class I, Class II divisions 1/2 and Class III arrangements illustrate tooth relationships, not skeletal diagnoses. Their approximate molar guides, assumptions and initial surface-crossing checks are exposed for review. Selected enamel stays natural with a thin contour; labels are decluttered.

Prepared cases and appliance workflows remain authored illustrations. The separate mechanics module calculates an initial elastic response under declared virtual-support and material assumptions. It does not calculate bone remodeling, tissue adaptation, clinical timing or patient outcome. Displayed support tissue is schematic; sampled crown checks do not establish root/bone clearance. Draft morphology, numerical examples and explanations still need orthodontic educator review before curriculum use.

Voice uses the existing hold-to-talk controller where browser support permits. Actual English microphone capture on a real device is a separate manual acceptance check; typed commands do not depend on it.
