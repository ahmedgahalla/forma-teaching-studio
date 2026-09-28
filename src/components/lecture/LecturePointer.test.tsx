// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LecturePointer } from './LectureViewTools';
import {
  createPublicOverlaySource,
  subscribePublicOverlays,
  type PublicOverlayFrame,
} from '../viewer/public-overlays';

let root: Root, host: HTMLDivElement, canvas: HTMLCanvasElement;
let source: ReturnType<typeof createPublicOverlaySource>, latest: PublicOverlayFrame | null;
let unsubscribe: () => void;
const exit = vi.fn(),
  select = vi.fn();
async function render(enabled = true) {
  await act(async () =>
    root.render(
      <section onPointerDown={select}>
        <div className="three-canvas">
          <canvas />
        </div>
        <LecturePointer enabled={enabled} onExit={exit} />
      </section>,
    ),
  );
}
const pointer = () => host.querySelector<HTMLDivElement>('.lecture-pointer')!;
async function move(type = 'pointermove', x = 220, y = 140) {
  await act(async () =>
    pointer().dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        relatedTarget: type === 'pointerout' ? document.body : null,
      }),
    ),
  );
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await render();
  canvas = host.querySelector('canvas')!;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 20,
    top: 40,
    width: 800,
    height: 400,
  } as DOMRect);
  vi.spyOn(pointer(), 'getBoundingClientRect').mockReturnValue({ left: 10, top: 30 } as DOMRect);
  pointer().setPointerCapture = vi.fn();
  source = createPublicOverlaySource(canvas, { teeth: [], surfaces: [], anatomy: [] });
  Object.assign(source.frame, { width: 400, height: 200, ready: true });
  source.publish();
  unsubscribe = subscribePublicOverlays(canvas, frame => {
    latest = frame;
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  unsubscribe();
  source.dispose();
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('projects pointer moves and touch-downs against the canvas while retaining presenter coordinates', async () => {
  await move();
  expect(latest!.pointer).toEqual({ visible: true, x: 100, y: 50 });
  const spot = host.querySelector<HTMLElement>('.lecture-pointer-spot')!;
  expect(spot.hidden).toBe(false);
  expect(spot.style.transform).toBe('translate(210px, 110px)');
  await move('pointerdown', 420, 240);
  expect(latest!.pointer).toEqual({ visible: true, x: 200, y: 100 });
  expect(select).not.toHaveBeenCalled();
  expect(pointer().setPointerCapture).toHaveBeenCalledOnce();
});

it.each(['pointerout', 'pointercancel', 'blur', 'escape', 'disable', 'unmount'])(
  'clears the public pointer on %s',
  async reason => {
    await move();
    expect(latest!.pointer.visible).toBe(true);
    if (reason === 'disable') await render(false);
    else if (reason === 'unmount') await act(async () => root.render(null));
    else if (reason === 'blur') await act(async () => window.dispatchEvent(new Event('blur')));
    else if (reason === 'escape')
      await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    else await move(reason);
    expect(latest!.pointer.visible).toBe(false);
    expect(exit).toHaveBeenCalledTimes(reason === 'escape' ? 1 : 0);
  },
);

it('drops the old canvas pointer and follows a replacement only after a new pointer event', async () => {
  await move();
  const old = latest!,
    replacement = document.createElement('canvas');
  replacement.getBoundingClientRect = canvas.getBoundingClientRect;
  const next = createPublicOverlaySource(replacement, { teeth: [], surfaces: [], anatomy: [] });
  Object.assign(next.frame, { width: 800, height: 400, ready: true });
  next.publish();
  let current: PublicOverlayFrame | null = null;
  const off = subscribePublicOverlays(replacement, frame => {
    current = frame;
  });
  canvas.replaceWith(replacement);
  expect(current!.pointer.visible).toBe(false);
  await move();
  expect(old.pointer.visible).toBe(false);
  expect(current!.pointer).toEqual({ visible: true, x: 200, y: 100 });
  off();
  next.dispose();
});
