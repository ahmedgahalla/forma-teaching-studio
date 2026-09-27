status: open

# Ready-made lecture — integration review and remaining acceptance

**Branch:** `ahmed/phase-3-teacher-lectures` · **PR:** [#14](https://github.com/ahmedgahalla/forma-teaching-studio/pull/14).

**Scope:** Phase 3.9 on Claude's unchanged Phase 4 base at `ff1b3e5`. The owner now requests a finished sample and no lecture creation option. The final feature opens a deterministic four-step translation/tipping lecture directly in Teach. Authoring, the saved-library UI and its storage code are removed; existing browser saves are not read, modified or deleted. See the [implementation and verification record](../../phases/phase-3-demo-path/3.9-teacher-lectures.md).

## Corrected during implementation

- Related glossary clicks retain the studied tooth, matching the context-aware typed request.
- Paused lecture restoration retains the model, camera, layers, frame and answer/notes visibility, independently of the original Explore workspace.
- Repeated Lecture clicks leave the current step alone. Reopening starts the fixed sample, independent of any prior model setup or unavailable browser storage.
- Read-only lecture protection covers attachment edits as well as tooth motion and scenario changes. Changes require Explore this question.
- Replay preflight uses the saved request-start session rather than the current final-step index. Tests cover repeated Next at the last step and repeated exploration with exact return.
- Command examples and exact visible navigation labels match supported local grammar. Retired preparation requests are rejected locally, including compound requests; the editor cannot be reopened by speech or typing.

Earlier capture/persistence findings informed the first implementation but those authoring features and their dedicated tests are now deliberately removed. Their model-reference lessons remain recorded without claiming a current capture or backup feature.

## Auditor acceptance still required

**Blocking for merge:** a real browser walkthrough with DPR 1 and 2. This session's browser security policy rejected preview access and prohibited alternate-surface workarounds. No browser, microphone, projector or timed-demo pass is claimed.

Verify Lecture directly opens the four-step sample with hidden answers and collapsed notes; play translation/tipping, navigate both directions, rehearse, explore a question and return to its paused moment, then exit to the original Explore workspace. Verify one playback bar, model occupancy, keyboard focus, scrolling, small-screen controls and readable projected text. Notes opened in this single window are visible to the audience. Also check a prepared case, the braces workflow and typed commands in Explore.

Full local gate results belong in the phase doc. Earlier full frontend runs encountered the unchanged BVH oracle timeout and worker startup timeouts; retain the assertions and original timeouts. No incomplete gate should be labelled green.

**Dependency and CI:** audit and integrate PR #13 and Phase 4 before this feature. PR #14 is stacked; the current CI workflow only triggers on PRs targeting main. After dependency integration, retarget this PR to main and require green Node 22/24 frontend and Python backend CI. The builder does not merge or edit auditor-owned STATUS. Unrelated CSS, Try Mode splitting and broad case-prop follow-ups remain separate.

**Suggested resolution:** record browser evidence, dependency disposition and CI results in the audit. Resolve only after acceptance has been performed or explicitly dispositioned by the owner.
