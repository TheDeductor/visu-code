import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@astryxdesign/core/theme';
import { vibemapTheme } from './theme';
import { App } from './App';
import './styles.css';

export function Root(): React.ReactElement {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('vibemap:theme-mode');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light'; // Light theme as default
  });

  useEffect(() => {
    localStorage.setItem('vibemap:theme-mode', themeMode);
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const mode = (e as CustomEvent<'light' | 'dark'>).detail;
      if (mode === 'light' || mode === 'dark') {
        setThemeMode(mode);
      }
    };
    window.addEventListener('vibemap:theme-change', handleCustomChange);
    return () => window.removeEventListener('vibemap:theme-change', handleCustomChange);
  }, []);

  return (
    <Theme theme={vibemapTheme} mode={themeMode}>
      <App themeMode={themeMode} onThemeChange={setThemeMode} />
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
