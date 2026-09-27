'use client';
import { useEffect, useRef, useState } from 'react';
import {
  readLectureLibrary,
  saveLectureLibrary,
  parseLectureDocument,
  serializeLectureDocument,
  type LectureDocument,
  MAX_LECTURE_BYTES,
} from '@/lib/lecture-documents';

export function useLectureLibrary() {
  const [documents, setDocuments] = useState<LectureDocument[]>([]);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Loading saved lectures…');
  const current = useRef<LectureDocument[]>([]),
    writable = useRef(false);
  useEffect(() => {
    try {
      const saved = readLectureLibrary(localStorage);
      current.current = saved;
      writable.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate browser-only storage after static HTML mounts
      setDocuments(saved);
      setSaveStatus('Saved on this device');
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : 'Saved lectures could not be read.'} Existing storage has been preserved. Export any new work as a backup.`,
      );
      setSaveStatus('Not saved on this device · export a backup');
    }
  }, []);
  const store = (next: LectureDocument[]) => {
    current.current = next;
    setDocuments(next);
    if (!writable.current) return;
    try {
      saveLectureLibrary(localStorage, next);
      setSaveStatus('Saved on this device');
      setError('');
    } catch (cause) {
      setSaveStatus('Not saved on this device · export a backup');
      setError(cause instanceof Error ? cause.message : 'Storage is unavailable. Export a backup.');
    }
  };
  const put = (document: LectureDocument) => {
    const next = { ...document, updatedAt: new Date().toISOString() };
    store([...current.current.filter(item => item.id !== document.id), next]);
  };
  return {
    documents,
    error,
    saveStatus,
    put,
    get: (id: string) => current.current.find(item => item.id === id),
    remove: (id: string) => store(current.current.filter(item => item.id !== id)),
    importFile: async (file: File) => {
      if (file.size > MAX_LECTURE_BYTES)
        throw new Error('Choose a lecture backup smaller than 10 MiB.');
      const imported = parseLectureDocument(await file.text());
      // Import a copy, so a backup never silently overwrites later local edits.
      const copy = {
        ...imported,
        id: crypto.randomUUID(),
        title: `${imported.title} (imported)`.slice(0, 120),
      };
      put(copy);
      return copy;
    },
    exportFile: (document: LectureDocument) => {
      const url = URL.createObjectURL(
        new Blob([serializeLectureDocument(document)], { type: 'application/json' }),
      );
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${document.title.replace(/[^a-z0-9 -]/gi, '').trim() || 'lecture'}.forma-lecture.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
