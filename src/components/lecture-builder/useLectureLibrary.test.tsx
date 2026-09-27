// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createLectureDocument,
  LECTURE_LIBRARY_KEY,
  parseLectureDocument,
  readLectureLibrary,
  saveLectureLibrary,
  serializeLectureDocument,
  type LectureDocument,
} from '@/lib/lecture-documents';
import { fixtureScene } from '@/lib/lecture-documents/documents.fixtures';
import { useLectureLibrary } from './useLectureLibrary';

let root: Root, container: HTMLDivElement, library: ReturnType<typeof useLectureLibrary>;
function Probe() {
  const current = useLectureLibrary();
  useEffect(() => {
    library = current;
  }, [current]);
  return (
    <>
      <output>{current.saveStatus}</output>
      <p role="alert">{current.error}</p>
    </>
  );
}
const lecture = () => createLectureDocument(fixtureScene(), 'Movement lecture');
const status = () => container.querySelector('output')!.textContent;
const error = () => container.querySelector('[role="alert"]')!.textContent;
const mount = () => act(async () => root.render(<Probe />));
const put = (document: LectureDocument) => act(async () => library.put(document));
function backup(document: LectureDocument) {
  const text = serializeLectureDocument(document);
  const file = new File([text], 'lecture.forma-lecture.json', { type: 'application/json' });
  // jsdom's File omits text(); supply the actual backup bytes at this browser boundary.
  Object.defineProperty(file, 'text', { value: async () => text });
  return file;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('hydrates saved documents without rewriting browser storage', async () => {
  const saved = lecture();
  saved.steps[0].notes = 'Ask students to predict before revealing.';
  saveLectureLibrary(localStorage, [saved]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await mount();
  expect(library.documents).toEqual([saved]);
  expect(library.get(saved.id)).toEqual(saved);
  expect(status()).toBe('Saved on this device');
  expect(error()).toBe('');
  expect(write).not.toHaveBeenCalled();
});

it('saves edits without mutating their input and reopens the same scene and notes', async () => {
  await mount();
  const input = lecture();
  input.updatedAt = '2026-01-01T00:00:00.000Z';
  input.steps[0].notes = 'Keep this explanation with the shown arrangement.';
  const before = structuredClone(input);
  Object.freeze(input);
  await put(input);
  expect(input).toEqual(before);
  const saved = readLectureLibrary(localStorage)[0];
  expect(saved.updatedAt).not.toBe(before.updatedAt);
  expect(saved.steps).toEqual(before.steps);
  expect(status()).toBe('Saved on this device');
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount();
  expect(library.get(input.id)).toEqual(saved);
  expect(library.documents).toHaveLength(1);
});

it('imports an independent copy without overwriting newer local edits or changing the backup', async () => {
  const original = lecture(),
    file = backup(original),
    before = structuredClone(original);
  saveLectureLibrary(localStorage, [{ ...original, title: 'Newer local version' }]);
  await mount();
  let imported!: LectureDocument;
  await act(async () => {
    imported = await library.importFile(file);
  });
  expect(imported.id).not.toBe(original.id);
  expect(imported.title).toBe('Movement lecture (imported)');
  expect(imported.steps).toEqual(original.steps);
  expect(original).toEqual(before);
  expect(parseLectureDocument(await file.text())).toEqual(before);
  expect(library.get(original.id)?.title).toBe('Newer local version');
  expect(library.get(imported.id)?.steps).toEqual(before.steps);
  expect(readLectureLibrary(localStorage)).toHaveLength(2);
  expect(status()).toBe('Saved on this device');
});

it('exports a validated immutable backup and releases the download URL', async () => {
  await mount();
  await put(lecture());
  const saved = library.documents[0],
    before = structuredClone(saved);
  const stored = localStorage.getItem(LECTURE_LIBRARY_KEY);
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:lecture-backup'),
    revokeObjectURL = vi.fn();
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.useFakeTimers();
  await act(async () => library.exportFile(saved));
  expect(click).toHaveBeenCalledOnce();
  const link = click.mock.contexts[0] as HTMLAnchorElement;
  const blob = createObjectURL.mock.calls[0][0] as unknown as Blob;
  expect(blob.type).toBe('application/json');
  expect(parseLectureDocument(await blob.text())).toEqual(before);
  expect(link.download).toBe('Movement lecture.forma-lecture.json');
  expect(link.href).toBe('blob:lecture-backup');
  expect(saved).toEqual(before);
  expect(localStorage.getItem(LECTURE_LIBRARY_KEY)).toBe(stored);
  expect(revokeObjectURL).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:lecture-backup');
});

it('preserves corrupt storage while keeping new work available in memory with a visible warning', async () => {
  const corrupt = '{recoverable original bytes';
  localStorage.setItem(LECTURE_LIBRARY_KEY, corrupt);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await mount();
  expect(library.documents).toEqual([]);
  expect(error()).toContain('Existing storage has been preserved');
  expect(status()).toContain('Not saved');
  const fresh = lecture();
  await put(fresh);
  await put({ ...library.get(fresh.id)!, title: 'Recovered session work' });
  expect(library.get(fresh.id)?.title).toBe('Recovered session work');
  expect(error()).toContain('Existing storage has been preserved');
  expect(status()).toContain('Not saved');
  expect(localStorage.getItem(LECTURE_LIBRARY_KEY)).toBe(corrupt);
  expect(write).not.toHaveBeenCalled();
});

it('retains edits and reports a quota failure, then saves all edits when storage recovers', async () => {
  const original = lecture();
  saveLectureLibrary(localStorage, [original]);
  const stored = localStorage.getItem(LECTURE_LIBRARY_KEY);
  await mount();
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
  });
  const draft = { ...original, title: 'Unsaved local changes' };
  await put(draft);
  expect(library.get(original.id)?.title).toBe(draft.title);
  expect(status()).toContain('Not saved');
  expect(error()).toMatch(/Storage.*(?:quota|unavailable)/i);
  expect(localStorage.getItem(LECTURE_LIBRARY_KEY)).toBe(stored);
  write.mockRestore();
  await put(library.get(original.id)!);
  expect(readLectureLibrary(localStorage)[0].title).toBe(draft.title);
  expect(status()).toBe('Saved on this device');
  expect(error()).toBe('');
});

it.each(['lecture', 'step'] as const)(
  'keeps a blank %s title draft and its notes until a valid title can be saved',
  async target => {
    const original = lecture();
    saveLectureLibrary(localStorage, [original]);
    const stored = localStorage.getItem(LECTURE_LIBRARY_KEY);
    await mount();
    const draft = structuredClone(original);
    if (target === 'lecture') draft.title = '';
    else draft.steps[0].title = '';
    draft.steps[0].notes = 'New explanation typed while the title is temporarily blank.';
    await put(draft);
    expect(library.get(original.id)?.steps).toEqual(draft.steps);
    expect(library.get(original.id)?.title).toBe(draft.title);
    expect(status()).toContain('Not saved');
    expect(error()).not.toBe('');
    expect(localStorage.getItem(LECTURE_LIBRARY_KEY)).toBe(stored);
    const repaired = structuredClone(library.get(original.id)!);
    if (target === 'lecture') repaired.title = 'Renamed lecture';
    else repaired.steps[0].title = 'Renamed step';
    await put(repaired);
    const saved = readLectureLibrary(localStorage)[0];
    expect(saved.title).toBe(repaired.title);
    expect(saved.steps).toEqual(repaired.steps);
    expect(saved.steps[0].notes).toBe(draft.steps[0].notes);
    expect(status()).toBe('Saved on this device');
    expect(error()).toBe('');
  },
);
