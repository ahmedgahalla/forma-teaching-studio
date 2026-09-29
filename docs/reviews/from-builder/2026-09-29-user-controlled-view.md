status: open

# User-controlled lecture view and recording acceptance

**Phase:** [3.31](../../phases/phase-3-demo-path/3.31-user-controlled-view.md), based on draft PR #30.

**Analysis:** Holding the named view alone is insufficient: scene snapshots load authored cameras, and the renderer also refits on visibility/focus changes. Preserve the actual camera pose during same-lecture navigation, then prevent downstream automatic refits from replacing it. Comparison snapshots must retain the view label as well as the physical camera. Explicit focus toggles still need a deliberate fit; automatic selection changes between steps do not.

**Location:** lecture scene/session restoration, comparison snapshots, Viewer camera lifecycle and LectureViewControls.

**Suggested auditor action:** Verify exact orbit/pan/zoom continuity while navigating steps, changing views, comparing and returning from exploration. Check explicit Fit/Focus and occlusal arch visibility on a real browser at DPR 1/2 and wide/short/narrow sizes. Run the repository's prepared-case, braces and typed-command acceptance. Keep the PR draft pending those checks and green CI.

**Recording:** The owner wants a real sixty-second continuous screen recording with no effects. A source-checked [rundown](../../pitch/nael-one-minute-screen-recording.md) is provided. No video is claimed: existing automatic security review blocks local-browser inspection/capture and workarounds in this session. Do not substitute the older illustrated pitch or describe the TAD initial response as the cause of the authored finish.
