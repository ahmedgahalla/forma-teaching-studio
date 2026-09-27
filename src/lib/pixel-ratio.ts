type ResolutionQuery = {
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
};
type PixelRatioSource = {
  readonly devicePixelRatio: number;
  matchMedia(query: string): ResolutionQuery;
};

/** Observe the raw display resolution while capping render-target work at DPR 2. */
export function observePixelRatio(source: PixelRatioSource, apply: (ratio: number) => void) {
  let query: ResolutionQuery | undefined,
    appliedRatio = 0,
    disposed = false;
  const update = () => {
    if (disposed) return;
    query?.removeEventListener('change', update);
    const rawRatio = source.devicePixelRatio,
      ratio = Math.min(rawRatio, 2);
    // Re-arm against the actual display, including changes between two capped values.
    query = source.matchMedia(`(resolution: ${rawRatio}dppx)`);
    query.addEventListener('change', update);
    if (ratio !== appliedRatio) {
      appliedRatio = ratio;
      apply(ratio);
    }
  };
  update();
  return () => {
    disposed = true;
    query?.removeEventListener('change', update);
  };
}
