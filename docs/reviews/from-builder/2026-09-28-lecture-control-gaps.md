# Teacher-flow requirements check

status: open

**From:** builder · **Reviewed base:** `22fd450` (Phase 3.17) · **Current implementation:** [Phase 3.18](../../phases/phase-3-demo-path/3.18-lecture-controls.md)

The previous goal turn made progress: PR #16 supplied mechanics facts to Analyze and PR #17 added cancellation with a passing full automated gate. The current requirements check compares the actual source and tests with the owner's two-workspace lecture brief; it does not treat passing tests as proof of every usability requirement.

1. **Sample entry lacks text/voice parity.** `CaseShell` calls `openSample()` for the Lecture tab, but `parsePresentationPlan` returns early without active presentation context and never emits an open action. An in-memory check of the real parsers rejects `lecture` / `open sample lecture`; legacy `start lecture` only toggles the Present layout. Phase 3.18 supplies explicit local sample-entry and Explore-exit aliases with the same saved-state protections as the buttons.
2. **Lecture removes essential clickable view controls.** `CaseMain` replaces `CaseWorkspaceHeading` with a title, dropping its camera/Fit controls. The topbar hides Tools/Layers and lecture CSS hides the sidebar. Root and camera commands still work by text. Phase 3.18 adds a compact camera/roots disclosure and Fit action in the lecture heading, without exposing editing controls.
3. **Public audience annotations are omitted.** `audience-connection.ts` captures only the WebGL canvas; tooth numbers, section/study labels and the lecture pointer are separate DOM elements. The audience therefore cannot see these annotations when the presenter enables them. Plan a separate correction that projects only public model annotations, keeps private notes and commands excluded, and avoids per-frame subtree mutation observation or a second renderer. Actual popup/video/monitor behavior still requires device verification.

The fixed sample, hidden answers, authored navigation, single playback strip, comparison restoration and separate Explore return points have source and focused test evidence. No lecture authoring remains. The mechanics review found no additional demonstrated baseline, cancellation or whole-request undo failure. Browser/DPR/projector, physical microphone and orthodontic educator acceptance remain unverified, and the PR dependency stack remains unmerged.

Implementation review also found two corrections within 3.18: repeated sample entry must return before runtime interruption/history, and the lecture View popup must be sized against its actual model column instead of the viewport. Both were corrected and covered by regressions; the full automated gate passed (2,604 frontend / 619 backend tests plus the remaining build/static checks). Final source review found no further actionable issue in the slice. Items 1–2 are addressed by this slice; item 3 keeps this review open for the audience-annotation follow-up and auditor review.
