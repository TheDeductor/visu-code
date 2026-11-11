# Astryx Setup Documentation

## Package Installation

The following packages were installed with exact versions (no `^` or `~`):
- `@astryxdesign/core`: `0.7.13`
- `@stylexjs/stylex`: `0.19.1`
- `@astryxdesign/theme-neutral`: `0.7.13`
- `@astryxdesign/cli`: `0.7.13` (dev dependency)

## Package.json Scripts

Added to `package.json` scripts:
```json
"astryx": "node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs"
```

## CSS Imports

Following the Astryx Quick Start for Vite, the pre-built CSS was imported in order (respecting the CSS layer cascade: reset -> base components -> theme tokens):
In `viewer/src/styles.css`:
```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css';
```

## Provider Setup

In `viewer/src/main.tsx`, the root React application is wrapped in Astryx's `Theme` provider initialized with `neutralTheme`:
```tsx
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme theme={neutralTheme}>
      <App />
    </Theme>
  </React.StrictMode>,
);
```

## Build Verification

Both `npm run typecheck` and `npm run build` (`build:web` and `build:cli`) pass cleanly with exit code 0.
