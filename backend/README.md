# Optional command interpretation backend

The browser prototype works without this service. This FastAPI service adds an optional OpenAI text interpreter. The original `/api/interpret` returns one proposed command. `/api/interpret-teaching` returns a validated sequence of classroom actions. Neither endpoint changes a model. There is no database, upload endpoint, geometry processor, or patient-record system here.

This is a nonclinical editor demonstration. Its numeric limits are editor guardrails, not biologically safe movement limits. It cannot decide treatment, segment scans, reconstruct roots, validate movements, or manufacture aligners.

## Start locally

Use Python 3.10 or later. In a PowerShell terminal opened in this `backend` directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` locally and put your own OpenAI API key in `OPENAI_API_KEY`. Do not paste the key into the web app. The model defaults to `gpt-4.1-mini` and can be changed with `OPENAI_MODEL` to a model available to your API project that supports Responses structured outputs.

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env --no-access-log
```

For macOS/Linux use `python3 -m venv .venv`, then `.venv/bin/python` instead of `.\.venv\Scripts\python.exe`; use `cp .env.example .env` to copy the settings.

In the frontend, use backend URL `http://127.0.0.1:8000` and explicitly choose AI interpretation. A missing key does not prevent startup; `/health` reports `ai_enabled: false` and interpretation returns HTTP 503.

Keep this development server bound to `127.0.0.1`. It has no authentication, tenancy, rate limiting, or production deployment configuration. The default allowed browser origins are `http://localhost:3000` and `http://127.0.0.1:3000`; `CORS_ORIGINS` can override them with a comma-separated list of exact origins. CORS is not authentication.

## Request and response

`GET /health` returns service status, model name, and whether a key is configured. It does not check or call OpenAI.

`POST /api/interpret` takes only command text and tooth-selection context:

```json
{
  "text": "Move tooth 11 buccally 1 mm",
  "selected_tooth": "11",
  "selected_teeth": ["11", "12"],
  "available_teeth": ["11", "12", "21", "22"]
}
```

The successful response is a direct command object:

```json
{"type": "move", "tooth": "11", "direction": "buccal", "amount": 1.0}
```

| Type | Additional fields |
| --- | --- |
| `move` | `tooth`, `direction`: `buccal`, `lingual`, `mesial`, `distal`, `intrude`, `extrude`, `x`, `y`, or `z`; signed `amount` in mm, -10 to 10, nonzero |
| `rotate` | `tooth`, `axis`: `x`, `y`, or `z`; signed `amount` in degrees, -180 to 180, nonzero |
| `move_group` | `teeth`: unique nonempty array of IDs; the same `direction` and millimetre bounds as `move` |
| `rotate_group` | `teeth`: unique nonempty array of IDs; the same `axis` and degree bounds as `rotate` |
| `orthodontic` | `teeth`: unique nonempty array of IDs; `movement`: `tip`, `torque`, or `rotate`; signed `amount` in degrees, -180 to 180, nonzero |
| `reset` | `teeth`: unique nonempty array of IDs; restore these teeth's original transforms |
| `appliance` | `visible`: boolean; show or hide the braces overlay |
| `ghost` | `visible`: boolean |
| `stages` | `count`: integer, 2 to 50 |
| `undo`, `redo`, `play` | None |

Permanent FDI tooth IDs (`11`–`18`, `21`–`28`, `31`–`38`, `41`–`48`) are accepted, with at most 32 available, selected, or target IDs. Lists must be unique. `selected_tooth` can be null; `selected_teeth` is optional and defaults to an empty list for older clients. Each selected ID must be in `available_teeth`. “It” and omitted targets refer to `selected_tooth`; “selected teeth” refers to `selected_teeth` and is rejected when that group is empty.

The server resolves target membership independently from model output. It sends the computed `resolved_teeth` to OpenAI, then verifies exact set equality on the returned action. A returned tooth must be available **and** requested. An explicit list containing a missing tooth fails in full; a named category contains only matching teeth present in the case. For example, “upper incisors” can resolve to `["11", "21"]` when those are the only upper incisors available. Missing teeth are never manufactured or silently removed from an explicit list.

Supported group selectors include all teeth, upper/maxillary or lower/mandibular teeth/arch, incisors (FDI positions 1–2), canines (3), premolars (4–5), molars (6–8), anterior (1–3), posterior (4–8), and an arch plus one category. Explicit lists such as `teeth 11,12`, `teeth 11 and 12`, and `teeth 11 12` are supported. Numeric ranges such as `11–18` are rejected; list each tooth or name a group. More specific left/right or central/lateral descriptions require explicit IDs, avoiding silent broadening of the target set.

Commands are limited to 500 characters. Unknown fields, malformed IDs, missing context, out-of-range values, zero movements, and unknown model output fields are rejected. Common compound commands are rejected before calling OpenAI; the model is instructed to reject other ambiguity. A conjunction between explicit tooth IDs is permitted because it denotes a single group action.

### Movement examples and conventions

| Example | Proposed action |
| --- | --- |
| `intrude upper incisors 0.5 mm` | `move_group`, `direction: intrude`, all available upper incisors |
| `torque lower incisors -3 degrees` | `orthodontic`, `movement: torque`, available lower incisors |
| `expand upper teeth 0.5 mm` | `move_group`, `direction: buccal`, 0.5 mm **per tooth** |
| `retract upper anterior 1 mm` | `move_group`, `direction: lingual`, 1 mm per selected anterior tooth |
| `rotate 11 5 degrees` | Legacy single-tooth `rotate`, world `axis: y` |
| `rotate teeth 11,12 5 degrees around x` | `rotate_group`, world `axis: x`, each tooth about its own pivot |
| `rotate upper incisors 5 degrees` | `orthodontic`, `movement: rotate`, each tooth about its own long axis |
| `axially rotate 11 5 degrees` | Single-tooth `orthodontic` axial rotation, using `teeth: ["11"]` |
| `reset selected teeth` | Restore only the explicitly selected group |
| `show braces` / `hide braces` | Toggle the appliance visualization |

The interpreter also understands protract as buccal, constrict as lingual, distalize as distal, and mesialize as mesial. Explicit cm values are converted to mm. Named-group requests remain group operations even if only one tooth matches. A group action should be applied atomically in the frontend and undone in one step.

These are fixed-reference-axis geometric previews. Tip and torque angles are not applied forces, force moments, predicted root movement, or clinical movement prescriptions. The frontend defines and displays the calibrated axis and geometric pivot; single-tooth world rotation remains distinct from orthodontic axial rotation. Arch expansion here is a per-tooth offset, not a measured increase in arch width. Braces visibility does not simulate wire forces or periodontal response.

Errors have the form `{"detail": "Human-readable error"}`. HTTP 422 means invalid or ambiguous input; HTTP 503 means no server API key; HTTP 502 means a provider error or invalid provider output. The frontend should display the error and keep the model unchanged. Always review the proposed action before applying it: schema validity does not guarantee correct interpretation of a person's intent.

## Data flow

When AI interpretation is requested, command text, selected tooth/group IDs, available tooth IDs, and the resolved target IDs are sent to OpenAI from this service. Geometry and case files remain outside this API. Do not include names, patient identifiers, or clinical records in command text. Browser speech recognition is a separate frontend feature, and its data flow depends on the browser.

The teaching endpoint sends command text plus the minimal classroom context documented below. It does not accept mesh data, case names, patient-ID fields or client-supplied API keys. This field restriction does not redact personal information typed into the command text; use synthetic classroom instructions only.

The server reads the API key only from its environment. It writes no command log, does not return upstream exception bodies, and requests `store=False`. That setting is not a claim of zero retention; provider data handling depends on your OpenAI project and applicable policies. Do not enable verbose SDK/HTTP logging when handling sensitive input. The recommended startup command also disables HTTP access logs.

## Run tests without a key

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Tests mock the OpenAI SDK and verify the command contract, FDI group resolution, selected-group context, exact output-target auditing, invalid/missing teeth, numeric/schema limits, backward compatibility, ambiguity, missing-key behavior, refusals, CORS, and server-only key handling. A live OpenAI request has not been tested as part of this prototype. Successful schema and target validation do not prove complete natural-language understanding. The v0.5 classroom controller validates plans again before automatically executing the user's requested actions; whole-request Undo is available.

## Teaching-plan endpoint

`POST /api/interpret-teaching` uses the same server-only `OPENAI_API_KEY`, configured `OPENAI_MODEL`, Responses structured-output parser and `store=False` setting. It accepts text up to 1,500 characters and this minimal context:

```json
{
  "text": "Show upper arch; select incisors; move them buccally 0.5 mm",
  "context": {
    "mode": "case",
    "workflowId": null,
    "stepIndex": 0,
    "selected": "11",
    "selectedIds": ["11"],
    "availableIds": ["11", "12", "21", "22", "31", "32", "41", "42"],
    "synthetic": true,
    "revision": 4,
    "view": "perspective",
    "arch": "both",
    "speed": 1
  }
}
```

In case mode, `stepIndex: -1` means no short-lesson step has been entered yet; this also applies before the first step of a selected lesson. Active workflows still require a valid nonnegative step index. Optional `stage` accepts finite fractional playback/scrubber positions from 0 to 50, and cannot exceed `stages` when that count is supplied. `stages` remains an integer from 2 to 50. Next/previous stage rounds the current position to the nearest integer (half upward), matching the frontend; an exact stage action still requires an integer.

The successful response contains **at most eight ordered actions**, a short summary, and a nullable clarification:

```json
{
  "actions": [
    {"kind": "arch", "arch": "upper"},
    {"kind": "select", "teeth": ["11", "12", "21", "22"]},
    {"kind": "dental", "command": {
      "type": "move_group", "teeth": ["11", "12", "21", "22"],
      "direction": "buccal", "amount": 0.5
    }}
  ],
  "summary": "Show and select the upper incisors, then demonstrate the requested displacement.",
  "clarification": null
}
```

An ambiguous or unsupported interpretation can return `actions: []` with a nonempty `clarification`. An executable plan and a clarification cannot coexist. Malformed provider output returns HTTP 502; a semantic validation failure returns HTTP 422; no key returns HTTP 503. No partial sequence is returned after a validation failure.

Allowed action kinds are `dental` (the existing command union), `select`, `focus`, `view`, `arch`, `toggle`, `comparison`, `stage`, `progress`, `stop`, `lecture`, `lesson-step`, `workflow`, `attachment`, `anatomy`, `anatomy-lesson`, `speed`, `question`, `narrate`, `replay`, and `return-lesson`. The Pydantic models in `main.py` define the exact field and enum allowlists; unknown fields or action kinds are rejected. There is no action that executes JavaScript or generated code.

Optional context is limited to `stage`, `stages`, `playing`, `lessonActive`, `canReturnToLesson`, `lastActions` (at most eight allowlisted actions), `layers` (known visibility booleans), and `boneOpacity` (0–1). View values are `front`, `right`, `left`, `occlusal`, `perspective`; arches are `upper`, `lower`, `both`; playback speed is 0.5, 1 or 2. Workflow context may identify the three appliance workflows or `anatomy`; appliance workflow start actions accept only `fixed-braces`, `palatal-expansion` and `archwire-expansion`.

`{"kind":"question","visible":true}` reveals the authored answer; `false` hides it. “Reveal answer/explanation” and “hide answer/explanation” control this display. “Explain this step” and “explain answer aloud” remain narration actions. This endpoint permits answer display in an active appliance workflow or anatomy lesson, not a free workspace or the older short lessons. Prepared-case answer commands are handled locally because prepared-case identity is not sent to this endpoint.

`{"kind":"progress","value":0.5}` stops directly at halfway without playing first. The finite value is from 0 to 1; fractional positions and odd stage counts are supported. In workflows it selects the authored movement phase, preserving a currently selected anatomy translation or tipping step. “Pause halfway” is the explicit 0.5 preset; other interpreted values need a matching requested fraction or percentage. Numbered `stage` actions remain integer-only and unavailable inside workflows.

The server validates the sequence independently of provider instructions:

- Tooth selection, available IDs, displayed arch and subsequent “it”/“them” references advance in action order. An unqualified family such as incisors uses the displayed arch. “Them” requires a selected group.
- Each numeric tooth edit must match its own source clause, including its signed amount, mm/cm or degree unit, direction/axis and requested targets. Known spoken number forms and cm-to-mm conversion are supported. Tooth IDs cannot supply missing movement values. Values are never clamped.
- Stage counts, exact stage navigation and opacity must match explicit input values and current bounds. The named display presets “make the bone transparent” and “make the bone opaque” mean opacity 0.25 and 1 respectively. These values are display/software controls, not treatment or biological limits; they never supply missing movement amounts.
- Workflow and anatomy starts use the fixed 28-tooth synthetic inventory. Workflow start selects tooth 11 unless an earlier explicit selection in the same request remains valid. Workflow navigation preserves selection. Explicit arch overrides persist through the sequence.
- Direct tooth and attachment edits during a workflow are permitted as reversible variations of the displayed lesson frame. They do not prescribe a clinical movement. `return-lesson` restores the authored frame in the frontend. Attachment geometry and calibration are checked in frontend preflight. Ordinary timeline stages remain unavailable inside workflows.
- All anatomy lesson variants enter a synthetic setup. Bone/cutaway/ligament layers cannot be enabled on an imported case outside such a setup. The model does not reconstruct a patient's anatomy.
- An anatomy lesson action selects a step without starting playback. A translation or tipping demonstration returns that step action followed by `workflow:play`. “Compare translation and tipping” returns translation/play/tipping/play; the frontend waits for each animation before proceeding. Workflow play, including a dental play command in workflow mode, preserves the current anatomy movement step instead of changing tipping back to translation.
- Replay, undo and redo must be standalone plans. Returning to a lesson or exiting a workflow must be the final action because the restored context is not in this request.
- Common negated, hypothetical, clinical planning and executable-code requests return a clarification without calling OpenAI. This is a bounded semantic audit, not proof of complete natural-language understanding.

The frontend must also validate against its **current** scene and reject an asynchronous response if its captured `revision` is stale. The server has no scene state and cannot perform that concurrency check. Plans only propose frontend actions; this API does not perform movements, narration or animation.

`test_teaching.py` uses mocked provider responses to exercise the teaching contract, sequential state/reference resolution, exact numeric and target audits, anatomy and workflow boundaries, refusal handling and server-key isolation. The original 97 `/api/interpret` tests remain unchanged and are run alongside these tests. No live OpenAI teaching call has been verified.

## Official API references

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): Python `responses.parse` and schema requirements.
- [GPT-4.1 mini model](https://developers.openai.com/api/docs/models/gpt-4.1-mini): Responses and structured-output support.

The integration follows these official pages checked on 22 September 2026; your account's model access is separate.
