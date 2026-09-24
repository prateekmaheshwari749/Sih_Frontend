import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'light';
export type FontSize = 'normal' | 'large' | 'larger';
export type Language = 'en' | 'hi';

interface ThemeContextType {
  theme: Theme;
  isLight: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Permanently locked to 'light' mode
  const theme: Theme = 'light';
  const language: Language = 'en';

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const saved = localStorage.getItem('ocean_font_size');
    return (saved === 'normal' || saved === 'large' || saved === 'larger') ? saved : 'normal';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('light');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    localStorage.setItem('ocean_theme', 'light');
    localStorage.setItem('ocean_language', 'en');
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === 'large') {
      root.style.fontSize = '17px';
    } else if (fontSize === 'larger') {
      root.style.fontSize = '18.5px';
    } else {
      root.style.fontSize = '16px';
    }
    localStorage.setItem('ocean_font_size', fontSize);
  }, [fontSize]);

  // Safe no-ops for theme and language setters
  const toggleTheme = useCallback(() => {}, []);
  const setTheme = useCallback(() => {}, []);
  const setFontSize = useCallback((s: FontSize) => {
    setFontSizeState(s);
  }, []);
  const setLanguage = useCallback(() => {}, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isLight: true,
        toggleTheme,
        setTheme,
        fontSize,
        setFontSize,
        language,
        setLanguage,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
