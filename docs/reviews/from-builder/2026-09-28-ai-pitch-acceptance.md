status: open

# Local AI startup and pitch acceptance

Phase [3.25](../../phases/phase-3-demo-path/3.25-ai-and-pitch.md) provides an opt-in local launcher and same-origin gateway for the existing Responses backend. Please review loopback/Host/Origin protections, limits/cancellation, credential separation and lifecycle behavior, including the new mocked tests.

Independent source review found Windows environment casing could defeat inherited provider overrides and frontend credential filtering. The launcher canonicalizes those provider names on Windows and filters them case-insensitively, with a dummy-value regression; lesson 43 records the cause and prevention.

The saved credential belongs to OpenRouter, while the user asked for OpenAI. Provider choice is pending; direct OpenAI needs its own key. No credential was copied and no live provider request or service startup was performed. Health only reports configuration, so it must not be recorded as successful account/model verification.

The narrated MP4 is an explicitly labelled feature overview with illustrations from the bundled model, not interactive app evidence. Earlier security review rejected local-browser inspection and workarounds. Browser/DPR 1/2, voice and projector acceptance remain outstanding; keep the PR draft. After provider choice and authorized live acceptance, rehearse a prepared case, braces and typed command and confirm saved AI opt-outs still win.
