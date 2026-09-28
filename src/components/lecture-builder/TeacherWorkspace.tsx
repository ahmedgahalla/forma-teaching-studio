'use client';
import type { TeacherLectures } from './useTeacherLectures';
import { LecturePanel } from './LecturePanel';

export function TeacherWorkspace({
  teacher,
  audienceOpen = false,
}: {
  teacher: TeacherLectures;
  audienceOpen?: boolean;
}) {
  return teacher.panelProps ? (
    <LecturePanel {...teacher.panelProps} audienceOpen={audienceOpen} />
  ) : null;
}
