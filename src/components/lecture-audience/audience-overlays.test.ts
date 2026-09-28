// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPublicOverlaySource, setPublicLecturePointer } from '../viewer/public-overlays';
import { createAudienceOverlays } from './audience-overlays';

let host: HTMLDivElement, video: HTMLVideoElement, canvas: HTMLCanvasElement;
let source: ReturnType<typeof createPublicOverlaySource>;
let sink: ReturnType<typeof createAudienceOverlays>;
let boxWidth: number, boxHeight: number, videoWidth: number, videoHeight: number;
let resize: () => void;
const disconnect = vi.fn();
const stream = {} as MediaStream;
function publishSource() {
  source = createPublicOverlaySource(canvas, {
    teeth: [{ id: '11', x: 500, y: 350, visible: true, selected: true }],
    surfaces: [{ text: 'Apex', x: 300, y: 200, visible: true }],
    anatomy: [
      {
        text: 'PDL',
        x: 50,
        y: 100,
        width: 130,
        side: 'left',
        color: '#bada55',
        anchorX: 300,
        anchorY: 200,
        visible: true,
      },
    ],
  });
  Object.assign(source.frame, {
    width: 1000,
    height: 700,
    ready: true,
    anatomyCaption: 'PDL enlarged for visibility · support tissues stay fixed',
    studyCaption: 'Schematic teaching anatomy',
    privateNotes: 'PRIVATE PRESENTER NOTES',
    hiddenAnswer: 'HIDDEN ANSWER',
  });
  source.publish();
}
function ready() {
  video.dispatchEvent(new Event('loadedmetadata'));
  video.dispatchEvent(new Event('playing'));
}
function annotation(kind: string) {
  return host.querySelector<HTMLElement>(`.audience-overlay-${kind}`)!;
}
beforeEach(() => {
  disconnect.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  host = document.createElement('div');
  video = document.createElement('video');
  canvas = document.createElement('canvas');
  document.body.append(host, video, canvas);
  boxWidth = boxHeight = 600;
  videoWidth = 2000;
  videoHeight = 1400;
  Object.defineProperties(video, {
    clientWidth: { get: () => boxWidth },
    clientHeight: { get: () => boxHeight },
    videoWidth: { get: () => videoWidth },
    videoHeight: { get: () => videoHeight },
    readyState: { get: () => 4 },
  });
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 20,
    top: 30,
    width: 500,
    height: 350,
  } as DOMRect);
  sink = createAudienceOverlays(host, video, canvas, stream);
  video.srcObject = stream;
});
afterEach(() => {
  sink.dispose();
  source?.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('waits for a publisher, current metadata and playing before showing only public labels', () => {
  expect(host.hidden).toBe(true);
  publishSource();
  expect(host.hidden).toBe(true);
  video.dispatchEvent(new Event('loadedmetadata'));
  expect(host.hidden).toBe(true);
  video.dispatchEvent(new Event('playing'));
  expect(host.hidden).toBe(false);
  expect(annotation('plane').style.transform).toBe('translate(0px, 90px) scale(0.6, 0.6)');
  expect(annotation('tooth').textContent).toBe('11');
  expect(annotation('tooth').classList.contains('selected')).toBe(true);
  expect(annotation('surface').textContent).toBe('Apex');
  expect(annotation('anatomy').textContent).toBe('PDL');
  expect(host.textContent).toContain('PDL enlarged for visibility');
  expect(host.textContent).toContain('Schematic teaching anatomy');
  expect(host.textContent).not.toMatch(/PRIVATE|HIDDEN|locked/);
  expect(host.querySelector('button,input,textarea,[contenteditable]')).toBeNull();
});

it('reuses all slots, renders text literally and keeps leader lines and pointer in source pixels', () => {
  publishSource();
  ready();
  const tooth = annotation('tooth');
  const created = vi.spyOn(document, 'createElement');
  const createdSvg = vi.spyOn(document, 'createElementNS');
  source.frame.teeth[0].x = 450;
  source.frame.teeth[0].selected = false;
  source.frame.surfaces[0].text = '<img src=x onerror=alert(1)>';
  source.frame.anatomy[0].side = 'right';
  source.publish();
  setPublicLecturePointer(canvas, 270, 205);
  expect(annotation('tooth')).toBe(tooth);
  expect(tooth.style.left).toBe('450px');
  expect(tooth.classList.contains('selected')).toBe(false);
  expect(annotation('surface').textContent).toBe('<img src=x onerror=alert(1)>');
  expect(host.querySelector('img')).toBeNull();
  expect(host.querySelector('line')?.getAttribute('x1')).toBe('50');
  expect(host.querySelector('line')?.getAttribute('x2')).toBe('300');
  expect(annotation('pointer').hidden).toBe(false);
  expect(annotation('pointer').style.left).toBe('500px');
  expect(annotation('pointer').style.top).toBe('350px');
  expect(created).not.toHaveBeenCalled();
  expect(createdSvg).not.toHaveBeenCalled();
  source.frame.teeth[0].visible = false;
  source.frame.anatomyCaption = source.frame.studyCaption = null;
  source.publish();
  expect(tooth.hidden).toBe(true);
  expect(annotation('anatomy-caption').hidden).toBe(true);
  expect(annotation('study-caption').hidden).toBe(true);
});

it('remaps popup resizes and hides changed source aspect until video metadata catches up', () => {
  publishSource();
  ready();
  boxWidth = 900;
  boxHeight = 700;
  resize();
  expect(annotation('plane').style.transform).toBe('translate(0px, 35px) scale(0.9, 0.9)');
  source.frame.width = 700;
  source.frame.height = 1000;
  source.publish();
  expect(host.hidden).toBe(true);
  videoWidth = 1400;
  videoHeight = 2000;
  video.dispatchEvent(new Event('resize'));
  expect(host.hidden).toBe(false);
  const transform = annotation('plane').style.transform;
  expect(parseFloat(transform.slice('translate('.length))).toBeCloseTo(205);
  expect(transform).toContain(', 0px) scale(0.7, 0.7)');
});

it.each(['waiting', 'stalled', 'pause', 'emptied'])(
  'hides annotations while video is %s',
  event => {
    publishSource();
    ready();
    video.dispatchEvent(new Event(event));
    source.publish();
    expect(host.hidden).toBe(true);
    video.dispatchEvent(new Event('playing'));
    expect(host.hidden).toBe(event === 'emptied');
    if (event === 'emptied') {
      video.dispatchEvent(new Event('loadedmetadata'));
      expect(host.hidden).toBe(false);
    }
  },
);

it('ignores old streams, clears disposed publishers and releases all observers and listeners', () => {
  publishSource();
  ready();
  video.srcObject = {} as MediaStream;
  source.publish();
  expect(host.hidden).toBe(true);
  video.srcObject = stream;
  ready();
  source.dispose();
  expect(host.hidden).toBe(true);
  publishSource();
  expect(host.hidden).toBe(false);
  const tooth = annotation('tooth');
  const remove = vi.spyOn(video, 'removeEventListener');
  sink.dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledTimes(7);
  expect(host.childElementCount).toBe(0);
  source.frame.teeth[0].x = 10;
  source.publish();
  expect(tooth.style.left).toBe('500px');
  expect(host.hidden).toBe(true);
});
