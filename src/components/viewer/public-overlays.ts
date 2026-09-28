export type PublicToothLabel = {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  selected: boolean;
};
export type PublicSurfaceLabel = {
  text: string;
  x: number;
  y: number;
  visible: boolean;
};
export type PublicAnatomyLabel = PublicSurfaceLabel & {
  width: number;
  side: 'left' | 'right';
  color: string;
  anchorX: number;
  anchorY: number;
};
type Labels = {
  teeth: PublicToothLabel[];
  surfaces: PublicSurfaceLabel[];
  anatomy: PublicAnatomyLabel[];
};
export type PublicOverlayFrame = Labels & {
  width: number;
  height: number;
  ready: boolean;
  anatomyCaption: string | null;
  studyCaption: string | null;
  pointer: { visible: boolean; x: number; y: number };
};
type Listener = (frame: PublicOverlayFrame | null) => void;
type PointerWriter = (clientX?: number, clientY?: number) => void;
type Channel = {
  current: PublicOverlayFrame | null;
  listeners: Set<Listener>;
  pointer: PointerWriter | null;
  emit: () => void;
};
const channels = new WeakMap<HTMLCanvasElement, Channel>();

function channelFor(canvas: HTMLCanvasElement) {
  let channel = channels.get(canvas);
  if (!channel) {
    const next: Channel = {
      current: null,
      listeners: new Set(),
      pointer: null,
      emit: () => next.listeners.forEach(notify),
    };
    const notify = (listener: Listener) => listener(next.current);
    channels.set(canvas, next);
    channel = next;
  }
  return channel;
}

/** Synchronous public storage, reused on commit. Subscribers must not mutate it. */
export function subscribePublicOverlays(canvas: HTMLCanvasElement, listener: Listener) {
  const channel = channelFor(canvas);
  channel.listeners.add(listener);
  listener(channel.current);
  return () => {
    channel.listeners.delete(listener);
  };
}

function frameFor(labels: Labels): PublicOverlayFrame {
  return {
    ...labels,
    width: 0,
    height: 0,
    ready: false,
    anatomyCaption: null,
    studyCaption: null,
    pointer: { visible: false, x: 0, y: 0 },
  };
}

/** One renderer owns fixed staging slots; subscribers see a separate successful-frame copy. */
export function createPublicOverlaySource(canvas: HTMLCanvasElement, labels: Labels) {
  const channel = channelFor(canvas);
  const frame = frameFor(labels);
  const committed = frameFor({
    teeth: labels.teeth.map(() => ({ id: '', x: 0, y: 0, visible: false, selected: false })),
    surfaces: labels.surfaces.map(() => ({ text: '', x: 0, y: 0, visible: false })),
    anatomy: labels.anatomy.map(() => ({
      text: '',
      x: 0,
      y: 0,
      visible: false,
      width: 0,
      side: 'left',
      color: '',
      anchorX: 0,
      anchorY: 0,
    })),
  });
  let disposed = false;
  const ownsChannel = () => !disposed && channel.pointer === pointer;
  const pointer: PointerWriter = (clientX, clientY) => {
    if (!ownsChannel()) return;
    const spot = committed.pointer;
    spot.visible = false;
    if (committed.ready && Number.isFinite(clientX) && Number.isFinite(clientY)) {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        const x = ((clientX! - bounds.left) * committed.width) / bounds.width;
        const y = ((clientY! - bounds.top) * committed.height) / bounds.height;
        if (x >= 0 && x <= committed.width && y >= 0 && y <= committed.height) {
          spot.x = x;
          spot.y = y;
          spot.visible = true;
        }
      }
    }
    frame.pointer.x = spot.x;
    frame.pointer.y = spot.y;
    frame.pointer.visible = spot.visible;
    channel.emit();
  };
  channel.pointer = pointer;
  channel.current = committed;
  channel.emit();
  return {
    frame,
    publish() {
      if (!ownsChannel()) return;
      if (committed.width !== frame.width || committed.height !== frame.height)
        committed.pointer.visible = frame.pointer.visible = false;
      committed.width = frame.width;
      committed.height = frame.height;
      committed.ready = frame.ready && frame.width > 0 && frame.height > 0;
      committed.anatomyCaption = frame.anatomyCaption;
      committed.studyCaption = frame.studyCaption;
      for (let i = 0; i < committed.teeth.length; i++) {
        const from = frame.teeth[i],
          to = committed.teeth[i];
        to.id = from.id;
        to.x = from.x;
        to.y = from.y;
        to.visible = from.visible;
        to.selected = from.selected;
      }
      for (let i = 0; i < committed.surfaces.length; i++) {
        const from = frame.surfaces[i],
          to = committed.surfaces[i];
        to.text = from.text;
        to.x = from.x;
        to.y = from.y;
        to.visible = from.visible;
      }
      for (let i = 0; i < committed.anatomy.length; i++) {
        const from = frame.anatomy[i],
          to = committed.anatomy[i];
        to.text = from.text;
        to.x = from.x;
        to.y = from.y;
        to.visible = from.visible;
        to.width = from.width;
        to.side = from.side;
        to.color = from.color;
        to.anchorX = from.anchorX;
        to.anchorY = from.anchorY;
      }
      if (!committed.ready) committed.pointer.visible = frame.pointer.visible = false;
      channel.emit();
    },
    clear() {
      if (!ownsChannel()) return;
      committed.ready = frame.ready = false;
      committed.pointer.visible = frame.pointer.visible = false;
      channel.emit();
    },
    dispose() {
      if (!ownsChannel()) return;
      disposed = true;
      channel.pointer = null;
      channel.current = null;
      channel.emit();
    },
  };
}

/** Coordinates belong to the actual canvas, independent of surrounding viewport controls. */
export function setPublicLecturePointer(
  canvas: HTMLCanvasElement | null,
  clientX?: number,
  clientY?: number,
) {
  if (canvas) channels.get(canvas)?.pointer?.(clientX, clientY);
}
