# Test Forma on your phone

Open https://forma-teaching-mobile.ahmedgah123.chatgpt.site in your phone browser and sign in with the same ChatGPT account used to publish the private site. It works across mobile data and different Wi-Fi networks. The 24 September 2026 update adds explicit Ask AI command routing and a more visible replay of calculated wire responses to version 0.12.

## Quick test

1. Wait for the synthetic 28-tooth model to load; landscape gives more space.
2. Turn **Ask AI** on in the command bar. Try `Can you show the roots and remove the gums so the students can see more clearly?` The command status identifies AI interpretation; ordinary automatic mode still handles recognized commands locally first.
3. Try `Please select the upper anterior teeth.`, then `Could you attach the brackets to these teeth?` and `Please thread a wire through these brackets.` The wire uses the displayed preset.
4. Try `Could you activate that wire by half a millimeter, then show me what happens?` Look for the unloaded ghost, displacement traces, actual displacement values and a clearly labelled display scale. The eight-second replay magnifies the initial response by at most 50×; it does not change the calculated values or represent elapsed treatment time.
5. Use **Stop** and **Undo** to pause or restore the request. These controls remain local even when Ask AI is on. Missing or ambiguous parameters require clarification.
6. Try the on-screen Hold to talk button if your phone browser supports speech recognition. Actual mobile microphone behavior still needs testing.

The phone discovers the authenticated same-origin AI service automatically. If you previously disabled AI in this phone browser, enable it in Settings. The service URL is the same URL as the app. Never enter an API key on the phone.

## Temporary AI connection

The 24 September hosted connection repair fixes an incompatible redirect option that caused immediate AI errors. Verified on the actual private website with a natural-language scene change and a prerequisite clarification. Refresh the page if it still shows the earlier error. The API key and model configuration are unchanged.

The host computer, local backend, phone bridge and tunnel must remain on. The OpenRouter key remains on that computer. The private Site stores a separate bridge credential as a server secret; it is never sent to the browser. Only command text and minimal scene context go through this connection. No file, mesh-upload or arbitrary proxy route is exposed.

Stopping the computer or tunnel disconnects online AI; built-in commands and loaded models continue working. Restarting the temporary tunnel requires updating the bridge URL in Sites and redeploying its environment revision. This is a test connection, not a permanent independent backend.

## Current verification · 24 September 2026

- Frontend: **1,493 tests / 47 files passed**. Production build passed.
- Python backend: **389 tests passed**, including phone-bridge coverage; one existing Starlette/AnyIO deprecation warning.
- Ask AI explicitly invokes the configured interpreter, while status distinguishes AI from local commands. Stop and manual controls retain local execution.
- Backend speech-unit normalization now accepts written millimeter/millimetre variants and singular/plural degrees. Strict output schemas put action discriminators before inherited payload fields. Exact target, amount and unsupported-field audits remain enforced.
- Wire response presentation uses a bounded scale up to 50×, an unloaded-reference ghost, displacement traces and an eight-second replay. Saved geometry and actual result values remain unchanged.
- Sites confirmed publication succeeded with environment revision 1 and the existing owner-private audience. Natural-language anatomy, selection, brackets, wire installation and activation were exercised with real AI in the connected desktop browser; see VERIFICATION.md and the full-screen demo. Physical phone, touch and microphone testing remain unverified; publication success is not an end-to-end phone test.

### Historical connection verification

The earlier phone publication passed six private-gateway tests for identity, origin, routing, body bounds, credential isolation and offline responses. Its live gateway code → HTTPS tunnel → authenticated bridge → Python validation → OpenRouter request, `Show roots and hide gums`, returned the two expected actions; unauthenticated tunnel access returned 401. These are earlier connection checks, not a new device test of this update.

## Published identity

- Site: `appgprj_6ab39ed0b82881919f49cba3045245ce`
- Version: `appgprj_6ab39ed0b82881919f49cba3045245ce~appgver_137307362fc481918897e0347be4c326`
- Deployment: `appgdep_6ab4f77c8cd08191b589f69d200cd71b`
- Site source commit: `24d2be74b690335c86fda71ea0c478f9c8caaa1c`
- Environment revision: `1`

Keep this Site identity and owner-only access. The hosted Worker source is maintained in the separate `../forma-mobile` Site checkout. See [backend setup](../backend/README.md) and [conversational commands](CONVERSATIONAL_COMMANDS.md).
