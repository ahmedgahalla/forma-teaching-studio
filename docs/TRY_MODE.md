# Try Mode · v0.8

Version 0.8 connects this workspace to prepared lessons and a shared appliance palette. See [Guided lessons and free exploration](COMBINED_WORKSPACE.md) for `try this setup`, `return to source lesson`, `restore my workspace`, appliance commands and session-only return links.

The case opens in Try Mode: select teeth, create a geometric preview, inspect it, then **Apply** or **Discard**. Workflows remain separate guided demonstrations. Say `return to try mode` as a separate request to return from a workflow to the preserved case.

These new commands run **locally in English**, with no API key. Type them or use hold-to-talk; browser speech recognition has its own availability and privacy limits described in [Voice Classroom](VOICE_CLASSROOM.md). The optional AI service supports the earlier classroom vocabulary and cannot invent Try Mode mechanics, targets, amounts or gap rules.

## First example

Run these requests in order on the synthetic study:

```text
enter try mode
show upper arch
select upper front six
lock upper molars
move the selected segment posteriorly 0.5 mm
```

The cyan surface is the proposed endpoint. The committed arrangement is unchanged. Inspect the path and its intersection report, then use `apply preview` if permitted, or `discard preview`. Apply commits one endpoint and plays the demonstrated path. It does not calculate treatment duration. A blocked preview can be reduced or discarded.

Resolve a pending preview before another edit, saving an arrangement/case, exporting, or leaving Try Mode. **Revise** can replace a numeric preview without discarding it first. After scrubbing an applied edit, use `show after` before starting another edit or saving an arrangement; new edits start from the committed endpoint, not the displayed intermediate frame.

## Select and move

| Command | Meaning |
| --- | --- |
| `select upper front six` | Available upper incisors and canines. |
| `select upper left molars` | Patient-left FDI group; left means quadrants 2/3, right means 1/4. |
| `select teeth 11,12,21,22` | Explicit ordered list; missing IDs reject the request. |
| `lock posterior teeth` / `unlock selection` | Lock a named group or unlock the selected teeth. |
| `save group as front segment` | Save the current selection; recall it from the group controls. |
| `move selected teeth buccally 0.5 mm` | Each tooth follows its own calibrated buccal direction. |
| `move selected segment posteriorly 1 mm` | One rigid translation, fixed case **−Z**. |
| `move segment upward 0.5 mm` | One rigid translation, fixed case **+Y**. |
| `rotate segment teeth 11,21 5 degrees around z` | Rotate the pair about its shared centre and case Z. |

Segment translations preserve spacing and orientation; segment rotations preserve relative spacing and orientation throughout playback. Ordinary group rotations rotate each tooth around its own crown centre. Case axes stay fixed when the camera or displayed arch changes: anterior is +Z, posterior −Z, upward +Y, downward −Y. Imported scans retain their supplied orientation, so these aliases describe case axes, not inferred anatomy. Named anatomical movements require calibration.

Locked moving teeth reject the whole edit, including in unrestricted mode. A one-sided gap edit can use a locked tooth as its stationary reference. Unqualified families such as `molars` follow the displayed arch; name `upper` or `lower` when needed. Use explicit lists, not numeric ranges.

## Geometric objectives

These are independent preview examples. Apply or discard one before starting the next; actual geometry may prevent an objective.

```text
select teeth 11,21 then close selected gap with equal
close gap between teeth 11,21 to 0.2 mm with first
close gap between teeth 11,21 with second
increase width between teeth 16,26 by 1 mm symmetrically
fit upper front six to arch curve width 54 mm and depth 34 mm
```

- **Gap:** projected crown bounds along the line joining the current centres. `equal` splits the closing displacement; `first` or `second` moves only that ordered tooth. Omitting a target gap means zero; the explicit rule is still required. This is not a shortest surface-distance or contact-fitting calculation. An already overlapping projected pair cannot be closed this way.
- **Width:** the total change in the pair's **3D crown-centre distance**. Each tooth moves half the signed change along their joining line. It is not buccal displacement per tooth or a clinical cusp-tip width.
- **Arch curve:** moves selected calibrated synthetic teeth from one arch to a reference ellipse, preserving their Y height and orientation. Width is its full X span; depth is its Z semiaxis, with a fixed centre at X=0, Z=−12. It does not fit a patient arch, resolve crowding or change tooth inclination.

## Revise, compare and replay

```text
make the last movement smaller
change last movement to -0.5 mm
show displacement traces
show arch curve
play in reverse
pause halfway
show after
save arrangement as baseline
compare saved arrangement baseline
compare with original
hide original
undo the last two changes
redo two changes
```

“Smaller” means half the **original amount** of the numeric edit, not repeated halving. An explicit replacement is signed: −0.5 mm preserves the posterior direction of a −Z segment movement. Revisions start from that edit's original setup and create a new preview; apply it to commit the replacement. Rotation revisions require `degrees`. Gap, curve-fit and arbitrary handle-pose previews have no single amount to revise.

`pause halfway` positions an even-stage demonstration at its midpoint; it does not schedule a later pause. Traces, reverse playback and timeline scrubbing are display tools. Before/After show the edit's start/endpoint; **original overlay** means the source model's original arrangement. Saved comparisons only add an overlay. The saved-arrangement **Restore** button instead creates a candidate that needs Apply.

Undo/redo counts refer to **complete recorded requests**, including their selection and display changes, not just tooth edits. Counts must be 1–10; insufficient history changes nothing. Use counted history and `return to try mode` as separate requests. A preview request and its later Apply request are two entries. Up to eight actions can be combined; missing information rejects the whole request before execution.

## Save, export and limits

**Save case** preserves committed poses, up to ten named arrangements, ten selection groups, locks, arch targets and Try Mode settings. Pending previews and the last-edit replay/revision state are not persisted. No autosave is provided. Saved names accept 1–60 visible characters; `Original` is reserved for the built-in arrangement comparison.

With an applied Try edit active, stage export follows that edit's checked geometric path: stage 0 is the edit start, not necessarily the source original. The individual STL uses the nearest whole shown stage; the ZIP samples the complete path. Without an active edit path, the ordinary original/checkpoint/final sequence applies. Exports contain crowns, static gums and optional attachments, not appliance mechanics or aligner shells.

Software bounds are ±10 mm per numeric translation/span change, ±180° per rotation, 0–10 mm target gaps with at most 10 mm closure, ellipse width 10–120 mm and depth 5–80 mm. Zero numeric movement is rejected. These bounds are not biological limits.

Default Apply checks crown-triangle intersections at **at most 33 path positions**. Starting intersections are reported separately; new or separated-then-reentered crossings block Apply. Reaching the sample budget also blocks constrained Apply. `unrestricted movement on` explicitly permits those illustrations; `unrestricted movement off` restores the constraint. Tooth locks always apply.

Sampling can miss crossings between positions and does not check enclosed volumes, roots, gums, bone, clearance or tissue response. “No new intersections detected” describes this bounded geometry check only. The workspace remains an educational model, not a clinical planning or manufacturing system.
