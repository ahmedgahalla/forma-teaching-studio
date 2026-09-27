import type { CSSProperties } from 'react';

/** Shared by the fitted camera region and the overlaid voice HUD. */
export const VOICE_HUD_SAFE_AREA = 0.2;
export const VOICE_VIEWPORT_STYLE = {
  '--voice-hud-safe-area': VOICE_HUD_SAFE_AREA,
} as CSSProperties;
export const VOICE_VIEWPORT_PROPS = {
  case: { className: 'viewport voice-viewport', style: VOICE_VIEWPORT_STYLE },
  workflow: { className: 'viewport workflow-viewport voice-viewport', style: VOICE_VIEWPORT_STYLE },
};
