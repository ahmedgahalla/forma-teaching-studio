export type AudienceOverlayLayout = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};

/** Source CSS coordinates mapped into the video element's object-fit: contain rectangle. */
export function fitAudienceOverlay(
  target: AudienceOverlayLayout,
  sourceWidth: number,
  sourceHeight: number,
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
): boolean {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    videoWidth <= 0 ||
    videoHeight <= 0 ||
    boxWidth <= 0 ||
    boxHeight <= 0 ||
    // Capture dimensions can differ by one rounded buffer pixel on either axis.
    Math.abs(videoWidth * sourceHeight - videoHeight * sourceWidth) > sourceWidth + sourceHeight
  )
    return false;
  const scale = Math.min(boxWidth / videoWidth, boxHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  target.x = (boxWidth - width) / 2;
  target.y = (boxHeight - height) / 2;
  target.scaleX = width / sourceWidth;
  target.scaleY = height / sourceHeight;
  return true;
}
