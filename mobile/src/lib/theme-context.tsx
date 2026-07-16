import { createContext, useContext, useEffect, useState } from 'react';
import { readCache, writeCache } from '@/lib/cache';

export type ThemeName = 'light' | 'dark' | 'cyberpunk' | 'emerald' | 'rosegold';

type ThemeContextType = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'dark',
  setThemeName: () => {},
});

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>('dark');

  useEffect(() => {
    (async () => {
      const saved = await readCache<ThemeName>('selected_theme');
      if (saved) setThemeNameState(saved);
    })();
  }, []);

  const setThemeName = (name: ThemeName) => {
    setThemeNameState(name);
    writeCache('selected_theme', name);
  };

  return <ThemeContext.Provider value={{ themeName, setThemeName }}>{children}</ThemeContext.Provider>;
}

export const useCustomTheme = () => useContext(ThemeContext);
