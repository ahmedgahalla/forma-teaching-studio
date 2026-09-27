'use client';
import type { TeacherLectures } from './useTeacherLectures';
import { LectureLibrary } from './LectureLibrary';
import { LecturePanel } from './LecturePanel';

export function TeacherWorkspace({ teacher }: { teacher: TeacherLectures }) {
  if (teacher.session.screen === 'library')
    return (
      <div className="teacher-library-screen">
        <LectureLibrary {...teacher.libraryProps} />
      </div>
    );
  return teacher.panelProps ? <LecturePanel {...teacher.panelProps} /> : null;
}
