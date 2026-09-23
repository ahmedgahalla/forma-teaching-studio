'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

export type StudioTheme = 'midnight' | 'clinical';
const ThemeContext = createContext<{ theme: StudioTheme; setTheme: (theme: StudioTheme) => void }>({ theme: 'midnight', setTheme: () => {} });

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<StudioTheme>('midnight');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('forma-studio-theme');
      if (saved === 'clinical' || saved === 'midnight') { updateTheme(saved); document.documentElement.dataset.formaTheme = saved; }
    } catch { /* Theme switching also works without persistent browser storage. */ }
  }, []);
  const setTheme = (next: StudioTheme) => {
    updateTheme(next);
    document.documentElement.dataset.formaTheme = next;
    try { localStorage.setItem('forma-studio-theme', next); } catch { /* Session preference remains usable. */ }
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useStudioTheme = () => useContext(ThemeContext);

export function StudioThemeToggle() {
  const { theme, setTheme } = useStudioTheme();
  const label = `Switch to ${theme === 'midnight' ? 'Clinical Studio (light)' : 'Midnight Lab (dark)'}`;
  return <button type="button" className="studio-theme-toggle" aria-label={label} title={label} onClick={() => setTheme(theme === 'midnight' ? 'clinical' : 'midnight')}>
    {theme === 'midnight' ? <Moon size={17} /> : <Sun size={17} />}<span>{theme === 'midnight' ? 'Midnight' : 'Clinical'}</span>
  </button>;
}
