# Handoff — 2026-09-26 — ahmed/phase-3-demo-proposal

## Completed

- Ran the session-start protocol and checked dependency sync. Finished onboarding separately in [PR #11](https://github.com/ahmedgahalla/forma-teaching-studio/pull/11), merging main and renumbering its record to Phase 1.9 (1.8 is reserved by PR #10). All three CI jobs on PR #11 passed.
- Branched this proposal from clean main at `dfd377f`, independent of the unmerged onboarding PR.
- Reviewed and agreed to the Node >=22.6 policy, verified local Node 22.23.3, setup, CI matrix and matching required check names. Marked the requested auditor inbox item resolved with builder sign-off. AGENTS.md itself was not changed.
- Read the Phase 3 sketch, product priority/direction, all twelve case recipes, sampled audit, anatomy implementation and open refactoring items. Used independent read-only reviews for case choice, UI seams and biology references.
- Expanded [Phase 3 proposal](../phases/phase-3-demo-path/README.md): existing/pitch case comparison and costs, a 3:40 script, opening/drawer/presenter design, conceptual translation biology, eight PR-sized steps and decisions for the owners.
- Recommendation: movement types plus anchorage, with diastema as a simpler substitute. Exact canine closure, premolar derotation and molar uprighting need new authored cases. Existing crown-centred tipping must not be given an incompatible pressure/tension overlay.
- Kept all three refactoring follow-ups open. Props/CSS work is included only at touched views/styles; the full Try Mode split is deferred.

## Verification

Full command gate passed on the proposal branch: 1,575 frontend tests across 51 files; nonincremental typecheck; lint with zero warnings; formatting; file limits (244 files); static production build; 470 backend tests without warnings on Python 3.13.3. Local Markdown links and whitespace checks passed. Independent case/script and biology reviews found no blocking issues; minor wording suggestions were incorporated. This proposal changes no application source, assets, dependencies, or UI. No new browser, projector, educator-review or recorded-demo acceptance is claimed; those are future plan criteria.

## Current state and next action

The proposal is open as [PR #12](https://github.com/ahmedgahalla/forma-teaching-studio/pull/12), documentation only and unapproved. The auditor and users should choose the case route, biology depth, reviewer, pivot treatment, presentation context and opening behaviour. Review the onboarding PR independently. No Phase 3 implementation starts until the roadmap is agreed; this task stops after opening the proposal PR.

No builder changes to `docs/STATUS.md`. No new defect lesson was identified in this planning slice; the existing stale-doc, generated-audit, canvas-DPR and phase-numbering lessons were applied. The proportional-verification proposal in PR #10 was not assumed to be an active rule.

## Follow-up: teacher-created lectures and exploration

The owner subsequently authorized the first UI implementation slice, now in PR #13, then explicitly requested planning before further building. The revised brief is two experiences, Explore and Lecture, with the 3D model central and supported control through clicking, typing and voice. The owner confirmed that lecture notes will be created beforehand inside Forma. The earlier stop statement above describes the original proposal session; this follow-up records the current request.

Added [teacher workspace proposal](../phases/phase-3-demo-path/teacher-workspace-proposal.md) and made it the phase README's current direction. The plan covers Prepare → Rehearse → Teach, saved notes and model setups, existing authored demonstrations, hidden answers, local lecture files, temporary exploration with exact return and input parity. It distinguishes static scene capture from motion authoring and ordinary shared-screen notes from a later private audience-window arrangement. Proposed new slices 3.9–3.14 leave the original 3.1–3.8 numbers intact.

Session start pulled main (already current), read status/lessons/inbox/phase/handoffs and checked open PRs. Planning work uses an isolated worktree on the existing proposal branch so the current PR #13 app preview remains untouched. Dependencies were installed with `npm run setup` in that worktree. The application, assets, dependency declarations, AGENTS.md and STATUS are unchanged.

### Current review boundary

Review the teacher journey before more implementation. One functional shared-screen experience is the recommended starting point; a separate audience window and additional voice languages remain decisions. English browser speech is available in the existing code, but offline recognition is not guaranteed. The original case choice and biology review decisions remain open. PR #13 has passing CI but retains its outstanding DPR 2 display audit; this docs proposal does not resolve that device check.

Existing state-preservation, stale-documentation and phase-numbering lessons informed the proposal. The Node-policy sign-off stays resolved on this branch; the props, CSS and Try Mode follow-ups remain open. The existing opening-review inbox item already covers PR #13; no duplicate opening audit request was created.

### Follow-up verification

Setup, 470 backend tests, nonincremental typecheck, zero-warning lint, formatting, file limits (244 source files), local documentation links, whitespace checks and the production build passed. The full frontend gate is **not green locally**: two default runs passed 1,574/1,575 tests and timed out in the unchanged real-GLB geometry oracle. A full run with `--maxWorkers=1` also exceeded its unchanged 30-second limit. No application/test code, timeout or assertion was modified. Recorded the recurring verification issue in [the auditor inbox](../reviews/from-builder/2026-09-26-geometry-oracle-timeout.md) and lesson 12; the underlying slowdown remains unproven. This does not block reading the plan, but must be represented honestly in PR verification.

The planning update changes no screens, so no new browser/device acceptance is claimed. An independent read-only proposal review led to two clarifications: attaching a demonstration explicitly adopts its compatible starting model, and clickable note actions/tooth-linked annotations are later extensions rather than hidden MVP scope.
