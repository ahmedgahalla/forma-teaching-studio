# Visual baselines

Reference screenshots for the verification gate's browser check (AGENTS.md § verification gate, step 8). One folder per capture, named `YYYY-MM-DD-<branch>-<commit>`, taken headless at 1600×900, DPR 1, on the six key screens:

1. first screen · 2. lecture mode · 3. teaching library · 4. a prepared case mid-playback · 5. the braces workflow · 6. the mechanics panel

Compare against the newest folder; expected differences are only inherent timing (playback progress). Recapture (and add a new folder, keeping the old) when a PR intentionally changes visuals — note the change in that PR's phase doc. Checks also run at DPR 2 for canvas sizing (lessons-learned #4); DPR-2 shots aren't stored, they're compared live.
