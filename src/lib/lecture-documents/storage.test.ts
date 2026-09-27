import { describe, expect, it, vi } from 'vitest';
import {
  createLectureDocument,
  LECTURE_LIBRARY_KEY,
  MAX_LECTURE_BYTES,
  parseLectureDocument,
  readLectureLibrary,
  saveLectureLibrary,
} from './index';
import { fixtureScene } from './documents.fixtures';

function memoryStorage(initial?: string) {
  const values = new Map(initial === undefined ? [] : [[LECTURE_LIBRARY_KEY, initial]]);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    values,
  };
}

describe('local lecture library', () => {
  it('treats only a missing key as an empty library and saves independent documents', () => {
    const storage = memoryStorage();
    expect(readLectureLibrary(storage)).toEqual([]);
    const first = createLectureDocument(fixtureScene(), 'One');
    const second = createLectureDocument(fixtureScene(), 'Two');
    saveLectureLibrary(storage, [second, first]);
    first.title = 'Unsaved change';
    const restored = readLectureLibrary(storage);
    expect(restored.map(document => document.title)).toEqual(['Two', 'One']);
    restored[0].steps[0].notes = 'Another unsaved change';
    expect(readLectureLibrary(storage)[0].steps[0].notes).toBe('');
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(storage.setItem.mock.calls[0][0]).toBe(LECTURE_LIBRARY_KEY);
  });

  it.each(['', '{broken', '{}', '[{"version":7}]', 'null'])(
    'preserves corrupt stored content %s for recovery',
    contents => {
      const storage = memoryStorage(contents);
      expect(() => readLectureLibrary(storage)).toThrow();
      expect(storage.values.get(LECTURE_LIBRARY_KEY)).toBe(contents);
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it('validates every document and duplicate ID before overwriting existing data', () => {
    const storage = memoryStorage('existing content');
    const document = createLectureDocument(fixtureScene());
    expect(() => saveLectureLibrary(storage, [document, document])).toThrow(/unique/);
    document.steps[0].scene.transforms['99'] = { translation: [0, 0, 0], rotation: [0, 0, 0] };
    expect(() => saveLectureLibrary(storage, [document])).toThrow();
    expect(storage.values.get(LECTURE_LIBRARY_KEY)).toBe('existing content');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('propagates unavailable storage and quota failures', () => {
    const denied = new Error('Storage denied'),
      quota = new Error('Quota exceeded');
    expect(() =>
      readLectureLibrary({
        getItem: () => {
          throw denied;
        },
      }),
    ).toThrow(denied);
    expect(() =>
      saveLectureLibrary(
        {
          setItem: () => {
            throw quota;
          },
        },
        [],
      ),
    ).toThrow(quota);
  });

  it('rejects oversized ASCII and UTF-8 input before JSON parsing', () => {
    expect(() => parseLectureDocument('!'.repeat(MAX_LECTURE_BYTES + 1))).toThrow(/file size/);
    expect(() => parseLectureDocument('牙'.repeat(Math.floor(MAX_LECTURE_BYTES / 3) + 1))).toThrow(
      /file size/,
    );
  });
});
