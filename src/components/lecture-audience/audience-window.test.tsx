// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AudienceLauncher } from './AudienceLauncher';
import { useAudienceWindow } from './useAudienceWindow';
import type { AudienceContent } from './types';
import { createPublicOverlaySource } from '../viewer/public-overlays';

class Popup extends EventTarget {
  document = document.implementation.createHTMLDocument();
  closed = false;
  focus = vi.fn();
  close = vi.fn(() => {
    this.closed = true;
    this.dispatchEvent(new Event('pagehide'));
  });
}
class Track extends EventTarget {
  stop = vi.fn();
}
const publicContent: AudienceContent = {
  lectureTitle: 'Tooth movement',
  stepTitle: 'Predict before moving',
  question: 'Which tooth will move?',
  answer: null,
};
let root: Root, container: HTMLDivElement, popup: Popup;
let tracks: Track[], streams: MediaStream[];
let capture: ReturnType<typeof vi.fn>;
function Harness({
  active = true,
  content = publicContent,
}: {
  active?: boolean;
  content?: AudienceContent;
}) {
  const source = useRef<HTMLElement>(null);
  const audience = useAudienceWindow({ active, content, source });
  return (
    <>
      <div data-status={audience.status} data-open={audience.isOpen}>
        <section ref={source} aria-label="Model source">
          <div>
            <canvas />
          </div>
        </section>
        <p>PRIVATE PRESENTER NOTES: ask Miriam first.</p>
        <AudienceLauncher
          status={audience.status}
          error={audience.error}
          onOpen={audience.open}
          onClose={audience.close}
        />
      </div>
      {audience.portal}
    </>
  );
}
async function render(props: Parameters<typeof Harness>[0] = {}) {
  await act(async () => root.render(<Harness {...props} />));
}
async function click(label = 'Open audience window') {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
function expectClosed(status = 'closed') {
  expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe(status);
  expect(container.querySelector('[data-open]')?.getAttribute('data-open')).toBe('false');
  expect(popup.document.querySelector('video')).toBeNull();
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  popup = new Popup();
  tracks = [];
  streams = [];
  capture = vi.fn(() => {
    const track = new Track();
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    tracks.push(track);
    streams.push(stream);
    return stream;
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
    configurable: true,
    value: capture,
  });
  vi.spyOn(window, 'open').mockImplementation(() => popup as unknown as Window);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream');
  delete document.documentElement.dataset.formaTheme;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('projects only public content and the live canvas, never notes or editing controls', async () => {
  const content = { ...publicContent, notes: 'SECRET NOTES' };
  await render({ content });
  expect(window.open).not.toHaveBeenCalled();
  await click();
  expect(capture).toHaveBeenCalledExactlyOnceWith(24);
  const video = popup.document.querySelector('video')!;
  expect(video.srcObject).toBe(streams[0]);
  expect(video.muted).toBe(true);
  expect(video.controls).toBe(false);
  expect(popup.document.body.textContent).toContain(publicContent.question);
  expect(popup.document.body.textContent).not.toMatch(/PRIVATE|SECRET|ask Miriam|Connecting/);
  expect(popup.document.querySelector('button,input,textarea,select,[contenteditable]')).toBeNull();
  expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('live');
  await render({ content: { ...content, answer: 'The canine.', stepTitle: 'Reveal' } });
  expect(popup.document.body.textContent).toContain('The canine.');
  expect(popup.document.querySelector('h1')?.textContent).toBe('Reveal');
  expect(window.open).toHaveBeenCalledOnce();
  expect(capture).toHaveBeenCalledOnce();
  await render({ content });
  expect(popup.document.body.textContent).not.toContain('The canine.');
});

it('reuses the open window and releases its stream on close', async () => {
  await render();
  await click();
  const video = popup.document.querySelector('video')!;
  await click('Show audience window');
  expect(popup.focus).toHaveBeenCalledOnce();
  expect(window.open).toHaveBeenCalledOnce();
  await click('Close audience window');
  expectClosed();
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  expect(video.srcObject).toBeNull();
  expect(popup.close).toHaveBeenCalledOnce();
});

it('reconnects when the viewer replaces its canvas and ignores the old stream', async () => {
  await render();
  await click();
  await act(async () =>
    container.querySelector('canvas')!.replaceWith(document.createElement('canvas')),
  );
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  expect(capture).toHaveBeenCalledTimes(2);
  expect(popup.document.querySelector('video')?.srcObject).toBe(streams[1]);
  await act(async () => tracks[0].dispatchEvent(new Event('ended')));
  expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('live');
  await act(async () => container.querySelector('canvas')!.remove());
  expect(tracks[1].stop).toHaveBeenCalledOnce();
  expect(popup.document.querySelector('video')?.srcObject).toBeNull();
  expect(popup.document.body.textContent).toContain('The 3D model is loading');
  await act(async () =>
    container.querySelector('section')!.appendChild(document.createElement('canvas')),
  );
  expect(popup.document.querySelector('video')?.srcObject).toBe(streams[2]);
});

it('does not scan the model when render-loop labels update', async () => {
  await render();
  await click();
  const source = container.querySelector('section')!;
  const label = document.createElement('span');
  await act(async () => {
    source.querySelector('div')!.appendChild(label);
  });
  const scan = vi.spyOn(source, 'querySelector');
  await act(async () => {
    label.textContent = 'Frame 2';
  });
  expect(scan).not.toHaveBeenCalled();
  expect(capture).toHaveBeenCalledOnce();
});

it('explains blocked popups and unsupported capture without disturbing the model', async () => {
  vi.mocked(window.open).mockReturnValueOnce(null);
  await render();
  const model = container.querySelector('canvas');
  await click();
  expectClosed('error');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Allow popups');
  expect(capture).not.toHaveBeenCalled();
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream');
  await click();
  expectClosed('error');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    'cannot share the 3D model',
  );
  expect(container.querySelector('canvas')).toBe(model);
  expect(window.open).toHaveBeenCalledOnce();
});

it('handles tainted canvases and rejected playback without leaking a stream or popup', async () => {
  capture.mockImplementationOnce(() => {
    throw new DOMException('tainted', 'SecurityError');
  });
  await render();
  await click();
  expectClosed('error');
  expect(popup.close).toHaveBeenCalledOnce();
  popup = new Popup();
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('autoplay denied'));
  await click();
  expectClosed('error');
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  expect(popup.close).toHaveBeenCalledOnce();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not start');
});

it.each(['context', 'track'] as const)(
  'cleans up a %s interruption and offers a clear recovery',
  async kind => {
    await render();
    await click();
    await act(async () => {
      if (kind === 'context')
        container.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost'));
      else tracks[0].dispatchEvent(new Event('ended'));
    });
    expectClosed('error');
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    expect(popup.close).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  },
);

it('cleans up a manually closed popup, leaving the lecture, and unmounting', async () => {
  await render();
  await click();
  await act(async () => popup.close());
  expectClosed();
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  popup = new Popup();
  await click();
  await render({ active: false });
  expectClosed();
  expect(tracks[1].stop).toHaveBeenCalledOnce();
  await render();
  popup = new Popup();
  await click();
  await act(async () => root.render(null));
  expect(tracks[2].stop).toHaveBeenCalledOnce();
  expect(popup.close).toHaveBeenCalledOnce();
});

it('detects window closure even when the browser omits pagehide', async () => {
  vi.useFakeTimers();
  await render();
  await click();
  popup.closed = true;
  await act(async () => vi.advanceTimersByTime(1000));
  expectClosed();
  expect(tracks[0].stop).toHaveBeenCalledOnce();
});

it('does not revive a closed audience window when playback starts late', async () => {
  let finish!: () => void;
  vi.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(
    new Promise<void>(resolve => {
      finish = resolve;
    }),
  );
  await render();
  await click();
  expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('opening');
  await click('Close audience window');
  await act(async () => finish());
  expectClosed();
  expect(tracks[0].stop).toHaveBeenCalledOnce();
});

it('renders public biology without controls and copies only local styles plus the theme', async () => {
  const local = document.createElement('link');
  local.rel = 'stylesheet';
  local.href = '/local-lecture.css';
  const external = document.createElement('link');
  external.rel = 'stylesheet';
  external.href = 'https://example.org/private.css';
  document.head.append(local, external);
  document.documentElement.dataset.formaTheme = 'clinical';
  try {
    await render({ content: { ...publicContent, biology: 'compression' } });
    await click();
    expect(popup.document.body.textContent).toContain('Osteoclast');
    expect(popup.document.querySelector('button,a,input')).toBeNull();
    expect(popup.document.documentElement.dataset.formaTheme).toBe('clinical');
    const links = [...popup.document.querySelectorAll('link')].map(link => link.href);
    expect(links).toContain(local.href);
    expect(links).not.toContain(external.href);
    expect(links).toContain(new URL('/audience.css', location.href).href);
    await act(async () => {
      document.documentElement.dataset.formaTheme = 'midnight';
    });
    expect(popup.document.documentElement.dataset.formaTheme).toBe('midnight');
  } finally {
    local.remove();
    external.remove();
  }
});

function publicLabels(canvas: HTMLCanvasElement, id: string) {
  const source = createPublicOverlaySource(canvas, {
    teeth: [{ id, x: 500, y: 350, visible: true, selected: false }],
    surfaces: [],
    anatomy: [],
  });
  Object.assign(source.frame, { width: 1000, height: 700, ready: true });
  source.publish();
  return source;
}
function readyAudienceVideo() {
  const video = popup.document.querySelector('video')!;
  for (const [name, value] of Object.entries({
    clientWidth: 600,
    clientHeight: 600,
    videoWidth: 2000,
    videoHeight: 1400,
    readyState: 4,
  }))
    Object.defineProperty(video, name, { configurable: true, value });
  video.dispatchEvent(new Event('loadedmetadata'));
  video.dispatchEvent(new Event('playing'));
}

it('binds public labels to each canvas generation, including replacement through an empty host', async () => {
  await render();
  const oldCanvas = container.querySelector('canvas')!;
  const original = publicLabels(oldCanvas, '11');
  const privateLabel = document.createElement('span');
  privateLabel.className = 'tooth-label';
  privateLabel.textContent = 'PRIVATE DOM TEXT';
  oldCanvas.parentElement!.append(privateLabel);
  const replacementCanvas = document.createElement('canvas');
  const replacement = publicLabels(replacementCanvas, '22');
  try {
    await click();
    const overlay = () => popup.document.querySelector<HTMLElement>('.audience-overlays')!;
    expect(overlay().hidden).toBe(true);
    await act(async () => readyAudienceVideo());
    expect(overlay().textContent).toBe('11');
    expect(overlay().hidden).toBe(false);
    expect(popup.document.body.textContent).not.toContain('PRIVATE DOM TEXT');

    const emptyHost = document.createElement('div');
    emptyHost.className = 'three-canvas';
    await act(async () => oldCanvas.parentElement!.replaceWith(emptyHost));
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    expect(overlay().hidden).toBe(true);
    expect(popup.document.querySelector('video')?.srcObject).toBeNull();
    await act(async () => emptyHost.append(replacementCanvas));
    expect(capture).toHaveBeenCalledTimes(2);
    expect(popup.document.querySelector('video')?.srcObject).toBe(streams[1]);
    expect(overlay().hidden).toBe(true);
    original.frame.teeth[0].id = 'OLD SOURCE';
    original.publish();
    expect(overlay().hidden).toBe(true);
    await act(async () => readyAudienceVideo());
    expect(overlay().textContent).toBe('22');
    expect(overlay().hidden).toBe(false);
    original.dispose();
    expect(overlay().hidden).toBe(false);
    await click('Close audience window');
    replacement.publish();
    expect(popup.document.querySelector('.audience-overlays')).toBeNull();
  } finally {
    original.dispose();
    replacement.dispose();
  }
});

it('projects public mechanics qualifications without notes or answer leakage', async () => {
  await render({
    content: {
      ...publicContent,
      modelCaption: 'Initial elastic response · magnified 20×',
      vectorLegend: true,
      separation: 8,
    },
  });
  await click();
  const caption = popup.document.querySelector('[aria-label="Model display explanation"]');
  expect(caption?.textContent).toContain('Initial elastic response · magnified 20×');
  expect(caption?.textContent).toContain('Arrow size is schematic');
  expect(caption?.textContent).toContain('Display separation 8 mm');
  expect(popup.document.body.textContent).not.toContain('PRIVATE');
  expect(popup.document.querySelector('button,input,textarea')).toBeNull();
  await render();
  expect(popup.document.querySelector('[aria-label="Model display explanation"]')).toBeNull();
});
