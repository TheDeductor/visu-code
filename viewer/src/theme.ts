import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

/**
 * Astryx theme for the viewer.
 * Values mirror the CSS tokens in styles.css so the library and the
 * hand-written surfaces resolve to the same palette.
 */
export const vibemapTheme = defineTheme({
  name: 'vibemap',
  extends: neutralTheme,
  tokens: {
    // Accent
    '--color-accent': ['#1668b3', '#6bb4f0'],
    '--color-accent-muted': ['#eaf2fa', '#152b3c'],
    '--color-text-accent': ['#125a9c', '#8ac6f5'],
    '--color-icon-accent': ['#1668b3', '#6bb4f0'],

    // Surfaces
    '--color-background-body': ['#f6f7f9', '#101418'],
    '--color-background-surface': ['#ffffff', '#161b21'],
    '--color-background-card': ['#ffffff', '#161b21'],
    '--color-background-popover': ['#ffffff', '#1c2229'],
    '--color-background-muted': ['#f3f5f7', '#1c2229'],

    // Borders
    '--color-border': ['#e3e7ec', '#273039'],
    '--color-border-emphasized': ['#cdd4dc', '#3a4550'],

    // Text and icons
    '--color-text-primary': ['#1b2430', '#e7ecf2'],
    '--color-text-secondary': ['#5f6b7a', '#9ba6b4'],
    '--color-icon-primary': ['#2f3a47', '#d5dce4'],
    '--color-icon-secondary': ['#5f6b7a', '#9ba6b4'],

    // Status
    '--color-success': ['#1f7a33', '#63c97c'],
    '--color-warning': ['#8a4b00', '#efb366'],
    '--color-error': ['#b42318', '#f0847a'],
  },
});
