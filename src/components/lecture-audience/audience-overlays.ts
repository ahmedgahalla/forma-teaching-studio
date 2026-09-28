import { subscribePublicOverlays, type PublicOverlayFrame } from '../viewer/public-overlays';
import { fitAudienceOverlay } from './overlay-layout';

/** One reusable public overlay surface. The presenter DOM is never read or copied. */
export function createAudienceOverlays(
  host: HTMLElement,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  stream: MediaStream,
) {
  const document = host.ownerDocument;
  const popup = document.defaultView;
  const surface = document.createElement('div');
  surface.className = 'audience-overlay-plane';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  surface.append(svg);
  const label = (kind: string) => {
    const node = document.createElement('span');
    node.className = `audience-overlay-label audience-overlay-${kind}`;
    node.hidden = true;
    surface.append(node);
    return node;
  };
  const anatomyCaption = label('anatomy-caption');
  const studyCaption = label('study-caption');
  const pointer = document.createElement('span');
  pointer.className = 'audience-overlay-pointer';
  pointer.setAttribute('aria-hidden', 'true');
  pointer.hidden = true;
  surface.append(pointer);
  host.hidden = true;
  host.append(surface);
  const layout = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  let frame: PublicOverlayFrame | null = null;
  let teeth: HTMLSpanElement[] = [];
  let surfaces: HTMLSpanElement[] = [];
  let anatomy: { node: HTMLSpanElement; line: SVGLineElement; dot: SVGCircleElement }[] = [];
  let width = 0,
    height = 0,
    metadata = false,
    playing = false,
    disposed = false;
  const text = (node: HTMLElement, value: string | null) => {
    node.hidden = value === null;
    if (node.textContent !== (value ?? '')) node.textContent = value ?? '';
  };
  const position = (node: HTMLElement, x: number, y: number) => {
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  };
  const render = () => {
    host.hidden = true;
    if (
      disposed ||
      !frame?.ready ||
      !metadata ||
      !playing ||
      video.srcObject !== stream ||
      !fitAudienceOverlay(
        layout,
        frame.width,
        frame.height,
        video.videoWidth,
        video.videoHeight,
        width,
        height,
      )
    )
      return;
    surface.style.width = `${frame.width}px`;
    surface.style.height = `${frame.height}px`;
    surface.style.transform = `translate(${layout.x}px, ${layout.y}px) scale(${layout.scaleX}, ${layout.scaleY})`;
    svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
    for (let i = 0; i < teeth.length; i++) {
      const item = frame.teeth[i],
        node = teeth[i];
      text(node, item.visible ? item.id : null);
      node.classList.toggle('selected', item.selected);
      position(node, item.x, item.y);
    }
    for (let i = 0; i < surfaces.length; i++) {
      const item = frame.surfaces[i],
        node = surfaces[i];
      text(node, item.visible ? item.text : null);
      position(node, item.x, item.y);
    }
    for (let i = 0; i < anatomy.length; i++) {
      const item = frame.anatomy[i],
        { node, line, dot } = anatomy[i];
      text(node, item.visible ? item.text : null);
      position(node, item.x, item.y);
      node.style.width = `${item.width}px`;
      node.style.setProperty('--tissue', item.color);
      line.style.display = dot.style.display = item.visible ? '' : 'none';
      line.setAttribute('x1', String(item.side === 'left' ? item.x + item.width : item.x));
      line.setAttribute('y1', String(item.y + 14));
      line.setAttribute('x2', String(item.anchorX));
      line.setAttribute('y2', String(item.anchorY));
      line.setAttribute('stroke', item.color);
      dot.setAttribute('cx', String(item.anchorX));
      dot.setAttribute('cy', String(item.anchorY));
      dot.setAttribute('fill', item.color);
    }
    text(anatomyCaption, frame.anatomyCaption);
    text(studyCaption, frame.studyCaption);
    pointer.hidden = !frame.pointer.visible;
    position(pointer, frame.pointer.x, frame.pointer.y);
    host.hidden = false;
  };
  const allocate = (next: PublicOverlayFrame) => {
    // Slot counts change only when a source is registered/replaced, never in its render loop.
    if (teeth.length !== next.teeth.length) {
      teeth.forEach(node => node.remove());
      teeth = next.teeth.map(() => label('tooth'));
    }
    if (surfaces.length !== next.surfaces.length) {
      surfaces.forEach(node => node.remove());
      surfaces = next.surfaces.map(() => label('surface'));
    }
    if (anatomy.length !== next.anatomy.length) {
      anatomy.forEach(({ node, line, dot }) => {
        node.remove();
        line.remove();
        dot.remove();
      });
      anatomy = next.anatomy.map(() => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('r', '2.5');
        svg.append(line, dot);
        return { node: label('anatomy'), line, dot };
      });
    }
  };
  const unsubscribe = subscribePublicOverlays(canvas, next => {
    frame = next;
    if (next) allocate(next);
    render();
  });
  const measure = () => {
    width = video.clientWidth;
    height = video.clientHeight;
    render();
  };
  const loaded = () => {
    metadata = video.readyState >= 1 && video.srcObject === stream;
    measure();
  };
  const ready = () => {
    playing = true;
    measure();
  };
  const suspended = (event: Event) => {
    playing = false;
    if (event.type === 'emptied') metadata = false;
    host.hidden = true;
  };
  const observer = popup?.ResizeObserver ? new popup.ResizeObserver(measure) : null;
  observer?.observe(video);
  popup?.addEventListener('resize', measure);
  video.addEventListener('loadedmetadata', loaded);
  video.addEventListener('resize', measure);
  video.addEventListener('playing', ready);
  for (const name of ['waiting', 'stalled', 'pause', 'emptied'])
    video.addEventListener(name, suspended);
  measure();
  return {
    ready,
    dispose() {
      disposed = true;
      unsubscribe();
      observer?.disconnect();
      popup?.removeEventListener('resize', measure);
      video.removeEventListener('loadedmetadata', loaded);
      video.removeEventListener('resize', measure);
      video.removeEventListener('playing', ready);
      for (const name of ['waiting', 'stalled', 'pause', 'emptied'])
        video.removeEventListener(name, suspended);
      host.hidden = true;
      surface.remove();
    },
  };
}
