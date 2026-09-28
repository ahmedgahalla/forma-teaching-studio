# Professor Nael pitch

The delivered **3:45 English narrated overview** covers the central anatomy workspace, predict/reveal/replay, mechanics and bracket placement, biology diagrams, click/type/voice control, the three sample lectures and the invitation to shape future content with Professor Nael's approved material.

The film is a feature overview with standalone model illustrations, **not an app screen recording or proof of interactive acceptance**. Each model panel is labelled. The opening identifies the format and AI narration, and the closing identifies the educational prototype and synthetic anatomy. No clinical validation, provider-account verification or educator approval is claimed.

## Delivery

Local artifact folder: `C:/Users/ahmed/Documents/Codex/Nael-Pitch-2026-09-28/`.

- `Nael-Teaching-Studio-Pitch.mp4`: 1920×1080, 24 fps, H.264/AAC, approximately 224.83 seconds.
- `Pitch-script.md`: complete chapter narration.
- `timeline.json`: machine-readable chapter start times and durations.
- `renders/manifest.json`: exact model and illustration hashes.
- `audio/sources.json`: generated narration provenance, duration, speed and cost estimate.

The MP4 and intermediate media remain outside the repository. Source script/content and production tools are versioned here. No upload to a public service or message to the professor was performed.

## Production and reproduction

The six illustrations use the current bundled `public/models/forma-atlas-v1.glb` asset (SHA256 `6ef4321a6a642404fabdb1660e770d4fbc225c84296c73d22a8fcd9c4c182c86`). Blender imports its geometry and vertex colors, hides wisdom teeth to match the 28-tooth teaching set, and creates standalone lighting/material presentation. It does not imitate app shaders, gum deformation, mechanics results or app UI. The roots shot hides gingiva. The original gingiva geometry is retained, including unfilled wisdom-tooth positions.

Narration was generated through fal.ai's MiniMax Speech-02-HD endpoint with stock voice `Patient_Man`, English, no voice cloning, and `store_payload: false`. The eight chapters total 3,020 input characters; the quoted rate was $0.10 per 1,000 characters, approximately $0.302 before any account-specific adjustments. Audio is generated media, not a recording of Professor Nael. Existing audio is reused during composition; rebuilding does not call a paid service.

Prerequisites: Blender 5.1, Python with Pillow, FFmpeg, the repository's local fonts, and the delivered narration MP3s/manifest. Run from the repository root, substituting installed executable paths:

```powershell
blender --background --python scripts/pitch-render.py -- --source public/models/forma-atlas-v1.glb --output C:/Users/ahmed/Documents/Codex/Nael-Pitch-2026-09-28/renders
python scripts/pitch-compose.py --output C:/Users/ahmed/Documents/Codex/Nael-Pitch-2026-09-28 --ffmpeg ffmpeg
```

The first chapter was recorded at 0.96 speed and adjusted to match the other chapters' 1.3 setting. Composition applies restrained movement only to illustrations; typography stays still. Chapters include fades and small pauses, with normalized narration. Changing the script requires regenerating the affected narration before recomposition.

## Remaining acceptance

Offline review passed a full audio/video decode and inspected frames from all eight chapters plus the closing frame. The file is 224.855 seconds and 8,143,462 bytes, SHA256 `65d6eb0e039cf8045d600a4c2b7405dfe655cd56ac81e5a7cbd4f1030e2b920b`. Narration has a measured maximum of −0.9 dB with no digital clipping. This signal check does not replace listening review. There is no subtitle track; the included transcript supplies the full text.

Earlier automatic security review rejected local-browser inspection and workarounds. The restriction prevents fresh app footage, microphone/projector checks and DPR 1/2 acceptance. The pitch therefore explains features implemented in the source; it does not certify the live app, voice recognition, AI credentials, account credit or model access. A future live walkthrough should use the actual app after authorized visual acceptance and the provider connection is verified.
