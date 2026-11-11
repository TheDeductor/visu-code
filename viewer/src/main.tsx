import React from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@astryxdesign/core/theme';
import { vibemapTheme } from './theme';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme theme={vibemapTheme} mode="system">
      <App />
    </Theme>
  </React.StrictMode>,
);
