# Guided lessons and free exploration

The Workflow Classroom and Try Mode share the same tooth, root, attachment and appliance renderers. A professor can explain a prepared step, open its displayed arrangement in Try Mode, and explore a geometric variation without rebuilding the model or changing the source lesson.

## Try this setup

1. Open **Teaching library** and choose an appliance workflow or the anatomy lesson.
2. Choose a step. During a movement step, pause at the arrangement you want to discuss. A temporary variation made in the classroom can also be copied.
3. Choose **Try this setup**, or say `try this setup` as a separate request.
4. The editing workspace opens with those displayed tooth poses, selected teeth, attachments, camera, arch and anatomy settings. Playback stops. The source lesson's explanation, question, answer and reference links remain available in the source card.
5. Select teeth and use the ordinary Try Mode preview, **Apply** and **Discard** controls. A saved arrangement named **Workflow start** lets you compare with the copied starting position.

The copied arrangement becomes the committed starting point for a new experiment. The source lesson's trajectory is not copied. Before making a free edit, the existing timeline still interpolates from the model's original poses to the copied setup; return to the source lesson to replay its authored sequence. After a free edit, the timeline replays that edit from its captured start. It starts with no locked teeth, no selection groups and unrestricted illustration off. The earlier workspace's locks and edits remain in its preserved return snapshot; they do not constrain the new experiment. Apply or discard a pending preview before transferring or returning between workspaces.

The source lesson's directional arrows and conceptual palate split are deliberately omitted from the free experiment. Their explanation belongs to the authored lesson. Expander hardware retains its captured illustration opening, while its bands and arms continue to follow edited teeth. Changing teeth does not advance the lesson or activate the appliance.

## One appliance palette

Open the **Appliances** tab in the editing workspace.

| Choice | Display |
| --- | --- |
| None | Hides bracket and workflow hardware. |
| Brackets | Bracket bodies without the archwire or ligatures. |
| Brackets + wire | Brackets, archwires and ligatures. |
| Molar bands | Upper molar bands on teeth 16 and 26. |
| Palatal expander | Molar bands, connecting arms, guide rails and a central screw. |
| Lingual retainer | A schematic wire and bonding pads behind the front teeth of each visible arch. |

The **Appliance display** / **Show chosen appliance** toggle hides and reveals the chosen hardware. If the preset is None, switching it on selects ordinary brackets and wire. Attachment visibility is controlled separately. Bracket material and ligature colour apply to fixed brackets, not to expander or retainer metalwork.

The expander is upper only. Its **Illustration opening** control changes the drawn hardware and optional schematic palate halves; it does not move teeth and is not a screw-turn or millimetre prescription. The palate is an optional diagram, not reconstructed anatomy. The fixed hardware, wires and retainer are regenerated around the displayed tooth positions during editing and playback; they do not calculate forces, elastic deformation or tissue response.

Anatomy cutaway intentionally hides the expander and retainer overlays. Turn cutaway off to inspect those complete appliances. Ordinary bracket detail can remain visible on the isolated tooth. Imported cases offer None and ordinary brackets with wire; imported teeth need their anatomical directions calibrated before bracket placement. The other appliance illustrations and generated support tissues require the synthetic teaching model.

Typed or hold-to-talk preset commands include:

```text
place brackets only
place braces
place expander bands
place palatal expander
place fixed retainer
remove teaching appliance
```

These display commands do not change tooth positions. See [Try Mode](TRY_MODE.md) for movement commands, sampled collision checks and their limits.

## Return to the lesson or your previous workspace

**Return to source lesson** restores the classroom step, shown progress, temporary variation and camera captured when the setup was copied. The free experiment stays in the editing workspace; **Back to my case** returns to it. To explore another classroom arrangement, use **Try this setup** again. This replaces the current free experiment while keeping the original pre-exploration workspace available.

**Restore my workspace** restores the case, edits, display settings and camera that were present before the first setup transfer. It exits the copied experiment. Use **Save case** first if you want a durable copy of that experiment.

The matching commands are `return to source lesson` and `restore my workspace`. Run workspace-transfer commands separately from movement instructions. They participate in whole-request undo/redo during the current session.

## What is saved

The preserved previous workspace and the source-lesson return link are **session-only**. They are not autosaved, included in the downloaded case, or recovered after reloading the page. Opening another case or importing a new model clears these links.

**Save case** writes the current model, committed poses, attachment metadata, movement history, checkpoints, Try Mode arrangements, groups, locks, settings and appliance display preset/opening/palate values. It does not save the source card, source classroom snapshot, previous workspace, camera, anatomy display flags, pending preview or last-edit replay path. Resolve a pending preview before saving.

STL exports contain tooth crowns, static gingiva and optional attachments. Brackets, wires, expanders, retainers, support-tissue illustrations and lesson arrows are display overlays and are not added to the STL. See [Try Mode export details](TRY_MODE.md#save-export-and-limits).

## Why Blender is not required

This integration reuses existing Three.js procedural geometry and the current tooth poses. It needs no Blender installation, conversion step, additional dental software or third-party mesh. Blender could be used separately to author future meshes, but it is not needed to connect the classroom to Try Mode. The shared renderer remains a teaching illustration; combining the tools does not turn it into a biomechanical simulation or manufacturing workflow.
