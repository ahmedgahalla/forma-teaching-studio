// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeachingCommandBar, TeachingProvider, useTeaching, useTeachingAdapter } from './TeachingController';
import type { SpeechRecognitionLike, SpeechResultEvent } from '../lib/speech';
import type { TeachingAction } from '../lib/lecture';

class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { FakeRecognition.instances.push(this); }
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn();
  abort = vi.fn();
  result(text: string, final = true) { this.onresult?.({ resultIndex: 0, results: [{ isFinal: final, 0: { transcript: text } }] }); }
}
class FakeUtterance {
  lang = ''; rate = 1; onend: (() => void) | null = null; onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}
type Scene = { selected: string; roots: boolean; gums: boolean };
let teaching: ReturnType<typeof useTeaching>, root: Root, container: HTMLDivElement;
let asyncSelection: Promise<void> | undefined;
const applied = vi.fn(), paused = vi.fn(), preflight = vi.fn();
const captured: Scene[] = [], spoken: FakeUtterance[] = [];
const synthesis = { cancel: vi.fn(), speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)) };

function Harness() {
  teaching = useTeaching();
  const [scene, setScene] = useState<Scene>({ selected: '11', roots: false, gums: true });
  useTeachingAdapter('case', {
    context: () => ({ mode: 'case', workflowId: null, stepIndex: 0, selected: scene.selected, selectedIds: [scene.selected], availableIds: ['11', '21'], synthetic: true, view: 'front', arch: 'both', speed: 1, playing: false, lessonActive: true, layers: { roots: scene.roots, gums: scene.gums } }),
    capture: () => { const value = { ...scene }; captured.push(value); return value; },
    restore: snapshot => setScene(snapshot as Scene),
    preflight, pause: paused, narration: () => `Current target is tooth ${scene.selected}.`,
    apply: action => {
      applied(action);
      if (action.kind === 'select') {
        if (asyncSelection) return asyncSelection.then(() => {
          // Production's async mechanics adapter commits React state before resolving.
          flushSync(() => setScene(previous => ({ ...previous, selected: action.teeth[0] })));
          return true;
        });
        setScene(previous => ({ ...previous, selected: action.teeth[0] }));
      }
      if (action.kind === 'toggle' && (action.target === 'roots' || action.target === 'gums')) setScene(previous => ({ ...previous, [action.target]: action.visible }));
      return true;
    },
  });
  return <><output data-testid="scene">{JSON.stringify(scene)}</output><button data-testid="reference" onClick={() => { teaching.referenceInteraction(); setScene(previous => ({ ...previous, selected: '21' })); }}>Point at tooth 21</button><TeachingCommandBar /></>;
}
function key(type: 'keydown' | 'keyup', code = 'Space', options: KeyboardEventInit = {}) {
  document.body.dispatchEvent(new KeyboardEvent(type, { key: code === 'Space' ? ' ' : code, code, bubbles: true, cancelable: true, ...options }));
}
async function start() { await act(async () => { key('keydown'); }); return FakeRecognition.instances.at(-1)!; }
async function finish(recognition: FakeRecognition, text = 'show roots') {
  await act(async () => { recognition.result(text); key('keyup'); recognition.onend?.(); });
}
function scene(): Scene { return JSON.parse(container.querySelector('[data-testid="scene"]')!.textContent!); }

beforeEach(async () => {
  vi.clearAllMocks(); FakeRecognition.instances = []; captured.length = 0; spoken.length = 0; asyncSelection = undefined;
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', synthesis);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => { root.render(<TeachingProvider><Harness /></TeachingProvider>); });
});
afterEach(async () => {
  await act(async () => { root.unmount(); }); container.remove(); vi.unstubAllGlobals();
});

describe('persistent teaching speech controller integration', () => {
  it('holds Space, displays interim speech and executes a repeated final exactly once after release/end', async () => {
    expect(FakeRecognition.instances).toHaveLength(0);
    const recognition = await start();
    expect(teaching.capture.phase).toBe('listening'); expect(recognition.start).toHaveBeenCalledTimes(1);
    await act(async () => { key('keydown', 'Space', { repeat: true }); recognition.result('show ro', false); });
    expect(FakeRecognition.instances).toHaveLength(1); expect(teaching.capture.transcript).toBe('show ro'); expect(applied).not.toHaveBeenCalled();
    const lateEnd = recognition.onend!;
    await act(async () => { recognition.result('show roots'); recognition.result('show roots'); key('keyup'); });
    expect(recognition.stop).toHaveBeenCalledTimes(1); expect(teaching.capture.phase).toBe('finishing'); expect(applied).not.toHaveBeenCalled();
    await act(async () => { recognition.onend?.(); lateEnd(); });
    expect(applied).toHaveBeenCalledExactlyOnceWith({ kind: 'toggle', target: 'roots', visible: true });
    expect(scene().roots).toBe(true); expect(teaching.capture.phase).toBe('idle'); expect(teaching.runtime.error).toBe(false);
  });
  it('keeps capture alive during a pointing reference and resolves the released command against the new target', async () => {
    const recognition = await start();
    await act(async () => { recognition.result('move it', false); (container.querySelector('[data-testid="reference"]') as HTMLButtonElement).click(); });
    expect(recognition.abort).not.toHaveBeenCalled(); expect(teaching.capture.phase).toBe('listening'); expect(scene().selected).toBe('21');
    await finish(recognition, 'move it buccally one millimeter');
    expect(teaching.runtime.error, teaching.runtime.message).toBe(false);
    expect(applied).toHaveBeenCalledTimes(1);
    const action = applied.mock.calls[0][0] as TeachingAction;
    expect(action.kind).toBe('dental');
    if (action.kind === 'dental') expect(action.command).toMatchObject({ type: 'move', tooth: '21', direction: 'buccal', amount: 1 });
  });
  it.each(['Escape', 'blur'] as const)('discards capture on %s and ignores late recognizer callbacks', async reason => {
    const recognition = await start(), lateResult = recognition.onresult!, lateEnd = recognition.onend!;
    await act(async () => { recognition.result('show roots'); if (reason === 'Escape') key('keydown', 'Escape'); else window.dispatchEvent(new Event('blur')); });
    expect(recognition.abort).toHaveBeenCalledTimes(1); expect(teaching.capture.phase).toBe('idle');
    await act(async () => { key('keyup'); lateResult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'show roots' } }] }); lateEnd(); });
    expect(applied).not.toHaveBeenCalled(); expect(scene().roots).toBe(false);
    const next = await start(); expect(next).not.toBe(recognition); await finish(next); expect(scene().roots).toBe(true);
  });
  it('cancels unfinished speech on a manual scene interaction while preserving the pointing exception', async () => {
    const recognition = await start();
    await act(async () => { recognition.result('show roots'); teaching.interact(); key('keyup'); });
    expect(recognition.abort).toHaveBeenCalledTimes(1); expect(teaching.capture.phase).toBe('idle'); expect(applied).not.toHaveBeenCalled();
  });
  it('interrupts narration before starting the microphone and does not execute the remaining narrated request', async () => {
    let narration!: Promise<void>;
    await act(async () => { narration = teaching.run('explain this step then hide gums'); });
    expect(teaching.runtime.phase).toBe('speaking'); expect(spoken).toHaveLength(1);
    const before = synthesis.cancel.mock.calls.length;
    const recognition = await start();
    expect(synthesis.cancel.mock.calls.length).toBeGreaterThan(before); expect(teaching.capture.phase).toBe('listening');
    await act(async () => { spoken[0].onend?.(); await narration; });
    expect(applied).not.toHaveBeenCalled(); expect(scene().gums).toBe(true);
    await finish(recognition); expect(scene().roots).toBe(true);
  });
  it('awaits async adapter completion before reading narration context and recording the completed snapshot', async () => {
    let resolve!: () => void; asyncSelection = new Promise<void>(done => { resolve = done; });
    let request!: Promise<void>;
    await act(async () => { request = teaching.execute([{ kind: 'select', teeth: ['21'] }, { kind: 'narrate', target: 'step' }], 'Select and explain'); });
    expect(teaching.runtime.phase).toBe('executing'); expect(scene().selected).toBe('11'); expect(spoken).toHaveLength(0);
    await act(async () => { resolve(); });
    expect(scene().selected).toBe('21'); expect(spoken).toHaveLength(1); expect(spoken[0].text).toBe('Current target is tooth 21.');
    await act(async () => { spoken[0].onend?.(); await request; });
    expect(teaching.runtime.phase).toBe('idle'); expect(captured.at(-1)?.selected).toBe('21');
    await act(async () => { await teaching.run('undo that'); }); expect(scene().selected).toBe('11');
    await act(async () => { await teaching.run('redo that'); }); expect(scene().selected).toBe('21');
  });
  it('does not hijack Space while typing and retains one recognizer across provider rerenders', async () => {
    const input = container.querySelector('input')!;
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })); });
    expect(FakeRecognition.instances).toHaveLength(0);
    const recognition = await start();
    await act(async () => { (container.querySelector('[data-testid="reference"]') as HTMLButtonElement).click(); recognition.result('show roots', false); });
    expect(FakeRecognition.instances).toHaveLength(1); expect(recognition.abort).not.toHaveBeenCalled();
    await finish(recognition); expect(applied).toHaveBeenCalledTimes(1);
  });
});
