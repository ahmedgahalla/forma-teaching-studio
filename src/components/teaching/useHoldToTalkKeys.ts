import { useEffect } from 'react';
import { hasOpenTeachingOverlay } from './usePresenterKeys';

export function useHoldToTalkKeys(options: {
  enabled: boolean;
  held: () => boolean;
  start: () => void;
  finish: () => void;
  cancel: () => void;
  cancelCapture: () => void;
}) {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        options.cancel();
        return;
      }
      if (
        !options.enabled ||
        event.code !== 'Space' ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,select,button,summary,dialog,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
          )) ||
        hasOpenTeachingOverlay()
      )
        return;
      event.preventDefault();
      options.start();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space' && options.held()) {
        event.preventDefault();
        options.finish();
      }
    };
    const blur = () => options.cancelCapture();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [options]);
}
