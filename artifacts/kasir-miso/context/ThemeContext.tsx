import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import colors, { defaultTheme, ThemeId } from '@/constants/colors';

export type ThemeMode = 'light' | 'dark';
interface ThemeValue {
  mode: ThemeMode;
  themeId: ThemeId;
  selectTheme: (themeId: ThemeId) => void;
  toggleMode: () => void;
}
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [themeId, setThemeId] = useState<ThemeId>(defaultTheme);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem('warung-theme'), AsyncStorage.getItem('warung-theme-id')])
      .then(([savedMode, savedTheme]) => {
        if (!mounted) return;
        if (savedMode === 'dark' || savedMode === 'light') setMode(savedMode);
        if (savedTheme && Object.prototype.hasOwnProperty.call(colors, savedTheme)) setThemeId(savedTheme as ThemeId);
      })
      .finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, []);
  const value = useMemo(() => ({
    mode,
    themeId,
    selectTheme: (nextTheme: ThemeId) => setThemeId(nextTheme),
    toggleMode: () => setMode(current => current === 'light' ? 'dark' : 'light'),
  }), [mode, themeId]);
  useEffect(() => { if (hydrated) void AsyncStorage.setItem('warung-theme', mode); }, [hydrated, mode]);
  useEffect(() => { if (hydrated) void AsyncStorage.setItem('warung-theme-id', themeId); }, [hydrated, themeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const value = useContext(ThemeContext); if (!value) throw new Error('useTheme harus dipakai di dalam ThemeProvider'); return value; }