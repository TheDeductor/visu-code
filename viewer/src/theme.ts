import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

/**
 * Custom Astryx theme for VibeMap, extending theme-neutral.
 * Colors are taken directly from the existing viewer CSS variables (styles.css).
 */
export const vibemapTheme = defineTheme({
  name: 'vibemap',
  extends: neutralTheme,
  tokens: {
    // Accent colors
    '--color-accent': ['#1971c2', '#4dabf7'],
    '--color-accent-muted': ['#e7f5ff', '#17324a'],
    '--color-text-accent': ['#1971c2', '#4dabf7'],
    '--color-icon-accent': ['#1971c2', '#4dabf7'],

    // Backgrounds
    '--color-background-body': ['#f5f6f8', '#14171c'],
    '--color-background-surface': ['#ffffff', '#1c2027'],
    '--color-background-card': ['#ffffff', '#1c2027'],
    '--color-background-popover': ['#ffffff', '#222831'],
    '--color-background-muted': ['#f1f3f5', '#222831'],

    // Borders
    '--color-border': ['#dee2e6', '#333b46'],
    '--color-border-emphasized': ['#ced4da', '#414b58'],

    // Text & Icons
    '--color-text-primary': ['#212529', '#e9ecef'],
    '--color-text-secondary': ['#6c757d', '#9aa4b2'],
    '--color-icon-primary': ['#212529', '#e9ecef'],
    '--color-icon-secondary': ['#6c757d', '#9aa4b2'],

    // Status colors
    '--color-success': ['#2f9e44', '#2f9e44'],
    '--color-warning': ['#e67700', '#e67700'],
    '--color-error': ['#e03131', '#e03131'],
  },
});
