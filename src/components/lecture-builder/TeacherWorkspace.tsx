'use client';
import type { TeacherLectures } from './useTeacherLectures';
import { LecturePanel } from './LecturePanel';

export function TeacherWorkspace({ teacher }: { teacher: TeacherLectures }) {
  return teacher.panelProps ? <LecturePanel {...teacher.panelProps} /> : null;
}
