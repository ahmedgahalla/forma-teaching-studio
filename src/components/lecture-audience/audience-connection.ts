type Callbacks = {
  onStream: (stream: MediaStream | null) => void;
  onError: (message: string) => void;
  onClosed: () => void;
};

function prepareDocument(popup: Window) {
  const target = popup.document.createElement('div');
  popup.document.title = 'Forma · Audience';
  popup.document.documentElement.lang = 'en';
  popup.document.body.className = 'audience-body';
  for (const sheet of document.head.querySelectorAll('link[rel="stylesheet"], style')) {
    if (sheet instanceof HTMLLinkElement && new URL(sheet.href).origin !== location.origin)
      continue;
    const copy = sheet.cloneNode(true) as HTMLElement;
    if (sheet instanceof HTMLLinkElement) (copy as HTMLLinkElement).href = sheet.href;
    popup.document.head.appendChild(copy);
  }
  const style = popup.document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('/audience.css', location.href).href;
  popup.document.head.appendChild(style);
  popup.document.body.appendChild(target);
  return target;
}

/** Owns one canvas stream; no second renderer or per-frame message allocation. */
export function createAudienceConnection(source: HTMLElement, callbacks: Callbacks) {
  let canvas = source.querySelector('canvas');
  if (!canvas) throw new Error('Wait for the 3D model to load, then open the audience window.');
  let canvasHost = canvas.parentElement;
  if (typeof canvas.captureStream !== 'function')
    throw new Error('This browser cannot share the 3D model. Keep presenting in the main window.');
  const popup = window.open('about:blank', '_blank', 'popup,width=1280,height=800');
  if (!popup)
    throw new Error('The audience window was blocked. Allow popups for Forma, then try again.');

  let stream: MediaStream | null = null;
  let disposed = false;
  let observer: MutationObserver | undefined;
  let themeObserver: MutationObserver | undefined;
  let closedTimer: ReturnType<typeof setInterval> | undefined;
  const fail = (message: string) => {
    if (!disposed) callbacks.onError(message);
  };
  const trackEnded = () => fail('Audience video stopped. Reopen the audience window to reconnect.');
  const contextLost = () =>
    fail('The 3D graphics were interrupted. Restore the model, then reopen the audience window.');
  const stopStream = () => {
    canvas?.removeEventListener('webglcontextlost', contextLost);
    stream?.getTracks().forEach(track => {
      track.removeEventListener('ended', trackEnded);
      track.stop();
    });
    stream = null;
  };
  const capture = () => {
    if (!canvas) return;
    stream = canvas.captureStream(24);
    canvas.addEventListener('webglcontextlost', contextLost);
    stream.getTracks().forEach(track => track.addEventListener('ended', trackEnded));
  };
  const dispose = (closeWindow = true) => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    themeObserver?.disconnect();
    clearInterval(closedTimer);
    stopStream();
    popup.removeEventListener('pagehide', closed);
    window.removeEventListener('pagehide', closed);
    if (closeWindow && !popup.closed) popup.close();
  };
  const closed = () => {
    if (disposed) return;
    dispose();
    callbacks.onClosed();
  };
  try {
    const target = prepareDocument(popup);
    const syncTheme = () => {
      popup.document.documentElement.dataset.formaTheme =
        document.documentElement.dataset.formaTheme || 'midnight';
    };
    syncTheme();
    themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-forma-theme'],
    });
    capture();
    const observeHosts = () => {
      observer!.observe(source, { childList: true });
      if (canvasHost && canvasHost !== source) observer!.observe(canvasHost, { childList: true });
    };
    observer = new MutationObserver(() => {
      const next = source.querySelector('canvas');
      if (next === canvas || disposed) return;
      stopStream();
      canvas = next;
      if (next && next.parentElement !== canvasHost) {
        canvasHost = next.parentElement;
        observer!.disconnect();
        observeHosts();
      }
      try {
        capture();
        callbacks.onStream(stream);
      } catch {
        fail('The model could not be shared. Reopen the audience window after the model loads.');
      }
    });
    // Viewer rewrites label text every frame. Observe host children, never those descendants.
    observeHosts();
    popup.addEventListener('pagehide', closed);
    window.addEventListener('pagehide', closed);
    closedTimer = setInterval(() => {
      if (popup.closed) closed();
    }, 1000);
    return { target, stream, dispose, focus: () => popup.focus() };
  } catch {
    dispose();
    throw new Error('The model could not be shared. Keep presenting in the main window.');
  }
}
