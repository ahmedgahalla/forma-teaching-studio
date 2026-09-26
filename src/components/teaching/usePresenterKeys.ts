import { useEffect } from 'react';

function isVisible(element: Element): boolean {
  if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

export function hasOpenTeachingOverlay(): boolean {
  const overlays = document.querySelectorAll(
    'dialog[open],[role="dialog"],[role="alertdialog"],[role="menu"],' +
      'details[open]:is(.opening-menu,.opening-view-menu,.lecture-variant-picker,.stage-options),' +
      '[aria-haspopup="menu"][aria-expanded="true"]',
  );
  return [...overlays].some(isVisible);
}

export function usePresenterKeys(runControl: (text: string) => void, toggleHandsFree: () => void) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
          ))
      )
        return;
      if (hasOpenTeachingOverlay()) return;
      const command = ['PageDown', 'ArrowRight'].includes(event.key)
        ? 'next step'
        : ['PageUp', 'ArrowLeft'].includes(event.key)
          ? 'previous step'
          : null;
      if (command) {
        event.preventDefault();
        runControl(command);
      } else if (['m', 'b', '.'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        toggleHandsFree();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [runControl, toggleHandsFree]);
}
