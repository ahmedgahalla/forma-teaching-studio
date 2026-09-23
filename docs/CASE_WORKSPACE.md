# Prepared cases in the interactive workspace

The teaching library contains 12 synthetic cases. Each case provides a starting arrangement, an authored demonstration, a question and answer, and linked reading. Prepared playback and free editing use the same model and viewer.

Case descriptions, example amounts, questions and answers are **teaching drafts pending educator review**. References support the discussion topics; the chosen poses and numeric values are display choreography, not patient measurements or treatment recommendations.

## A first demonstration

Open **Teaching library**, choose **Anterior crowding**, or use these commands one at a time:

```text
load crowding
play case
pause case
set case progress to 50 percent
explore this arrangement
move tooth 11 buccally 0.5 mm
```

The case opens at its prepared start. Play follows its authored keyframes; Pause and the progress slider let you stop for discussion. **Explore this arrangement** freezes the displayed stage as the starting point of a free Try Mode experiment.

The movement command creates a preview. Review the cyan candidate and the sampled collision report, then choose **Apply** or **Discard**. The matching commands are `apply preview` and `discard preview`. A detected crossing can block Apply; the prepared example's starting intersections are distinguished from new crossings. See [Try Mode](TRY_MODE.md) for locks, revision, collision limits and unrestricted illustrations.

After resolving the preview:

```text
return to prepared case
restore my workspace
```

**Return to prepared case** restores the case and the exact prepared progress saved when you entered Explore. It replaces the free variation with the authored arrangement at that stage. **Restore my workspace** instead returns to the model and editing state that existed before you loaded the prepared case. Save an explored arrangement before leaving it if you want to keep a separate file.

## Cases and comparisons

| Case | Authored demonstration or comparison |
| --- | --- |
| Reference occlusal relationships | Inspect the registered reference without movement. |
| Translation, tip, torque and rotation | Four geometric movement types from one incisor setup. |
| Anterior crowding | Centre alignment followed by rotation correction. |
| Midline diastema | Symmetric closure versus closure with a shifted midpoint. |
| Increased overjet | Anterior translation versus incisor inclination. |
| Dental anterior crossbite | Local repositioning through an illustrative clearance waypoint. |
| Deep bite · anterior intrusion | Upper-incisor intrusion versus a posterior-extrusion concept. |
| Dental anterior open bite | Reduce the authored anterior separation. |
| Dental posterior crossbite | Reposition and upright the displayed posterior segment. |
| Anchorage and space use | Hold posterior reference teeth or let both segments contribute; teeth 14 and 24 are omitted in this example. |
| Occlusal finishing observations | Inspect alignment, height and inclination separately. |
| Removable retention | Hold the arrangement still beneath a schematic transparent removable retainer. |

For example, run `load deep bite`, then `choose posterior extrusion`, then `play case`, as separate requests. Choosing another variant always starts that variant at **0%**; it does not add a second mechanism to the current endpoint. Return from free exploration before choosing or playing a prepared variant. `reset prepared case` restores the current variant's start.

Case load, variant, playback, progress and return commands must be **standalone requests**. Do not combine `load crowding` or `choose intrusion` with a movement in the same utterance. The built-in English commands work without an OpenAI API key. Hold-to-talk uses the browser's speech service; typed commands remain available.

## Reading the display

The selected variant provides its appliance display. Brackets, wires, expanders and the removable-retainer illustration follow the displayed crowns; placement does not generate the scripted tooth motion. The removable retainer is a transparent crown-envelope illustration, distinct from the fixed lingual-wire preset. It is hidden in anatomy cutaway views and has no fit, wear schedule or manufacturing claim.

Use the case question before playback, then reveal its answer. **Assumptions & reading** explains what the example omits and links the relevant sources. The deep-bite posterior-extrusion comparison intentionally keeps the jaw frames fixed; it does not reproduce mandibular rotation or establish an equivalent corrected bite.

Prepared paths can contain intersecting crowns or roots. The supplied geometry audit samples three discrete positions and is not swept collision detection. No force, biological timing, bone response, jaw growth, stability or patient outcome is predicted. Millimetres and degrees describe the authored mesh transforms only. The [case engine and geometry audit](TEACHING_CASES.md) records the implementation and checks separately.

## Saving and returning

Choose Explore before saving an editable case. **Save case** preserves the explored model and committed poses with ordinary case/Try Mode metadata. The prepared case identity, chosen variant, paused return stage, classroom explanations and original-workspace return snapshot remain **session-only**. Reloading a saved case opens its geometry for editing; it does not reconstruct the prepared storyboard or its case-specific removable-retainer flag. There is no autosave.

The older step-by-step appliance and anatomy classrooms remain under **Appliance workflows & anatomy classroom** in the library. Their transfer controls are described in [Combined workspace](COMBINED_WORKSPACE.md). The delivered runtime anatomy and editable source are described in [Blender model](BLENDER_MODEL.md).
