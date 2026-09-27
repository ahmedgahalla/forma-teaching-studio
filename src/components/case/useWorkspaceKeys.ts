import { useEffect, type RefObject } from 'react';

export function useWorkspaceKeys({
  active,
  runControl,
  setMobilePanel,
  setToolsOpen,
  setCommandsOpen,
  commandInput,
}: {
  active: boolean;
  runControl: (text: string) => Promise<void>;
  setMobilePanel: (panel: 'model') => void;
  setToolsOpen: (open: boolean) => void;
  setCommandsOpen: (open: boolean) => void;
  commandInput: RefObject<HTMLInputElement | null>;
}) {
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        (event.target instanceof Element &&
          event.target.closest('input, textarea, select, dialog, [contenteditable]'))
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        void runControl(event.shiftKey ? 'redo' : 'undo that');
      }
      if (event.key === 'Escape') {
        setMobilePanel('model');
        setToolsOpen(false);
      }
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setCommandsOpen(true);
        requestAnimationFrame(() => commandInput.current?.focus());
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, runControl, setMobilePanel, setToolsOpen, setCommandsOpen, commandInput]);
}
