import { validateLectureDocument } from './documents';
import type { LectureDocument, LectureStorage } from './types';

export const LECTURE_LIBRARY_KEY = 'forma-lecture-library-v1';
export const MAX_LECTURE_BYTES = 10 * 1024 * 1024;
const MAX_LIBRARY_BYTES = 25 * 1024 * 1024;

function checkSize(text: string, maximum: number) {
  if (text.length > maximum || new TextEncoder().encode(text).byteLength > maximum)
    throw new Error('Lecture data exceeds the supported file size.');
}

export function parseLectureDocument(text: string): LectureDocument {
  checkSize(text, MAX_LECTURE_BYTES);
  return validateLectureDocument(JSON.parse(text));
}

export function serializeLectureDocument(document: LectureDocument): string {
  const text = JSON.stringify(validateLectureDocument(document));
  checkSize(text, MAX_LECTURE_BYTES);
  return text;
}

function validateLibrary(raw: unknown): LectureDocument[] {
  if (!Array.isArray(raw) || raw.length > 100)
    throw new Error('A lecture library may contain at most 100 lectures.');
  const documents = raw.map(validateLectureDocument);
  if (new Set(documents.map(document => document.id)).size !== documents.length)
    throw new Error('Lecture library identifiers must be unique.');
  return documents;
}

/** Read/parse failures deliberately propagate; a browser adapter must not overwrite corrupt data. */
export function readLectureLibrary(storage: Pick<LectureStorage, 'getItem'>): LectureDocument[] {
  const text = storage.getItem(LECTURE_LIBRARY_KEY);
  if (text === null) return [];
  checkSize(text, MAX_LIBRARY_BYTES);
  return validateLibrary(JSON.parse(text));
}

/** Validate completely before the sole write; quota/permission failures propagate to the caller. */
export function saveLectureLibrary(
  storage: Pick<LectureStorage, 'setItem'>,
  documents: LectureDocument[],
): void {
  const text = JSON.stringify(validateLibrary(documents));
  checkSize(text, MAX_LIBRARY_BYTES);
  storage.setItem(LECTURE_LIBRARY_KEY, text);
}
