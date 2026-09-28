'use client';
import type { TeachingAction } from '@/lib/lecture';
import './JawControl.css';

export type JawControlProps = {
  jawAvailable?: boolean;
  jawOpen?: boolean;
  execute: (actions: TeachingAction[], summary: string) => Promise<void>;
};

export function JawControl({ jawAvailable, jawOpen = false, execute }: JawControlProps) {
  if (!jawAvailable) return null;
  const label = jawOpen ? 'Close jaw' : 'Open jaw';
  return (
    <button
      className="jaw-control"
      type="button"
      aria-pressed={jawOpen}
      title="Hinged display opening; tooth movements and mechanics are unchanged"
      onClick={() => void execute([{ kind: 'jaw', open: !jawOpen }], label)}
    >
      {label}
    </button>
  );
}
