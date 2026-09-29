status: open

# Learner walkthrough and TAD acceptance

**Phase:** [3.30](../../phases/phase-3-demo-path/3.30-learning-appliances.md), based on draft PR #29.

**Analysis:** The previous role-oriented lecture UI conflicted with the owner's requested single learning view. Removing only visible question/notes controls would leave narration and AI context describing hidden answers. This slice aligns all three surfaces with the short visible takeaway and keeps comparison context distinct. The inherited camera fitting considered anatomy alone, so offset TAD hardware could fall outside a wide viewport despite passing geometry-clearance tests; the final framing review covers this in camera space.

**Location:** CaseMain/CaseShell, lecture-builder workspace/session/analysis, lecture document data, mechanics TAD rendering and camera fitting.

**Suggested auditor action:** Check the seventeen-step case in a real browser at wide, short and narrow sizes, both themes and DPR 1/2. Confirm no role split, dominant model, readable minimal captions, visible screw/elastic at steps 10-12, one calculation/playback bar, fixed anchorage, reliable cancellation and exact return/comparison/Undo. Validate the optional appliance story with Professor Nael before describing it as clinically reviewed. Broader existing CSS, prop-narrowing and try-mode items remain open.

**Acceptance limit:** Automatic security review prohibits local-browser inspection and workarounds in this session. Source, DOM, pure Three.js projection and runtime tests are not pixel/GPU evidence. Leave the PR draft until browser acceptance and CI pass. No need to change AGENTS.md or STATUS.md in this builder branch.
