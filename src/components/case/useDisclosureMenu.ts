'use client';
import { useEffect, useRef } from 'react';

export function useDisclosureMenu({ closeOnAction = false }: { closeOnAction?: boolean } = {}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const close = () => {
      menu.open = false;
      if (menu.contains(document.activeElement)) summaryRef.current?.focus();
    };
    const action = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('button')) close();
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.open) {
        event.preventDefault();
        close();
      }
    };
    if (closeOnAction) menu.addEventListener('click', action);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      if (closeOnAction) menu.removeEventListener('click', action);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [closeOnAction]);
  return { menuRef, summaryRef };
}
